/**
 * AmeriLend Test Scenarios - Authentication & Authorization
 * 
 * Comprehensive test scenarios for authentication workflows including
 * signup, login, OTP verification, password reset, and role-based access control.
 */

import { test, expect } from '@testsprite/core';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api/trpc';
const generateEmail = () => `test-${Date.now()}@example.com`;

describe('Authentication & Authorization Tests', () => {
  
  test('should successfully register a new user', async ({ request }) => {
    const testEmail = generateEmail();
    
    const signupData = {
      email: testEmail,
      password: "SecurePassword123!",
      name: "Test User Registration"
    };

    const response = await request.post(`${API_BASE}/auth.signUp`, {
      data: signupData
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data.result.data).toHaveProperty('success', true);
    expect(data.result.data).toHaveProperty('user');
    expect(data.result.data.user).toHaveProperty('email', testEmail);
    expect(data.result.data.user).toHaveProperty('role', 'user'); // Not admin
    
    // Verify password is NOT returned
    expect(data.result.data.user).not.toHaveProperty('password');

    console.log(`✅ User registered successfully: ${testEmail}`);
  });

  test('should prevent duplicate email registration', async ({ request }) => {
    const testEmail = generateEmail();
    
    const signupData = {
      email: testEmail,
      password: "SecurePassword123!",
      name: "Duplicate Test User"
    };

    // First registration
    const firstResponse = await request.post(`${API_BASE}/auth.signUp`, {
      data: signupData
    });
    expect(firstResponse.status()).toBe(200);

    // Attempt duplicate registration
    const secondResponse = await request.post(`${API_BASE}/auth.signUp`, {
      data: signupData
    });

    expect(secondResponse.status()).toBe(400);
    const errorData = await secondResponse.json();
    
    expect(errorData.error).toBeDefined();
    expect(errorData.error.message).toMatch(/already exists|duplicate|registered/i);

    console.log(`✅ Duplicate email registration prevented`);
  });

  test('should successfully login with valid credentials', async ({ request }) => {
    const testEmail = generateEmail();
    const password = "LoginTest123!";
    
    // First register user
    await request.post(`${API_BASE}/auth.signUp`, {
      data: {
        email: testEmail,
        password: password,
        name: "Login Test User"
      }
    });

    // Now login
    const loginResponse = await request.post(`${API_BASE}/auth.signIn`, {
      data: {
        email: testEmail,
        password: password
      }
    });

    expect(loginResponse.status()).toBe(200);
    const loginData = await loginResponse.json();
    
    expect(loginData.result.data).toHaveProperty('success', true);
    expect(loginData.result.data).toHaveProperty('user');
    
    // Verify session cookie is set
    const cookies = loginResponse.headers()['set-cookie'];
    expect(cookies).toBeDefined();

    console.log(`✅ User logged in successfully`);
  });

  test('should reject login with invalid password', async ({ request }) => {
    const testEmail = generateEmail();
    
    // Register user
    await request.post(`${API_BASE}/auth.signUp`, {
      data: {
        email: testEmail,
        password: "CorrectPassword123!",
        name: "Invalid Password Test"
      }
    });

    // Attempt login with wrong password
    const loginResponse = await request.post(`${API_BASE}/auth.signIn`, {
      data: {
        email: testEmail,
        password: "WrongPassword456!"
      }
    });

    expect(loginResponse.status()).toBe(401);
    const errorData = await loginResponse.json();
    
    expect(errorData.error).toBeDefined();
    expect(errorData.error.message).toMatch(/invalid|incorrect|credentials/i);

    console.log(`✅ Invalid password rejected`);
  });

  test('should successfully request OTP via email', async ({ request }) => {
    const testEmail = generateEmail();
    
    // Register user first
    await request.post(`${API_BASE}/auth.signUp`, {
      data: {
        email: testEmail,
        password: "OTPTest123!",
        name: "OTP Test User"
      }
    });

    // Request OTP
    const otpResponse = await request.post(`${API_BASE}/auth.requestOTP`, {
      data: {
        identifier: testEmail,
        channel: "email"
      }
    });

    expect(otpResponse.status()).toBe(200);
    const otpData = await otpResponse.json();
    
    expect(otpData.result.data).toHaveProperty('success', true);
    expect(otpData.result.data).toHaveProperty('message');
    
    // OTP should be sent but not returned in response
    expect(otpData.result.data).not.toHaveProperty('code');

    console.log(`✅ OTP requested successfully`);
  });

  test('should verify valid OTP code', async ({ request }) => {
    const testEmail = generateEmail();
    
    // Register user
    await request.post(`${API_BASE}/auth.signUp`, {
      data: {
        email: testEmail,
        password: "OTPVerify123!",
        name: "OTP Verify User"
      }
    });

    // Request OTP
    await request.post(`${API_BASE}/auth.requestOTP`, {
      data: {
        identifier: testEmail,
        channel: "email"
      }
    });

    // Note: In real scenario, retrieve OTP from email or database
    // For testing, you might need to query the database or use a test OTP
    const testOTP = "123456"; // This would come from your test database

    const verifyResponse = await request.post(`${API_BASE}/auth.verifyOTP`, {
      data: {
        identifier: testEmail,
        code: testOTP
      }
    });

    // This might fail in actual test if OTP doesn't match
    // Adjust based on your test environment
    console.log(`⚠️ OTP verification attempted (requires valid test OTP)`);
  });

  test('should reject invalid OTP code', async ({ request }) => {
    const testEmail = generateEmail();
    
    // Register user
    await request.post(`${API_BASE}/auth.signUp`, {
      data: {
        email: testEmail,
        password: "InvalidOTP123!",
        name: "Invalid OTP User"
      }
    });

    // Request OTP
    await request.post(`${API_BASE}/auth.requestOTP`, {
      data: {
        identifier: testEmail,
        channel: "email"
      }
    });

    // Try invalid OTP
    const verifyResponse = await request.post(`${API_BASE}/auth.verifyOTP`, {
      data: {
        identifier: testEmail,
        code: "000000" // Invalid code
      }
    });

    expect(verifyResponse.status()).toBe(400);
    const errorData = await verifyResponse.json();
    
    expect(errorData.error).toBeDefined();
    expect(errorData.error.message).toMatch(/invalid|incorrect|expired/i);

    console.log(`✅ Invalid OTP rejected`);
  });

  test('should successfully initiate password reset', async ({ request }) => {
    const testEmail = generateEmail();
    
    // Register user
    await request.post(`${API_BASE}/auth.signUp`, {
      data: {
        email: testEmail,
        password: "OriginalPassword123!",
        name: "Password Reset User"
      }
    });

    // Request password reset
    const resetResponse = await request.post(`${API_BASE}/auth.resetPassword`, {
      data: {
        email: testEmail
      }
    });

    expect(resetResponse.status()).toBe(200);
    const resetData = await resetResponse.json();
    
    expect(resetData.result.data).toHaveProperty('success', true);
    
    console.log(`✅ Password reset initiated`);
  });

  test('should enforce rate limiting on failed login attempts', async ({ request }) => {
    const testEmail = generateEmail();
    
    // Register user
    await request.post(`${API_BASE}/auth.signUp`, {
      data: {
        email: testEmail,
        password: "RateLimit123!",
        name: "Rate Limit Test"
      }
    });

    // Attempt multiple failed logins
    const failedAttempts = [];
    for (let i = 0; i < 6; i++) {
      const attempt = await request.post(`${API_BASE}/auth.signIn`, {
        data: {
          email: testEmail,
          password: "WrongPassword!"
        }
      });
      failedAttempts.push(attempt.status());
    }

    // After 5 failed attempts, should get rate limited
    const lastAttempt = failedAttempts[failedAttempts.length - 1];
    expect(lastAttempt).toBe(429); // Too Many Requests

    console.log(`✅ Rate limiting enforced after ${failedAttempts.length} attempts`);
  });

  test('should prevent non-admin from accessing admin endpoints', async ({ request }) => {
    const testEmail = generateEmail();
    
    // Register regular user
    const signupResponse = await request.post(`${API_BASE}/auth.signUp`, {
      data: {
        email: testEmail,
        password: "RegularUser123!",
        name: "Regular User"
      }
    });

    // Login to get session
    await request.post(`${API_BASE}/auth.signIn`, {
      data: {
        email: testEmail,
        password: "RegularUser123!"
      }
    });

    // Try to access admin endpoint
    const adminResponse = await request.get(`${API_BASE}/loans.adminList`);

    expect(adminResponse.status()).toBe(403); // Forbidden
    const errorData = await adminResponse.json();
    
    expect(errorData.error).toBeDefined();
    expect(errorData.error.code).toBe('FORBIDDEN');

    console.log(`✅ Non-admin access to admin endpoints blocked`);
  });

  test('should reject weak passwords', async ({ request }) => {
    const testEmail = generateEmail();
    
    const weakPasswords = [
      "123",           // Too short
      "1234567",       // Still too short (< 8 chars)
      "password",      // Common password
      "12345678"       // Only numbers
    ];

    for (const weakPass of weakPasswords) {
      const response = await request.post(`${API_BASE}/auth.signUp`, {
        data: {
          email: generateEmail(),
          password: weakPass,
          name: "Weak Password Test"
        }
      });

      expect(response.status()).toBe(400);
      const errorData = await response.json();
      expect(errorData.error.message).toMatch(/password|characters|length/i);
    }

    console.log(`✅ Weak passwords rejected`);
  });

  test('should handle session expiration', async ({ request }) => {
    // This test would require manipulating session expiry
    // Implementation depends on your session management
    console.log(`⚠️ Session expiration test (requires session manipulation)`);
  });

  test('should successfully logout user', async ({ request }) => {
    const testEmail = generateEmail();
    
    // Register and login
    await request.post(`${API_BASE}/auth.signUp`, {
      data: {
        email: testEmail,
        password: "LogoutTest123!",
        name: "Logout Test User"
      }
    });

    await request.post(`${API_BASE}/auth.signIn`, {
      data: {
        email: testEmail,
        password: "LogoutTest123!"
      }
    });

    // Logout
    const logoutResponse = await request.post(`${API_BASE}/auth.signOut`);

    expect(logoutResponse.status()).toBe(200);
    const logoutData = await logoutResponse.json();
    
    expect(logoutData.result.data).toHaveProperty('success', true);
    
    // Verify session cookie is cleared
    const cookies = logoutResponse.headers()['set-cookie'];
    if (cookies) {
      expect(cookies).toMatch(/app_session_id=;|Max-Age=0/);
    }

    console.log(`✅ User logged out successfully`);
  });
});
