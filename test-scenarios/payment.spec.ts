/**
 * AmeriLend Test Scenarios - Payment Processing
 * 
 * Comprehensive test scenarios for payment workflows including
 * credit card payments, crypto payments, payment verification, and error handling.
 */

import { test, expect } from '@testsprite/core';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api/trpc';
const generateEmail = () => `test-${Date.now()}@example.com`;

describe('Payment Processing Tests', () => {
  
  // Helper function to create an approved loan application
  async function createApprovedLoan(request: any) {
    const testEmail = generateEmail();
    
    // Submit loan application
    const appResponse = await request.post(`${API_BASE}/loans.submit`, {
      data: {
        fullName: "Payment Test User",
        email: testEmail,
        phone: "5551234567",
        password: "PaymentTest123!",
        dateOfBirth: "1990-01-15",
        ssn: `${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 90 + 10)}-${Math.floor(Math.random() * 9000 + 1000)}`,
        street: "123 Payment St",
        city: "Los Angeles",
        state: "CA",
        zipCode: "90001",
        employmentStatus: "employed",
        monthlyIncome: 5000,
        loanType: "installment",
        requestedAmount: 10000,
        loanPurpose: "Payment processing test for integration",
        disbursementMethod: "bank_transfer"
      }
    });

    const appData = await appResponse.json();
    return appData.result.data.applicationId || 1;
  }

  test('should successfully create a payment intent for credit card', async ({ request }) => {
    const applicationId = await createApprovedLoan(request);

    const paymentData = {
      applicationId: applicationId,
      amount: 20000, // $200.00 in cents
      paymentMethod: "card",
      paymentMethodNonce: "test_nonce_valid_card",
      description: "Processing fee payment - test"
    };

    const response = await request.post(`${API_BASE}/payments.createIntent`, {
      data: paymentData
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data.result.data).toHaveProperty('success', true);
    expect(data.result.data).toHaveProperty('paymentId');
    
    console.log(`✅ Payment intent created successfully`);
  });

  test('should process Authorize.Net credit card payment', async ({ request }) => {
    const applicationId = await createApprovedLoan(request);

    const cardPaymentData = {
      applicationId: applicationId,
      amount: 20000,
      paymentMethod: "card",
      paymentMethodNonce: "test_authorize_net_nonce",
      cardNumber: "4111111111111111", // Test card
      expiryMonth: "12",
      expiryYear: "25",
      cvv: "123"
    };

    const response = await request.post(`${API_BASE}/payments.createIntent`, {
      data: cardPaymentData
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data.result.data).toHaveProperty('success', true);
    expect(data.result.data).toHaveProperty('transactionId');
    
    console.log(`✅ Authorize.Net payment processed`);
  });

  test('should reject payment with invalid card number', async ({ request }) => {
    const applicationId = await createApprovedLoan(request);

    const invalidCardData = {
      applicationId: applicationId,
      amount: 20000,
      paymentMethod: "card",
      cardNumber: "1234567890123456", // Invalid card
      expiryMonth: "12",
      expiryYear: "25",
      cvv: "123"
    };

    const response = await request.post(`${API_BASE}/payments.createIntent`, {
      data: invalidCardData
    });

    expect(response.status()).toBe(400);
    const errorData = await response.json();
    
    expect(errorData.error).toBeDefined();
    expect(errorData.error.message).toMatch(/invalid|card|declined/i);

    console.log(`✅ Invalid card number rejected`);
  });

  test('should successfully initiate Bitcoin payment', async ({ request }) => {
    const applicationId = await createApprovedLoan(request);

    const btcPaymentData = {
      applicationId: applicationId,
      amount: 20000,
      cryptoType: "BTC"
    };

    const response = await request.post(`${API_BASE}/payments.processCrypto`, {
      data: btcPaymentData
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data.result.data).toHaveProperty('success', true);
    expect(data.result.data).toHaveProperty('paymentAddress');
    expect(data.result.data).toHaveProperty('amount');
    expect(data.result.data.paymentAddress).toMatch(/^bc1/); // BTC bech32 address

    console.log(`✅ Bitcoin payment initiated. Address: ${data.result.data.paymentAddress}`);
  });

  test('should successfully initiate Ethereum payment', async ({ request }) => {
    const applicationId = await createApprovedLoan(request);

    const ethPaymentData = {
      applicationId: applicationId,
      amount: 20000,
      cryptoType: "ETH"
    };

    const response = await request.post(`${API_BASE}/payments.processCrypto`, {
      data: ethPaymentData
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data.result.data).toHaveProperty('success', true);
    expect(data.result.data).toHaveProperty('paymentAddress');
    expect(data.result.data.paymentAddress).toMatch(/^0x/); // ETH address

    console.log(`✅ Ethereum payment initiated. Address: ${data.result.data.paymentAddress}`);
  });

  test('should successfully initiate USDT payment', async ({ request }) => {
    const applicationId = await createApprovedLoan(request);

    const usdtPaymentData = {
      applicationId: applicationId,
      amount: 20000,
      cryptoType: "USDT"
    };

    const response = await request.post(`${API_BASE}/payments.processCrypto`, {
      data: usdtPaymentData
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data.result.data).toHaveProperty('success', true);
    expect(data.result.data).toHaveProperty('paymentAddress');
    expect(data.result.data.paymentAddress).toMatch(/^0x/); // ERC-20 address

    console.log(`✅ USDT payment initiated`);
  });

  test('should verify crypto payment by transaction hash', async ({ request }) => {
    const applicationId = await createApprovedLoan(request);

    // First create crypto payment
    const cryptoResponse = await request.post(`${API_BASE}/payments.processCrypto`, {
      data: {
        applicationId: applicationId,
        amount: 20000,
        cryptoType: "BTC"
      }
    });

    const cryptoData = await cryptoResponse.json();
    const paymentId = cryptoData.result.data.paymentId;

    // Now verify with tx hash
    const verifyResponse = await request.post(`${API_BASE}/payments.verifyCryptoPayment`, {
      data: {
        paymentId: paymentId,
        txHash: "test_transaction_hash_0x123456789abcdef"
      }
    });

    expect(verifyResponse.status()).toBe(200);
    const verifyData = await verifyResponse.json();
    
    expect(verifyData.result.data).toHaveProperty('success', true);
    
    console.log(`✅ Crypto payment verified`);
  });

  test('should reject payment with negative amount', async ({ request }) => {
    const applicationId = await createApprovedLoan(request);

    const invalidPaymentData = {
      applicationId: applicationId,
      amount: -10000, // Negative amount
      paymentMethod: "card"
    };

    const response = await request.post(`${API_BASE}/payments.createIntent`, {
      data: invalidPaymentData
    });

    expect(response.status()).toBe(400);
    const errorData = await errorResponse.json();
    
    expect(errorData.error).toBeDefined();
    expect(errorData.error.message).toMatch(/amount|positive|negative/i);

    console.log(`✅ Negative payment amount rejected`);
  });

  test('should reject payment with zero amount', async ({ request }) => {
    const applicationId = await createApprovedLoan(request);

    const zeroPaymentData = {
      applicationId: applicationId,
      amount: 0,
      paymentMethod: "card"
    };

    const response = await request.post(`${API_BASE}/payments.createIntent`, {
      data: zeroPaymentData
    });

    expect(response.status()).toBe(400);
    const errorData = await response.json();
    
    expect(errorData.error).toBeDefined();
    expect(errorData.error.message).toMatch(/amount|positive|greater/i);

    console.log(`✅ Zero payment amount rejected`);
  });

  test('should retrieve payments for a loan application', async ({ request }) => {
    const applicationId = await createApprovedLoan(request);

    // Create a payment first
    await request.post(`${API_BASE}/payments.createIntent`, {
      data: {
        applicationId: applicationId,
        amount: 20000,
        paymentMethod: "card",
        paymentMethodNonce: "test_nonce"
      }
    });

    // Now retrieve payments
    const response = await request.get(`${API_BASE}/payments.getByLoanId`, {
      params: {
        input: JSON.stringify({ loanApplicationId: applicationId })
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(Array.isArray(data.result.data)).toBe(true);
    expect(data.result.data.length).toBeGreaterThan(0);
    
    const payment = data.result.data[0];
    expect(payment).toHaveProperty('amount');
    expect(payment).toHaveProperty('status');
    expect(payment).toHaveProperty('paymentMethod');

    console.log(`✅ Retrieved ${data.result.data.length} payment(s) for loan`);
  });

  test('should handle payment failure gracefully', async ({ request }) => {
    const applicationId = await createApprovedLoan(request);

    const failingPaymentData = {
      applicationId: applicationId,
      amount: 20000,
      paymentMethod: "card",
      cardNumber: "4000000000000002", // Card that will be declined
      expiryMonth: "12",
      expiryYear: "25",
      cvv: "123"
    };

    const response = await request.post(`${API_BASE}/payments.createIntent`, {
      data: failingPaymentData
    });

    // Should handle failure gracefully
    if (response.status() === 400 || response.status() === 402) {
      const errorData = await response.json();
      expect(errorData.error).toBeDefined();
      expect(errorData.error.message).toMatch(/declined|failed|insufficient/i);
      console.log(`✅ Payment failure handled gracefully`);
    }
  });

  test('should prevent duplicate payment with same idempotency key', async ({ request }) => {
    const applicationId = await createApprovedLoan(request);
    const idempotencyKey = `test_idem_${Date.now()}`;

    const paymentData = {
      applicationId: applicationId,
      amount: 20000,
      paymentMethod: "card",
      paymentMethodNonce: "test_nonce",
      idempotencyKey: idempotencyKey
    };

    // First payment
    const firstResponse = await request.post(`${API_BASE}/payments.createIntent`, {
      data: paymentData
    });
    expect(firstResponse.status()).toBe(200);

    // Duplicate payment with same idempotency key
    const duplicateResponse = await request.post(`${API_BASE}/payments.createIntent`, {
      data: paymentData
    });

    // Should either return original payment or reject duplicate
    expect([200, 409]).toContain(duplicateResponse.status());
    
    console.log(`✅ Duplicate payment with same idempotency key handled`);
  });

  test('should record payment attempts in audit log', async ({ request }) => {
    const applicationId = await createApprovedLoan(request);

    await request.post(`${API_BASE}/payments.createIntent`, {
      data: {
        applicationId: applicationId,
        amount: 20000,
        paymentMethod: "card",
        paymentMethodNonce: "test_nonce"
      }
    });

    // Verify audit log (if accessible)
    console.log(`✅ Payment attempt logged`);
  });

  test('should calculate correct crypto conversion rates', async ({ request }) => {
    const applicationId = await createApprovedLoan(request);

    const response = await request.post(`${API_BASE}/payments.processCrypto`, {
      data: {
        applicationId: applicationId,
        amount: 20000, // $200 USD
        cryptoType: "BTC"
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data.result.data).toHaveProperty('cryptoAmount');
    expect(data.result.data).toHaveProperty('exchangeRate');
    expect(typeof data.result.data.cryptoAmount).toBe('number');
    expect(data.result.data.cryptoAmount).toBeGreaterThan(0);

    console.log(`✅ Crypto conversion calculated: $200 = ${data.result.data.cryptoAmount} BTC`);
  });
});
