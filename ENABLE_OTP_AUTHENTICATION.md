# Enable OTP Authentication on Railway

Your app has OTP (One-Time Password) authentication built in! This is simpler than OAuth.

## What is OTP Authentication?

Instead of OAuth redirects, users:
1. Enter their email
2. Receive a 6-digit code via email
3. Enter the code to login
4. Done!

Your app already has this feature. We just need to enable it.

## Quick Setup (2 minutes)

### Step 1: Check OTP Configuration

Your app uses **SendGrid** for OTP codes. Ensure in Railway Variables:

```
SENDGRID_API_KEY = [your-sendgrid-key]
```

**Get SendGrid key:**
1. Go to https://sendgrid.com
2. Create account or sign in
3. Settings → API Keys → Create API Key
4. Copy and paste into Railway

### Step 2: Update Railway Variables

Remove or comment out these OAuth variables (they won't be used):

```
OAUTH_SERVER_URL = [can be blank]
VITE_OAUTH_PORTAL_URL = [can be blank]
```

Keep these:

```
SENDGRID_API_KEY = [your-key]
JWT_SECRET = [any-random-string]
DATABASE_URL = [auto-filled]
NODE_ENV = production
VITE_APP_ID = amerilend
```

### Step 3: Database Setup

Run this to create tables:

```powershell
DATABASE_URL="[your-railway-database-url]" npm run db:push
```

### Step 4: Redeploy

1. In Railway, click "Redeploy" button
2. App should now load
3. Login page should show OTP option

### Step 5: Test

1. Go to your Railway URL
2. Click "Sign In"
3. Enter any email
4. Check email for 6-digit code
5. Enter code on website
6. Logged in! ✅

## How to Get Database URL

In Railway:
1. Click your project
2. Click the **PostgreSQL** service (if you have it)
3. Click **"Connect"**
4. Copy the "DATABASE_URL"

---

## Full Environment Variables Needed

```
NODE_ENV = production
VITE_APP_ID = amerilend
VITE_APP_TITLE = AmeriLend Loans
VITE_APP_LOGO = https://www.amerilendloan.com/images/logo-new.jpg
JWT_SECRET = [generate-32-char-random-string]
DATABASE_URL = [from-railway-postgres]
SENDGRID_API_KEY = [from-sendgrid]
```

**Optional (for advanced features):**
```
OPENAI_API_KEY = [if-using-ai-chat]
TWILIO_ACCOUNT_SID = [if-using-sms]
TWILIO_AUTH_TOKEN = [if-using-sms]
TWILIO_PHONE_NUMBER = [if-using-sms]
```

---

## Why OTP Over OAuth?

✅ **OTP Benefits:**
- No external OAuth server needed
- Users don't need to remember passwords
- Faster setup
- More secure
- Already built in your app

❌ **OAuth Problems (your case):**
- Requires proper OAuth server
- Complex setup
- Current config points to your website (not an OAuth provider)

---

## Next Steps

1. **Get SendGrid API key** (2 min)
2. **Add to Railway Variables** (1 min)
3. **Run database migrations** (2 min)
4. **Test login with OTP** (1 min)

Want me to help you get the SendGrid key?
