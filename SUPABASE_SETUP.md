# Supabase Setup Guide - Making Invite Client Work

This guide explains how to set up and deploy the Supabase Edge Functions needed for the invite client feature to work.

## Prerequisites

1. A Supabase project (create one at https://supabase.com if you haven't)
2. Your Supabase project credentials

**Note:** You can complete this entire setup using just the Supabase Dashboard (no CLI needed)!

---

## 🚀 Quick Start (5 Minutes)

If you just want to get it working ASAP:

1. **Create `.env` file** in your project root with your Supabase credentials
2. **Deploy database** - Go to SQL Editor in Supabase Dashboard, paste and run both SQL migration files
3. **Deploy Edge Functions** - Go to Edge Functions in Dashboard, create 3 new functions and paste the code
4. **Set secrets** - Add SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in Edge Functions → Secrets
5. **Test it** - Run your app, login, and try inviting a client!

Detailed instructions below ⬇️

---

## Step 1: Set Up Environment Variables

Create a `.env` file in the project root with the following variables:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Where to find these values:

1. Go to your Supabase project dashboard
2. Click on **Settings** (gear icon in sidebar)
3. Click on **API**
4. Copy the **Project URL** → use as `VITE_SUPABASE_URL`
5. Copy the **anon/public key** → use as `VITE_SUPABASE_ANON_KEY`

## Step 2: Deploy Database Schema and Functions

**Using Supabase Dashboard (Recommended - No CLI needed):**

1. Go to your Supabase project dashboard at https://supabase.com/dashboard
2. Click on **SQL Editor** in the sidebar
3. Click **New Query**
4. Copy the entire contents of `supabase-migrations/001_create_schema.sql` from your project
5. Paste it into the SQL editor and click **Run**
6. Wait for it to complete (you'll see a success message)
7. Click **New Query** again
8. Copy the entire contents of `supabase-migrations/002_create_functions.sql`
9. Paste it and click **Run**
10. You should see success messages for all the functions created

## Step 3: Deploy Edge Functions

Edge Functions need to be deployed to Supabase. You have two options:

### Option A: Using Supabase Dashboard (Easiest)

1. Go to **Edge Functions** in your Supabase Dashboard sidebar
2. Click **Deploy a new function**
3. For **invite-client**:
   - Function name: `invite-client`
   - Copy the entire contents of `supabase/functions/invite-client/index.ts`
   - Paste into the editor
   - Click **Deploy function**
4. Repeat for **get-client-emails**:
   - Function name: `get-client-emails`
   - Copy contents from `supabase/functions/get-client-emails/index.ts`
   - Click **Deploy function**
5. Repeat for **invite-advisor**:
   - Function name: `invite-advisor`
   - Copy contents from `supabase/functions/invite-advisor/index.ts`
   - Click **Deploy function**

### Option B: Using Supabase CLI (Windows)

If you prefer using the CLI, install it using one of these methods:

**Method 1: Using Scoop (Recommended for Windows)**
```powershell
# Install Scoop first if you don't have it
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

# Install Supabase CLI
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Method 2: Direct Download**
1. Download the latest Windows binary from: https://github.com/supabase/cli/releases
2. Extract the .exe file
3. Add it to your PATH or run it from the extracted location

**Then deploy:**
```powershell
supabase login
supabase link --project-ref your-project-ref
supabase functions deploy invite-client
supabase functions deploy get-client-emails
supabase functions deploy invite-advisor
```

## Step 4: Set Edge Function Secrets

⚠️ **IMPORTANT:** The Edge Functions need these secrets to work!

1. Go to **Settings** → **API** in your Supabase Dashboard
2. Copy the **service_role key** (⚠️ Keep this secret! Never commit it to git!)
3. Copy the **URL** and **anon key** as well
4. Go to **Edge Functions** in the sidebar
5. Click on **Manage secrets** or **Secrets** tab
6. Add these three secrets (click "Add a new secret" for each):
   - Name: `SUPABASE_URL` → Value: `https://your-project-ref.supabase.co`
   - Name: `SUPABASE_SERVICE_ROLE_KEY` → Value: `your-service-role-key`
   - Name: `SUPABASE_ANON_KEY` → Value: `your-anon-key`
7. Click **Save** after adding each secret

## Step 5: Configure Email Templates (Optional but Recommended)

1. Go to **Authentication** → **Email Templates** in Supabase Dashboard
2. Customize the **Invite user** template to match your brand
3. Make sure the confirmation URL is set to your app's domain

## Step 6: Test the Invite Client Feature

1. Start your development server: `npm run dev`
2. Login as a financial professional (advisor)
3. Go to `/app` and click **+ Invite a Client**
4. Fill in the client details and click **Send Invite**
5. The client should receive an email to set up their account

## Troubleshooting

### "Missing authorization header" error
- Make sure you're logged in before trying to invite a client
- Check that your `.env` file has the correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

### "Advisor not in any firm" error
- Make sure your advisor account is properly set up in the `firm_memberships` table
- Run the invite-advisor Edge Function or manually insert your advisor into a firm

### Edge Function not found (404)
- Ensure the Edge Functions are deployed: `supabase functions deploy invite-client`
- Check that the function URL matches your Supabase project URL

### Clients not showing "Account Set Up" status
- This is expected for newly invited clients who haven't accepted the invite yet
- Once they click the email link and set their password, the status will change to "Account Set Up"

## Database Structure

The invite client feature uses these tables:
- **firms**: Stores financial advisory firms
- **firm_memberships**: Links users to firms with their roles (advisor, owner, client)
- **client_access**: Manages which advisors have access to which clients
- **profiles**: Stores user profile information (first_name, last_name)

## Security Notes

⚠️ **Never commit your `.env` file or service role key to version control!**

The `.env` file is already in `.gitignore` to prevent accidental commits.

## Next Steps

After setup is complete, your invite client feature should work! Clients will:
1. Receive an email invitation
2. Click the link to set their password
3. Automatically be added to your firm
4. Appear in your client list with "Account Set Up" status
