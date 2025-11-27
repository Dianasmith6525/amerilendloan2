# AmeriLend Test Plan - TestSprite

## Test Environment Setup

### Prerequisites
- Node.js 18+ installed
- Database connection available
- Environment variables configured
- TestSprite MCP server configured in Claude Desktop

### Configuration Files
- `testsprite.config.json` - Main TestSprite configuration
- `.env` - Environment variables (already configured)
- `test-scenarios/` - Test scenario definitions

---

## Test Suites Overview

### 1. Loan Application End-to-End (Critical Priority)

#### Test: loan-application-submit
**Objective:** Verify complete loan application submission workflow

**Steps:**
1. Navigate to `/apply`
2. Fill out personal information form:
   - Full Name: "John Test Applicant"
   - Email: `test-${Date.now()}@example.com`
   - Phone: "5551234567"
   - Password: "SecurePass123"
   - Date of Birth: "1990-01-15"
   - SSN: "123-45-6789"
3. Fill out address information:
   - Street: "123 Main Street"
   - City: "Los Angeles"
   - State: "CA"
   - Zip Code: "90001"
4. Fill out employment information:
   - Employment Status: "employed"
   - Employer: "Test Corporation"
   - Monthly Income: 5000
5. Fill out loan information:
   - Loan Type: "installment"
   - Requested Amount: 10000
   - Loan Purpose: "Home improvement project for kitchen renovation"
   - Disbursement Method: "bank_transfer"
6. Submit application
7. Verify response contains tracking number
8. Verify application status is "pending"

**Expected Results:**
- Status code: 200
- Response contains `success: true`
- Response contains `trackingNumber` (format: /^[A-Z0-9]{8,12}$/)
- Application saved in database
- Email notification sent to applicant
- Admin notification sent

**API Call:**
```typescript
POST /api/trpc/loans.submit
{
  "fullName": "John Test Applicant",
  "email": "test@example.com",
  "phone": "5551234567",
  "password": "SecurePass123",
  "dateOfBirth": "1990-01-15",
  "ssn": "123-45-6789",
  "street": "123 Main Street",
  "city": "Los Angeles",
  "state": "CA",
  "zipCode": "90001",
  "employmentStatus": "employed",
  "employer": "Test Corporation",
  "monthlyIncome": 5000,
  "loanType": "installment",
  "requestedAmount": 10000,
  "loanPurpose": "Home improvement project for kitchen renovation",
  "disbursementMethod": "bank_transfer"
}
```

---

#### Test: loan-application-track
**Objective:** Verify tracking functionality for submitted applications

**Steps:**
1. Submit a loan application (use setup from previous test)
2. Save tracking number from response
3. Navigate to Track Application page
4. Enter tracking number
5. Enter email address used in application
6. Click "Track Application"
7. Verify application details displayed

**Expected Results:**
- Application status displayed correctly
- All application details visible (name, amount, status)
- Created date shown
- No sensitive data exposed (SSN masked)

**API Call:**
```typescript
GET /api/trpc/loans.getLoanByTrackingNumber
{
  "trackingNumber": "ABC12345"
}
```

---

#### Test: loan-application-duplicate-check
**Objective:** Verify duplicate detection prevents multiple applications

**Steps:**
1. Submit first loan application with SSN "123-45-6789" and DOB "1990-01-15"
2. Wait for confirmation
3. Attempt to submit second application with same SSN and DOB
4. Verify duplicate detected
5. Verify error message indicates existing application
6. Verify tracking number of existing application provided

**Expected Results:**
- Second submission returns duplicate error
- Response includes existing application tracking number
- Email is partially masked in response
- Status indicates if reapplication is allowed (based on status)

**API Call:**
```typescript
GET /api/trpc/loans.checkDuplicate
{
  "dateOfBirth": "1990-01-15",
  "ssn": "123-45-6789"
}
```

---

### 2. Authentication & Authorization (Critical Priority)

#### Test: auth-signup
**Objective:** Verify user registration workflow

**Steps:**
1. Navigate to signup page
2. Enter email: `newuser-${Date.now()}@example.com`
3. Enter password: "SecurePass123"
4. Enter name: "Test User"
5. Submit registration
6. Verify account created
7. Verify welcome email sent

**Expected Results:**
- Status code: 200
- User created in database
- Session cookie set
- Welcome email sent
- User role set to "user" (not admin)

---

#### Test: auth-otp-verify
**Objective:** Verify OTP authentication flow

**Steps:**
1. Request OTP via email
2. Retrieve OTP code (check database or email)
3. Submit OTP code
4. Verify authentication successful
5. Verify session created

**Expected Results:**
- OTP code generated (6 digits)
- OTP valid for 10 minutes
- Successful verification creates session
- Failed verification returns appropriate error
- OTP expires after use

**API Calls:**
```typescript
// Request OTP
POST /api/trpc/auth.requestOTP
{
  "identifier": "test@example.com",
  "channel": "email"
}

// Verify OTP
POST /api/trpc/auth.verifyOTP
{
  "identifier": "test@example.com",
  "code": "123456"
}
```

---

### 3. Payment Processing (High Priority)

#### Test: payment-card-authorize-net
**Objective:** Verify credit card payment processing via Authorize.Net

**Steps:**
1. Create approved loan application
2. Navigate to payment page
3. Enter payment details:
   - Card Number: "4111111111111111" (test card)
   - CVV: "123"
   - Expiry: "12/25"
4. Submit payment
5. Verify payment processed
6. Verify application status updated to "fee_paid"

**Expected Results:**
- Payment intent created
- Authorize.Net transaction successful
- Payment record saved
- Application status updated
- Confirmation email sent

**API Call:**
```typescript
POST /api/trpc/payments.createIntent
{
  "applicationId": 123,
  "amount": 20000,
  "paymentMethod": "card",
  "paymentMethodNonce": "test_nonce_123"
}
```

---

#### Test: payment-crypto-btc
**Objective:** Verify Bitcoin payment processing

**Steps:**
1. Create approved loan application
2. Select crypto payment method
3. Select Bitcoin (BTC)
4. Get payment address
5. Verify address matches configured BTC address
6. Simulate payment (provide tx hash)
7. Verify payment verification

**Expected Results:**
- Correct BTC address provided
- Payment amount calculated in BTC
- Transaction hash recorded
- Payment marked as pending verification
- Webhook or manual verification updates status

**API Call:**
```typescript
POST /api/trpc/payments.processCrypto
{
  "applicationId": 123,
  "amount": 20000,
  "cryptoType": "BTC",
  "txHash": "test_tx_hash_123"
}
```

---

### 4. Admin Operations (Medium Priority)

#### Test: admin-loan-approval
**Objective:** Verify admin can approve loan applications

**Steps:**
1. Login as admin user
2. Navigate to admin dashboard
3. View pending applications
4. Select application to approve
5. Enter approved amount: 10000
6. Enter admin notes: "Approved based on credit verification"
7. Submit approval
8. Verify application status updated to "approved"
9. Verify processing fee calculated
10. Verify approval email sent

**Expected Results:**
- Application status changes to "approved"
- Processing fee calculated based on fee config
- Approved amount saved
- Approved timestamp recorded
- Admin activity logged
- Email sent to applicant

**API Call:**
```typescript
POST /api/trpc/loans.adminApprove
{
  "id": 123,
  "approvedAmount": 1000000,
  "adminNotes": "Approved based on credit verification"
}
```

---

#### Test: admin-statistics
**Objective:** Verify admin dashboard statistics are accurate

**Steps:**
1. Login as admin
2. Navigate to admin dashboard
3. View statistics panel
4. Verify counts match database queries

**Expected Results:**
- Total applications count accurate
- Pending count accurate
- Approved count accurate
- Fee pending count accurate
- Fee paid count accurate
- Total disbursed amount accurate

**API Call:**
```typescript
GET /api/trpc/loans.adminStatistics
```

---

### 5. API Validation & Security (High Priority)

#### Test: api-invalid-data-types
**Objective:** Verify API rejects invalid data types

**Test Cases:**
```typescript
// Test 1: String instead of number
POST /api/trpc/loans.submit
{
  "requestedAmount": "10000",  // Should be number
  ...
}
Expected: 400 Bad Request

// Test 2: Invalid enum value
POST /api/trpc/loans.submit
{
  "loanType": "personal",  // Should be "installment" or "short_term"
  ...
}
Expected: 400 Bad Request

// Test 3: Invalid date format
POST /api/trpc/loans.submit
{
  "dateOfBirth": "01/15/1990",  // Should be "1990-01-15"
  ...
}
Expected: 400 Bad Request
```

---

#### Test: api-sql-injection-prevention
**Objective:** Verify SQL injection attempts are blocked

**Test Cases:**
```typescript
// Test 1: SQL in fullName
POST /api/trpc/loans.submit
{
  "fullName": "'; DROP TABLE users; --",
  ...
}
Expected: Input sanitized or rejected, no SQL execution

// Test 2: SQL in search
GET /api/trpc/loans.adminSearch
{
  "searchTerm": "' OR '1'='1"
}
Expected: No unauthorized data access
```

---

#### Test: api-rate-limiting
**Objective:** Verify rate limiting prevents abuse

**Steps:**
1. Make 100 rapid requests to login endpoint
2. Verify rate limit triggered
3. Verify appropriate error response
4. Wait for rate limit window to expire
5. Verify requests allowed again

**Expected Results:**
- Rate limit kicks in after 5 failed login attempts
- Status code: 429 Too Many Requests
- Error message indicates wait time
- Suspicious activity alert sent

---

## Test Execution Plan

### Phase 1: Critical Path (Week 1)
- Loan Application E2E
- Authentication & Authorization
- Payment Processing (Card)

### Phase 2: Extended Coverage (Week 2)
- Admin Operations
- API Validation
- Security Tests

### Phase 3: Performance & Load (Week 3)
- Load testing
- Stress testing
- Concurrent user scenarios

---

## Success Criteria

### Functional Tests
- ✅ 100% of critical path tests pass
- ✅ 95%+ of all tests pass
- ✅ No security vulnerabilities detected
- ✅ All payment flows validated

### Performance Benchmarks
- ✅ API response time < 500ms (95th percentile)
- ✅ Loan application submission < 2s
- ✅ Admin dashboard load < 1s
- ✅ Support 100 concurrent users

### Code Coverage
- ✅ 80%+ endpoint coverage
- ✅ All critical workflows tested
- ✅ Edge cases validated

---

## Test Data Management

### Test Users
```json
{
  "regular_user": {
    "email": "testuser@example.com",
    "password": "TestPass123",
    "role": "user"
  },
  "admin_user": {
    "email": "admin@amerilend.com",
    "password": "AdminPass123",
    "role": "admin"
  }
}
```

### Test Applications
- Sample SSNs: "123-45-6789", "987-65-4321"
- Sample DOBs: "1990-01-15", "1985-06-20"
- Sample amounts: 5000, 10000, 25000

### Test Payment Data
- Test Card: 4111111111111111 (Visa)
- Test CVV: 123
- Test Expiry: 12/25
- Test BTC Address: bc1qxm9y49hresxn6h55j43eywj0t6pw0h3d0exfmp

---

## Continuous Integration

### GitHub Actions Workflow
```yaml
name: TestSprite E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
```

---

## Monitoring & Alerts

### Test Failure Notifications
- Slack notifications for failed tests
- Email alerts for critical test failures
- Dashboard with real-time test status

### Metrics Tracking
- Test execution time trends
- Failure rate over time
- Coverage percentage

---

**Last Updated:** November 27, 2025
**Version:** 1.0.0
**Owner:** AmeriLend Development Team
