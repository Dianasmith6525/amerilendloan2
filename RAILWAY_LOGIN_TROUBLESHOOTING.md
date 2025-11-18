# Railway Login Issues - Diagnostic Checklist

## ❌ Common Causes

Your app uses **Manus OAuth** for authentication. Login fails when OAuth environment variables aren't set.

## ✅ What to Check in Railway Dashboard

### Step 1: Verify Environment Variables

In Railway, go to **Variables** tab and confirm you have:

```
OAUTH_SERVER_URL = [should look like https://...auth...]
VITE_OAUTH_PORTAL_URL = [should look like https://...oauth...]
VITE_APP_ID = [your-app-id-from-manus]
OWNER_OPEN_ID = [your-owner-id]
JWT_SECRET = [any random string, 32+ chars]
DATABASE_URL = [auto-filled by Railway PostgreSQL]
NODE_ENV = production
```

### Step 2: Check if Any Are Missing or Empty

If any show as empty `""`, that's your problem.

### Step 3: Get the Correct Values

**From your local machine:**

```powershell
cd C:\Users\USER\Downloads\Amerilendloan.com
$env:OAUTH_SERVER_URL
$env:VITE_OAUTH_PORTAL_URL
$env:VITE_APP_ID
$env:OWNER_OPEN_ID
```

If these are blank locally too, you need to set them first.

### Step 4: Update Railway Variables

1. Go to Railway project dashboard
2. Click the Node service
3. Click "Variables"
4. For each missing variable:
   - Click "Add Variable"
   - Paste the name and value
5. Railway auto-redeploys

### Step 5: Check Logs

After updating variables:
1. Click "Logs" tab
2. Look for any error mentioning:
   - "OAUTH_SERVER_URL is not configured"
   - "Network error" calling OAuth
   - "Invalid redirect URI"

## 🔧 Quick Fix

Run this locally to see your current env vars:

```powershell
Get-Content .env | Select-String "OAUTH|VITE_APP_ID|OWNER"
```

Or check your `.env` file directly in the repo root.

## 🆘 Still Not Working?

If after setting env vars login still fails:

1. **Database issue**: Run `DATABASE_URL="your_prod_url" npm run db:push` to create tables
2. **OAuth server down**: Try locally - if it works locally, the issue is Railway config
3. **CORS issue**: Check Railway logs for CORS errors
4. **Timeout**: Check if OAuth server is reachable from Railway's location

## 📋 Quick Restart

After updating Railway variables, the app should auto-redeploy. If not:

1. In Railway dashboard → Deployments
2. Click the latest failed deployment
3. Click "Redeploy" button

## Contact Manus Support

If you don't have the correct `OAUTH_SERVER_URL` and `VITE_OAUTH_PORTAL_URL`, contact your Manus account manager.

---

**Let me know the output of the env var check and I'll help you fix it.**
