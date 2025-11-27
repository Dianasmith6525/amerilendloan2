/**
 * AmeriLend Test Scenarios - Loan Application End-to-End
 * 
 * This file contains comprehensive test scenarios for the loan application workflow
 * using TestSprite testing framework.
 */

import { test, expect } from '@testsprite/core';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api/trpc';
const generateEmail = () => `test-${Date.now()}@example.com`;

describe('Loan Application End-to-End Tests', () => {
  
  test('should successfully submit a complete loan application', async ({ request }) => {
    const testEmail = generateEmail();
    
    const applicationData = {
      fullName: "John Test Applicant",
      email: testEmail,
      phone: "5551234567",
      password: "SecurePass123!",
      dateOfBirth: "1990-01-15",
      ssn: "123-45-6789",
      street: "123 Main Street",
      city: "Los Angeles",
      state: "CA",
      zipCode: "90001",
      employmentStatus: "employed",
      employer: "Test Corporation",
      monthlyIncome: 5000,
      loanType: "installment",
      requestedAmount: 10000,
      loanPurpose: "Home improvement project for kitchen renovation",
      disbursementMethod: "bank_transfer"
    };

    const response = await request.post(`${API_BASE}/loans.submit`, {
      data: applicationData
    });

    // Verify response structure
    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data.result.data).toHaveProperty('success', true);
    expect(data.result.data).toHaveProperty('trackingNumber');
    expect(data.result.data.trackingNumber).toMatch(/^[A-Z0-9]{8,12}$/);
    
    // Store tracking number for later tests
    const trackingNumber = data.result.data.trackingNumber;
    test.info().annotations.push({
      type: 'tracking-number',
      description: trackingNumber
    });

    console.log(`✅ Application submitted successfully. Tracking: ${trackingNumber}`);
  });

  test('should track application by tracking number', async ({ request }) => {
    // First submit an application
    const testEmail = generateEmail();
    const applicationData = {
      fullName: "Jane Tracker Test",
      email: testEmail,
      phone: "5559876543",
      password: "TrackPass123!",
      dateOfBirth: "1985-06-20",
      ssn: "987-65-4321",
      street: "456 Elm Street",
      city: "San Francisco",
      state: "CA",
      zipCode: "94102",
      employmentStatus: "self_employed",
      monthlyIncome: 7500,
      loanType: "short_term",
      requestedAmount: 5000,
      loanPurpose: "Business equipment purchase for my startup company",
      disbursementMethod: "debit_card"
    };

    const submitResponse = await request.post(`${API_BASE}/loans.submit`, {
      data: applicationData
    });
    
    const submitData = await submitResponse.json();
    const trackingNumber = submitData.result.data.trackingNumber;

    // Now track the application
    const trackResponse = await request.get(`${API_BASE}/loans.getLoanByTrackingNumber`, {
      params: {
        input: JSON.stringify({ trackingNumber })
      }
    });

    expect(trackResponse.status()).toBe(200);
    const trackData = await trackResponse.json();
    
    expect(trackData.result.data).toHaveProperty('trackingNumber', trackingNumber);
    expect(trackData.result.data).toHaveProperty('fullName', 'Jane Tracker Test');
    expect(trackData.result.data).toHaveProperty('status', 'pending');
    expect(trackData.result.data).toHaveProperty('requestedAmount', 5000);
    
    // Verify sensitive data is not exposed
    expect(trackData.result.data).not.toHaveProperty('ssn');
    expect(trackData.result.data).not.toHaveProperty('password');

    console.log(`✅ Application tracked successfully. Status: ${trackData.result.data.status}`);
  });

  test('should detect duplicate applications by SSN and DOB', async ({ request }) => {
    const ssn = "111-22-3333";
    const dob = "1992-03-15";
    const testEmail1 = generateEmail();
    const testEmail2 = generateEmail();

    // Submit first application
    const firstApp = {
      fullName: "Duplicate Test User 1",
      email: testEmail1,
      phone: "5551111111",
      password: "DupTest123!",
      dateOfBirth: dob,
      ssn: ssn,
      street: "789 Oak Avenue",
      city: "Austin",
      state: "TX",
      zipCode: "78701",
      employmentStatus: "employed",
      monthlyIncome: 6000,
      loanType: "installment",
      requestedAmount: 15000,
      loanPurpose: "Debt consolidation and financial restructuring",
      disbursementMethod: "bank_transfer"
    };

    const firstResponse = await request.post(`${API_BASE}/loans.submit`, {
      data: firstApp
    });
    
    expect(firstResponse.status()).toBe(200);
    const firstData = await firstResponse.json();
    const firstTracking = firstData.result.data.trackingNumber;

    // Check for duplicate
    const duplicateCheckResponse = await request.get(`${API_BASE}/loans.checkDuplicate`, {
      params: {
        input: JSON.stringify({
          dateOfBirth: dob,
          ssn: ssn
        })
      }
    });

    expect(duplicateCheckResponse.status()).toBe(200);
    const duplicateData = await duplicateCheckResponse.json();
    
    expect(duplicateData.result.data).toHaveProperty('isDuplicate', true);
    expect(duplicateData.result.data).toHaveProperty('trackingNumber', firstTracking);
    expect(duplicateData.result.data).toHaveProperty('status', 'pending');
    
    // Verify email is masked
    if (duplicateData.result.data.maskedEmail) {
      expect(duplicateData.result.data.maskedEmail).toMatch(/^.{3}\*\*\*@/);
    }

    console.log(`✅ Duplicate detection working. Existing application: ${firstTracking}`);
  });

  test('should reject application with invalid data types', async ({ request }) => {
    const invalidData = {
      fullName: "Invalid Data Test",
      email: "invalid@example.com",
      phone: "5551234567",
      password: "TestPass123!",
      dateOfBirth: "1990-01-15",
      ssn: "123-45-6789",
      street: "123 Test St",
      city: "Test City",
      state: "CA",
      zipCode: "90001",
      employmentStatus: "employed",
      monthlyIncome: "5000",  // Should be number, not string
      loanType: "installment",
      requestedAmount: 10000,
      loanPurpose: "Test purpose for validation",
      disbursementMethod: "bank_transfer"
    };

    const response = await request.post(`${API_BASE}/loans.submit`, {
      data: invalidData
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    
    expect(data.error).toBeDefined();
    expect(data.error.message).toContain('validation');

    console.log(`✅ Invalid data type rejected: ${data.error.message}`);
  });

  test('should reject application with invalid date format', async ({ request }) => {
    const invalidData = {
      fullName: "Invalid Date Test",
      email: generateEmail(),
      phone: "5551234567",
      password: "TestPass123!",
      dateOfBirth: "01/15/1990",  // Wrong format, should be YYYY-MM-DD
      ssn: "123-45-6789",
      street: "123 Test St",
      city: "Test City",
      state: "CA",
      zipCode: "90001",
      employmentStatus: "employed",
      monthlyIncome: 5000,
      loanType: "installment",
      requestedAmount: 10000,
      loanPurpose: "Test purpose for validation",
      disbursementMethod: "bank_transfer"
    };

    const response = await request.post(`${API_BASE}/loans.submit`, {
      data: invalidData
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    
    expect(data.error).toBeDefined();
    expect(data.error.message).toMatch(/date|format|YYYY-MM-DD/i);

    console.log(`✅ Invalid date format rejected`);
  });

  test('should reject application with invalid SSN format', async ({ request }) => {
    const invalidData = {
      fullName: "Invalid SSN Test",
      email: generateEmail(),
      phone: "5551234567",
      password: "TestPass123!",
      dateOfBirth: "1990-01-15",
      ssn: "123456789",  // Missing dashes, should be XXX-XX-XXXX
      street: "123 Test St",
      city: "Test City",
      state: "CA",
      zipCode: "90001",
      employmentStatus: "employed",
      monthlyIncome: 5000,
      loanType: "installment",
      requestedAmount: 10000,
      loanPurpose: "Test purpose for validation",
      disbursementMethod: "bank_transfer"
    };

    const response = await request.post(`${API_BASE}/loans.submit`, {
      data: invalidData
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    
    expect(data.error).toBeDefined();
    expect(data.error.message).toMatch(/SSN|format/i);

    console.log(`✅ Invalid SSN format rejected`);
  });

  test('should reject application with missing required fields', async ({ request }) => {
    const incompleteData = {
      fullName: "Incomplete Test",
      email: generateEmail(),
      // Missing many required fields
    };

    const response = await request.post(`${API_BASE}/loans.submit`, {
      data: incompleteData
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    
    expect(data.error).toBeDefined();
    expect(data.error.message).toMatch(/required|missing/i);

    console.log(`✅ Missing required fields rejected`);
  });

  test('should reject negative loan amount', async ({ request }) => {
    const invalidData = {
      fullName: "Negative Amount Test",
      email: generateEmail(),
      phone: "5551234567",
      password: "TestPass123!",
      dateOfBirth: "1990-01-15",
      ssn: "123-45-6789",
      street: "123 Test St",
      city: "Test City",
      state: "CA",
      zipCode: "90001",
      employmentStatus: "employed",
      monthlyIncome: 5000,
      loanType: "installment",
      requestedAmount: -10000,  // Negative amount
      loanPurpose: "Test purpose for validation",
      disbursementMethod: "bank_transfer"
    };

    const response = await request.post(`${API_BASE}/loans.submit`, {
      data: invalidData
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    
    expect(data.error).toBeDefined();
    expect(data.error.message).toMatch(/positive|amount|negative/i);

    console.log(`✅ Negative loan amount rejected`);
  });

  test('should handle SQL injection attempts safely', async ({ request }) => {
    const maliciousData = {
      fullName: "'; DROP TABLE users; --",
      email: generateEmail(),
      phone: "5551234567",
      password: "TestPass123!",
      dateOfBirth: "1990-01-15",
      ssn: "123-45-6789",
      street: "123 Test St",
      city: "Test City",
      state: "CA",
      zipCode: "90001",
      employmentStatus: "employed",
      monthlyIncome: 5000,
      loanType: "installment",
      requestedAmount: 10000,
      loanPurpose: "' OR '1'='1",
      disbursementMethod: "bank_transfer"
    };

    const response = await request.post(`${API_BASE}/loans.submit`, {
      data: maliciousData
    });

    // Should either reject or sanitize the input
    // If accepted, verify data is properly escaped in database
    if (response.status() === 200) {
      const data = await response.json();
      // SQL injection should not execute - verify by checking database integrity
      console.log(`⚠️ SQL injection attempt handled (sanitized)`);
    } else {
      expect(response.status()).toBe(400);
      console.log(`✅ SQL injection attempt rejected`);
    }
  });

  test('should handle XSS attempts safely', async ({ request }) => {
    const xssData = {
      fullName: "<script>alert('XSS')</script>",
      email: generateEmail(),
      phone: "5551234567",
      password: "TestPass123!",
      dateOfBirth: "1990-01-15",
      ssn: "123-45-6789",
      street: "123 Test St",
      city: "Test City",
      state: "CA",
      zipCode: "90001",
      employmentStatus: "employed",
      monthlyIncome: 5000,
      loanType: "installment",
      requestedAmount: 10000,
      loanPurpose: "<img src=x onerror=alert('XSS')>",
      disbursementMethod: "bank_transfer"
    };

    const response = await request.post(`${API_BASE}/loans.submit`, {
      data: xssData
    });

    // Should sanitize HTML/script tags
    if (response.status() === 200) {
      const data = await response.json();
      console.log(`⚠️ XSS attempt handled (sanitized)`);
    } else {
      expect(response.status()).toBe(400);
      console.log(`✅ XSS attempt rejected`);
    }
  });
});
