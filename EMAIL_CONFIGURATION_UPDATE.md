# Email Configuration Update - Support vs Admin Separation

## Summary
Successfully separated support and admin email addresses in the system to ensure proper role separation and email routing.

## Email Configuration

### Support Email
- **Address:** `support@amerilendloan.com`
- **Purpose:** General support, verification, and customer-facing communications
- **Location:** `COMPANY_INFO.contact.email` in `companyConfig.ts`
- **Reply-To:** All emails have `support@amerilendloan.com` as reply-to address

### Admin Email
- **Address:** `admin@amerilendloan.com`
- **Purpose:** Admin-only notifications and administrative communications
- **Location:** `COMPANY_INFO.admin.email` in `companyConfig.ts`
- **Usage:** Only for admin notifications about new applications

## Email Types and Routing

### Support Email Uses (`support@amerilendloan.com`)
1. **OTP Verification Emails**
   - Signup verification codes
   - Login verification codes
   - Password reset codes

2. **Customer Notifications**
   - Loan application received confirmation
   - Application status updates (approved/rejected)
   - Loan disbursement notifications
   - Processing/fee payment notifications
   - More information requests

3. **Security Alerts (to customers)**
   - Suspicious activity alerts
   - Login notifications
   - Email change notifications
   - Bank info update notifications

4. **Email Footer**
   - Support contact info in all customer emails
   - Support email link for customer inquiries

5. **Reply-To Address**
   - All emails reply to `support@amerilendloan.com` for customer responses

### Admin Email Uses (`admin@amerilendloan.com`)
1. **Application Notifications**
   - New loan application alerts
   - Admin dashboard review notifications

## Files Modified

### 1. `server/_core/companyConfig.ts`
**Before:**
```typescript
contact: {
  email: "admin@amerilendloan.com",
  // ...
}
```

**After:**
```typescript
contact: {
  email: "support@amerilendloan.com",
  phone: "+1 (888) 123-4567",
  whatsapp: "+1 (888) 123-4567",
  telegram: "@amerilendloans",
},
admin: {
  email: "admin@amerilendloan.com",
}
```

### 2. `server/_core/email.ts`
**Admin Notification Function Updated:**
- Changed from: `COMPANY_INFO.contact.email`
- Changed to: `COMPANY_INFO.admin.email`
- **Function:** `sendAdminNewApplicationNotification()`
- **Location:** Line 1076

**Reply-To Configuration:**
- Already set to: `"support@amerilendloan.com"` (no change needed)
- **Location:** Line 43-46
- **Applies to:** All emails sent via SendGrid

## Email Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   Email System Flow                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  USER ACTIONS                                            │
│  ├─ Signup/Login/Reset                                  │
│  │  └─→ OTP Code Email → SUPPORT EMAIL                 │
│  │                                                       │
│  └─ Application Submission                              │
│     ├─→ Confirmation Email → SUPPORT EMAIL (to user)   │
│     └─→ Admin Alert → ADMIN EMAIL (to admin)           │
│                                                          │
│  ADMIN ACTIONS                                           │
│  ├─ Approve Application                                 │
│  │  └─→ Notification Email → SUPPORT EMAIL (to user)   │
│  │                                                       │
│  ├─ Reject Application                                  │
│  │  └─→ Notification Email → SUPPORT EMAIL (to user)   │
│  │                                                       │
│  └─ Disburse Loan                                       │
│     └─→ Notification Email → SUPPORT EMAIL (to user)   │
│                                                          │
│  SECURITY EVENTS                                         │
│  ├─ Login Detection                                      │
│  │  └─→ Alert Email → SUPPORT EMAIL (to user)          │
│  │                                                       │
│  └─ Suspicious Activity                                 │
│     └─→ Alert Email → SUPPORT EMAIL (to user)          │
│                                                          │
└─────────────────────────────────────────────────────────┘

Legend:
  SUPPORT EMAIL: support@amerilendloan.com (customer-facing)
  ADMIN EMAIL:   admin@amerilendloan.com (admin-only)
```

## Verification Checklist

✅ **Configuration Updated**
- Support email set in `COMPANY_INFO.contact.email`
- Admin email set in `COMPANY_INFO.admin.email`

✅ **Admin Notifications**
- New application alerts → `admin@amerilendloan.com`
- Only admin dashboard receives these emails

✅ **Reply-To Address**
- All emails reply to `support@amerilendloan.com`
- Ensures customer responses go to support team

✅ **Email Footer**
- Customer-facing emails show `support@amerilendloan.com`
- Support link in email footer for inquiries

## Environment Variables
No new environment variables needed. Configuration is hardcoded in `companyConfig.ts`.

**To change emails in the future:**
1. Edit `server/_core/companyConfig.ts`
2. Update `COMPANY_INFO.contact.email` for support
3. Update `COMPANY_INFO.admin.email` for admin
4. Restart the server

## Email Service Configuration

### SendGrid Configuration
- **From Address:** `noreply@amerilendloan.com`
- **From Name:** "AmeriLend"
- **Reply-To:** `support@amerilendloan.com`
- **Reply-To Name:** "AmeriLend Support"

### API Key Required
- Set `SENDGRID_API_KEY` environment variable
- All emails will fail gracefully if API key not configured

## Testing

To verify the email configuration is working:

1. **Test Support Emails:**
   - Go to `/otp` page
   - Request OTP code
   - Check `support@amerilendloan.com` inbox for verification code

2. **Test Admin Emails:**
   - Submit a loan application
   - Check `admin@amerilendloan.com` inbox for new application alert
   - Application confirmation goes to user's email via support address

3. **Verify Reply-To:**
   - Reply to any email
   - Should default to `support@amerilendloan.com`

## Impact Analysis

### Backward Compatibility
- ✅ No breaking changes to API
- ✅ No database migrations needed
- ✅ All existing functionality preserved
- ✅ Old admin email references removed cleanly

### Performance
- ✅ No performance impact
- ✅ Same number of emails sent
- ✅ Same SendGrid API calls

### Security
- ✅ Improved security through role separation
- ✅ Admin emails not exposed to customers
- ✅ Support email handles customer inquiries only

## Related Documentation
- See `ADMIN_LOGIN_GUIDE.md` for admin dashboard access
- See `OTP_AUTHENTICATION_GUIDE.md` for OTP system details
- See `API_DOCUMENTATION.md` for API endpoints
