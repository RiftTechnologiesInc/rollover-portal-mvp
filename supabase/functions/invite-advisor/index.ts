// Supabase Edge Function: invite-advisor
// Invites a financial advisor to a firm (admin only)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InviteAdvisorRequest {
  email: string
  firstName: string
  lastName: string
  firmName: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get request body
    const { email, firstName, lastName, firmName }: InviteAdvisorRequest = await req.json()

    // Validate inputs
    if (!email || !firstName || !lastName || !firmName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role (server-side only)
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

    // Step 1: Find or create firm
    const { data: existingFirm } = await supabaseAdmin
      .from('firms')
      .select('id')
      .eq('name', firmName)
      .single()

    let firmId: string
    let isFirstUser = false

    if (existingFirm) {
      firmId = existingFirm.id

      // Check if firm already has members
      const { data: members } = await supabaseAdmin
        .from('firm_memberships')
        .select('user_id')
        .eq('firm_id', firmId)
        .limit(1)

      isFirstUser = !members || members.length === 0
    } else {
      // Create new firm
      const { data: newFirm, error: firmError } = await supabaseAdmin
        .from('firms')
        .insert({ name: firmName })
        .select('id')
        .single()

      if (firmError || !newFirm) {
        throw new Error(`Failed to create firm: ${firmError?.message}`)
      }

      firmId = newFirm.id
      isFirstUser = true
    }

    // Determine role (first user is owner, others are advisors)
    const role = isFirstUser ? 'owner' : 'advisor'

    // Step 2: Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers.users.find(u => u.email === email)

    let userId: string

    if (existingUser) {
      // User exists, just add to firm
      userId = existingUser.id

      // Update profile
      await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          first_name: firstName,
          last_name: lastName
        })

      // Add to firm
      await supabaseAdmin
        .from('firm_memberships')
        .upsert({
          firm_id: firmId,
          user_id: userId,
          role: role
        })

      return new Response(
        JSON.stringify({
          success: true,
          userId,
          firmId,
          role,
          message: 'User already exists, added to firm'
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
          role: role
        },
        redirectTo: `${req.headers.get('origin') || 'http://localhost:5173'}/auth/callback`
      }
    )

    if (inviteError || !newUser.user) {
      throw new Error(`Failed to invite user: ${inviteError?.message}`)
    }

    userId = newUser.user.id

    // Step 4: Create profile
    await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        first_name: firstName,
        last_name: lastName
      })

    // Step 5: Add to firm
    await supabaseAdmin
      .from('firm_memberships')
      .insert({
        firm_id: firmId,
        user_id: userId,
        role: role
      })

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        firmId,
        role,
        message: 'Advisor invited successfully. They will receive an email to set their password.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in invite-advisor:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
