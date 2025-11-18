# Admin Dashboard Login Guide

## Overview
The admin dashboard uses **OTP (One-Time Password) authentication via email**. You do NOT need a password - just an email address and a 6-digit verification code sent to your email.

## Current Admin Email
**Admin Email:** `admin@amerilendloan.com` (recently updated from support@amerilendloan.com)

## How to Login to Admin Dashboard

### Step 1: Access the Login Page
1. Go to `http://localhost:3000/otp` (or your application URL + `/otp`)
2. Make sure you're on the **"Login"** tab (not "Sign Up")

### Step 2: Enter Your Email and Password
- **Email/Identifier:** `admin@amerilendloan.com`
- **Password:** Enter any password (the system will ignore the password and use OTP instead)
- Click **"Login"** button

### Step 3: Receive OTP Code
- An OTP verification code will be sent to your email (`admin@amerilendloan.com`)
- Check your email for a 6-digit code
- The code expires in **10 minutes**

### Step 4: Enter OTP Code
- Return to the login page (you'll be prompted to enter the code)
- Enter the **6-digit OTP code** from your email
- Click **"Verify"** button

### Step 5: Access Admin Dashboard
- After successful verification, you'll be redirected to `/admin` (or `/dashboard`)
- You now have access to the admin panel

## Admin Dashboard Features
Once logged in, you can access:

- **Applications Management** - View and manage loan applications
- **Approval/Rejection** - Approve or reject applications with custom amounts and notes
- **Disbursement** - Process loan disbursements with bank account details
- **Fee Configuration** - Set application fees (percentage or fixed amount)
- **Admin Management** - Promote users to admin status
- **User Management** - Search and manage user accounts
- **Statistics & Analytics** - View real-time dashboard metrics
- **AI Assistant** - Get AI-powered recommendations and analysis
- **Document Verification** - Review and verify user documents

## OTP Authentication Details

### What is OTP?
- **OTP** = One-Time Password
- A 6-digit code sent to your email for verification
- More secure than passwords as it changes every request
- Valid for 10 minutes only

### Supported OTP Purposes
1. **Login** - Authenticate into existing account
2. **Signup** - Create a new account
3. **Reset** - Reset account access if locked out

### OTP Technical Details
- **Code Length:** 6 digits
- **Expiration:** 10 minutes
- **Delivery Method:** Email via SendGrid
- **Database Storage:** Encrypted in `otp_codes` table
- **Rate Limiting:** Max 5 failed attempts per 15 minutes

## Accessing Admin Dashboard Routes

### Direct Routes
- **Admin Dashboard:** `/admin`
- **OTP Login:** `/otp`
- **User Dashboard:** `/dashboard`

### Using Links
From the home page, if authenticated as admin:
1. Go to "Dashboard" link (top-right navigation)
2. You'll be directed to the admin dashboard

## Troubleshooting

### OTP Code Not Received
1. Check spam/junk folder in your email
2. Make sure SendGrid email service is configured
3. Verify `admin@amerilendloan.com` is the correct admin email in `server/_core/companyConfig.ts`

### OTP Code Expired
- OTP codes expire after 10 minutes
- Request a new code by clicking "Resend Code" or resubmitting the form

### Too Many Failed Attempts
- After 5 failed attempts in 15 minutes, you'll be locked out temporarily
- A security alert email will be sent
- Wait 15 minutes before trying again or use the "Forgot Password" option

### Can't Access Admin Dashboard
- Verify your user account has `role: "admin"` in the database
- Check the `users` table in PostgreSQL
- If needed, manually update your role to `admin`:
  ```sql
  UPDATE users SET role = 'admin' WHERE email = 'admin@amerilendloan.com';
  ```

## Database Configuration

### Key Files
- **OTP Logic:** `server/_core/otp.ts`
- **Email Service:** `server/_core/email.ts`
- **Company Config:** `server/_core/companyConfig.ts` (contains admin email)
- **Admin Dashboard:** `client/src/pages/AdminDashboard.tsx`
- **Login Page:** `client/src/pages/OTPLogin.tsx`

### Database Tables
- `users` - User accounts (role: 'admin', 'user')
- `otp_codes` - OTP verification codes
- `loan_applications` - Loan applications managed by admins
- `login_attempts` - Login audit trail

## Creating a New Admin Account

If you need to create another admin account:

### Option 1: Via Database (Fastest)
```sql
-- Create a new admin user
INSERT INTO users (email, name, open_id, password_hash, role)
VALUES ('newemail@example.com', 'Admin Name', 'email_timestamp_random', '', 'admin');
```

### Option 2: Via Application
1. Sign up using OTP login page
2. Manually update role in database to 'admin'

## Environment Variables

### Required for Admin Login
- `DATABASE_URL` - PostgreSQL connection string
- `SENDGRID_API_KEY` - For sending OTP emails
- `JWT_SECRET` - For session management
- `COOKIE_NAME` - Session cookie identifier (default: "app_session_id")

### Email Configuration
```typescript
// In server/_core/companyConfig.ts
export const COMPANY_INFO = {
  contact: {
    email: "admin@amerilendloan.com", // Admin email
    // ... other contact info
  }
};
```

## Security Features

### Built-in Protections
1. ✅ OTP-only authentication (no passwords to steal)
2. ✅ Rate limiting (5 attempts per 15 minutes)
3. ✅ Login notifications to admin email
4. ✅ Suspicious activity alerts
5. ✅ JWT session tokens with expiration
6. ✅ Secure cookies (HttpOnly, SameSite)
7. ✅ Activity logging for all admin actions

### Best Practices
- Keep your admin email `admin@amerilendloan.com` secure
- Check your email regularly for security alerts
- Log out when finished using the admin dashboard
- Monitor login notifications for unauthorized access attempts

## More Information

For more details, see:
- `OTP_AUTHENTICATION_GUIDE.md` - Complete OTP implementation guide
- `ADMIN_FEATURES_IMPLEMENTATION.md` - Admin feature details
- `API_DOCUMENTATION.md` - API endpoints for authentication
