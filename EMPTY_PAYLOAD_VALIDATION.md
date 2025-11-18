# Empty Payload Validation Implementation

## Overview
The empty payload validation system ensures that API endpoints receiving POST/PUT/PATCH requests have valid, non-empty request bodies. This prevents processing of incomplete or malformed requests and provides clear error messages to clients.

## Features

### 1. **Automatic Empty Payload Detection**
- Detects truly empty request bodies (null, undefined)
- Distinguishes between empty strings and valid payloads
- Supports configurable validation for empty objects and arrays

### 2. **Content Length Validation**
- Validates minimum and maximum content length
- Returns appropriate HTTP status codes (400 for too small, 413 for too large)
- Configurable size limits

### 3. **Flexible Configuration**
- Exclude specific HTTP methods (GET, HEAD, DELETE, OPTIONS by default)
- Exclude specific API paths
- Allow empty objects/arrays on a per-route basis
- Configure minimum payload size

### 4. **Standardized Error Responses**
All validation errors follow the standard response format:
```json
{
  "success": false,
  "error": {
    "code": "EMPTY_PAYLOAD",
    "message": "Invalid input: Empty or missing payload",
    "details": {
      "reason": "Payload is null or undefined",
      "expected": "Non-empty JSON object or array",
      "received": "Empty or missing payload"
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

## Architecture

### Files Created/Modified

#### **`server/_core/payload-validator.ts`** (New - 570+ lines)
Comprehensive payload validation system with multiple validation strategies:

**Core Functions:**
- `isEmptyPayload()` - Checks if payload is empty with detailed reasoning
- `validatePayload()` - Main middleware for validating request payloads
- `validateContentLength()` - Validates request body size
- `validateRequiredFields()` - Checks for specific required fields

**Classes:**
- `PayloadValidator` - Flexible validator with custom rules
- `StrictPayloadValidator` - Enforces strict validation rules

**Utilities:**
- `createEmptyPayloadErrorResponse()` - Generates standardized error responses
- `createMissingFieldsErrorResponse()` - Creates missing field errors
- `createCommonPayloadValidator()` - Factory for common use case validator

#### **`server/_core/index.ts`** (Modified)
Added payload validation middleware to the Express middleware stack:

**Changes:**
- Imported payload validation utilities
- Added `validateContentLength` middleware (min 1B, max 50MB)
- Added `validatePayload` middleware with proper configuration
- Positioned in correct middleware order (after body parsing, before routes)

### Middleware Stack Order (Correct Sequence)

```
1. express.json() ─────────────────────── Parse JSON body
2. ensureJsonHeaders ──────────────────── Wrap res.json()
3. malformedJsonHandler ───────────────── Catch parse errors
4. validateJsonRequest ────────────────── Validate Content-Type
5. validateContentLength ──────────────── Check body size
6. validatePayload ────────────────────── Check for empty payload ✓ NEW
7. CSP headers ────────────────────────── Security headers
8. multer config ──────────────────────── File uploads
9. Routes (OAuth, health, tRPC) ──────── Application logic
10. notFoundHandler ───────────────────── 404 handling
11. errorHandlerMiddleware ───────────── Global error handler
```

## Configuration

### Basic Configuration
```typescript
// Default configuration (already set in index.ts)
app.use(validatePayload({
  allowEmpty: false,                    // Reject empty payloads
  allowEmptyArrays: true,               // Allow []
  allowEmptyObjects: true,              // Allow {}
  excludePaths: [                       // Skip validation on these paths
    "/api/trpc",
    "/api/oauth",
    "/health"
  ],
  excludeMethods: [                     // Skip validation for these methods
    "GET",
    "HEAD",
    "DELETE",
    "OPTIONS"
  ],
}));
```

### Custom Configuration Examples

#### Strict Validation (Reject Empty Objects/Arrays)
```typescript
app.use(validatePayload({
  allowEmpty: false,
  allowEmptyArrays: false,              // Reject []
  allowEmptyObjects: false,             // Reject {}
  minSize: 10,                          // Minimum 10 bytes
}));
```

#### Content Length Validation
```typescript
// Minimum 1 byte, maximum 10MB
app.use(validateContentLength(1, 10 * 1024 * 1024));
```

#### Custom Validator with Rules
```typescript
const validator = new PayloadValidator();

// Add custom validation rules
validator.addRule("has-name-field", (body) => {
  if (!body?.name) {
    return { valid: false, error: "Field 'name' is required" };
  }
  return { valid: true };
});

validator.addRule("valid-email", (body) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (body?.email && !emailRegex.test(body.email)) {
    return { valid: false, error: "Invalid email format" };
  }
  return { valid: true };
});

// Exclude specific paths
validator.excludePath("/api/webhooks");

// Get middleware
app.use(validator.middleware());
```

#### Strict Payload Validator
```typescript
const strict = new StrictPayloadValidator();

// This validator enforces:
// - No empty objects {}
// - No empty arrays []
// - No null values in fields
// - Valid JSON serialization

app.use(strict.middleware());
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `EMPTY_PAYLOAD` | 400 | Request body is empty or missing |
| `INVALID_PAYLOAD` | 400 | Payload failed validation rules |
| `CONTENT_TOO_SMALL` | 400 | Request body too small |
| `CONTENT_TOO_LARGE` | 413 | Request body exceeds size limit |
| `MISSING_REQUIRED_FIELDS` | 422 | Required fields are missing |

## Usage Examples

### Example 1: Catch Empty POST Request
```bash
curl -X POST http://localhost:3000/api/trpc/users.create \
  -H "Content-Type: application/json" \
  -d ''
```

**Response (400):**
```json
{
  "success": false,
  "error": {
    "code": "EMPTY_PAYLOAD",
    "message": "Invalid input: Empty or missing payload",
    "details": {
      "reason": "Payload is null or undefined",
      "expected": "Non-empty JSON object or array",
      "received": "Empty or missing payload"
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Example 2: Catch Empty Object Without allowEmptyObjects
```bash
curl -X POST http://localhost:3000/api/loans/create \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Response (400):**
```json
{
  "success": false,
  "error": {
    "code": "EMPTY_PAYLOAD",
    "message": "Invalid input: Empty or missing payload",
    "details": {
      "reason": "Payload is an empty object",
      "expected": "Non-empty JSON object or array",
      "received": "Empty or missing payload"
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Example 3: Catch Empty String Payload
```bash
curl -X POST http://localhost:3000/api/payments/process \
  -H "Content-Type: application/json" \
  -d '   '  # whitespace only
```

**Response (400):**
```json
{
  "success": false,
  "error": {
    "code": "EMPTY_PAYLOAD",
    "message": "Invalid input: Empty or missing payload",
    "details": {
      "reason": "Payload is an empty string",
      "expected": "Non-empty JSON object or array",
      "received": "Empty or missing payload"
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Example 4: Catch Request Body Too Large
```bash
# Create a file with 51MB of data
dd if=/dev/zero bs=1M count=51 | base64 > large_file.txt

curl -X POST http://localhost:3000/api/documents/upload \
  -H "Content-Type: application/json" \
  --data-binary @large_file.txt
```

**Response (413):**
```json
{
  "success": false,
  "error": {
    "code": "CONTENT_TOO_LARGE",
    "message": "Request body is too large",
    "details": {
      "max": 52428800,
      "received": 67108864
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Example 5: Valid Request Still Passes
```bash
curl -X POST http://localhost:3000/api/trpc/users.create \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@example.com"}'
```

**Response (200 - passes validation, processes normally):**
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "name": "John",
    "email": "john@example.com"
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Example 6: GET Requests Are Not Validated
```bash
curl -X GET http://localhost:3000/api/trpc/users.list
```

**Response (200 - GET is excluded by default):**
```json
{
  "success": true,
  "data": [
    { "id": "user_1", "name": "Alice" },
    { "id": "user_2", "name": "Bob" }
  ],
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

## Integration Points

### With Field Validation
Payload validation runs BEFORE field-level validation:

1. **Payload Validation** ← Empty payload check (NEW)
2. **Body Parsing** ← JSON converted to object
3. **Field Validation** ← Missing field detection (existing)
4. **Business Logic** ← Processing (existing)

Example flow:
```
Request: POST {} 
  ↓ (validatePayload middleware)
Caught: Empty object → Error 400
  ↓
Client receives: EMPTY_PAYLOAD error

Request: POST {"name":""}
  ↓ (validatePayload middleware)
Passes: Valid object structure
  ↓ (Field validation - existing)
Caught: Empty string for required field
  ↓
Client receives: MISSING_REQUIRED_FIELD error
```

### With Global Error Handler
If payload validation catches an issue, the response is sent directly without reaching the global error handler. The error is already formatted and sent.

### With tRPC
tRPC routes are excluded by default (`/api/trpc` in excludePaths) because tRPC has its own validation system. However, you can enable validation for tRPC if needed:

```typescript
// Enable validation for tRPC
app.use(validatePayload({
  excludePaths: ["/api/oauth", "/health"],  // Remove /api/trpc from exclude list
  // ... other options
}));
```

## Testing Checklist

- [ ] **Empty payload (no body)**
  - `curl -X POST http://localhost:3000/api/test -d ''` → 400 EMPTY_PAYLOAD

- [ ] **Empty object without config**
  - `curl -X POST http://localhost:3000/api/test -d '{}'` → Depends on allowEmptyObjects

- [ ] **Empty array without config**
  - `curl -X POST http://localhost:3000/api/test -d '[]'` → Depends on allowEmptyArrays

- [ ] **Whitespace-only payload**
  - `curl -X POST http://localhost:3000/api/test -d '   '` → 400 EMPTY_PAYLOAD

- [ ] **Valid payload passes through**
  - `curl -X POST http://localhost:3000/api/test -d '{"key":"value"}'` → Passes validation

- [ ] **GET requests skip validation**
  - `curl -X GET http://localhost:3000/api/test` → No validation

- [ ] **Excluded paths skip validation**
  - `curl -X POST http://localhost:3000/health -d ''` → Passes (excluded path)

- [ ] **Large payloads rejected**
  - Send 51MB+ body → 413 CONTENT_TOO_LARGE

- [ ] **Small payloads accepted**
  - Send valid small JSON → Passes validation

- [ ] **Multiple validation rules**
  - Use PayloadValidator with custom rules → All rules checked

## Performance Considerations

### Validation Overhead
- **Empty check**: O(1) - immediate check
- **Content-length validation**: O(1) - header check
- **Safe stringification**: O(n) - only if creating error response
- **Typical request**: < 1ms overhead

### Optimization Tips
1. Exclude paths that don't need validation
2. Use allowEmptyObjects/allowEmptyArrays when safe
3. Set appropriate content length limits
4. Avoid deep nesting in custom validators

## Security Considerations

1. **DoS Prevention**
   - Content-length validation prevents memory exhaustion
   - Default max size is 50MB (configurable)

2. **Injection Prevention**
   - Validation happens before business logic
   - Empty payloads can't bypass subsequent validation

3. **Information Disclosure**
   - Error messages are sanitized
   - No internal stack traces in production

## Troubleshooting

### Issue: Valid empty objects rejected
**Solution**: Enable `allowEmptyObjects`:
```typescript
validatePayload({
  allowEmptyObjects: true,
  // ...
})
```

### Issue: Large valid files rejected
**Solution**: Increase size limit:
```typescript
validateContentLength(1, 100 * 1024 * 1024) // 100MB
```

### Issue: Validation too strict
**Solution**: Use allowEmpty flag:
```typescript
validatePayload({
  allowEmpty: true,  // Skip validation for this route
  // ...
})
```

### Issue: Custom validation rule not working
**Solution**: Ensure rule returns proper format:
```typescript
validator.addRule("my-rule", (body) => {
  // Must return object with { valid: boolean; error?: string }
  return { valid: true }; // or { valid: false, error: "reason" }
});
```

## Future Enhancements

1. **Payload Size Metrics**
   - Track average payload sizes
   - Alert on unusual patterns

2. **Rate Limiting Integration**
   - Combine with rate limiting middleware
   - Reject excessive empty payloads from same source

3. **Schema Validation**
   - Integrate with JSON Schema validation
   - Validate structure before business logic

4. **Compression Support**
   - Handle gzip/deflate encoded payloads
   - Validate decompressed size

5. **Streaming Support**
   - Validate streaming payloads
   - Progressive validation for large uploads

## Deployment Notes

### Environment Variables
No specific environment variables required. Configuration is done via middleware options.

### Backwards Compatibility
- ✅ Existing endpoints unaffected (excludes tRPC, OAuth, health)
- ✅ GET/HEAD/DELETE requests unaffected
- ✅ Valid payloads pass through unchanged
- ✅ Only empty payloads are rejected

### Migration Guide
The validation is automatically applied to:
- POST endpoints (except excluded paths)
- PUT endpoints (except excluded paths)
- PATCH endpoints (except excluded paths)

No code changes needed in individual routes.

## Related Documentation
- See `JSON_RESPONSE_GUARANTEE.md` for response formatting
- See `FIELD_VALIDATION_ERRORS.md` for field-level validation
- See `API_RESPONSE_QUICK_REFERENCE.md` for quick error reference
