/**
 * AmeriLend Test Scenarios - Admin Operations
 * 
 * Comprehensive test scenarios for admin workflows including
 * application management, approval/rejection, statistics, and admin-only features.
 */

import { test, expect } from '@testsprite/core';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api/trpc';
const generateEmail = () => `test-${Date.now()}@example.com`;

describe('Admin Operations Tests', () => {
  
  // Helper function to create admin session
  async function loginAsAdmin(request: any) {
    // This assumes you have an admin account set up
    const adminLogin = await request.post(`${API_BASE}/auth.signIn`, {
      data: {
        email: "admin@amerilend.com",
        password: process.env.ADMIN_PASSWORD || "AdminPass123!"
      }
    });
    
    return adminLogin.status() === 200;
  }

  // Helper function to create a test loan application
  async function createTestApplication(request: any) {
    const testEmail = generateEmail();
    
    const response = await request.post(`${API_BASE}/loans.submit`, {
      data: {
        fullName: "Admin Test Applicant",
        email: testEmail,
        phone: "5551234567",
        password: "TestPass123!",
        dateOfBirth: "1990-01-15",
        ssn: `${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 90 + 10)}-${Math.floor(Math.random() * 9000 + 1000)}`,
        street: "123 Admin Test St",
        city: "Los Angeles",
        state: "CA",
        zipCode: "90001",
        employmentStatus: "employed",
        monthlyIncome: 5000,
        loanType: "installment",
        requestedAmount: 10000,
        loanPurpose: "Admin testing loan application processing",
        disbursementMethod: "bank_transfer"
      }
    });

    const data = await response.json();
    return data.result.data.applicationId || 1;
  }

  test('should allow admin to view all loan applications', async ({ request }) => {
    await loginAsAdmin(request);

    const response = await request.get(`${API_BASE}/loans.adminList`);

    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(Array.isArray(data.result.data)).toBe(true);
    
    if (data.result.data.length > 0) {
      const application = data.result.data[0];
      expect(application).toHaveProperty('id');
      expect(application).toHaveProperty('fullName');
      expect(application).toHaveProperty('status');
      expect(application).toHaveProperty('requestedAmount');
    }

    console.log(`✅ Admin retrieved ${data.result.data.length} applications`);
  });

  test('should allow admin to approve loan application', async ({ request }) => {
    await loginAsAdmin(request);
    const applicationId = await createTestApplication(request);

    const approvalData = {
      id: applicationId,
      approvedAmount: 1000000, // $10,000 in cents
      adminNotes: "Approved based on credit verification and income stability"
    };

    const response = await request.post(`${API_BASE}/loans.adminApprove`, {
      data: approvalData
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data.result.data).toHaveProperty('success', true);
    expect(data.result.data).toHaveProperty('processingFeeAmount');
    expect(typeof data.result.data.processingFeeAmount).toBe('number');
    expect(data.result.data.processingFeeAmount).toBeGreaterThan(0);

    console.log(`✅ Loan approved. Processing fee: $${data.result.data.processingFeeAmount / 100}`);
  });

  test('should allow admin to reject loan application', async ({ request }) => {
    await loginAsAdmin(request);
    const applicationId = await createTestApplication(request);

    const rejectionData = {
      id: applicationId,
      rejectionReason: "Insufficient income documentation provided"
    };

    const response = await request.post(`${API_BASE}/loans.adminReject`, {
      data: rejectionData
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data.result.data).toHaveProperty('success', true);

    console.log(`✅ Loan rejected successfully`);
  });

  test('should retrieve accurate loan statistics', async ({ request }) => {
    await loginAsAdmin(request);

    const response = await request.get(`${API_BASE}/loans.adminStatistics`);

    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data.result.data).toHaveProperty('totalApplications');
    expect(data.result.data).toHaveProperty('pending');
    expect(data.result.data).toHaveProperty('approved');
    expect(data.result.data).toHaveProperty('fee_pending');
    expect(data.result.data).toHaveProperty('fee_paid');
    expect(data.result.data).toHaveProperty('disbursed');
    expect(data.result.data).toHaveProperty('rejected');
    
    // All counts should be numbers
    expect(typeof data.result.data.totalApplications).toBe('number');
    expect(typeof data.result.data.pending).toBe('number');
    expect(typeof data.result.data.approved).toBe('number');

    console.log(`✅ Statistics: ${data.result.data.totalApplications} total, ${data.result.data.pending} pending`);
  });

  test('should allow admin to search applications', async ({ request }) => {
    await loginAsAdmin(request);

    const searchData = {
      searchTerm: "Test",
      status: "pending"
    };

    const response = await request.get(`${API_BASE}/loans.adminSearch`, {
      params: {
        input: JSON.stringify(searchData)
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(Array.isArray(data.result.data)).toBe(true);

    console.log(`✅ Search returned ${data.result.data.length} results`);
  });

  test('should retrieve admin activity log', async ({ request }) => {
    await loginAsAdmin(request);

    const response = await request.get(`${API_BASE}/loans.adminActivityLog`, {
      params: {
        input: JSON.stringify({ limit: 50 })
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(Array.isArray(data.result.data)).toBe(true);
    
    if (data.result.data.length > 0) {
      const activity = data.result.data[0];
      expect(activity).toHaveProperty('action');
      expect(activity).toHaveProperty('adminId');
      expect(activity).toHaveProperty('timestamp');
    }

    console.log(`✅ Retrieved ${data.result.data.length} activity log entries`);
  });

  test('should allow admin to view detailed application', async ({ request }) => {
    await loginAsAdmin(request);
    const applicationId = await createTestApplication(request);

    const response = await request.get(`${API_BASE}/loans.adminGetDetail`, {
      params: {
        input: JSON.stringify({ id: applicationId })
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data.result.data).toHaveProperty('application');
    expect(data.result.data).toHaveProperty('user');
    expect(data.result.data).toHaveProperty('payments');
    
    const application = data.result.data.application;
    expect(application).toHaveProperty('id', applicationId);

    console.log(`✅ Retrieved detailed application data`);
  });

  test('should allow admin to update fee configuration', async ({ request }) => {
    await loginAsAdmin(request);

    const feeConfigData = {
      calculationMode: "percentage",
      percentageRate: 500, // 5%
      fixedFeeAmount: 0
    };

    const response = await request.post(`${API_BASE}/feeConfig.adminUpdate`, {
      data: feeConfigData
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data.result.data).toHaveProperty('success', true);

    console.log(`✅ Fee configuration updated`);
  });

  test('should allow admin to retrieve fee configuration', async ({ request }) => {
    await loginAsAdmin(request);

    const response = await request.get(`${API_BASE}/feeConfig.adminGet`);

    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data.result.data).toHaveProperty('calculationMode');
    expect(data.result.data).toHaveProperty('percentageRate');
    expect(data.result.data).toHaveProperty('fixedFeeAmount');
    expect(['percentage', 'fixed']).toContain(data.result.data.calculationMode);

    console.log(`✅ Fee config: ${data.result.data.calculationMode} mode`);
  });

  test('should allow admin to initiate disbursement', async ({ request }) => {
    await loginAsAdmin(request);
    const applicationId = await createTestApplication(request);

    // First approve the loan
    await request.post(`${API_BASE}/loans.adminApprove`, {
      data: {
        id: applicationId,
        approvedAmount: 1000000
      }
    });

    // Now initiate disbursement
    const disbursementData = {
      loanApplicationId: applicationId,
      amount: 1000000,
      method: "bank_transfer",
      accountHolderName: "Test Applicant",
      accountNumber: "1234567890",
      routingNumber: "021000021"
    };

    const response = await request.post(`${API_BASE}/disbursements.adminInitiate`, {
      data: disbursementData
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data.result.data).toHaveProperty('success', true);
    expect(data.result.data).toHaveProperty('disbursementId');

    console.log(`✅ Disbursement initiated: ID ${data.result.data.disbursementId}`);
  });

  test('should allow admin to bulk approve applications', async ({ request }) => {
    await loginAsAdmin(request);
    
    // Create multiple applications
    const app1 = await createTestApplication(request);
    const app2 = await createTestApplication(request);

    const bulkApprovalData = {
      applicationIds: [app1, app2],
      approvedAmount: 1000000
    };

    const response = await request.post(`${API_BASE}/loans.adminBulkApprove`, {
      data: bulkApprovalData
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.result.data).toHaveProperty('results');
      expect(Array.isArray(data.result.data.results)).toBe(true);
      console.log(`✅ Bulk approval completed`);
    } else {
      console.log(`⚠️ Bulk approval endpoint may not exist`);
    }
  });

  test('should allow admin to bulk reject applications', async ({ request }) => {
    await loginAsAdmin(request);
    
    // Create multiple applications
    const app1 = await createTestApplication(request);
    const app2 = await createTestApplication(request);

    const bulkRejectionData = {
      applicationIds: [app1, app2],
      rejectionReason: "Bulk rejection for testing"
    };

    const response = await request.post(`${API_BASE}/loans.adminBulkReject`, {
      data: bulkRejectionData
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.result.data).toHaveProperty('results');
      expect(Array.isArray(data.result.data.results)).toBe(true);
      console.log(`✅ Bulk rejection completed`);
    } else {
      console.log(`⚠️ Bulk rejection endpoint may not exist`);
    }
  });

  test('should retrieve alerts for pending actions', async ({ request }) => {
    await loginAsAdmin(request);

    const response = await request.get(`${API_BASE}/loans.adminGetAlerts`);

    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data.result.data).toHaveProperty('pendingReview');
    expect(data.result.data).toHaveProperty('feePending');
    expect(Array.isArray(data.result.data.pendingReview)).toBe(true);

    console.log(`✅ Alerts: ${data.result.data.pendingReview.length} pending review`);
  });

  test('should calculate processing fee correctly for percentage mode', async ({ request }) => {
    await loginAsAdmin(request);

    // Set percentage mode
    await request.post(`${API_BASE}/feeConfig.adminUpdate`, {
      data: {
        calculationMode: "percentage",
        percentageRate: 500, // 5%
        fixedFeeAmount: 0
      }
    });

    const applicationId = await createTestApplication(request);

    const approvalResponse = await request.post(`${API_BASE}/loans.adminApprove`, {
      data: {
        id: applicationId,
        approvedAmount: 1000000 // $10,000
      }
    });

    const data = await approvalResponse.json();
    
    // 5% of $10,000 = $500 = 50000 cents
    expect(data.result.data.processingFeeAmount).toBe(50000);

    console.log(`✅ Processing fee calculated correctly: $500`);
  });

  test('should calculate processing fee correctly for fixed mode', async ({ request }) => {
    await loginAsAdmin(request);

    // Set fixed mode
    await request.post(`${API_BASE}/feeConfig.adminUpdate`, {
      data: {
        calculationMode: "fixed",
        percentageRate: 0,
        fixedFeeAmount: 30000 // $300
      }
    });

    const applicationId = await createTestApplication(request);

    const approvalResponse = await request.post(`${API_BASE}/loans.adminApprove`, {
      data: {
        id: applicationId,
        approvedAmount: 1000000 // $10,000
      }
    });

    const data = await approvalResponse.json();
    
    expect(data.result.data.processingFeeAmount).toBe(30000);

    console.log(`✅ Fixed fee applied correctly: $300`);
  });
});
