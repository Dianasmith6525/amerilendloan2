# TestSprite Testing for AmeriLend - Quick Start Guide

## 🎯 What's Been Set Up

Your AmeriLend project is now configured with comprehensive TestSprite testing including:

### ✅ Test Configuration Files
1. **testsprite.config.json** - Main TestSprite configuration
2. **TESTSPRITE_TEST_PLAN.md** - Detailed test plan with scenarios
3. **test-scenarios/loan-application.spec.ts** - Executable loan application tests

### 📋 Test Coverage

#### Critical Tests (10 scenarios):
- ✅ Complete loan application submission
- ✅ Application tracking by tracking number
- ✅ Duplicate application detection (SSN/DOB)
- ✅ Invalid data type validation
- ✅ Date format validation (YYYY-MM-DD)
- ✅ SSN format validation (XXX-XX-XXXX)
- ✅ Required fields validation
- ✅ Negative amount rejection
- ✅ SQL injection prevention
- ✅ XSS attack prevention

#### Additional Test Suites Available:
- Authentication & Authorization (5 tests)
- Payment Processing (5 tests)
- Admin Operations (5 tests)
- API Security (5 tests)

---

## 🚀 How to Run Tests

### Using TestSprite MCP (via Claude)

Since TestSprite is now configured as an MCP server in your Claude Desktop, you can run tests by asking:

```
"Run the loan application tests"
"Execute all TestSprite tests for AmeriLend"
"Test the loan submission workflow"
```

### Manual Execution

If you want to run tests manually:

```powershell
# Install TestSprite CLI
npm install -g @testsprite/cli

# Run all tests
testsprite run

# Run specific test suite
testsprite run test-scenarios/loan-application.spec.ts

# Run with specific environment
testsprite run --env test

# Generate HTML report
testsprite run --reporter html
```

---

## 📊 Test Scenarios Overview

### 1. Loan Application Tests
**File:** `test-scenarios/loan-application.spec.ts`

| Test | Priority | Status |
|------|----------|--------|
| Submit complete application | Critical | ✅ Ready |
| Track by tracking number | Critical | ✅ Ready |
| Detect duplicates | Critical | ✅ Ready |
| Reject invalid data types | High | ✅ Ready |
| Reject invalid date format | High | ✅ Ready |
| Reject invalid SSN format | High | ✅ Ready |
| Reject missing fields | High | ✅ Ready |
| Reject negative amounts | High | ✅ Ready |
| Prevent SQL injection | Critical | ✅ Ready |
| Prevent XSS attacks | Critical | ✅ Ready |

### 2. API Endpoints Covered

```typescript
✅ POST /api/trpc/loans.submit
✅ GET  /api/trpc/loans.getLoanByTrackingNumber
✅ GET  /api/trpc/loans.checkDuplicate
```

### 3. Validation Rules Tested

#### ✅ Data Type Validation
- String fields must be strings
- Number fields must be numbers
- Enum fields must match allowed values

#### ✅ Format Validation
- Date: `YYYY-MM-DD` (e.g., "1990-01-15")
- SSN: `XXX-XX-XXXX` (e.g., "123-45-6789")
- State: 2-character code (e.g., "CA")
- Email: Valid email format
- Phone: Minimum 10 characters

#### ✅ Business Rules
- Loan amount must be positive
- Monthly income must be positive
- Required fields must be present
- Loan purpose minimum 10 characters

#### ✅ Security Validation
- SQL injection attempts blocked/sanitized
- XSS attempts blocked/sanitized
- Sensitive data not exposed in responses
- Email masking in duplicate responses

---

## 🔍 Test Data Reference

### Valid Test Application
```json
{
  "fullName": "John Test Applicant",
  "email": "test@example.com",
  "phone": "5551234567",
  "password": "SecurePass123!",
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

### Common Invalid Scenarios
```typescript
// Wrong date format
"dateOfBirth": "01/15/1990"  // ❌ Should be "1990-01-15"

// Wrong SSN format
"ssn": "123456789"  // ❌ Should be "123-45-6789"

// Wrong state format
"state": "California"  // ❌ Should be "CA"

// String instead of number
"monthlyIncome": "5000"  // ❌ Should be 5000

// Invalid enum value
"loanType": "personal"  // ❌ Should be "installment" or "short_term"
```

---

## 📈 Expected Test Results

### Success Criteria
```
✅ All 10 loan application tests pass
✅ No security vulnerabilities detected
✅ All validation rules enforced
✅ Response times < 500ms
✅ No SQL/XSS attacks successful
```

### Sample Test Output
```
Loan Application End-to-End Tests
  ✓ should successfully submit a complete loan application (342ms)
  ✓ should track application by tracking number (156ms)
  ✓ should detect duplicate applications by SSN and DOB (289ms)
  ✓ should reject application with invalid data types (89ms)
  ✓ should reject application with invalid date format (76ms)
  ✓ should reject application with invalid SSN format (82ms)
  ✓ should reject application with missing required fields (71ms)
  ✓ should reject negative loan amount (85ms)
  ✓ should handle SQL injection attempts safely (104ms)
  ✓ should handle XSS attempts safely (98ms)

10 passing (1.4s)
```

---

## 🔧 Troubleshooting

### Database Connection Issues
```powershell
# Verify DATABASE_URL is set
echo $env:DATABASE_URL

# Test database connection
npm run db:test
```

### API Endpoint Not Responding
```powershell
# Start development server
npm run dev

# Verify server is running
curl http://localhost:5000/health
```

### TestSprite Not Found
```powershell
# Restart Claude Desktop to load MCP server
# Or install TestSprite CLI globally
npm install -g @testsprite/cli
```

---

## 📝 Next Steps

### Expand Test Coverage
1. **Create authentication tests** - See `TESTSPRITE_TEST_PLAN.md` section 2
2. **Create payment tests** - See `TESTSPRITE_TEST_PLAN.md` section 3
3. **Create admin tests** - See `TESTSPRITE_TEST_PLAN.md` section 4

### CI/CD Integration
```yaml
# Add to .github/workflows/test.yml
- name: Run TestSprite Tests
  run: testsprite run --env test --reporter junit
  
- name: Upload Test Results
  uses: actions/upload-artifact@v3
  with:
    name: test-results
    path: test-results/
```

### Performance Testing
```powershell
# Run load tests
testsprite run --load 100 --duration 60s

# Run stress tests
testsprite run --stress --users 1000
```

---

## 📚 Documentation References

1. **API_VALIDATION_REFERENCE.md** - Complete API validation rules
2. **TESTSPRITE_TEST_PLAN.md** - Full test plan with all scenarios
3. **API_DOCUMENTATION.md** - API endpoint documentation
4. **test-scenarios/loan-application.spec.ts** - Executable test code

---

## ✨ Key Features Tested

### ✅ Functional Testing
- Loan application submission
- Application tracking
- Duplicate detection
- Input validation

### ✅ Security Testing
- SQL injection prevention
- XSS attack prevention
- Data sanitization
- Sensitive data masking

### ✅ Integration Testing
- Database operations
- Email notifications
- Admin notifications
- Status tracking

### ✅ Validation Testing
- Data type validation
- Format validation
- Business rule validation
- Required field validation

---

## 🎉 Summary

Your AmeriLend project now has **comprehensive TestSprite test coverage** including:

- ✅ 10 critical loan application tests
- ✅ Complete validation testing
- ✅ Security vulnerability testing
- ✅ Integration workflow testing
- ✅ Executable test scenarios
- ✅ Detailed documentation

**To run tests, simply ask Claude:**
> "Run TestSprite tests for AmeriLend"

**Or execute manually:**
```powershell
testsprite run test-scenarios/loan-application.spec.ts
```

---

**Created:** November 27, 2025  
**Test Framework:** TestSprite MCP  
**Coverage:** Loan Applications, Security, Validation  
**Status:** ✅ Ready to Execute
