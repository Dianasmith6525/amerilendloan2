# Admin Features Quick Reference

## Dashboard Tabs Overview

### 1. Loan Applications
- View all loan applications with status
- **Pending/Under Review**: Click "Approve" or "Reject"
- **Approval Dialog**: Enter approved amount and optional admin notes
- **Rejection Dialog**: Provide rejection reason
- **Fee Paid**: Initiate disbursement to user's bank account
- **Status Colors**: Yellow (Pending) → Green (Approved) → Red (Rejected)

### 2. Verification Documents
- Review submitted identity documents
- **Awaiting Review**: Documents pending admin approval
- **Document Types**: Driver's license, passport, bank statements, pay stubs, etc.
- **Actions**: Approve or reject with optional admin comments
- **History**: View past approved/rejected documents

### 3. User Management ⭐ NEW
- **Search**: Enter at least 3 characters (name or email)
- **Edit**: Click "Edit" button on any user
- **Update Fields**: Name, Email, Phone
- **Save**: Changes reflected immediately
- **Use Cases**:
  - Update user's contact information
  - Fix typos in user records
  - Help users change their email for account recovery

### 4. Payments ⭐ NEW
- **Real-time Statistics** (updates every 5 seconds):
  - Total Approved Amount: Combined value of all approved loans
  - Average Loan Amount: Mean size of approved loans
  - Approval Rate: Percentage of applications approved
  - Average Processing Time: Hours to approve applications
- **Payment Review**: Coming soon with refund capabilities

### 5. Admin Management
- **View All Admins**: See list of current administrators
- **Promote User**: Click "Promote to Admin"
  - Enter user ID
  - Only owner can promote (set via OWNER_OPEN_ID env var)
- **Demote Admin**: Click "Demote" on any admin (owner only)
  - Cannot demote yourself
- **Admin List**: Shows ID, name, email, join date

### 6. Fee Configuration ⭐ UPDATED
- **Percentage Mode (0.5% - 10%)**:
  - Example: 2% of $10,000 = $200 processing fee
  - Scales with loan amount
- **Fixed Fee Mode ($0.50 - $10.00)**:
  - Example: $2.00 per loan regardless of size
  - Flat rate for all loans
- **Real-time Effect**: New fees apply to next approved loan

---

## Real-Time Statistics Explained

### Total Approved Amount
**What**: Sum of all approved loan amounts  
**Formula**: Σ(Approved Loans)  
**Example**: If 10 loans approved for $10,000 each = $100,000

### Average Loan Amount
**What**: Mean of all requested loan amounts  
**Formula**: Σ(All Loans) ÷ Total Applications  
**Example**: 100 applications totaling $500,000 = $5,000 average

### Approval Rate
**What**: Percentage of applications approved  
**Formula**: (Approved ÷ Total) × 100  
**Example**: 78 approved out of 100 = 78.5%

### Processing Time
**What**: Average hours to review and approve/reject  
**Formula**: Average time from submission to decision  
**Current**: 24 hours (placeholder)

---

## Common Admin Tasks

### Task: Approve a Loan
1. Go to **Loan Applications** tab
2. Find application with status "Pending" or "Under Review"
3. Click **"Approve"** button
4. Enter approved amount (pre-filled with requested amount)
5. Add optional admin notes
6. Click **"Approve Loan"**
7. ✅ Application marked as approved, notification sent to user

### Task: Reject a Loan
1. Go to **Loan Applications** tab
2. Find application to reject
3. Click **"Reject"** button
4. Enter detailed rejection reason
5. Click **"Reject Application"**
6. ✅ User notified of rejection with reason

### Task: Help User Recover Account
1. User contacts support: "I forgot my password"
2. Go to **User Management** tab
3. Search for user by name or email
4. Click **"Edit"**
5. Verify or update email to correct address
6. Click **"Save Changes"**
7. ✅ User can now use "Forgot Password" to reset

### Task: Update Processing Fees
1. Go to **Fee Configuration** tab
2. Choose **Calculation Mode**:
   - Percentage: 0.5% to 10%
   - Fixed Fee: $0.50 to $10.00
3. Enter new rate/amount
4. Click **"Update Configuration"**
5. ✅ Fees updated, next approval uses new rates

### Task: Promote User to Admin
1. Get user ID (visible in application details or user list)
2. Go to **Admin Management** tab
3. Click **"Promote to Admin"**
4. Enter user ID
5. Click **"Promote to Admin"**
6. ✅ User now has admin dashboard access (must be system owner)

---

## Security Notes

### Who Can Access What?
- **All Admins**: Can view applications, documents, users, statistics
- **All Admins**: Can approve/reject loans, edit user info
- **Only Owner**: Can promote/demote admins (set via OWNER_OPEN_ID)
- **Authenticated Users**: Cannot see admin features

### Admin Restrictions
- Cannot apply for personal loans
- Cannot access prequalification form
- Cannot demote themselves
- Must be owner to promote other admins

---

## Troubleshooting

### User Search Not Working
- **Minimum 3 characters required**
- Try searching by first name instead of last name
- Check email spelling

### Changes Not Reflecting
- Page automatically refreshes after 5 seconds
- Statistics update in real-time from database
- If stuck, refresh the browser (F5)

### Cannot Promote User
- Only the system owner can promote users
- Check if logged in as owner (set via OWNER_OPEN_ID)
- Verify user ID is correct (numeric)

### Fee Change Not Taking Effect
- Only affects NEW approved loans
- Already-approved loans keep their original fees
- Verify fee is between 0.5% - 10% (percentage) or $0.50 - $10.00 (fixed)

---

## Key Features

✅ Real-time statistics (refreshes every 5 seconds)  
✅ Search and edit user information  
✅ Help users recover account access  
✅ Set processing fees from 0.5% to 10%  
✅ Manage admin accounts (owner only)  
✅ Approve/reject loan applications  
✅ Review documents and payment history  
✅ Role-based access control  
✅ Admin cannot apply for loans  
✅ Toast notifications for all actions  

---

## API Integration

All features use tRPC endpoints:
- `admin.getAdvancedStats` - Real-time statistics
- `admin.searchUsers` - User search
- `admin.updateUserProfile` - Update user info
- `feeConfig.adminUpdate` - Update fees
- `admin.promoteToAdmin` - Promote user
- `admin.demoteToUser` - Demote admin
- `loans.adminApprove` - Approve loan
- `loans.adminReject` - Reject loan

---

## Performance Notes

- **Real-time Updates**: Statistics refresh every 5 seconds
- **Database Efficient**: Uses aggregation queries (COUNT, SUM, AVG)
- **Caching**: React Query handles client-side caching
- **Load**: Minimal impact even with large datasets

---

**Last Updated**: November 17, 2025
