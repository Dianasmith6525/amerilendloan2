# Payment Processing & Fees Flow - Complete Analysis

## Overview

AmeriLend implements a comprehensive payment processing system that handles:
1. **Fee Calculation** - Dynamic fee configuration (percentage or fixed)
2. **Payment Processing** - Multiple payment methods (card & crypto)
3. **Payment Status Tracking** - Database persistence and webhooks
4. **Loan Disbursement** - Gated on successful payment

---

## 1. FEE CALCULATION FLOW

### 1.1 Fee Configuration Management

**Location**: `server/routers.ts` Lines 1310-1354

#### Active Fee Configuration Query
```typescript
trpc.feeConfig.getActive.query()
```
- Returns current fee configuration (percentage or fixed mode)
- Defaults to 2.00% percentage if no configuration exists
- Used by both admin and users to calculate fees

#### Admin Update Endpoint
```typescript
trpc.feeConfig.adminUpdate.mutation({
  calculationMode: "percentage" | "fixed",
  percentageRate?: number,        // 150-250 basis points (1.5%-2.5%)
  fixedFeeAmount?: number,         // 150-250 cents ($1.50-$2.50)
})
```

**Constraints**:
- Percentage mode: 1.5% to 2.5% (stored as basis points)
- Fixed mode: $1.50 to $2.50 per loan
- Only admin can update configuration

### 1.2 Fee Calculation on Loan Approval

**Location**: `server/routers.ts` Lines 1217-1265

```typescript
// Admin approves loan
trpc.loans.adminApprove.mutation({
  id: number,
  approvedAmount: number,  // in cents
  adminNotes?: string
})
```

**Calculation Logic**:
```typescript
const feeConfig = await db.getActiveFeeConfiguration();

if (feeConfig?.calculationMode === "percentage") {
  // Formula: (approvedAmount × percentageRate) / 10000
  // Example: ($10,000 × 200) / 10000 = $200
  processingFeeAmount = Math.round(
    (approvedAmount * feeConfig.percentageRate) / 10000
  );
} else if (feeConfig?.calculationMode === "fixed") {
  // Fixed amount regardless of loan size
  processingFeeAmount = feeConfig.fixedFeeAmount;
}
```

**Fee Calculation Examples**:

| Mode | Loan Amount | Fee Rate | Calculation | Result |
|------|------------|----------|-------------|--------|
| Percentage | $1,000 | 2.00% | 1000 × 200 / 10000 | $20.00 |
| Percentage | $5,000 | 2.00% | 5000 × 200 / 10000 | $100.00 |
| Percentage | $10,000 | 2.00% | 10000 × 200 / 10000 | $200.00 |
| Fixed | $1,000 | $2.00 | N/A | $2.00 |
| Fixed | $50,000 | $2.00 | N/A | $2.00 |

**After Approval**:
- Fee amount stored in `loanApplications.processingFeeAmount`
- Application status: `pending_fee_payment`
- User receives approval notification with fee amount
- User sees fee on dashboard and in payment page

---

## 2. PAYMENT FLOW - CARD PAYMENTS (AUTHORIZE.NET)

### 2.1 Payment Initiation

**Location**: `server/routers.ts` Lines 1395-1510

```typescript
trpc.payments.createIntent.mutation({
  loanApplicationId: number,
  paymentMethod: "card",
  paymentProvider: "authorizenet",
  // Accept.js token from client
  opaqueData: {
    dataDescriptor: string,  // "COMMON.ACCEPT.INAPP.PAYMENT"
    dataValue: string        // Tokenized card data
  }
})
```

### 2.2 Client-Side Card Tokenization

**File**: `client/src/pages/EnhancedPaymentPage.tsx` Lines 300-400

```typescript
// 1. Load Accept.js library
const script = document.createElement('script');
script.src = 'https://jsapicdn.authorize.net/v1/Accept.js';
document.head.appendChild(script);

// 2. Get public key from server
const { clientKey } = await trpc.payments.getAuthorizeNetConfig.query();

// 3. Tokenize card data (never sent to server)
AuthorizeNet.dispatchData({
  authData: {
    clientKey: clientKey,
    apiLoginID: apiLoginID  // From server config
  },
  data: {
    type: 'PAYMENT_FORM',
    id: 'cardForm'  // Form ID
  },
  callback: (response) => {
    if (response.messages.resultCode === 'Ok') {
      opaqueData = {
        dataDescriptor: response.opaqueData.dataDescriptor,
        dataValue: response.opaqueData.dataValue
      };
      // Send opaqueData to server (NOT card data)
      trpc.payments.createIntent.mutate({
        loanApplicationId,
        paymentMethod: 'card',
        opaqueData
      });
    }
  }
});
```

**Security Model**:
- ✅ Card data never touches your server
- ✅ Accept.js tokenizes in browser
- ✅ Only opaque token sent to server
- ✅ PCI-DSS Level 1 compliant

### 2.3 Server-Side Payment Processing

**Location**: `server/_core/authorizenet.ts`

```typescript
export async function createAuthorizeNetTransaction(
  amount: number,          // in cents
  opaqueData: OpaqueData,
  metadata: Record<string, any>
): Promise<TransactionResult>
```

**Transaction Creation**:
```typescript
const transactionRequest = {
  transactionType: 'authCaptureTransaction',
  amount: (amount / 100).toFixed(2),  // Convert cents to dollars
  opaqueData: {
    dataDescriptor: opaqueData.dataDescriptor,
    dataValue: opaqueData.dataValue
  },
  deviceProfile: { ... },
  userFields: { ... }
};

const response = await authorizeNetApiCall(transactionRequest);
```

**Transaction States**:
```
Pending → Processing → Succeeded (captured) or Failed
         ↓
      Queued for settlement
      ↓
      Settled (funds in account)
```

### 2.4 Payment Status Management

**Location**: `server/routers.ts` Lines 1500-1540 & `server/db.ts`

```typescript
// After successful Authorize.net transaction:
const paymentData = {
  loanApplicationId: number,
  userId: number,
  amount: number,              // Processing fee amount
  paymentProvider: 'authorizenet',
  paymentMethod: 'card',
  paymentIntentId: string,     // Authorize.net transaction ID
  paymentMethodId: string,     // Payment method identifier
  cardLast4: string,           // Last 4 digits
  cardBrand: string,           // Visa, Mastercard, etc.
  status: 'succeeded',
  completedAt: new Date()
};

await db.createPayment(paymentData);
```

**Database Schema** (`drizzle/schema.ts` Lines 201-230):
```typescript
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  loanApplicationId: integer("loanApplicationId").notNull(),
  userId: integer("userId").notNull(),
  
  // Amount details
  amount: integer("amount").notNull(),        // in cents
  currency: varchar("currency", { length: 3 }).default("USD"),
  
  // Provider details
  paymentProvider: paymentProviderEnum("paymentProvider").default("stripe"),
  paymentMethod: paymentMethodEnum("paymentMethod").default("card"),
  
  // Card payment details
  paymentIntentId: varchar("paymentIntentId", { length: 255 }),
  paymentMethodId: varchar("paymentMethodId", { length: 255 }),
  cardLast4: varchar("cardLast4", { length: 4 }),
  cardBrand: varchar("cardBrand", { length: 20 }),
  
  // Crypto payment details
  cryptoCurrency: varchar("cryptoCurrency", { length: 10 }),
  cryptoAddress: varchar("cryptoAddress", { length: 255 }),
  cryptoTxHash: varchar("cryptoTxHash", { length: 255 }),
  cryptoAmount: varchar("cryptoAmount", { length: 50 }),
  
  // Status tracking
  status: paymentStatusEnum("status").default("pending"),
  failureReason: text("failureReason"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
  completedAt: timestamp("completedAt"),
});
```

---

## 3. PAYMENT FLOW - CRYPTOCURRENCY PAYMENTS

### 3.1 Crypto Payment Setup

**Location**: `server/_core/crypto-payment.ts`

```typescript
export async function createCryptoCharge(
  amount: number,              // in cents USD
  currency: CryptoCurrency,    // BTC, ETH, USDT, USDC
  description: string,
  metadata: Record<string, any>
): Promise<CryptoCharge>
```

### 3.2 Supported Cryptocurrencies

```typescript
type CryptoCurrency = 'BTC' | 'ETH' | 'USDT' | 'USDC';

interface CryptoRate {
  currency: string;
  rate: number;      // 1 BTC = $X USD
  lastUpdated: Date;
}
```

### 3.3 Conversion Flow

**Step 1: Get Exchange Rate**
```typescript
const rate = await getCryptoExchangeRate('BTC');
// Returns: { rate: 45000 }  // 1 BTC = $45,000 USD
```

**Step 2: Convert USD to Crypto**
```typescript
export async function convertUSDToCrypto(
  usdCents: number,     // e.g., 20000 = $200.00
  currency: 'BTC'
): Promise<string>

// Formula: USD Amount / Exchange Rate
// Example: $200 / $45,000 per BTC = 0.00444 BTC
// Result: "0.00444"
```

**Step 3: Generate Payment Address**
```typescript
const charge = await createCryptoCharge(
  20000,      // $200.00
  'BTC',
  'Processing fee for loan #AL123456',
  { loanApplicationId: 1 }
);

// Returns:
{
  success: true,
  chargeId: 'charge_123',          // Unique charge ID
  cryptoAmount: '0.00444',         // Amount in BTC
  paymentAddress: '1A1z7aD...',    // Wallet address to send to
  qrCodeUrl: 'https://...',        // QR code for mobile scanning
  expiresAt: Date                  // Payment expires in 1 hour
}
```

### 3.4 Crypto Payment Verification

**Location**: `server/_core/web3-verification.ts`

```typescript
export async function verifyCryptoTransactionWeb3(
  txHash: string,         // Transaction hash on blockchain
  expectedAmount: string, // Amount expected (e.g., "0.00444")
  currency: string,       // BTC, ETH, etc.
  toAddress: string,      // Receiving wallet address
  confirmations?: number  // Min confirmations required (usually 3-6)
): Promise<VerificationResult>
```

**Verification Steps**:
1. Query blockchain explorer API
2. Verify transaction amount matches expected
3. Verify recipient address matches payment address
4. Check transaction confirmation count
5. Update payment status to `succeeded`

---

## 4. DISBURSEMENT GATE - PAYMENT REQUIREMENT

### 4.1 Loan Status Flow

```
SUBMITTED → PENDING_REVIEW → APPROVED → PENDING_FEE_PAYMENT
                                           ↓
                                      [USER PAYS]
                                           ↓
                                      FEE_PAID → PENDING_DISBURSEMENT
                                                        ↓
                                                    DISBURSED
```

### 4.2 Disbursement Lock

**Location**: `server/routers.ts` Lines 1515-1580

```typescript
// Disbursement only allowed if:
// 1. Loan status is "fee_paid"
// 2. Payment record exists with status "succeeded"
// 3. User has bank account info on file

const canDisburseLoan = (application) => {
  return (
    application.status === 'fee_paid' &&
    application.disbursementStatus === 'pending' &&
    hasPaymentRecord(application.id) &&
    hasBankAccount(application.userId)
  );
};
```

### 4.3 Disbursement Process

```typescript
trpc.loans.adminDisburse.mutation({
  loanApplicationId: number,
  accountHolderName: string,
  accountNumber: string,
  routingNumber: string,
  adminNotes?: string
})
```

**Disbursement Record Creation**:
```typescript
export const disbursements = pgTable("disbursements", {
  id: serial("id").primaryKey(),
  loanApplicationId: integer("loanApplicationId").notNull(),
  userId: integer("userId").notNull(),
  amount: integer("amount").notNull(),
  
  // Bank details (encrypted)
  accountHolderName: varchar("accountHolderName", { length: 255 }),
  accountNumber: varchar("accountNumber", { length: 255 }), // encrypted
  routingNumber: varchar("routingNumber", { length: 9 }),
  
  status: varchar("status", { length: 50 }).default("pending"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow(),
});
```

---

## 5. PAYMENT CONFIRMATION & STATUS UPDATES

### 5.1 Immediate Payment Confirmation

**Location**: `server/routers.ts` Lines 1500-1540

```typescript
// After successful card/crypto payment:
trpc.payments.confirmPayment.mutation({
  paymentId: number,
})
```

**Actions on Confirmation**:
1. Update `payments.status = 'succeeded'`
2. Update `loanApplications.status = 'fee_paid'`
3. Update `loanApplications.paymentConfirmedAt = new Date()`
4. Send confirmation email to user
5. Send notification to admin
6. Enable disbursement button

### 5.2 Payment Confirmation Email

**File**: `server/_core/email.ts`

```typescript
export async function sendPaymentConfirmationEmail(
  email: string,
  amount: number,
  cardLast4?: string,
  cryptoCurrency?: string
): Promise<void>
```

**Email Contents**:
- Payment amount confirmed
- Payment method (card ending in XXXX or crypto address)
- Transaction ID
- Loan details
- Expected disbursement timeline

### 5.3 Admin Notifications

**File**: `client/src/pages/AdminDashboard.tsx` Lines 200-300

Admin sees:
- Real-time payment updates in dashboard
- Payment list with statuses (pending, succeeded, failed)
- Can filter by date range
- Can see full transaction details

---

## 6. ERROR HANDLING & FAILURE FLOWS

### 6.1 Card Payment Failures

**Possible Failures**:
```typescript
{
  "code": "CARD_DECLINED",
  "message": "The card was declined",
  "transactionId": "123456"
}

{
  "code": "INSUFFICIENT_FUNDS",
  "message": "Insufficient funds in account",
  "transactionId": "123456"
}

{
  "code": "EXPIRED_CARD",
  "message": "Card has expired",
  "transactionId": "123456"
}

{
  "code": "INVALID_CVV",
  "message": "Invalid CVV",
  "transactionId": "123456"
}
```

**Failure Handling**:
```typescript
if (!result.success) {
  // Store failure reason
  await db.updatePaymentStatus(payment.id, 'failed', {
    failureReason: result.message
  });
  
  // Send failure email to user
  await sendPaymentFailureEmail(user.email, result.message);
  
  // Keep loan in fee_pending status
  // User can retry with different card
}
```

### 6.2 Crypto Payment Timeouts

```typescript
// Payment address expires after 1 hour
// If not received by expiration:
if (charge.expiresAt < new Date()) {
  charge.status = 'expired';
  // User must create new charge
  // New address generated
}
```

### 6.3 User Retry Logic

**For Card Payments**:
- User can retry immediately with different card
- Previous failed transactions logged

**For Crypto Payments**:
- If transaction expires, user creates new charge
- New payment address and QR code generated
- Admin can manually verify blockchain transaction

---

## 7. FEE CONFIGURATION UI (ADMIN DASHBOARD)

### 7.1 Admin Fee Management

**File**: `client/src/pages/AdminDashboard.tsx` Lines 400-500

```typescript
// Current fee config display
if (feeConfig) {
  <div>
    <p>Mode: {feeConfig.calculationMode}</p>
    {feeConfig.calculationMode === "percentage" && (
      <p>Rate: {(feeConfig.percentageRate / 100).toFixed(2)}%</p>
    )}
    {feeConfig.calculationMode === "fixed" && (
      <p>Fee: ${(feeConfig.fixedFeeAmount / 100).toFixed(2)}</p>
    )}
  </div>
}
```

### 7.2 Update Fee Configuration

```typescript
const handleUpdateFeeConfig = () => {
  if (feeMode === "percentage") {
    const rate = parseFloat(percentageRate);
    if (isNaN(rate) || rate < 1.5 || rate > 2.5) {
      toast.error("Percentage rate must be between 1.5% and 2.5%");
      return;
    }
    updateFeeConfigMutation.mutate({
      calculationMode: "percentage",
      percentageRate: Math.round(rate * 100), // Convert to basis points
    });
  } else {
    const amount = parseFloat(fixedFeeAmount);
    if (isNaN(amount) || amount < 1.5 || amount > 2.5) {
      toast.error("Fixed fee must be between $1.50 and $2.50");
      return;
    }
    updateFeeConfigMutation.mutate({
      calculationMode: "fixed",
      fixedFeeAmount: Math.round(amount * 100), // Convert to cents
    });
  }
};
```

---

## 8. PAYMENT USER INTERFACE

### 8.1 Payment Page Flow

**File**: `client/src/pages/EnhancedPaymentPage.tsx`

**Layout**:
```
┌─────────────────────────────────┐
│      LOAN SUMMARY               │
│  Loan Amount: $10,000.00        │
│  Processing Fee: $200.00        │
│  Fee Calculation Details        │
│  - Loan: $10,000 × 2% = $200    │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│    PAYMENT METHOD SELECT        │
│  [ Card Payment ]  [ Crypto ]   │
└─────────────────────────────────┘

CARD PAYMENT TAB:
┌─────────────────────────────────┐
│  Card Number: [__________________]
│  Exp Date: [__/__]  CVV: [___]  │
│  ZIP Code: [_____]              │
│  [ Pay $200.00 Securely ]       │
└─────────────────────────────────┘

CRYPTO PAYMENT TAB:
┌─────────────────────────────────┐
│  Select Currency: [BTC ↓]       │
│  Amount: 0.00444 BTC            │
│  ≈ $200.00 USD                  │
│  Send to: 1A1z7aD...            │
│  [QR Code]                      │
│  [ Copy Address ]               │
└─────────────────────────────────┘
```

### 8.2 Payment Status Display

```typescript
// After payment submission:
switch (payment.status) {
  case 'pending':
    return <div>Processing your payment...</div>;
  
  case 'succeeded':
    return <div className="text-green-600">✓ Payment successful!</div>;
  
  case 'failed':
    return <div className="text-red-600">✗ Payment failed: {payment.failureReason}</div>;
}
```

---

## 9. DATABASE FLOW DIAGRAM

```
USER APPLIES FOR LOAN
         ↓
loanApplications (status: submitted)
         ↓
ADMIN APPROVES LOAN
         ↓
loanApplications (
  status: pending_fee_payment,
  processingFeeAmount: calculated,
  approvedAmount: set
)
         ↓
USER NAVIGATES TO PAYMENT PAGE
         ↓
Display fee amount and payment options
         ↓
USER SELECTS PAYMENT METHOD
         ↓
[CARD PATH]                    [CRYPTO PATH]
Accept.js tokenization         Charge creation
           ↓                           ↓
authorizenet API call          Blockchain address
           ↓                           ↓
Payment record created         User sends crypto
(status: pending)              (status: pending)
           ↓                           ↓
Transaction approved ←─────→ Blockchain confirmation
           ↓                           ↓
Payment status: succeeded      Payment status: succeeded
           ↓                           ↓
        ┌─────────────────────────────┐
        │ loanApplications updated    │
        │ status: fee_paid            │
        │ paymentConfirmedAt: now     │
        └─────────────────────────────┘
                     ↓
        DISBURSEMENT ENABLED
                     ↓
        USER PROVIDES BANK INFO
                     ↓
        ADMIN DISBURSES FUNDS
                     ↓
        disbursements record created
        (status: processing)
                     ↓
        loanApplications updated
        (status: disbursed)
```

---

## 10. TEST CASES & EXPECTED OUTCOMES

### TC-PAY-001: Percentage Fee Calculation
**Setup**: Fee config = 2.00%
**Test**: Approve $10,000 loan
**Expected**: processingFeeAmount = $200.00
**Status**: ✅ Pass

### TC-PAY-002: Fixed Fee Calculation
**Setup**: Fee config = $2.00 fixed
**Test**: Approve $50,000 loan
**Expected**: processingFeeAmount = $2.00
**Status**: ✅ Pass

### TC-PAY-003: Card Payment Success
**Setup**: User has approved loan with fee
**Test**: Submit valid card via Accept.js
**Expected**: 
- Payment record created with status "succeeded"
- Loan status changed to "fee_paid"
- User sees success message
**Status**: ✅ Pass

### TC-PAY-004: Crypto Payment Verification
**Setup**: User has approved loan with fee
**Test**: Send crypto to generated address
**Expected**:
- Payment verified on blockchain
- Status changed to "succeeded" after confirmations
- Loan unlocked for disbursement
**Status**: ✅ Pass

### TC-PAY-005: Payment Failure Retry
**Setup**: User submits declined card
**Test**: Submit payment with invalid card
**Expected**:
- Payment status: "failed"
- Failure reason logged
- User remains in fee_pending status
- Can retry with different card
**Status**: ✅ Pass

---

## 11. SECURITY CONSIDERATIONS

### 11.1 PCI DSS Compliance
- ✅ Card data never touches server (Accept.js tokenization)
- ✅ Only tokenized data and last 4 digits stored
- ✅ All card data encrypted in transit (HTTPS)
- ✅ Payment provider handles tokenization

### 11.2 Crypto Security
- ✅ Payment addresses unique per transaction
- ✅ QR codes for copy-paste prevention
- ✅ Blockchain verification of amounts
- ✅ Transaction expiration prevents stale addresses

### 11.3 Database Security
- ✅ Bank account data encrypted (AES-256)
- ✅ Sensitive fields never logged
- ✅ Access controls via admin role

---

## 12. MONITORING & ANALYTICS

### 12.1 Admin Dashboard Metrics

```typescript
// Payment Success Rate
const successRate = (
  successfulPayments / totalPayments
) * 100;

// Average Payment Time
const avgTime = mean(
  payments.map(p => p.completedAt - p.createdAt)
);

// Revenue by Method
const cardRevenue = payments
  .filter(p => p.paymentMethod === 'card')
  .reduce((sum, p) => sum + p.amount, 0);

const cryptoRevenue = payments
  .filter(p => p.paymentMethod === 'crypto')
  .reduce((sum, p) => sum + p.amount, 0);
```

### 12.2 Payment Alerts

Admin receives alerts for:
- Payment failures (after 3 retries)
- Suspicious activity (multiple failed attempts)
- High-value payments
- Expired crypto payment addresses

---

## 13. INTEGRATION POINTS

### 13.1 Authorize.net Integration

**Location**: `server/_core/authorizenet.ts`

**Configuration**:
```env
AUTHORIZENET_API_LOGIN_ID=<login_id>
AUTHORIZENET_TRANSACTION_KEY=<key>
AUTHORIZENET_ENVIRONMENT=production|sandbox
AUTHORIZENET_CLIENT_KEY=<client_key>
```

### 13.2 Crypto Integration

**Location**: `server/_core/crypto-payment.ts`

**Configuration**:
```env
COINBASE_COMMERCE_API_KEY=<key>
COINBASE_COMMERCE_WEBHOOK_SECRET=<secret>
CRYPTO_PAYMENT_ENVIRONMENT=production|sandbox
```

### 13.3 Database Integration

**Location**: `server/db.ts`

**Key Functions**:
- `createPayment()` - Insert payment record
- `updatePaymentStatus()` - Update payment state
- `getPaymentById()` - Retrieve payment details
- `getPaymentsByLoanId()` - Get all payments for loan
- `getFeeConfiguration()` - Get current fee config
- `createFeeConfiguration()` - Save new fee config

---

## 14. FUTURE ENHANCEMENTS

1. **Recurring Payments** - Auto-pay loan installments
2. **Payment Plans** - Split fees over multiple payments
3. **Refund Processing** - Handle payment reversals
4. **Multi-Currency** - Support USD, EUR, GBP, etc.
5. **Payment Analytics** - Advanced reporting dashboard
6. **Webhook Retry** - Robust payment status sync
7. **Rate Limiting** - Prevent abuse of payment endpoints
8. **Audit Logging** - Full payment transaction history

---

## Summary

The payment system provides:
- ✅ Flexible fee configuration (percentage or fixed)
- ✅ Multiple payment methods (card & crypto)
- ✅ PCI-DSS compliant card processing
- ✅ Blockchain verification for crypto
- ✅ Status tracking and retry logic
- ✅ Disbursement gating on payment
- ✅ Admin monitoring and controls
- ✅ Comprehensive error handling

All payments are logged, verified, and tied to loan applications for full audit trail.
