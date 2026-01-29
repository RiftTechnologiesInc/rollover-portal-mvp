# Quick Setup Guide - Dashboard Only (No CLI Needed!)

Follow these steps to get your invite client feature working in about 10 minutes.

## ✅ Step 1: Create Your .env File

1. In your project folder (`C:\Users\Krew Bussel\Desktop\MVP`), create a new file called `.env`
2. Open Supabase Dashboard: https://supabase.com/dashboard
3. Select your project
4. Go to **Settings** (gear icon) → **API**
5. Copy these values into your `.env` file:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Replace with YOUR actual values from the API page!

---

## ✅ Step 2: Deploy Database Schema

1. In Supabase Dashboard, click **SQL Editor** (in left sidebar)
2. Click **New Query** button

### First Migration:
3. Open the file: `supabase-migrations/001_create_schema.sql` on your computer
4. Copy ALL the contents (Ctrl+A, Ctrl+C)
5. Paste into the SQL editor in Supabase
6. Click **Run** button (or press Ctrl+Enter)
7. Wait for "Success" message

### Second Migration:
8. Click **New Query** again
9. Open the file: `supabase-migrations/002_create_functions.sql`
10. Copy ALL the contents
11. Paste into the SQL editor
12. Click **Run**
13. Wait for success messages

---

## ✅ Step 3: Deploy Edge Functions

### Function 1: invite-client

1. In Supabase Dashboard, click **Edge Functions** (left sidebar)
2. Click **Deploy a new function** or **Create function**
3. Enter function name: `invite-client`
4. In the code editor, delete any placeholder code
5. Open file: `supabase/functions/invite-client/index.ts` on your computer
6. Copy ALL the contents
7. Paste into the Supabase function editor
8. Click **Deploy** or **Deploy function**

### Function 2: get-client-emails

9. Click **Deploy a new function** again
10. Name: `get-client-emails`
11. Open: `supabase/functions/get-client-emails/index.ts`
12. Copy and paste contents
13. Click **Deploy**

### Function 3: invite-advisor

14. Click **Deploy a new function** again
15. Name: `invite-advisor`
16. Open: `supabase/functions/invite-advisor/index.ts`
17. Copy and paste contents
18. Click **Deploy**

---

## ✅ Step 4: Set Edge Function Secrets

**This is CRITICAL - your functions won't work without these!**

1. Still in **Edge Functions**, click on **Manage secrets** or **Secrets** tab
2. You need to add 3 secrets. For each one:
   - Click **Add a new secret**
   - Enter the Name and Value
   - Click **Save** or **Add**

### Secret 1:
- **Name**: `SUPABASE_URL`
- **Value**: Your project URL (same as in .env file)
  - Example: `https://xxxxxxxxxxxxx.supabase.co`

### Secret 2:
- **Name**: `SUPABASE_ANON_KEY`
- **Value**: Your anon key (same as in .env file)
  - Get from Settings → API → anon/public key

### Secret 3 (IMPORTANT):
- **Name**: `SUPABASE_SERVICE_ROLE_KEY`
- **Value**: Your service role key
  - ⚠️ Go to Settings → API
  - Scroll down to **service_role key**
  - Click **Reveal** and copy it
  - ⚠️ NEVER share this key or commit it to git!

---

## ✅ Step 5: Test It Out!

1. Open PowerShell in your project folder
2. Run: `npm run dev`
3. Open your browser to the local URL (usually http://localhost:5173)
4. Login as a financial advisor
5. Click **+ Invite a Client**
6. Fill in the form:
   - First Name: Test
   - Last Name: Client
   - Email: your-email@example.com (use a real email you can access)
7. Click **Send Invite**
8. You should see: "Success! Invite sent to..."
9. Check your email inbox
10. Click the link in the email to set up the client account

---

## 🎉 Success!

If you see the client appear in your client list with "Pending Setup" status, it worked!

After they click the email link and set their password, the status will change to "Account Set Up".

---

## ❌ Troubleshooting

### "Missing authorization header" error
- Make sure you're logged in before inviting a client
- Try logging out and logging back in

### "Advisor not in any firm" error
- Your advisor account needs to be set up properly
- You may need to run the invite-advisor function first
- Or manually add your advisor to a firm in the database

### Edge Function returns 404
- Make sure all 3 functions are deployed in Edge Functions
- Check that the function names are exactly: `invite-client`, `get-client-emails`, `invite-advisor`
- No typos, no extra spaces

### No email received
- Check your spam folder
- Go to Authentication → Email Templates in Supabase to customize
- Make sure email sending is enabled in your Supabase project

### Still stuck?
- Check the browser console (F12) for error messages
- Check the Edge Function logs in Supabase Dashboard → Edge Functions → Logs
- Make sure all 3 secrets are set correctly in Step 4

---

## 📁 Files You Edited/Created

- ✅ `.env` - Your environment variables
- ✅ Database deployed via SQL Editor
- ✅ 3 Edge Functions deployed
- ✅ 3 Secrets configured

You're all set! 🚀
