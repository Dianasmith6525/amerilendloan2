# Empty Payload Validation - Quick Reference

## What It Does
Automatically rejects POST/PUT/PATCH requests with empty or missing request bodies before they reach your business logic.

## Quick Start

### Default Behavior (Already Configured)
```typescript
// In server/_core/index.ts - automatically enabled
validatePayload({
  allowEmpty: false,                    // Reject truly empty payloads
  allowEmptyArrays: true,               // Allow []
  allowEmptyObjects: true,              // Allow {}
  excludePaths: ["/api/trpc", "/api/oauth", "/health"],
  excludeMethods: ["GET", "HEAD", "DELETE", "OPTIONS"],
})
```

### Test It
```bash
# This will fail (empty body)
curl -X POST http://localhost:3000/api/test -H "Content-Type: application/json" -d ''

# This will succeed (valid object)
curl -X POST http://localhost:3000/api/test -H "Content-Type: application/json" -d '{"name":"test"}'

# This will succeed (empty object - allowed by default)
curl -X POST http://localhost:3000/api/test -H "Content-Type: application/json" -d '{}'

# This will succeed (empty array - allowed by default)
curl -X POST http://localhost:3000/api/test -H "Content-Type: application/json" -d '[]'

# This will fail (GET requests skip validation)
curl -X GET http://localhost:3000/api/test
```

## Error Response Format
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

## Common Validation Reasons
| Reason | When It Happens |
|--------|-----------------|
| `Payload is null or undefined` | POST body is completely empty |
| `Payload is an empty string` | POST body is whitespace only |
| `Payload is an empty object` | POST body is `{}` (if not allowed) |
| `Payload is an empty array` | POST body is `[]` (if not allowed) |

## Configure for Your Route

### Strict Validation (Reject Empty Objects/Arrays)
```typescript
// Import in your router or middleware
import { validatePayload } from "./server/_core/payload-validator";

// For a specific route
router.post("/strict-endpoint", 
  validatePayload({
    allowEmptyObjects: false,    // Reject {}
    allowEmptyArrays: false,     // Reject []
  }),
  // ... your handler
);
```

### Allow Empty Payloads (Rare Cases)
```typescript
router.post("/webhook", 
  validatePayload({
    allowEmpty: true,  // Accept any payload including empty
  }),
  // ... your handler
);
```

### Custom Rules
```typescript
import { PayloadValidator } from "./server/_core/payload-validator";

const validator = new PayloadValidator();

validator.addRule("has-name", (body) => {
  if (!body?.name) {
    return { valid: false, error: "Name field required" };
  }
  return { valid: true };
});

// Use it
app.use("/api/users", validator.middleware());
```

## HTTP Status Codes
- **400**: Empty payload or validation failed
- **413**: Request body too large (> 50MB)
- **422**: Missing required fields (different validation)

## Files Involved
- **`server/_core/payload-validator.ts`** - Core validation logic
- **`server/_core/index.ts`** - Middleware integration
- **`server/_core/error-handler.ts`** - Error handling
- **`server/_core/response-formatter.ts`** - Response formatting

## Integration with Other Systems

### With Field Validation
Payload validation runs first, then field-level validation:
```
Empty check → Body parsed → Field validation → Business logic
```

### With Global Error Handler
Payload validation errors are sent directly before reaching the error handler.

### With tRPC
tRPC is excluded by default since it has its own validation. To enable:
```typescript
validatePayload({
  excludePaths: ["/api/oauth", "/health"],  // Remove /api/trpc
})
```

## Performance Impact
- **Empty check**: < 1ms (just a type check)
- **Total overhead**: Typically < 1ms per request
- **No significant performance impact**

## Monitoring & Debugging

### Enable Debug Logging
Look for console output:
```
[Payload Validation] Empty payload on POST /api/test: Payload is null or undefined
```

### Check Validation Rules
Use the PayloadValidator class:
```typescript
const validator = new PayloadValidator();
const result = validator.validate({ name: "test" }, ["not-empty"]);
console.log(result.valid); // true
console.log(result.errors); // []
```

## Common Patterns

### Pattern 1: API Endpoint Validation
```typescript
// Validate non-empty POST
router.post("/users/create", async (req, res) => {
  // Validation already done by middleware
  // Safe to use req.body
  const user = await createUser(req.body);
  res.json({ success: true, data: user });
});
```

### Pattern 2: Webhook Handler
```typescript
// Allow empty webhooks
router.post("/webhooks/github",
  validatePayload({ allowEmpty: true }),
  webhookHandler
);
```

### Pattern 3: Batch Operations
```typescript
// Require non-empty array
router.post("/batch/process",
  validatePayload({
    allowEmptyArrays: false,  // Must have at least one item
  }),
  batchHandler
);
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `"code": "EMPTY_PAYLOAD"` | Send a non-empty body |
| `"code": "CONTENT_TOO_LARGE"` | Send payload < 50MB |
| Validation not working | Check excluded paths/methods |
| Empty objects still allowed | Set `allowEmptyObjects: false` |

## See Also
- `EMPTY_PAYLOAD_VALIDATION.md` - Full documentation
- `JSON_RESPONSE_GUARANTEE.md` - Response formatting
- `FIELD_VALIDATION_ERRORS.md` - Field-level validation
- `API_RESPONSE_QUICK_REFERENCE.md` - All error codes
