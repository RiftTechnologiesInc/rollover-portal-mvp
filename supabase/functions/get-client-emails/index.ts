// Supabase Edge Function: get-client-emails
// Returns client emails for advisors who have explicit access

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  clientIds: string[]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { clientIds }: RequestBody = await req.json()

    if (!Array.isArray(clientIds) || clientIds.length === 0) {
      return new Response(
        JSON.stringify({ emails: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const advisorId = user.id

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Validate advisor role
    const { data: advisorMembership } = await supabaseAdmin
      .from('firm_memberships')
      .select('firm_id, role')
      .eq('user_id', advisorId)
      .single()

    if (!advisorMembership || !['advisor', 'owner'].includes(advisorMembership.role)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Only allow emails for clients this advisor can access
    const { data: accessRows, error: accessError } = await supabaseAdmin
      .from('client_access')
      .select('client_id')
      .eq('advisor_id', advisorId)
      .in('client_id', clientIds)

    if (accessError) {
      throw new Error(accessError.message)
    }

    const allowedClientIds = (accessRows || []).map((row) => row.client_id)

    const emails = await Promise.all(
      allowedClientIds.map(async (clientId) => {
        const { data, error } = await supabaseAdmin.auth.admin.getUserById(clientId)
        if (error || !data?.user) return null
        return { id: clientId, email: data.user.email }
      })
    )

    return new Response(
      JSON.stringify({ emails: emails.filter(Boolean) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
