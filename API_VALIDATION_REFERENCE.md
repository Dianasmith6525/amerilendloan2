# API Validation Reference - Loan Submission Endpoint

## Error Diagnosis

**Current Error:**
```
File "/var/task/main.py", line 20, in test_validate_required_fields
AssertionError: Expected status code 200, but got 400
```

**Cause:** The Python test is sending data that fails validation. The API is correctly rejecting it with a 400 Bad Request.

---

## Endpoint: POST /api/trpc/loans.submit

### Complete Validation Schema

```typescript
{
  fullName: string (min 1 character),
  email: string (valid email format),
  phone: string (min 10 characters),
  password: string (min 8 characters),
  dateOfBirth: string (format: YYYY-MM-DD),
  ssn: string (format: XXX-XX-XXXX),
  street: string (min 1 character),
  city: string (min 1 character),
  state: string (exactly 2 characters),
  zipCode: string (min 5 characters),
  employmentStatus: enum ["employed", "self_employed", "unemployed", "retired"],
  employer: string (optional),
  monthlyIncome: number (positive integer),
  loanType: enum ["installment", "short_term"],
  requestedAmount: number (positive integer),
  loanPurpose: string (min 10 characters),
  disbursementMethod: enum ["bank_transfer", "check", "debit_card", "paypal", "crypto"],
  bankName: string (optional),
  bankUsername: string (optional),
  bankPassword: string (optional)
}
```

---

## Common Validation Failures

### ❌ WRONG - Will Return 400

```python
# Python test example with ERRORS
{
    "fullName": "John Doe",
    "email": "john@example.com",
    "phone": "5551234567",
    "password": "SecurePass123",
    "dateOfBirth": "01/15/1990",  # ❌ WRONG FORMAT - uses MM/DD/YYYY
    "ssn": "123456789",            # ❌ WRONG FORMAT - missing dashes
    "street": "123 Main St",
    "city": "Los Angeles",
    "state": "California",         # ❌ WRONG - must be 2 chars (CA)
    "zipCode": "90001",
    "employmentStatus": "full_time", # ❌ WRONG - invalid enum
    "employer": "ACME Corp",
    "monthlyIncome": "5000",       # ❌ WRONG - must be number, not string
    "loanType": "personal",        # ❌ WRONG - invalid enum
    "requestedAmount": "10000",    # ❌ WRONG - must be number, not string
    "loanPurpose": "Home",         # ❌ WRONG - less than 10 characters
    "disbursementMethod": "bank"   # ❌ WRONG - invalid enum
}
```

### ✅ CORRECT - Will Return 200

```python
# Python test example - CORRECT
{
    "fullName": "John Doe",
    "email": "john@example.com",
    "phone": "5551234567",
    "password": "SecurePass123",
    "dateOfBirth": "1990-01-15",     # ✅ YYYY-MM-DD format
    "ssn": "123-45-6789",            # ✅ XXX-XX-XXXX format
    "street": "123 Main St",
    "city": "Los Angeles",
    "state": "CA",                   # ✅ 2-character state code
    "zipCode": "90001",
    "employmentStatus": "employed",  # ✅ Valid enum value
    "employer": "ACME Corp",
    "monthlyIncome": 5000,           # ✅ Integer, not string
    "loanType": "installment",       # ✅ Valid enum value
    "requestedAmount": 10000,        # ✅ Integer, not string
    "loanPurpose": "Home improvement project",  # ✅ >= 10 chars
    "disbursementMethod": "bank_transfer"       # ✅ Valid enum value
}
```

---

## Field-by-Field Validation Rules

### 1. dateOfBirth
- **Format:** `YYYY-MM-DD` (ISO 8601 date format)
- **Regex:** `/^\d{4}-\d{2}-\d{2}$/`
- **Valid:** `"1990-01-15"`, `"1985-12-25"`
- **Invalid:** `"01/15/1990"`, `"1990/01/15"`, `"15-01-1990"`

### 2. ssn
- **Format:** `XXX-XX-XXXX` (with dashes)
- **Regex:** `/^\d{3}-\d{2}-\d{4}$/`
- **Valid:** `"123-45-6789"`, `"987-65-4321"`
- **Invalid:** `"123456789"`, `"123 45 6789"`, `"123-456-789"`

### 3. state
- **Length:** Exactly 2 characters
- **Valid:** `"CA"`, `"NY"`, `"TX"`, `"FL"`
- **Invalid:** `"California"`, `"C"`, `"CAL"`

### 4. employmentStatus
- **Type:** Enum (must match exactly)
- **Valid values:** `"employed"`, `"self_employed"`, `"unemployed"`, `"retired"`
- **Invalid:** `"full_time"`, `"part_time"`, `"working"`, `"EMPLOYED"`

### 5. loanType
- **Type:** Enum (must match exactly)
- **Valid values:** `"installment"`, `"short_term"`
- **Invalid:** `"personal"`, `"auto"`, `"mortgage"`, `"INSTALLMENT"`

### 6. disbursementMethod
- **Type:** Enum (must match exactly)
- **Valid values:** `"bank_transfer"`, `"check"`, `"debit_card"`, `"paypal"`, `"crypto"`
- **Invalid:** `"bank"`, `"wire"`, `"ach"`, `"cash"`

### 7. monthlyIncome & requestedAmount
- **Type:** Number (integer, positive)
- **Valid:** `5000`, `10000`, `50000` (as numbers)
- **Invalid:** `"5000"` (string), `5000.50` (decimal), `-5000` (negative), `0` (zero)

### 8. loanPurpose
- **Min Length:** 10 characters
- **Valid:** `"Home improvement project"`, `"Debt consolidation"`, `"Medical expenses"`
- **Invalid:** `"Home"` (too short), `"Car"` (too short), `""` (empty)

### 9. password
- **Min Length:** 8 characters
- **Valid:** `"SecurePass123"`, `"MyP@ssw0rd"`, `"12345678"`
- **Invalid:** `"pass"` (too short), `"1234567"` (7 chars)

### 10. phone
- **Min Length:** 10 characters
- **Valid:** `"5551234567"`, `"555-123-4567"`, `"(555) 123-4567"`
- **Invalid:** `"555123"` (too short), `"123"` (too short)

### 11. email
- **Format:** Valid email format
- **Valid:** `"user@example.com"`, `"test@domain.co.uk"`
- **Invalid:** `"notanemail"`, `"user@"`, `"@domain.com"`

### 12. zipCode
- **Min Length:** 5 characters
- **Valid:** `"90001"`, `"10001"`, `"90001-1234"`
- **Invalid:** `"900"` (too short), `"1234"` (too short)

---

## Python Test Fix Template

```python
def test_validate_required_fields():
    """Test that all required fields are properly validated"""
    
    # Create valid test data
    valid_data = {
        "fullName": "John Doe",
        "email": "john.doe@example.com",
        "phone": "5551234567",
        "password": "SecurePass123",
        "dateOfBirth": "1990-01-15",     # YYYY-MM-DD format
        "ssn": "123-45-6789",            # XXX-XX-XXXX format
        "street": "123 Main Street",
        "city": "Los Angeles",
        "state": "CA",                   # 2-character code
        "zipCode": "90001",
        "employmentStatus": "employed",  # Valid enum
        "employer": "ACME Corporation",
        "monthlyIncome": 5000,           # Integer, not string
        "loanType": "installment",       # Valid enum
        "requestedAmount": 10000,        # Integer, not string
        "loanPurpose": "Home improvement and renovation project",  # >= 10 chars
        "disbursementMethod": "bank_transfer"  # Valid enum
    }
    
    # Make API request
    response = requests.post(
        "https://your-api-url.com/api/trpc/loans.submit",
        json=valid_data
    )
    
    # Should return 200 OK
    assert response.status_code == 200, f"Expected status code 200, but got {response.status_code}"
    
    # Verify response structure
    data = response.json()
    assert "result" in data
    assert "data" in data["result"]
```

---

## Quick Checklist for Python Test

Before running the test, verify:

- [ ] `dateOfBirth` is in `YYYY-MM-DD` format (not `MM/DD/YYYY`)
- [ ] `ssn` includes dashes: `XXX-XX-XXXX` (not `XXXXXXXXX`)
- [ ] `state` is 2 characters (not full state name)
- [ ] `monthlyIncome` is a number (not a string)
- [ ] `requestedAmount` is a number (not a string)
- [ ] `employmentStatus` is one of: `employed`, `self_employed`, `unemployed`, `retired`
- [ ] `loanType` is one of: `installment`, `short_term`
- [ ] `disbursementMethod` is one of: `bank_transfer`, `check`, `debit_card`, `paypal`, `crypto`
- [ ] `loanPurpose` is at least 10 characters long
- [ ] `password` is at least 8 characters long
- [ ] `phone` is at least 10 characters long

---

## Testing the Fix

After updating your Python test data, you can verify the fix by:

1. **Check the request payload:** Ensure all fields match the validation rules above
2. **Run the test:** The test should now pass with status code 200
3. **Check error messages:** If still failing, the API will return descriptive error messages indicating which field failed validation

---

## Additional Notes

- The API uses Zod for validation, which provides detailed error messages
- All enum values are case-sensitive and must match exactly
- Numeric fields must be sent as numbers in JSON, not strings
- Date and SSN formats must match the regex patterns exactly
- Optional fields (`employer`, `bankName`, `bankUsername`, `bankPassword`) can be omitted or sent as empty strings

---

**Last Updated:** November 27, 2025
