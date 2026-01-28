# Setup Instructions for Advisor/Client Invite System

## ⚠️ IMPORTANT: Read This First

This implementation introduces a **complete database schema change** that moves from storing `role` and `firm_name` on the profiles table to a normalized schema with separate tables for firms, memberships, and client access.

## Quick Start

### Step 1: Run SQL Migrations

1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Run these files **in order**:
   - `supabase-migrations/001_create_schema.sql`
   - `supabase-migrations/002_create_functions.sql`

⚠️ **WARNING**: The first migration will **DROP** the `role`, `firm_name`, and `firm_id` columns from the `profiles` table. If you have existing data, back it up first.

### Step 2: Update Environment Variables

Add to your `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Find your service role key in: Supabase Dashboard → Settings → API → Project API keys → `service_role` (secret)

⚠️ **SECURITY**: The service role key bypasses RLS. In this MVP, it's used client-side for development only. For production, move admin functions to Supabase Edge Functions.

### Step 3: Restart Vite

```bash
npm run dev
```

### Step 4: Test the System

1. **Invite an Advisor** (Platform Admin):
   - Go to: `http://localhost:5173/admin/invite-advisor`
   - Enter: email, first name, last name, firm name
   - First user in a firm becomes 'owner', others are 'advisor'

2. **Login as Advisor**:
   - Check your email for the invite
   - Click the link to set password
   - Login at `/login/advisor`

3. **Invite a Client** (As Advisor):
   - Navigate to `/app/invite`
   - Enter client's email, first name, last name
   - Client automatically granted access to you

4. **Share Client Access** (Coming soon):
   - View clients on `/app`
   - Click share button to grant other advisors access

## What Changed

### Database Schema

**NEW TABLES:**
- `firms` - Company/firm records
- `firm_memberships` - Links users to firms with roles (owner/advisor/client)
- `client_access` - Controls which advisors can access which clients

**UPDATED TABLES:**
- `profiles` - Removed: `role`, `firm_name`, `firm_id`. Now only stores: `first_name`, `last_name`

### Frontend Files Changed

**NEW FILES:**
1. `src/lib/supabaseAdmin.js` - Admin API utilities (uses service role key)
2. `src/pages/InviteAdvisor.jsx` - Admin page to invite advisors
3. `supabase-migrations/001_create_schema.sql` - Database schema
4. `supabase-migrations/002_create_functions.sql` - PostgreSQL functions

**UPDATED FILES:**
1. `src/pages/InviteClient.jsx` - Now uses `inviteClient()` from supabaseAdmin
2. `src/App.jsx` - Added route for `/admin/invite-advisor`
3. `src/pages/pages.css` - Added styles for share/revoke UI

**FILES THAT NEED UPDATING** (for full functionality):
1. `src/components/Header.jsx` - Update to use `get_user_firm()` RPC
2. `src/pages/Settings.jsx` - Update to use `get_user_firm()` RPC
3. `src/pages/AppHome.jsx` - Update to load clients from `client_access` table
4. `src/pages/AdvisorLogin.jsx` - Update role checking to use `firm_memberships`
5. `src/pages/InvestorLogin.jsx` - Update role checking to use `firm_memberships`

## How It Works

### Inviting an Advisor

1. Admin fills out form at `/admin/invite-advisor`
2. `inviteAdvisor()` calls PostgreSQL function `invite_advisor()`:
   - Creates or finds firm by name
   - Determines if user should be 'owner' (first in firm) or 'advisor'
3. Supabase Admin API creates user and sends invite email
4. `complete_advisor_setup()` function:
   - Inserts profile record
   - Inserts firm_memberships record

### Inviting a Client

1. Advisor fills out form at `/app/invite`
2. `inviteClient()` calls PostgreSQL function `invite_client()`:
   - Gets advisor's firm from `firm_memberships`
   - Validates advisor has role 'advisor' or 'owner'
3. Supabase Admin API creates user and sends invite email
4. `complete_client_setup()` function:
   - Inserts profile record
   - Inserts firm_memberships record (role='client')
   - **Automatically grants access** to inviting advisor in `client_access`

### Sharing a Client (RPC function ready, UI pending)

```javascript
const { data, error } = await supabase.rpc('share_client', {
  p_client_id: 'client-uuid',
  p_advisor_id: 'advisor-uuid'
})
```

Validation:
- Caller must be advisor/owner in a firm
- Target advisor must be in same firm
- Client must be in same firm
- Caller must already have access to client

### Row Level Security

All tables have RLS enabled:

**firms**: Users can view their firm (via firm_memberships)

**firm_memberships**:
- Users can view their own membership
- Users can view other members in their firm

**client_access**:
- SELECT: advisor_id = auth.uid() OR client_id = auth.uid()
- INSERT: Must be advisor/owner in firm (validated in function)
- DELETE: Only granter or firm owner can revoke

**profiles**:
- Users can view/update their own profile

## PostgreSQL Functions Available

Call these via Supabase RPC:

```javascript
// Get current user's firm info
const { data } = await supabase.rpc('get_user_firm')
// Returns: { firm_id, firm_name, role }

// Get current user's role
const { data } = await supabase.rpc('get_user_role')
// Returns: 'owner' | 'advisor' | 'client' | null

// Share client with advisor
await supabase.rpc('share_client', {
  p_client_id: uuid,
  p_advisor_id: uuid
})

// Revoke advisor's access to client
await supabase.rpc('revoke_client_access', {
  p_client_id: uuid,
  p_advisor_id: uuid
})
```

## Next Steps to Complete Implementation

1. **Update Header.jsx** to load firm info:
```javascript
const { data: firmInfo } = await supabase.rpc('get_user_firm')
// Use firmInfo.firm_name and firmInfo.role
```

2. **Update AppHome.jsx** to load clients:
```javascript
// Load clients the advisor has access to
const { data: clients } = await supabase
  .from('client_access')
  .select(`
    client_id,
    profiles:client_id (
      first_name,
      last_name,
      email
    )
  `)
  .eq('advisor_id', user.id)
```

3. **Add Share Client UI** to AppHome.jsx:
```javascript
// Load advisors in same firm
const { data: advisors } = await supabase
  .from('firm_memberships')
  .select('user_id, profiles:user_id (first_name, last_name)')
  .eq('firm_id', myFirmId)
  .in('role', ['advisor', 'owner'])
  .neq('user_id', myUserId)
```

4. **Update Login Pages** to check role from firm_memberships:
```javascript
const { data: firmInfo } = await supabase.rpc('get_user_firm')
if (firmInfo.role !== 'advisor') {
  // Wrong portal
}
```

## Troubleshooting

### "Service role key not configured"
- Add `VITE_SUPABASE_SERVICE_ROLE_KEY` to `.env`
- Restart Vite dev server: `npm run dev`

### "Missing Supabase env vars"
- Check `.env` has all three keys
- Restart Vite

### "Failed to prepare advisor/client invite"
- Check SQL migrations ran successfully
- Check PostgreSQL functions exist: Run `\df` in Supabase SQL Editor

### Email invites not working
- Check Supabase email settings: Dashboard → Authentication → Email Templates
- Verify SMTP is configured (or use Supabase's default)
- Check spam folder

### RLS errors
- Verify migrations ran completely
- Check policies exist: `SELECT * FROM pg_policies WHERE schemaname = 'public'`

## Production Checklist

Before deploying to production:

- [ ] Move admin functions to Supabase Edge Functions
- [ ] Remove `VITE_SUPABASE_SERVICE_ROLE_KEY` from client .env
- [ ] Add proper admin authentication/authorization
- [ ] Customize Supabase email templates with branding
- [ ] Add rate limiting for invites
- [ ] Add audit logging for access grants/revokes
- [ ] Test all RLS policies thoroughly
- [ ] Add error tracking (Sentry, etc.)
- [ ] Add analytics for invite funnel

## Support

For questions or issues:
1. Check `IMPLEMENTATION_GUIDE.md` for detailed architecture
2. Check SQL migration files for schema details
3. Check `src/lib/supabaseAdmin.js` for API implementation
4. Review PostgreSQL function code in `002_create_functions.sql`

## Architecture Diagram

```
┌─────────────────┐
│  Platform Admin │
└────────┬────────┘
         │ invites
         ▼
    ┌─────────┐         ┌──────────────┐
    │ Advisor ├────────►│ firm_members │
    └────┬────┘  joins  │    (table)   │
         │              └──────────────┘
         │ invites
         ▼
    ┌────────┐          ┌──────────────┐
    │ Client ├─────────►│ client_access│◄──── Advisor 2
    └────────┘   grants │    (table)   │      (shared)
                 access └──────────────┘
```

## License

This code is part of your RIFT MVP project.
