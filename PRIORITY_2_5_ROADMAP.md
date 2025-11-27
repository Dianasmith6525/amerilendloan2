# Priority 2-5 Implementation Roadmap

**Status:** Priority 1 (User Experience) ✅ COMPLETE  
**Next Up:** Priority 2-5 Features

---

## ✅ COMPLETED (Priority 1)

### User Experience Improvements
1. ✅ **Email Formatting** - Thousand separators added to all currency values
2. ✅ **Real-time Notifications** - UserNotificationBell with 30s polling
3. ✅ **Mobile Responsive Design** - Hamburger menu, responsive grids, touch-friendly
4. ✅ **Advanced Filtering** - Search, date filters, amount filters, CSV export

---

## 🔄 PRIORITY 2: Payment & Financial Features

### 1. Payment Method Management ⚠️ IN PROGRESS
**Component Created:** `PaymentMethodManager.tsx`  
**Status:** Frontend complete, needs backend routes

**Features:**
- Save multiple payment methods (cards & crypto wallets)
- Set default payment method
- Delete saved methods
- Card validation and formatting
- Visual card brand detection

**TODO - Backend Routes Needed:**
```typescript
// Add to server/routers.ts payments router:
- getSavedMethods: protectedProcedure.query() 
- addPaymentMethod: protectedProcedure.mutation()
- deletePaymentMethod: protectedProcedure.mutation()
- setDefaultMethod: protectedProcedure.mutation()
```

**Database Schema Needed:**
```sql
CREATE TABLE savedPaymentMethods (
  id SERIAL PRIMARY KEY,
  userId INTEGER NOT NULL,
  type VARCHAR(20) NOT NULL, -- 'card' or 'crypto'
  cardBrand VARCHAR(50), -- 'Visa', 'Mastercard', etc.
  last4 VARCHAR(4),
  expiryMonth VARCHAR(2),
  expiryYear VARCHAR(4),
  nameOnCard VARCHAR(255),
  walletAddress VARCHAR(255),
  isDefault BOOLEAN DEFAULT false,
  createdAt TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (userId) REFERENCES users(id)
);
```

### 2. Payment Reminders 📅 NOT STARTED
**Estimated Time:** 3-4 hours

**Features Needed:**
- Email reminders 7 days before due date
- Email reminders 3 days before due date
- Email reminders 1 day before due date
- SMS reminders (optional, requires Twilio)
- In-app notification reminders

**Implementation Steps:**
1. Create cron job/scheduler (use node-cron or built-in scheduler)
2. Query loans with upcoming due dates
3. Send reminder emails using existing email templates
4. Add reminder email template to `server/_core/email.ts`
5. Add user preference for reminder frequency in Settings

**Backend Route:**
```typescript
// Cron job in server/_core/paymentReminders.ts
export async function checkAndSendPaymentReminders() {
  const upcomingPayments = await db.getUpcomingPayments();
  for (const payment of upcomingPayments) {
    await sendPaymentReminderEmail(...);
  }
}
```

### 3. Scheduled/Recurring Payments ✅ EXISTS
**Component:** `AutoPaySettings.tsx`  
**Status:** Already implemented in Phase 1

**Current Features:**
- Enable/disable auto-pay per loan
- Schedule specific payment dates
- View auto-pay history

**Enhancement Needed:**
- Add recurring payment execution logic
- Connect to payment processor for automatic charges
- Add retry logic for failed auto-payments

### 4. Payment Analytics 📊 ✅ EXISTS
**Component:** `PaymentHistoryAnalytics.tsx`  
**Status:** Already implemented

**Current Features:**
- Total payments visualization
- Payment status breakdown
- Monthly spending charts
- Export to CSV

**Enhancement Ideas:**
- Add Recharts visualizations (pie charts, bar charts)
- Payment trends over time
- Savings tracker
- Comparison to budget

---

## 🔄 PRIORITY 3: Document & Verification

### 1. Drag-and-Drop File Uploads 📎 NOT STARTED
**Estimated Time:** 2-3 hours

**Implementation:**
1. Install react-dropzone: `npm install react-dropzone`
2. Update `VerificationUpload.tsx` component
3. Add drag overlay visual feedback
4. Support multiple file uploads at once

**Code Example:**
```typescript
import { useDropzone } from 'react-dropzone';

const { getRootProps, getInputProps, isDragActive } = useDropzone({
  accept: {
    'image/*': ['.png', '.jpg', '.jpeg'],
    'application/pdf': ['.pdf']
  },
  maxSize: 10 * 1024 * 1024, // 10MB
  onDrop: (files) => handleUpload(files)
});
```

### 2. Document Preview 👁️ NOT STARTED
**Estimated Time:** 3-4 hours

**Features:**
- PDF preview before upload
- Image preview before upload
- Document viewer modal
- Zoom/pan controls

**Libraries Needed:**
- `react-pdf` for PDF preview
- `react-image-lightbox` for image preview

### 3. File Validation & Feedback ✅ NOT STARTED
**Estimated Time:** 1-2 hours

**Features:**
- File size validation (max 10MB)
- File type validation (only images & PDFs)
- Real-time validation errors
- Progress bar during upload
- Success/error toast notifications

---

## 🔄 PRIORITY 4: Security & Compliance

### 1. Rate Limiting 🛡️ NOT STARTED
**Estimated Time:** 2-3 hours

**Implementation:**
1. Install express-rate-limit: `npm install express-rate-limit`
2. Add to Express server in `server/_core/index.ts`
3. Configure limits per endpoint

**Code:**
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);
```

### 2. Activity Logging ✅ PARTIALLY EXISTS
**Status:** Admin activity logging exists

**Enhancement Needed:**
- Add user activity logging
- Track login attempts
- Track document uploads
- Track payment attempts
- Store in `userActivityLog` table

### 3. Session Management ⏱️ NOT STARTED
**Estimated Time:** 2-3 hours

**Features:**
- Session timeout after 30 minutes inactivity
- "Remember me" option for 30-day sessions
- Force logout on password change
- Multiple device management

### 4. GDPR Compliance 📋 NOT STARTED
**Estimated Time:** 5-6 hours

**Features Required:**
- Data export tool (download all user data as JSON)
- Right to deletion (delete account & all data)
- Data retention policy (auto-delete after X years)
- Privacy policy consent tracking
- Cookie consent banner

---

## 🔄 PRIORITY 5: Production Readiness

### 1. Error Monitoring 🔍 NOT STARTED
**Estimated Time:** 1-2 hours

**Recommended:** Sentry.io

**Implementation:**
```bash
npm install @sentry/node @sentry/react
```

**Setup:**
1. Create Sentry account
2. Add DSN to .env
3. Initialize in `server/_core/index.ts` and `client/src/main.tsx`
4. Automatic error tracking & alerts

### 2. Performance Optimization ⚡ PARTIAL
**Estimated Time:** 4-6 hours

**Tasks:**
- [ ] Enable Gzip compression
- [ ] Add Redis caching for tRPC queries
- [ ] Image optimization (use Next/Image or similar)
- [ ] Code splitting (React.lazy for large components)
- [ ] CDN setup for static assets
- [x] Database indexing (already has indexes)

### 3. Backup Strategy 💾 NOT STARTED
**Estimated Time:** 2-3 hours

**Features:**
- Daily automated database backups
- Store backups in AWS S3 or similar
- Backup retention policy (keep 30 days)
- Backup restoration testing

**Supabase Note:** Supabase Pro plan includes automatic backups

### 4. SSL & Security Headers 🔒 PARTIAL
**Status:** Vercel provides SSL automatically

**Additional Headers Needed:**
```typescript
// Add to server/_core/index.ts
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
});
```

---

## 📊 Implementation Priority Ranking

Based on impact vs effort:

**HIGH PRIORITY (Do Next):**
1. ✅ Payment Method Management backend (2 hours) - Critical UX improvement
2. ✅ Payment Reminders (3 hours) - Reduces late payments
3. ✅ Error Monitoring with Sentry (1 hour) - Critical for production
4. ✅ Rate Limiting (2 hours) - Security essential

**MEDIUM PRIORITY:**
5. Drag-and-Drop Uploads (2 hours) - Nice UX improvement
6. Session Management (2 hours) - Security improvement
7. File Validation (1 hour) - Better UX feedback
8. Performance Optimization (4 hours) - User experience

**LOW PRIORITY:**
9. Document Preview (3 hours) - Nice to have
10. GDPR Compliance (6 hours) - Required for EU users
11. Backup Strategy (2 hours) - Supabase handles this
12. Activity Logging Enhancement (2 hours) - Analytics

---

## 🎯 Quick Wins (< 2 hours each)

1. ✅ **Error Monitoring** - Just install Sentry
2. ✅ **Rate Limiting** - Just add middleware
3. ✅ **File Validation** - Add validation rules
4. ✅ **Security Headers** - Add Express middleware
5. ✅ **Session Timeout** - Update JWT expiry

---

## Next Steps

**Recommended Order:**
1. Complete Payment Method Management backend (finish what we started)
2. Add Sentry error monitoring
3. Add rate limiting
4. Implement payment reminders
5. Then tackle remaining items based on user feedback

**Total Estimated Time for All Remaining:** ~35-40 hours

Would you like me to:
- A) Complete Payment Method Management backend first?
- B) Jump to error monitoring setup (quick win)?
- C) Implement payment reminders?
- D) Something else?
