// Supabase Edge Function: invite-client
// Invites a client and grants access to the inviting advisor

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InviteClientRequest {
  email: string
  firstName: string
  lastName: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get request body
    const { email, firstName, lastName }: InviteClientRequest = await req.json()

    // Validate inputs
    if (!email || !firstName || !lastName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, firstName, lastName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with user's token (for auth check)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    )

    // Get the current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const advisorId = user.id

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Step 1: Get advisor's firm and validate role
    const { data: advisorMembership } = await supabaseAdmin
      .from('firm_memberships')
      .select('firm_id, role')
      .eq('user_id', advisorId)
      .single()

    if (!advisorMembership) {
      return new Response(
        JSON.stringify({ error: 'Advisor not in any firm' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!['advisor', 'owner'].includes(advisorMembership.role)) {
      return new Response(
        JSON.stringify({ error: 'Only advisors and owners can invite clients' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const firmId = advisorMembership.firm_id

    // Step 2: Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers.users.find(u => u.email === email)

    let clientId: string

    if (existingUser) {
      // User exists, add to firm as client
      clientId = existingUser.id

      // Update profile
      await supabaseAdmin
        .from('profiles')
        .upsert({
          id: clientId,
          first_name: firstName,
          last_name: lastName
        })

      // Add to firm as client
      await supabaseAdmin
        .from('firm_memberships')
        .upsert({
          firm_id: firmId,
          user_id: clientId,
          role: 'client'
        })

      // Grant access to inviting advisor
      await supabaseAdmin
        .from('client_access')
        .upsert({
          firm_id: firmId,
          client_id: clientId,
          advisor_id: advisorId,
          granted_by: advisorId
        })

      return new Response(
        JSON.stringify({
          success: true,
          clientId,
          firmId,
          message: 'Client already exists, granted access'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 3: Create new user and send invite email
    const { data: newUser, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          first_name: firstName,
          last_name: lastName,
          firm_id: firmId,
          advisor_id: advisorId,
          role: 'client'
        },
        redirectTo: `${req.headers.get('origin') || 'http://localhost:5173'}/auth/callback`
      }
    )

    if (inviteError || !newUser.user) {
      throw new Error(`Failed to invite client: ${inviteError?.message}`)
    }

    clientId = newUser.user.id

    // Step 4: Create profile
    await supabaseAdmin
      .from('profiles')
      .insert({
        id: clientId,
        first_name: firstName,
        last_name: lastName
      })

    // Step 5: Add to firm as client
    await supabaseAdmin
      .from('firm_memberships')
      .insert({
        firm_id: firmId,
        user_id: clientId,
        role: 'client'
      })

    // Step 6: Grant access to inviting advisor
    await supabaseAdmin
      .from('client_access')
      .insert({
        firm_id: firmId,
        client_id: clientId,
        advisor_id: advisorId,
        granted_by: advisorId
      })

    return new Response(
      JSON.stringify({
        success: true,
        clientId,
        firmId,
        message: 'Client invited successfully. They will receive an email to set their password.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in invite-client:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
