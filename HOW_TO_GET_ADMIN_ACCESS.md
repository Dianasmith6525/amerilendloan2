# How to Get Admin Access

## Quick Answer

**Admin access is automatic for the first user whose `openId` matches the `OWNER_OPEN_ID` environment variable.**

---

## Current Status

In your `.env`:
```
OWNER_OPEN_ID=
```

**It's empty!** That's why no one has admin access yet.

---

## How to Enable Admin Access

### Step 1: Get Your User ID

Since you're using OTP authentication (email-based login), there's no traditional "ID". Instead, we need to set up admin access a different way.

**Option A: Use Your Email as OpenID (Easiest)**
```
OWNER_OPEN_ID=your-email@example.com
```

**Option B: Use a Custom Admin ID**
```
OWNER_OPEN_ID=admin-user-001
```

### Step 2: Update Railway Variables

1. Go to **Railway Dashboard**
2. Click your **Project**
3. Click the **Node.js service**
4. Click **Variables**
5. Find `OWNER_OPEN_ID` and set it to:
   - `your-email@example.com` (if using email), OR
   - Any unique identifier you choose

### Step 3: Restart Your App

Railway will auto-redeploy. When it does:
- The next time YOU login with that email/ID, you'll be automatically granted **admin role**
- You can then access `/admin` to approve/decline loans

### Step 4: Login and Access Admin

1. Go to https://www.amerilendloan.com
2. Login with the email/ID you set as `OWNER_OPEN_ID`
3. You'll now have admin access
4. Visit **https://www.amerilendloan.com/admin** to access the admin dashboard

---

## What You Can Do as Admin

Once you have admin access, you can:

✅ **View all loan applications**
✅ **Approve loans**
✅ **Decline loans**
✅ **View user documents**
✅ **Process payments**
✅ **View payment history**
✅ **Chat with customers**
✅ **Send notifications**
✅ **View user profiles**
✅ **Track application status**

---

## Admin Dashboard Features

Your admin dashboard includes:

1. **Loan Applications Management**
   - View all pending applications
   - Approve or reject applications
   - Request additional documents
   - Send status updates

2. **Document Verification**
   - View uploaded documents
   - Approve verification status
   - Request corrections

3. **Payment Processing**
   - Process loan disbursements
   - Track payments
   - View payment history

4. **User Management**
   - View all users
   - Update user information
   - Send notifications

5. **AI Assistant**
   - Get AI-powered recommendations
   - Analyze applications
   - Get suggested tasks

6. **Analytics**
   - View application insights
   - Track conversion rates
   - Monitor key metrics

---

## Current Setup

Your `.env` currently has:
```
OWNER_OPEN_ID=
```

**Before you become admin:**
1. Decide what should identify the admin:
   - Email address? (e.g., `admin@amerilendloan.com`)
   - Your personal email? (e.g., `diana@example.com`)
   - Custom ID? (e.g., `admin-001`)

2. Update `OWNER_OPEN_ID` in Railway to that value

3. Login with that exact value

4. You'll automatically become admin ✅

---

## Example Setup

**If you want admin email to be `diana@amerilendloan.com`:**

1. In Railway Variables, set:
   ```
   OWNER_OPEN_ID = diana@amerilendloan.com
   ```

2. Railway auto-redeploys

3. Go to https://www.amerilendloan.com

4. Click "Sign In"

5. Enter: `diana@amerilendloan.com`

6. Check email for 6-digit OTP code

7. Enter code

8. You're logged in as **ADMIN** ✅

9. Click "Admin Dashboard" or go to `/admin`

---

## Next Steps

**Right now:**
1. Decide your admin email/ID
2. Go to Railway → Variables
3. Set `OWNER_OPEN_ID = [your-email]`
4. Railway redeploys automatically
5. Login with that email
6. Access admin dashboard!

**What's your preferred admin email or ID?** I can update it for you in Railway.
