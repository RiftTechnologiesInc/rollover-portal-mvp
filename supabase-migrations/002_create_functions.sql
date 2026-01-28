-- ============================================================================
-- MIGRATION 002: Create PostgreSQL functions for invite and access management
-- ============================================================================
-- These functions run with SECURITY DEFINER to perform admin operations

-- ============================================================================
-- FUNCTION 1: invite_advisor (admin only)
-- ============================================================================
-- Creates an advisor account for a firm
-- Called by platform admins only

CREATE OR REPLACE FUNCTION public.invite_advisor(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_firm_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_firm_id uuid;
  v_user_id uuid;
  v_is_first_user boolean;
  v_role text;
BEGIN
  -- Validate inputs
  IF p_email IS NULL OR p_email = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email is required');
  END IF;

  IF p_firm_name IS NULL OR p_firm_name = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Firm name is required');
  END IF;

  -- Find or create firm
  SELECT id INTO v_firm_id
  FROM public.firms
  WHERE name = p_firm_name;

  IF v_firm_id IS NULL THEN
    INSERT INTO public.firms (name)
    VALUES (p_firm_name)
    RETURNING id INTO v_firm_id;

    v_is_first_user := true;
  ELSE
    -- Check if firm already has members
    SELECT NOT EXISTS (
      SELECT 1 FROM public.firm_memberships
      WHERE firm_id = v_firm_id
    ) INTO v_is_first_user;
  END IF;

  -- Determine role (first user is owner, others are advisors)
  IF v_is_first_user THEN
    v_role := 'owner';
  ELSE
    v_role := 'advisor';
  END IF;

  -- Check if user already exists
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email;

  IF v_user_id IS NOT NULL THEN
    -- User already exists, just add to firm
    INSERT INTO public.firm_memberships (firm_id, user_id, role)
    VALUES (v_firm_id, v_user_id, v_role)
    ON CONFLICT (firm_id, user_id) DO UPDATE
    SET role = v_role;

    -- Update profile
    INSERT INTO public.profiles (id, first_name, last_name)
    VALUES (v_user_id, p_first_name, p_last_name)
    ON CONFLICT (id) DO UPDATE
    SET first_name = p_first_name,
        last_name = p_last_name;

    RETURN jsonb_build_object(
      'success', true,
      'user_id', v_user_id,
      'firm_id', v_firm_id,
      'role', v_role,
      'message', 'User already exists, added to firm'
    );
  END IF;

  -- Create new user via admin API (this requires service role)
  -- Note: Supabase doesn't allow creating users directly in SQL
  -- We'll return a flag that client should call the admin API
  RETURN jsonb_build_object(
    'success', true,
    'requires_invite', true,
    'firm_id', v_firm_id,
    'role', v_role,
    'email', p_email,
    'first_name', p_first_name,
    'last_name', p_last_name,
    'message', 'Call admin API to send invite email'
  );
END;
$$;

-- Grant execute to authenticated users (you may want to restrict this further)
GRANT EXECUTE ON FUNCTION public.invite_advisor TO authenticated;

-- ============================================================================
-- FUNCTION 2: invite_client (advisor only)
-- ============================================================================
-- Creates a client account and grants access to the inviting advisor

CREATE OR REPLACE FUNCTION public.invite_client(
  p_email text,
  p_first_name text,
  p_last_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_advisor_id uuid;
  v_firm_id uuid;
  v_advisor_role text;
  v_user_id uuid;
BEGIN
  -- Get calling user
  v_advisor_id := auth.uid();

  IF v_advisor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Validate inputs
  IF p_email IS NULL OR p_email = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email is required');
  END IF;

  -- Get advisor's firm and role
  SELECT firm_id, role INTO v_firm_id, v_advisor_role
  FROM public.firm_memberships
  WHERE user_id = v_advisor_id;

  IF v_firm_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Advisor not in any firm');
  END IF;

  IF v_advisor_role NOT IN ('advisor', 'owner') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only advisors can invite clients');
  END IF;

  -- Check if user already exists
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email;

  IF v_user_id IS NOT NULL THEN
    -- User already exists, add to firm as client
    INSERT INTO public.firm_memberships (firm_id, user_id, role)
    VALUES (v_firm_id, v_user_id, 'client')
    ON CONFLICT (firm_id, user_id) DO UPDATE
    SET role = 'client';

    -- Update profile
    INSERT INTO public.profiles (id, first_name, last_name)
    VALUES (v_user_id, p_first_name, p_last_name)
    ON CONFLICT (id) DO UPDATE
    SET first_name = COALESCE(p_first_name, profiles.first_name),
        last_name = COALESCE(p_last_name, profiles.last_name);

    -- Grant access to inviting advisor
    INSERT INTO public.client_access (firm_id, client_id, advisor_id, granted_by)
    VALUES (v_firm_id, v_user_id, v_advisor_id, v_advisor_id)
    ON CONFLICT (client_id, advisor_id) DO NOTHING;

    RETURN jsonb_build_object(
      'success', true,
      'client_id', v_user_id,
      'firm_id', v_firm_id,
      'message', 'Client already exists, granted access'
    );
  END IF;

  -- Return flag to create user via admin API
  RETURN jsonb_build_object(
    'success', true,
    'requires_invite', true,
    'firm_id', v_firm_id,
    'advisor_id', v_advisor_id,
    'email', p_email,
    'first_name', p_first_name,
    'last_name', p_last_name,
    'message', 'Call admin API to send invite email'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_client TO authenticated;

-- ============================================================================
-- FUNCTION 3: complete_client_setup
-- ============================================================================
-- Called after admin API creates the user to set up firm membership and access

CREATE OR REPLACE FUNCTION public.complete_client_setup(
  p_client_id uuid,
  p_firm_id uuid,
  p_advisor_id uuid,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (p_client_id, p_first_name, p_last_name)
  ON CONFLICT (id) DO UPDATE
  SET first_name = COALESCE(p_first_name, profiles.first_name),
      last_name = COALESCE(p_last_name, profiles.last_name);

  -- Add client to firm
  INSERT INTO public.firm_memberships (firm_id, user_id, role)
  VALUES (p_firm_id, p_client_id, 'client')
  ON CONFLICT (firm_id, user_id) DO NOTHING;

  -- Grant access to advisor
  INSERT INTO public.client_access (firm_id, client_id, advisor_id, granted_by)
  VALUES (p_firm_id, p_client_id, p_advisor_id, p_advisor_id)
  ON CONFLICT (client_id, advisor_id) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'client_id', p_client_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_client_setup TO authenticated;

-- ============================================================================
-- FUNCTION 4: complete_advisor_setup
-- ============================================================================
-- Called after admin API creates the advisor user

CREATE OR REPLACE FUNCTION public.complete_advisor_setup(
  p_advisor_id uuid,
  p_firm_id uuid,
  p_role text,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (p_advisor_id, p_first_name, p_last_name)
  ON CONFLICT (id) DO UPDATE
  SET first_name = COALESCE(p_first_name, profiles.first_name),
      last_name = COALESCE(p_last_name, profiles.last_name);

  -- Add advisor to firm
  INSERT INTO public.firm_memberships (firm_id, user_id, role)
  VALUES (p_firm_id, p_advisor_id, p_role)
  ON CONFLICT (firm_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'advisor_id', p_advisor_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_advisor_setup TO authenticated;

-- ============================================================================
-- FUNCTION 5: share_client
-- ============================================================================
-- Shares a client with another advisor in the same firm

CREATE OR REPLACE FUNCTION public.share_client(
  p_client_id uuid,
  p_advisor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_firm_id uuid;
  v_target_advisor_firm_id uuid;
  v_target_advisor_role text;
  v_client_firm_id uuid;
  v_client_role text;
  v_has_access boolean;
BEGIN
  v_caller_id := auth.uid();

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_client_id = p_advisor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot share client with themselves');
  END IF;

  -- Get caller's firm
  SELECT firm_id INTO v_caller_firm_id
  FROM public.firm_memberships
  WHERE user_id = v_caller_id;

  IF v_caller_firm_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Caller not in any firm');
  END IF;

  -- Check if target advisor is in same firm and is an advisor/owner
  SELECT firm_id, role INTO v_target_advisor_firm_id, v_target_advisor_role
  FROM public.firm_memberships
  WHERE user_id = p_advisor_id;

  IF v_target_advisor_firm_id IS NULL OR v_target_advisor_firm_id != v_caller_firm_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target advisor not in same firm');
  END IF;

  IF v_target_advisor_role NOT IN ('advisor', 'owner') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target user is not an advisor');
  END IF;

  -- Check if client is in same firm
  SELECT firm_id, role INTO v_client_firm_id, v_client_role
  FROM public.firm_memberships
  WHERE user_id = p_client_id;

  IF v_client_firm_id IS NULL OR v_client_firm_id != v_caller_firm_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client not in same firm');
  END IF;

  IF v_client_role != 'client' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target user is not a client');
  END IF;

  -- Check if caller has access to this client
  SELECT EXISTS (
    SELECT 1 FROM public.client_access
    WHERE client_id = p_client_id
      AND advisor_id = v_caller_id
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RETURN jsonb_build_object('success', false, 'error', 'Caller does not have access to this client');
  END IF;

  -- Grant access
  INSERT INTO public.client_access (firm_id, client_id, advisor_id, granted_by)
  VALUES (v_caller_firm_id, p_client_id, p_advisor_id, v_caller_id)
  ON CONFLICT (client_id, advisor_id) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'message', 'Access granted');
END;
$$;

GRANT EXECUTE ON FUNCTION public.share_client TO authenticated;

-- ============================================================================
-- FUNCTION 6: revoke_client_access
-- ============================================================================
-- Revokes an advisor's access to a client

CREATE OR REPLACE FUNCTION public.revoke_client_access(
  p_client_id uuid,
  p_advisor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_granted_by uuid;
  v_is_owner boolean;
BEGIN
  v_caller_id := auth.uid();

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get who granted this access
  SELECT granted_by INTO v_granted_by
  FROM public.client_access
  WHERE client_id = p_client_id
    AND advisor_id = p_advisor_id;

  IF v_granted_by IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access grant not found');
  END IF;

  -- Check if caller is owner
  SELECT EXISTS (
    SELECT 1 FROM public.firm_memberships fm
    JOIN public.client_access ca ON ca.firm_id = fm.firm_id
    WHERE ca.client_id = p_client_id
      AND ca.advisor_id = p_advisor_id
      AND fm.user_id = v_caller_id
      AND fm.role = 'owner'
  ) INTO v_is_owner;

  -- Only the granter or firm owner can revoke
  IF v_caller_id != v_granted_by AND NOT v_is_owner THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the granter or firm owner can revoke access');
  END IF;

  -- Revoke access
  DELETE FROM public.client_access
  WHERE client_id = p_client_id
    AND advisor_id = p_advisor_id;

  RETURN jsonb_build_object('success', true, 'message', 'Access revoked');
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_client_access TO authenticated;

-- ============================================================================
-- HELPER FUNCTION: get_user_role
-- ============================================================================
-- Get user's role in their firm

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role
  FROM public.firm_memberships
  WHERE user_id = auth.uid();

  RETURN v_role;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_role TO authenticated;

-- ============================================================================
-- HELPER FUNCTION: get_user_firm
-- ============================================================================
-- Get user's firm details

CREATE OR REPLACE FUNCTION public.get_user_firm()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'firm_id', f.id,
    'firm_name', f.name,
    'role', fm.role
  ) INTO v_result
  FROM public.firm_memberships fm
  JOIN public.firms f ON f.id = fm.firm_id
  WHERE fm.user_id = auth.uid();

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_firm TO authenticated;

-- ============================================================================
-- FUNCTIONS COMPLETE
-- ============================================================================
-- Next: Update your .env with VITE_SUPABASE_SERVICE_ROLE_KEY
-- Then update the frontend code to use these functions
