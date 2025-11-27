/**
 * Error Handling Test Suite
 * Tests server error responses, error simulation, and recovery
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  errorSimulationRegistry,
  MockPaymentGateway,
  MockEmailService,
  MockSmsService,
  MockDatabaseService,
  MockExternalApiService,
  errorTestingUtils,
} from "./error-simulation";

describe("Error Simulation Registry", () => {
  beforeEach(() => {
    errorSimulationRegistry.enableSimulation();
  });

  afterEach(() => {
    errorSimulationRegistry.disableSimulation();
    errorSimulationRegistry.clearAllErrorSimulations();
  });

  it("should enable error simulation", () => {
    expect(errorSimulationRegistry.isSimulationActive()).toBe(true);
  });

  it("should disable error simulation", () => {
    errorSimulationRegistry.disableSimulation();
    expect(errorSimulationRegistry.isSimulationActive()).toBe(false);
  });

  it("should register error simulation for endpoint", () => {
    errorSimulationRegistry.registerErrorSimulation(
      "auth.signIn",
      "INTERNAL_SERVER_ERROR"
    );

    expect(errorSimulationRegistry.shouldSimulateError("auth.signIn")).toBe(true);
  });

  it("should unregister error simulation", () => {
    errorSimulationRegistry.registerErrorSimulation(
      "auth.signIn",
      "INTERNAL_SERVER_ERROR"
    );
    errorSimulationRegistry.unregisterErrorSimulation("auth.signIn");

    expect(errorSimulationRegistry.shouldSimulateError("auth.signIn")).toBe(false);
  });

  it("should return correct HTTP status codes for error types", () => {
    const testCases = [
      { type: "INTERNAL_SERVER_ERROR" as const, expectedStatus: 500 },
      { type: "SERVICE_UNAVAILABLE" as const, expectedStatus: 503 },
      { type: "BAD_GATEWAY" as const, expectedStatus: 502 },
      { type: "GATEWAY_TIMEOUT" as const, expectedStatus: 504 },
      { type: "RATE_LIMIT" as const, expectedStatus: 429 },
      { type: "VALIDATION_ERROR" as const, expectedStatus: 400 },
      { type: "AUTHENTICATION_ERROR" as const, expectedStatus: 401 },
      { type: "AUTHORIZATION_ERROR" as const, expectedStatus: 403 },
      { type: "NOT_FOUND" as const, expectedStatus: 404 },
    ];

    testCases.forEach(({ type, expectedStatus }) => {
      errorSimulationRegistry.registerErrorSimulation("test", type);
      const config = errorSimulationRegistry.getErrorSimulation("test");
      expect(config?.statusCode).toBe(expectedStatus);
    });
  });

  it("should get error simulation config", () => {
    errorSimulationRegistry.registerErrorSimulation(
      "loans.calculatePayment",
      "DATABASE_ERROR",
      {
        delayMs: 100,
        errorMessage: "Custom database error",
      }
    );

    const config = errorSimulationRegistry.getErrorSimulation("loans.calculatePayment");
    expect(config).toBeDefined();
    expect(config?.errorType).toBe("DATABASE_ERROR");
    expect(config?.delayMs).toBe(100);
    expect(config?.errorMessage).toBe("Custom database error");
  });

  it("should clear all error simulations", () => {
    errorSimulationRegistry.registerErrorSimulation("auth.signIn", "INTERNAL_SERVER_ERROR");
    errorSimulationRegistry.registerErrorSimulation("loans.create", "DATABASE_ERROR");

    const before = errorSimulationRegistry.getAllErrorSimulations().size;
    expect(before).toBe(2);

    errorSimulationRegistry.clearAllErrorSimulations();
    const after = errorSimulationRegistry.getAllErrorSimulations().size;
    expect(after).toBe(0);
  });
});

describe("Mock Payment Gateway", () => {
  let gateway: MockPaymentGateway;

  beforeEach(() => {
    gateway = new MockPaymentGateway();
  });

  it("should process payment successfully", async () => {
    const result = await gateway.processPayment(10000, "token_123");

    expect(result.success).toBe(true);
    expect(result.transactionId).toBeDefined();
  });

  it("should fail payment when failure rate is high", async () => {
    gateway.setFailureRate(1.0); // 100% failure rate

    const result = await gateway.processPayment(10000, "token_123");

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe("PAYMENT_PROCESSING_ERROR");
  });

  it("should simulate network delay", async () => {
    gateway.setDelay(100);

    const start = Date.now();
    await gateway.processPayment(10000, "token_123");
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(100);
  });

  it("should throw error when configured", async () => {
    gateway.setFailureRate(1.0);
    gateway.setThrowError(true);

    await expect(() => gateway.processPayment(10000, "token_123")).rejects.toThrow();
  });
});

describe("Mock Email Service", () => {
  let emailService: MockEmailService;

  beforeEach(() => {
    emailService = new MockEmailService();
  });

  it("should send email successfully", async () => {
    const result = await emailService.sendEmail(
      "user@example.com",
      "Test Subject",
      "<p>Test body</p>"
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
  });

  it("should fail email send with high failure rate", async () => {
    emailService.setFailureRate(1.0);

    const result = await emailService.sendEmail(
      "user@example.com",
      "Test Subject",
      "<p>Test body</p>"
    );

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("EMAIL_SEND_ERROR");
  });

  it("should simulate partial email failures (80%)", async () => {
    emailService.setFailureRate(0.8);

    const results = [];
    for (let i = 0; i < 10; i++) {
      const result = await emailService.sendEmail(
        "user@example.com",
        "Test",
        "Body"
      );
      results.push(result.success);
    }

    const failures = results.filter((success) => !success).length;
    expect(failures).toBeGreaterThan(0);
    expect(failures).toBeLessThanOrEqual(10);
  });
});

describe("Mock SMS Service", () => {
  let smsService: MockSmsService;

  beforeEach(() => {
    smsService = new MockSmsService();
  });

  it("should send SMS successfully", async () => {
    const result = await smsService.sendSms("+1234567890", "Test message");

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
  });

  it("should fail SMS send with high failure rate", async () => {
    smsService.setFailureRate(1.0);

    const result = await smsService.sendSms("+1234567890", "Test message");

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("SMS_SEND_ERROR");
  });
});

describe("Mock Database Service", () => {
  let dbService: MockDatabaseService;

  beforeEach(() => {
    dbService = new MockDatabaseService();
  });

  it("should execute query successfully", async () => {
    const result = await dbService.query(
      "SELECT * FROM users WHERE id = ?",
      [1]
    );

    expect(result.success).toBe(true);
  });

  it("should fail query with high failure rate", async () => {
    dbService.setFailureRate(1.0);

    const result = await dbService.query(
      "SELECT * FROM users WHERE id = ?",
      [1]
    );

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("DATABASE_ERROR");
  });

  it("should simulate database timeout", async () => {
    dbService.setDelay(500);

    const start = Date.now();
    await dbService.query("SELECT * FROM users");
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(500);
  });
});

describe("Mock External API Service", () => {
  let apiService: MockExternalApiService;

  beforeEach(() => {
    apiService = new MockExternalApiService();
  });

  it("should call external API successfully", async () => {
    const result = await apiService.callApi(
      "/api/external/endpoint",
      "GET"
    );

    expect(result.success).toBe(true);
  });

  it("should fail API call with high failure rate", async () => {
    apiService.setFailureRate(1.0);

    const result = await apiService.callApi(
      "/api/external/endpoint",
      "GET"
    );

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("EXTERNAL_API_ERROR");
  });
});

describe("Error Testing Utilities", () => {
  it("should create valid error response", () => {
    const response = errorTestingUtils.createErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Custom error message"
    );

    expect(errorTestingUtils.assertErrorResponse(response)).toBe(true);
    expect(response.success).toBe(false);
    expect(response.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(response.error.message).toBe("Custom error message");
  });

  it("should validate error response structure", () => {
    const validResponse = {
      success: false,
      error: {
        code: "ERROR_CODE",
        message: "Error message",
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };

    expect(errorTestingUtils.assertErrorResponse(validResponse)).toBe(true);
  });

  it("should reject invalid error response", () => {
    const invalidResponses = [
      { success: false }, // missing error
      { success: false, error: { code: "ERROR" } }, // missing message
      { success: false, error: { message: "Error" } }, // missing code
      { success: false, error: { code: "ERROR", message: "Msg" } }, // missing meta
      null,  // null response
      undefined,  // undefined response
    ];

    invalidResponses.forEach((response) => {
      const result = errorTestingUtils.assertErrorResponse(response);
      expect(result).toBe(false);
    });
  });

  it("should generate random error", () => {
    const error = errorTestingUtils.getRandomError();

    expect(error.type).toBeDefined();
    expect(error.statusCode).toBeGreaterThanOrEqual(400);
    expect(error.message).toBeDefined();
  });
});

describe("Error Recovery Scenarios", () => {
  beforeEach(() => {
    errorSimulationRegistry.enableSimulation();
  });

  afterEach(() => {
    errorSimulationRegistry.disableSimulation();
    errorSimulationRegistry.clearAllErrorSimulations();
  });

  it("should simulate transient failure and recover", async () => {
    const gateway = new MockPaymentGateway();

    // First attempt fails
    gateway.setFailureRate(1.0);
    const result1 = await gateway.processPayment(10000, "token_123");
    expect(result1.success).toBe(false);

    // Second attempt succeeds after reset
    gateway.setFailureRate(0);
    const result2 = await gateway.processPayment(10000, "token_123");
    expect(result2.success).toBe(true);
  });

  it("should simulate cascading failures", async () => {
    const payment = new MockPaymentGateway({ failureRate: 0.8 });
    const email = new MockEmailService({ failureRate: 0.8 });
    const sms = new MockSmsService({ failureRate: 0.8 });

    // Simulate multiple service failures
    let totalFailures = 0;
    for (let i = 0; i < 10; i++) {
      const p1 = await payment.processPayment(10000, "token");
      const p2 = await email.sendEmail("user@example.com", "Subject", "Body");
      const p3 = await sms.sendSms("+1234567890", "Message");

      if (!p1.success) totalFailures++;
      if (!p2.success) totalFailures++;
      if (!p3.success) totalFailures++;
    }

    expect(totalFailures).toBeGreaterThan(0);
  });

  it("should handle concurrent error scenarios", async () => {
    const services = [
      new MockPaymentGateway({ failureRate: 0.5 }),
      new MockEmailService({ failureRate: 0.5 }),
      new MockDatabaseService({ failureRate: 0.5 }),
    ];

    const promises = services.map((service) => {
      if (service instanceof MockPaymentGateway) {
        return (service as MockPaymentGateway).processPayment(10000, "token");
      } else if (service instanceof MockEmailService) {
        return (service as MockEmailService).sendEmail("user@example.com", "Subject", "Body");
      } else {
        return (service as MockDatabaseService).query("SELECT * FROM users");
      }
    });

    const results = await Promise.all(promises);
    expect(results.length).toBe(3);
  });
});

describe("Error Response Codes", () => {
  it("should map all error types to correct status codes", () => {
    const errorMappings = [
      { type: "INTERNAL_SERVER_ERROR" as const, status: 500 },
      { type: "SERVICE_UNAVAILABLE" as const, status: 503 },
      { type: "BAD_GATEWAY" as const, status: 502 },
      { type: "GATEWAY_TIMEOUT" as const, status: 504 },
      { type: "RATE_LIMIT" as const, status: 429 },
      { type: "NETWORK_TIMEOUT" as const, status: 504 },
      { type: "NETWORK_FAILURE" as const, status: 503 },
      { type: "DATABASE_ERROR" as const, status: 500 },
      { type: "PAYMENT_GATEWAY_ERROR" as const, status: 502 },
      { type: "EMAIL_SERVICE_ERROR" as const, status: 503 },
      { type: "SMS_SERVICE_ERROR" as const, status: 503 },
      { type: "EXTERNAL_API_ERROR" as const, status: 502 },
      { type: "VALIDATION_ERROR" as const, status: 400 },
      { type: "AUTHENTICATION_ERROR" as const, status: 401 },
      { type: "AUTHORIZATION_ERROR" as const, status: 403 },
      { type: "NOT_FOUND" as const, status: 404 },
    ];

    errorMappings.forEach(({ type, status }) => {
      const response = errorTestingUtils.createErrorResponse(type);
      expect(response.error.details?.statusCode).toBe(status);
    });
  });
});
