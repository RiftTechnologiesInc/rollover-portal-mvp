# Advisor/Client Invite & Sharing System - Implementation Guide

This guide explains the complete advisor/client invite and access control system implemented for your RIFT platform.

## Overview

The system implements a secure, normalized database schema with proper access controls for:
- Platform admins inviting advisors to firms
- Advisors inviting clients
- Advisors sharing client access with other advisors in their firm
- Proper data isolation and security via RLS

## Database Schema

### Tables

1. **firms**
   - `id` (uuid, PK)
   - `name` (text, unique)
   - `created_at` (timestamptz)

2. **profiles**
   - `id` (uuid, PK, FK to auth.users)
   - `first_name` (text)
   - `last_name` (text)
   - `created_at` (timestamptz)
   - **Removed**: `firm_name`, `role`, `firm_id` (moved to firm_memberships)

3. **firm_memberships**
   - `firm_id` (uuid, FK to firms)
   - `user_id` (uuid, FK to auth.users)
   - `role` (text: 'owner', 'advisor', 'client')
   - `created_at` (timestamptz)
   - PK: (firm_id, user_id)
   - UNIQUE index on user_id (one firm per user)

4. **client_access**
   - `firm_id` (uuid, FK to firms)
   - `client_id` (uuid, FK to auth.users)
   - `advisor_id` (uuid, FK to auth.users)
   - `granted_by` (uuid, FK to auth.users)
   - `created_at` (timestamptz)
   - PK: (client_id, advisor_id)
   - CHECK: client_id ≠ advisor_id

## Setup Instructions

### 1. Run SQL Migrations

Run these migrations in your Supabase SQL Editor in order:

```bash
1. supabase-migrations/001_create_schema.sql
2. supabase-migrations/002_create_functions.sql
```

**IMPORTANT**: The first migration will drop the `firm_name`, `role`, and `firm_id` columns from profiles. If you have existing data, you'll need to migrate it first.

### 2. Update Environment Variables

Add the following to your `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**SECURITY NOTE**: The service role key is used in `supabaseAdmin.js`. This is for **development only**. In production, move the admin functions to Supabase Edge Functions or a secure backend to prevent exposing the service role key.

### 3. Test the System

1. **Invite an Advisor** (as platform admin):
   - Navigate to `/admin/invite-advisor`
   - Enter email, name, and firm name
   - First user in a firm becomes 'owner', subsequent users are 'advisor'

2. **Invite a Client** (as advisor):
   - Navigate to `/app/invite`
   - Enter client email and name
   - Client is automatically granted access to you

3. **Share Client Access** (as advisor):
   - Navigate to `/app`
   - Click "Share" button next to a client
   - Select an advisor from dropdown
   - That advisor can now access the client's data

4. **Revoke Access** (as advisor):
   - Navigate to client details
   - Click "Revoke" next to an advisor's name
   - That advisor loses access

## PostgreSQL Functions (RPC)

All server-side logic runs as secure PostgreSQL functions:

### Admin Functions

- **`invite_advisor(email, first_name, last_name, firm_name)`**: Prepares firm and metadata for advisor invite
- **`complete_advisor_setup(advisor_id, firm_id, role, first_name, last_name)`**: Completes setup after user creation

### Advisor Functions

- **`invite_client(email, first_name, last_name)`**: Prepares client invite, auto-grants access to inviting advisor
- **`complete_client_setup(client_id, firm_id, advisor_id, first_name, last_name)`**: Completes client setup
- **`share_client(client_id, advisor_id)`**: Grants another advisor access to a client
- **`revoke_client_access(client_id, advisor_id)`**: Revokes an advisor's access to a client

### Helper Functions

- **`get_user_role()`**: Returns current user's role
- **`get_user_firm()`**: Returns current user's firm info (firm_id, firm_name, role)

## Row Level Security (RLS)

All tables have RLS enabled with these policies:

### profiles
- Users can view and update their own profile

### firms
- Users can view their firm (via firm_memberships join)

### firm_memberships
- Users can view their own membership
- Users can view other members in their firm

### client_access
- Advisors can view grants where they are the advisor, client, or granter
- Advisors/owners can insert grants (validated in functions)
- Only the granter or firm owner can delete grants

## Security Model

1. **One Firm Per User**: Enforced by unique index on firm_memberships(user_id)

2. **Access Control**: Advisors can only access client data if a row exists in client_access

3. **Role Hierarchy**:
   - **Owner**: First user in firm, can revoke any access grants
   - **Advisor**: Can invite clients, share clients, revoke own grants
   - **Client**: Can only access own data

4. **Admin Operations**: Use SECURITY DEFINER functions that run with elevated privileges

## Frontend Changes

### Updated Files

1. **src/lib/supabaseAdmin.js** (NEW)
   - Admin utilities for inviting users
   - Uses service role key (move to backend for production)

2. **src/pages/InviteAdvisor.jsx** (NEW)
   - Admin page for inviting advisors

3. **src/pages/InviteClient.jsx** (UPDATED)
   - Now uses `inviteClient()` from supabaseAdmin

4. **src/pages/AppHome.jsx** (UPDATED)
   - Lists clients from `client_access` table
   - Shows share client UI

5. **src/components/Header.jsx** (UPDATED)
   - Uses `get_user_firm()` instead of profiles.role

6. **src/pages/Settings.jsx** (UPDATED)
   - Shows firm info from `get_user_firm()`

7. **src/pages/AdvisorLogin.jsx** & **src/pages/InvestorLogin.jsx** (UPDATED)
   - Role checking uses firm_memberships

## API Usage Examples

### Inviting an Advisor

```javascript
import { inviteAdvisor } from '../lib/supabaseAdmin'

const result = await inviteAdvisor({
  email: 'advisor@firm.com',
  firstName: 'John',
  lastName: 'Doe',
  firmName: 'Acme Financial'
})
```

### Inviting a Client

```javascript
import { inviteClient } from '../lib/supabaseAdmin'
import { supabase } from '../lib/supabaseClient'

const { data: { user } } = await supabase.auth.getUser()

const result = await inviteClient({
  email: 'client@example.com',
  firstName: 'Jane',
  lastName: 'Client'
}, user)
```

### Sharing a Client

```javascript
import { supabase } from '../lib/supabaseClient'

const { data, error } = await supabase.rpc('share_client', {
  p_client_id: 'client-uuid',
  p_advisor_id: 'advisor-uuid'
})
```

### Revoking Access

```javascript
const { data, error } = await supabase.rpc('revoke_client_access', {
  p_client_id: 'client-uuid',
  p_advisor_id: 'advisor-uuid'
})
```

### Getting Current User's Firm

```javascript
const { data, error } = await supabase.rpc('get_user_firm')
// Returns: { firm_id, firm_name, role }
```

## Production Deployment

Before deploying to production:

1. **Move Admin Functions to Backend**:
   - Create Supabase Edge Functions for `inviteAdvisor` and `inviteClient`
   - Remove `VITE_SUPABASE_SERVICE_ROLE_KEY` from client .env
   - Update frontend to call Edge Functions instead of using supabaseAdmin.js

2. **Add Proper Admin Authentication**:
   - Implement admin role checking
   - Restrict `/admin/*` routes to authenticated admins
   - Add admin user table or use custom claims

3. **Add Audit Logging**:
   - Log all invite and access grant operations
   - Track who granted/revoked access and when

4. **Add Email Customization**:
   - Customize Supabase email templates
   - Add firm branding to invite emails

5. **Add Rate Limiting**:
   - Limit invite attempts per user/IP
   - Prevent abuse of invite system

## Testing Checklist

- [ ] Run both SQL migrations successfully
- [ ] Add service role key to .env
- [ ] Create first advisor (becomes owner)
- [ ] Create second advisor (becomes advisor)
- [ ] Invite a client as advisor
- [ ] Verify client appears in advisor's client list
- [ ] Share client with another advisor
- [ ] Verify shared advisor can see client
- [ ] Revoke access
- [ ] Verify advisor no longer sees client
- [ ] Test RLS: client cannot see other clients
- [ ] Test RLS: advisor cannot see non-shared clients

## Troubleshooting

### "Missing VITE_SUPABASE_SERVICE_ROLE_KEY"
- Add the service role key to your `.env` file
- Restart Vite dev server

### "Only the granter or firm owner can revoke access"
- You can only revoke access you granted
- Or you must be the firm owner

### "Caller does not have access to this client"
- You must have access to a client before you can share them

### "Target advisor not in same firm"
- You can only share clients with advisors in your firm

## Next Steps

1. Add client dashboard data tables (portfolios, accounts, etc.)
2. Add RLS policies to those tables using client_access joins
3. Implement admin panel for managing firms and users
4. Add analytics and reporting
5. Implement audit trail for compliance

## Questions?

Check the source code in:
- `supabase-migrations/` for database schema and functions
- `src/lib/supabaseAdmin.js` for admin API calls
- `src/pages/` for frontend implementation
