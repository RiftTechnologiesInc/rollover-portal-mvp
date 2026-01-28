/**
 * Supabase Admin Client
 *
 * IMPORTANT: This file uses the SERVICE ROLE KEY which bypasses RLS.
 * Only use this for admin operations that require elevated privileges.
 * NEVER expose this key to the client or use it in production frontend code.
 *
 * For production, move these functions to a secure backend/edge function.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL')
}

// WARNING: Using service role key in client-side code is for development only!
// In production, these functions should be moved to a secure backend
let supabaseAdmin = null

if (supabaseServiceRoleKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * Invite an advisor to a firm
 * This function combines the RPC call with the admin API call
 */
export async function inviteAdvisor({ email, firstName, lastName, firmName }) {
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured. Add VITE_SUPABASE_SERVICE_ROLE_KEY to your .env')
  }

  // Step 1: Call RPC function to prepare firm and get metadata
  const { data: prepData, error: prepError } = await supabaseAdmin.rpc('invite_advisor', {
    p_email: email,
    p_first_name: firstName,
    p_last_name: lastName,
    p_firm_name: firmName
  })

  if (prepError) {
    throw new Error(`Failed to prepare advisor invite: ${prepError.message}`)
  }

  if (!prepData.success) {
    throw new Error(prepData.error || 'Failed to prepare advisor invite')
  }

  // If user already exists, we're done
  if (!prepData.requires_invite) {
    return {
      success: true,
      userId: prepData.user_id,
      firmId: prepData.firm_id,
      message: prepData.message
    }
  }

  // Step 2: Create user via admin API and send invite email
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email,
    {
      data: {
        first_name: firstName,
        last_name: lastName,
        firm_id: prepData.firm_id,
        role: prepData.role
      },
      redirectTo: `${window.location.origin}/auth/callback`
    }
  )

  if (userError) {
    throw new Error(`Failed to send invite email: ${userError.message}`)
  }

  // Step 3: Complete setup with the created user ID
  const { data: setupData, error: setupError } = await supabaseAdmin.rpc('complete_advisor_setup', {
    p_advisor_id: userData.user.id,
    p_firm_id: prepData.firm_id,
    p_role: prepData.role,
    p_first_name: firstName,
    p_last_name: lastName
  })

  if (setupError) {
    throw new Error(`Failed to complete advisor setup: ${setupError.message}`)
  }

  return {
    success: true,
    userId: userData.user.id,
    firmId: prepData.firm_id,
    role: prepData.role,
    message: 'Advisor invited successfully'
  }
}

/**
 * Invite a client (called by advisors)
 * Combines RPC call with admin API call
 */
export async function inviteClient({ email, firstName, lastName }, currentUser) {
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured. Add VITE_SUPABASE_SERVICE_ROLE_KEY to your .env')
  }

  if (!currentUser) {
    throw new Error('Must be authenticated to invite clients')
  }

  // Step 1: Call RPC function to prepare client and get metadata
  const { data: prepData, error: prepError } = await supabaseAdmin.rpc('invite_client', {
    p_email: email,
    p_first_name: firstName,
    p_last_name: lastName
  })

  if (prepError) {
    throw new Error(`Failed to prepare client invite: ${prepError.message}`)
  }

  if (!prepData.success) {
    throw new Error(prepData.error || 'Failed to prepare client invite')
  }

  // If user already exists, we're done
  if (!prepData.requires_invite) {
    return {
      success: true,
      clientId: prepData.client_id,
      firmId: prepData.firm_id,
      message: prepData.message
    }
  }

  // Step 2: Create user via admin API and send invite email
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email,
    {
      data: {
        first_name: firstName,
        last_name: lastName,
        firm_id: prepData.firm_id,
        advisor_id: prepData.advisor_id,
        role: 'client'
      },
      redirectTo: `${window.location.origin}/auth/callback`
    }
  )

  if (userError) {
    throw new Error(`Failed to send invite email: ${userError.message}`)
  }

  // Step 3: Complete setup with the created user ID
  const { data: setupData, error: setupError } = await supabaseAdmin.rpc('complete_client_setup', {
    p_client_id: userData.user.id,
    p_firm_id: prepData.firm_id,
    p_advisor_id: prepData.advisor_id,
    p_first_name: firstName,
    p_last_name: lastName
  })

  if (setupError) {
    throw new Error(`Failed to complete client setup: ${setupError.message}`)
  }

  return {
    success: true,
    clientId: userData.user.id,
    firmId: prepData.firm_id,
    message: 'Client invited successfully'
  }
}
