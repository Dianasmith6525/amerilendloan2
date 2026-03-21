import { describe, it, expect } from 'vitest';
import { validateSSNFormat, validateITINFormat } from './ofac-check';

describe('validateSSNFormat', () => {
  it('accepts a valid SSN', () => {
    const result = validateSSNFormat('123-45-6789');
    expect(result.valid).toBe(true);
    expect(result.maskedSSN).toBe('***-**-6789');
  });

  it('accepts SSN without dashes', () => {
    const result = validateSSNFormat('123456789');
    expect(result.valid).toBe(true);
    expect(result.maskedSSN).toBe('***-**-6789');
  });

  it('rejects SSN with wrong length', () => {
    expect(validateSSNFormat('12345').valid).toBe(false);
    expect(validateSSNFormat('12345678901').valid).toBe(false);
  });

  it('rejects SSN area number 000', () => {
    expect(validateSSNFormat('000-45-6789').valid).toBe(false);
  });

  it('rejects SSN area number 666', () => {
    expect(validateSSNFormat('666-45-6789').valid).toBe(false);
  });

  it('rejects SSN area number 900-999', () => {
    expect(validateSSNFormat('900-45-6789').valid).toBe(false);
    expect(validateSSNFormat('999-45-6789').valid).toBe(false);
  });

  it('rejects SSN group number 00', () => {
    expect(validateSSNFormat('123-00-6789').valid).toBe(false);
  });

  it('rejects SSN serial number 0000', () => {
    expect(validateSSNFormat('123-45-0000').valid).toBe(false);
  });
});

describe('validateITINFormat', () => {
  it('accepts a valid ITIN (group 70-88)', () => {
    const result = validateITINFormat('912-70-1234');
    expect(result.valid).toBe(true);
    expect(result.maskedITIN).toBe('***-**-1234');
  });

  it('accepts ITIN group 50-65', () => {
    expect(validateITINFormat('900-50-1234').valid).toBe(true);
    expect(validateITINFormat('900-65-1234').valid).toBe(true);
  });

  it('accepts ITIN group 90-92', () => {
    expect(validateITINFormat('900-90-1234').valid).toBe(true);
    expect(validateITINFormat('900-92-1234').valid).toBe(true);
  });

  it('accepts ITIN group 94-99', () => {
    expect(validateITINFormat('900-94-1234').valid).toBe(true);
    expect(validateITINFormat('900-99-1234').valid).toBe(true);
  });

  it('rejects ITIN not starting with 9', () => {
    expect(validateITINFormat('123-70-1234').valid).toBe(false);
  });

  it('rejects ITIN with invalid group number', () => {
    expect(validateITINFormat('900-10-1234').valid).toBe(false);
    expect(validateITINFormat('900-49-1234').valid).toBe(false);
    expect(validateITINFormat('900-66-1234').valid).toBe(false);
    expect(validateITINFormat('900-69-1234').valid).toBe(false);
    expect(validateITINFormat('900-93-1234').valid).toBe(false);
  });

  it('rejects ITIN with wrong length', () => {
    expect(validateITINFormat('12345').valid).toBe(false);
  });
});
