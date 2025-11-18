# AmeriLend OTP Authentication Guide

## Overview

AmeriLend now supports One-Time Password (OTP) authentication as an alternative to traditional OAuth login. This passwordless authentication method enhances security and provides a seamless user experience for signup and login flows.

## How OTP Authentication Works

OTP authentication eliminates the need for users to remember passwords. Instead, users receive a 6-digit verification code via email that expires after 10 minutes. This approach provides several security benefits:

- **No password storage** - Eliminates password-related vulnerabilities
- **Time-limited codes** - Codes expire after 10 minutes
- **Single-use tokens** - Each code can only be used once
- **Rate limiting** - Prevents brute force attacks
- **Email verification** - Confirms user owns the email address

## Database Schema

The `otpCodes` table stores verification codes:

```sql
CREATE TABLE otpCodes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(320) NOT NULL,
  code VARCHAR(6) NOT NULL,
  purpose ENUM('signup', 'login') NOT NULL,
  expiresAt TIMESTAMP NOT NULL,
  verified INT DEFAULT 0 NOT NULL,  -- 0 = not verified, 1 = verified
  attempts INT DEFAULT 0 NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Key Fields:**
- `email` - User's email address
- `code` - 6-digit numeric code
- `purpose` - Whether code is for signup or login
- `expiresAt` - Code expiration time (10 minutes from creation)
- `verified` - Prevents code reuse
- `attempts` - Tracks failed verification attempts (max 5)

## API Endpoints

### Request OTP Code

```typescript
trpc.otp.requestCode.useMutation({
  email: "user@example.com",
  purpose: "login" | "signup"
})
```

**Behavior:**
1. Generates random 6-digit code
2. Invalidates any existing codes for this email/purpose
3. Stores new code with 10-minute expiration
4. Sends code via email
5. Returns success confirmation

**Rate Limiting:**
- Maximum 3 requests per email per 5 minutes
- Prevents spam and abuse

### Verify OTP Code

```typescript
trpc.otp.verifyCode.useMutation({
  email: "user@example.com",
  code: "123456",
  purpose: "login" | "signup"
})
```

**Behavior:**
1. Finds most recent unverified code for email/purpose
2. Checks if code has expired
3. Verifies code matches
4. Marks code as verified (prevents reuse)
5. Creates user session (for login)
6. Returns success or error

**Security Features:**
- Maximum 5 verification attempts per code
- Automatic code invalidation after expiration
- Single-use codes (marked as verified after successful use)

## Frontend Implementation

### OTP Login Flow

The OTP login page (`/otp-login`) provides a two-step authentication process:

**Step 1: Email Entry**
- User enters email address
- Clicks "Send Verification Code"
- System sends 6-digit code to email

**Step 2: Code Verification**
- User enters 6-digit code from email
- System verifies code
- On success, user is logged in
- On failure, error message displayed

**Key Features:**
- Clean, professional UI matching AmeriLend branding
- Real-time input validation
- Loading states during API calls
- Error handling with user-friendly messages
- "Resend Code" functionality
- "Use Different Email" option
- Link to signup page for new users

### OTP Signup Flow

Similar to login but includes additional steps:

1. Email entry and verification
2. OTP code verification
3. Profile completion (name, phone, etc.)
4. Account creation

## Email Delivery

### Current Implementation (Demo Mode)

In the current implementation, OTP codes are logged to the server console for demonstration purposes:

```
═══════════════════════════════════════
  OTP CODE FOR LOGIN
═══════════════════════════════════════
  Email: user@example.com
  Code: 123456
  Expires in: 10 minutes
═══════════════════════════════════════
```

### Production Implementation

For production deployment, integrate with an email service provider:

**Recommended Services:**
- SendGrid
- AWS SES (Simple Email Service)
- Mailgun
- Postmark

**Example SendGrid Integration:**

```typescript
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export async function sendOTPEmail(
  email: string, 
  code: string, 
  purpose: "signup" | "login"
): Promise<void> {
  const msg = {
    to: email,
    from: 'noreply@amerilendloan.com',
    subject: `Your ${purpose} verification code`,
    text: `Your verification code is: ${code}. This code will expire in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>AmeriLend Verification Code</h2>
        <p>Your verification code is:</p>
        <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 10px;">
          ${code}
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this code, please ignore this email.</p>
      </div>
    `,
  };
  
  await sgMail.send(msg);
}
```

## Security Best Practices

### Code Generation

- Use cryptographically secure random number generation
- 6-digit codes provide 1,000,000 possible combinations
- Combined with rate limiting and expiration, provides strong security

### Rate Limiting

Implement rate limiting at multiple levels:

1. **Per Email:**
   - 3 code requests per 5 minutes
   - 5 verification attempts per code

2. **Per IP Address:**
   - 10 code requests per hour
   - 20 verification attempts per hour

3. **Global:**
   - Monitor for suspicious patterns
   - Temporary blocks for abuse

### Code Expiration

- Default: 10 minutes
- Automatically invalidate expired codes
- Periodic cleanup of old codes (recommended: hourly)

### Brute Force Protection

- Maximum 5 attempts per code
- Exponential backoff after failures
- Account lockout after repeated failures
- CAPTCHA after 3 failed attempts

## Testing

### Test OTP Login

1. Navigate to `/otp-login`
2. Enter any email address
3. Click "Send Verification Code"
4. Check server console for OTP code
5. Enter the 6-digit code
6. Verify successful login

**Expected Console Output:**
```
═══════════════════════════════════════
  OTP CODE FOR LOGIN
═══════════════════════════════════════
  Email: test@example.com
  Code: 456789
  Expires in: 10 minutes
═══════════════════════════════════════
```

### Test Error Scenarios

**Expired Code:**
1. Request OTP code
2. Wait 11 minutes
3. Try to verify
4. Should see "No valid OTP found or OTP expired"

**Invalid Code:**
1. Request OTP code
2. Enter wrong code
3. Should see "Invalid code"
4. Attempts counter increments

**Too Many Attempts:**
1. Request OTP code
2. Enter wrong code 5 times
3. Should see "Too many failed attempts. Please request a new code."

## Production Deployment

### Pre-Deployment Checklist

- [ ] Configure email service provider (SendGrid, AWS SES, etc.)
- [ ] Set up email templates with branding
- [ ] Configure SPF/DKIM records for email deliverability
- [ ] Implement rate limiting middleware
- [ ] Set up monitoring for OTP delivery failures
- [ ] Configure CAPTCHA for brute force protection
- [ ] Test email delivery across major providers (Gmail, Outlook, etc.)
- [ ] Set up alerts for high failure rates
- [ ] Document OTP troubleshooting procedures
- [ ] Train support staff on OTP issues

### Environment Variables

```env
# Email Service Configuration
SENDGRID_API_KEY=your_sendgrid_api_key
OTP_FROM_EMAIL=noreply@amerilendloan.com
OTP_FROM_NAME=AmeriLend

# OTP Configuration
OTP_CODE_LENGTH=6
OTP_EXPIRATION_MINUTES=10
OTP_MAX_ATTEMPTS=5
OTP_RATE_LIMIT_REQUESTS=3
OTP_RATE_LIMIT_WINDOW=5  # minutes
```

### Monitoring

Track the following metrics:

1. **OTP Delivery Rate**
   - Target: >99% successful delivery
   - Alert if drops below 95%

2. **Average Delivery Time**
   - Target: <30 seconds
   - Alert if exceeds 2 minutes

3. **Verification Success Rate**
   - Target: >90% first-attempt success
   - Track reasons for failures

4. **Code Expiration Rate**
   - Monitor how many codes expire unused
   - May indicate delivery issues

## User Experience Considerations

### Email Design

- Clear subject line: "Your AmeriLend Verification Code"
- Large, easy-to-read code display
- Expiration time clearly stated
- Security notice about not sharing code
- Contact information for support

### UI/UX Best Practices

1. **Clear Instructions**
   - Tell users where to find the code
   - Explain expiration time
   - Provide help text for common issues

2. **Input Validation**
   - Auto-format code input (numeric only)
   - Auto-submit when 6 digits entered
   - Clear error messages

3. **Loading States**
   - Show spinner during code sending
   - Disable button to prevent double-submission
   - Provide feedback on success/failure

4. **Accessibility**
   - Keyboard navigation support
   - Screen reader friendly labels
   - High contrast for code display
   - Focus management between steps

## Troubleshooting

### Common Issues

**Issue: Email not received**
- Check spam/junk folder
- Verify email address is correct
- Check email service provider status
- Verify SPF/DKIM records

**Issue: Code expired**
- Request new code
- Check system time synchronization
- Verify expiration time is reasonable

**Issue: Code not working**
- Verify code matches exactly (no spaces)
- Check if code already used
- Verify attempts not exceeded
- Request new code if needed

### Support Procedures

1. **User reports not receiving code:**
   - Verify email address
   - Check email service logs
   - Resend code
   - Try alternative email if persistent

2. **User reports code not working:**
   - Verify code hasn't expired
   - Check attempts counter
   - Generate new code
   - Escalate if issue persists

## Future Enhancements

Planned improvements:

1. **SMS Delivery**
   - Alternative to email
   - Faster delivery
   - Better for mobile users

2. **Biometric Authentication**
   - Face ID / Touch ID
   - Reduce friction for returning users

3. **Remember Device**
   - Skip OTP for trusted devices
   - Configurable trust duration

4. **Backup Codes**
   - Generate one-time backup codes
   - For account recovery

5. **Multi-Factor Authentication**
   - Combine OTP with other factors
   - Enhanced security for sensitive operations

---

**Last Updated:** November 2, 2025  
**Version:** 2.0  
**Author:** Manus AI
