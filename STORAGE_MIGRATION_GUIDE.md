# Document Storage Migration Guide

## Current Status: ✅ Already Configured for External Storage!

The application is **already designed** to use external file storage via the Forge API. The upload system stores files externally and only uses Base64 as a fallback when storage credentials are missing.

---

## Storage Architecture

### Upload Flow
```
1. User selects file in UI
   ↓
2. File sent to `/api/upload-document` endpoint
   ↓
3. Server authenticates user
   ↓
4. Server attempts external storage upload (Forge API)
   ├─ Success → Returns storage URL
   └─ Failure → Falls back to Base64 data URL
   ↓
5. Client receives URL and saves to database via TRPC
   ↓
6. Database stores URL in `uploadedDocuments.storagePath` field
```

### Database Schema
```typescript
export const uploadedDocuments = pgTable("uploadedDocuments", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  documentType: documentTypeEnum("documentType").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  storagePath: varchar("storagePath", { length: 500 }).notNull(), // ✅ Stores URL
  fileSize: integer("fileSize").notNull(),
  mimeType: varchar("mimeType", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  // ... other fields
});
```

---

## Environment Configuration

### Required Environment Variables

```bash
# External Storage (Forge API)
BUILT_IN_FORGE_API_URL=https://your-storage-api.com
BUILT_IN_FORGE_API_KEY=your-api-key-here
```

### Check Current Configuration

**Server Startup Logs:**
```
[Environment] All critical environment variables configured ✓
[Environment] DATABASE_URL is configured ✓
```

**Test Upload:**
- If configured: `[Upload] Uploading to storage: verification-documents/1/...`
- If missing: `[Upload] Storage not configured (missing FORGE_API_URL or FORGE_API_KEY), using base64 fallback`

---

## Storage Providers

### Current: Forge API (Built-in)
The application uses Manus WebDev's Forge storage proxy.

**Implementation:** `server/storage.ts`
```typescript
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });
  
  const url = (await response.json()).url;
  return { key, url };
}
```

### Alternative: AWS S3

To migrate to AWS S3, update `server/storage.ts`:

```typescript
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const bucket = process.env.AWS_S3_BUCKET!;
  const key = normalizeKey(relKey);
  
  await s3Client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: data instanceof Buffer ? data : Buffer.from(data),
    ContentType: contentType,
  }));
  
  const url = `https://${bucket}.s3.amazonaws.com/${key}`;
  return { key, url };
}
```

**Environment Variables:**
```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=amerilend-documents
```

### Alternative: Cloudflare R2

```typescript
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET!;
  const key = normalizeKey(relKey);
  
  await r2Client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: data instanceof Buffer ? data : Buffer.from(data),
    ContentType: contentType,
  }));
  
  // Use custom domain or R2 public URL
  const url = `https://${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`;
  return { key, url };
}
```

**Environment Variables:**
```bash
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_R2_ACCESS_KEY_ID=your-access-key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-secret-key
CLOUDFLARE_R2_BUCKET=amerilend-documents
CLOUDFLARE_R2_PUBLIC_URL=documents.amerilend.com
```

---

## Migration Steps (If Needed)

### Step 1: Identify Base64 Documents

```sql
-- Find documents stored as Base64 data URLs
SELECT id, userId, filename, 
  CASE 
    WHEN storagePath LIKE 'data:%' THEN 'Base64'
    ELSE 'External'
  END as storage_type,
  LENGTH(storagePath) as url_length
FROM uploadedDocuments
WHERE storagePath LIKE 'data:%';
```

### Step 2: Extract and Re-upload

Create migration script `scripts/migrate-base64-to-storage.ts`:

```typescript
import { db } from "../server/db";
import { storagePut } from "../server/storage";

async function migrateBase64Documents() {
  // Get all Base64 documents
  const documents = await db.query(`
    SELECT * FROM uploadedDocuments 
    WHERE storagePath LIKE 'data:%'
  `);
  
  console.log(`Found ${documents.length} Base64 documents to migrate`);
  
  for (const doc of documents) {
    try {
      // Extract Base64 data
      const match = doc.storagePath.match(/^data:(.+?);base64,(.+)$/);
      if (!match) {
        console.error(`Invalid Base64 format for document ${doc.id}`);
        continue;
      }
      
      const [, mimeType, base64Data] = match;
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Upload to external storage
      const key = `migrated-documents/${doc.userId}/${doc.id}-${doc.filename}`;
      const { url } = await storagePut(key, buffer, mimeType);
      
      // Update database
      await db.query(`
        UPDATE uploadedDocuments 
        SET storagePath = ? 
        WHERE id = ?
      `, [url, doc.id]);
      
      console.log(`✓ Migrated document ${doc.id}: ${doc.filename}`);
    } catch (error) {
      console.error(`✗ Failed to migrate document ${doc.id}:`, error);
    }
  }
  
  console.log('Migration complete!');
}

migrateBase64Documents().catch(console.error);
```

**Run Migration:**
```bash
tsx scripts/migrate-base64-to-storage.ts
```

### Step 3: Verify Migration

```sql
-- Check all documents are now using external storage
SELECT 
  COUNT(*) as total_documents,
  SUM(CASE WHEN storagePath LIKE 'data:%' THEN 1 ELSE 0 END) as base64_count,
  SUM(CASE WHEN storagePath LIKE 'http%' THEN 1 ELSE 0 END) as external_count
FROM uploadedDocuments;
```

Expected result:
```
total_documents | base64_count | external_count
----------------|--------------|---------------
      150       |      0       |      150
```

---

## Monitoring & Maintenance

### Log Analysis

**Successful External Upload:**
```
[Upload] Uploading to storage: verification-documents/123/1699999999-passport.jpg
[Upload] Storage upload successful, URL length: 85
```

**Fallback to Base64:**
```
[Upload] Storage failed, using fallback: Storage proxy credentials missing
[Upload] Using base64 fallback, URL length: 234567
```

### Health Checks

Add storage health check to `server/_core/index.ts`:

```typescript
app.get("/api/health/storage", async (req, res) => {
  try {
    // Test upload small file
    const testData = Buffer.from("test");
    const { url } = await storagePut("health-check/test.txt", testData, "text/plain");
    
    // Test download
    const response = await fetch(url);
    if (!response.ok) throw new Error("Download failed");
    
    res.json({ status: "healthy", storage: "external" });
  } catch (error) {
    res.json({ 
      status: "degraded", 
      storage: "fallback", 
      error: error instanceof Error ? error.message : "Unknown error" 
    });
  }
});
```

### Storage Costs

**Base64 in Database:**
- 1MB image = ~1.37MB Base64 = expensive DB storage
- Slow queries due to large TEXT fields
- Not scalable

**External Storage (S3/R2):**
- 1MB image = 1MB storage = $0.023/GB/month (S3)
- Fast queries (only URL in database)
- CDN integration possible
- Highly scalable

**Cost Comparison (1000 users, 3 docs each, 2MB avg):**
| Storage Type | DB Size | Cost/Month | Query Speed |
|--------------|---------|------------|-------------|
| Base64 | 8.22 GB | $20 (RDS) | Slow |
| S3 | 6 GB | $0.14 (S3) | Fast |

---

## Security Best Practices

### 1. Signed URLs (Recommended)

Modify `server/storage.ts` to return temporary signed URLs:

```typescript
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export async function storageGet(
  relKey: string,
  expiresIn = 3600 // 1 hour
): Promise<{ key: string; url: string }> {
  const bucket = process.env.AWS_S3_BUCKET!;
  const key = normalizeKey(relKey);
  
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const url = await getSignedUrl(s3Client, command, { expiresIn });
  
  return { key, url };
}
```

### 2. File Validation

Already implemented in `server/_core/index.ts`:

```typescript
fileFilter: (req, file, cb) => {
  const allowedMimes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "application/pdf",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type"));
  }
}
```

### 3. Virus Scanning (Optional)

Integrate ClamAV or AWS Macie:

```typescript
import { execSync } from "child_process";

function scanFile(buffer: Buffer): boolean {
  // Write to temp file
  const tempPath = `/tmp/${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, buffer);
  
  try {
    execSync(`clamscan ${tempPath}`);
    return true; // Clean
  } catch (error) {
    return false; // Infected
  } finally {
    fs.unlinkSync(tempPath);
  }
}
```

---

## Rollback Plan

If issues occur after migration:

### 1. Backup Database
```bash
mysqldump -u user -p amerilend > backup_before_migration.sql
```

### 2. Keep Base64 Fallback
The current code already has fallback logic - just remove credentials to revert.

### 3. Restore from Backup
```bash
mysql -u user -p amerilend < backup_before_migration.sql
```

---

## Performance Optimization

### 1. CDN Integration

Use CloudFront or Cloudflare CDN:

```typescript
const CDN_URL = process.env.CDN_URL || `https://${bucket}.s3.amazonaws.com`;

export async function storagePut(...): Promise<{ key: string; url: string }> {
  // ... upload logic ...
  
  const url = `${CDN_URL}/${key}`;
  return { key, url };
}
```

### 2. Image Optimization

Add image resizing on upload:

```bash
npm install sharp
```

```typescript
import sharp from "sharp";

async function optimizeImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(1920, 1920, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}
```

### 3. Lazy Loading

Client-side optimization in `VerificationUpload.tsx`:

```tsx
<img 
  src={document.storagePath} 
  loading="lazy"
  alt={document.filename}
/>
```

---

## Testing Checklist

- [ ] Upload document with storage configured → External URL
- [ ] Upload document without storage → Base64 fallback
- [ ] View uploaded document → Loads correctly
- [ ] Download document → File downloads
- [ ] Check database → `storagePath` contains URL
- [ ] Admin review document → Displays correctly
- [ ] Migrate Base64 to external → Script completes
- [ ] Verify migration → All URLs are external

---

## Summary

### Current State ✅
- System **already uses external storage** when configured
- Falls back to Base64 only when credentials missing
- Database schema supports URL storage (500 char limit)
- Upload endpoint handles both storage types

### Action Required
1. **Set environment variables** for production:
   ```bash
   BUILT_IN_FORGE_API_URL=https://api.forge.example.com
   BUILT_IN_FORGE_API_KEY=your-secret-key
   ```

2. **Optional:** Migrate existing Base64 documents using migration script

3. **Optional:** Switch to AWS S3/Cloudflare R2 by updating `server/storage.ts`

### No Code Changes Needed!
The application is already production-ready for external storage. Just configure the environment variables and deploy!
