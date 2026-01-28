-- ============================================================================
-- MIGRATION 001: Create new schema for firms, memberships, and client access
-- ============================================================================
-- Run this in your Supabase SQL Editor

-- Drop existing tables if they exist (BE CAREFUL - this will delete data!)
-- Comment these out if you want to preserve existing data
-- DROP TABLE IF EXISTS public.client_access CASCADE;
-- DROP TABLE IF EXISTS public.firm_memberships CASCADE;
-- DROP TABLE IF EXISTS public.firms CASCADE;

-- ============================================================================
-- 1. FIRMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.firms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- 2. UPDATE PROFILES TABLE
-- ============================================================================
-- Remove firm_name and role columns if they exist
-- (We'll migrate this data to firm_memberships)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS firm_name CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS firm_id CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS onboarded CASCADE;

-- Ensure profiles has the correct structure
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

-- ============================================================================
-- 3. FIRM MEMBERSHIPS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.firm_memberships (
  firm_id uuid REFERENCES public.firms(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'advisor', 'client')),
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (firm_id, user_id)
);

-- Additional FK for profile joins (used by PostgREST embeds)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'firm_memberships_user_profile_fkey'
  ) THEN
    ALTER TABLE public.firm_memberships
      ADD CONSTRAINT firm_memberships_user_profile_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Enforce one firm per user
CREATE UNIQUE INDEX IF NOT EXISTS firm_memberships_one_firm_per_user
  ON public.firm_memberships (user_id);

-- ============================================================================
-- 4. CLIENT ACCESS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.client_access (
  firm_id uuid REFERENCES public.firms(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  advisor_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (client_id, advisor_id),
  CHECK (client_id != advisor_id)
);

-- Additional FKs for profile joins (used by PostgREST embeds)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_access_client_profile_fkey'
  ) THEN
    ALTER TABLE public.client_access
      ADD CONSTRAINT client_access_client_profile_fkey
      FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_access_advisor_profile_fkey'
  ) THEN
    ALTER TABLE public.client_access
      ADD CONSTRAINT client_access_advisor_profile_fkey
      FOREIGN KEY (advisor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS client_access_advisor_idx ON public.client_access(advisor_id);
CREATE INDEX IF NOT EXISTS client_access_client_idx ON public.client_access(client_id);
CREATE INDEX IF NOT EXISTS client_access_firm_idx ON public.client_access(firm_id);

-- ============================================================================
-- 5. ENABLE RLS
-- ============================================================================
ALTER TABLE public.firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firm_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================

-- PROFILES: Users can read and update their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view firm profiles" ON public.profiles;
CREATE POLICY "Users can view firm profiles"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1
      FROM public.firm_memberships fm_self
      JOIN public.firm_memberships fm_other
        ON fm_other.firm_id = fm_self.firm_id
      WHERE fm_self.user_id = auth.uid()
        AND fm_other.user_id = profiles.id
    )
  );

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- FIRMS: Users can read their firm
DROP POLICY IF EXISTS "Users can view their firm" ON public.firms;
CREATE POLICY "Users can view their firm"
  ON public.firms FOR SELECT
  USING (
    id IN (
      SELECT firm_id FROM public.firm_memberships
      WHERE user_id = auth.uid()
    )
  );

-- FIRM_MEMBERSHIPS: Users can read their own membership
DROP POLICY IF EXISTS "Users can view own membership" ON public.firm_memberships;
CREATE POLICY "Users can view own membership"
  ON public.firm_memberships FOR SELECT
  USING (user_id = auth.uid());

-- FIRM_MEMBERSHIPS: Users can view other members in their firm
DROP POLICY IF EXISTS "Users can view firm members" ON public.firm_memberships;
CREATE POLICY "Users can view firm members"
  ON public.firm_memberships FOR SELECT
  USING (
    firm_id IN (
      SELECT firm_id FROM public.firm_memberships
      WHERE user_id = auth.uid()
    )
  );

-- CLIENT_ACCESS: Advisors can view access grants where they are the advisor
DROP POLICY IF EXISTS "Advisors can view their client access" ON public.client_access;
CREATE POLICY "Advisors can view their client access"
  ON public.client_access FOR SELECT
  USING (
    auth.uid() = advisor_id
    OR auth.uid() = client_id
    OR auth.uid() = granted_by
  );

-- CLIENT_ACCESS: Advisors can insert access grants (validated in function)
DROP POLICY IF EXISTS "Advisors can grant access" ON public.client_access;
CREATE POLICY "Advisors can grant access"
  ON public.client_access FOR INSERT
  WITH CHECK (
    -- Must be an advisor/owner in the firm
    EXISTS (
      SELECT 1 FROM public.firm_memberships
      WHERE user_id = auth.uid()
        AND firm_id = client_access.firm_id
        AND role IN ('advisor', 'owner')
    )
  );

-- CLIENT_ACCESS: Only the granter can revoke access they granted
DROP POLICY IF EXISTS "Grantors can revoke access" ON public.client_access;
CREATE POLICY "Grantors can revoke access"
  ON public.client_access FOR DELETE
  USING (
    auth.uid() = granted_by
    OR EXISTS (
      SELECT 1 FROM public.firm_memberships
      WHERE user_id = auth.uid()
        AND firm_id = client_access.firm_id
        AND role = 'owner'
    )
  );

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next: Run 002_create_functions.sql to create the RPC functions
