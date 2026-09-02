import { describe, it, expect } from 'vitest'

export function validateOtpFormat(otpArray) {
  if (!Array.isArray(otpArray) || otpArray.length !== 6) return false;
  return otpArray.every(char => /^[0-9]$/.test(char));
}

export function parsePastedOtp(pastedString) {
  const digits = pastedString.replace(/\D/g, '').slice(0, 6).split('');
  while (digits.length < 6) digits.push('');
  return digits;
}

describe('OTP Validation & Parsing Logic', () => {
  it('validates a complete 6-digit numeric OTP array', () => {
    expect(validateOtpFormat(['1', '2', '3', '4', '5', '6'])).toBe(true);
  });

  it('rejects incomplete or non-numeric OTP entries', () => {
    expect(validateOtpFormat(['1', '2', '3', '', '', ''])).toBe(false);
    expect(validateOtpFormat(['1', '2', 'a', '4', '5', '6'])).toBe(false);
  });

  it('correctly extracts and pads 6-digit clipboard paste', () => {
    expect(parsePastedOtp('987654')).toEqual(['9', '8', '7', '6', '5', '4']);
    expect(parsePastedOtp('code: 1234')).toEqual(['1', '2', '3', '4', '', '']);
  });
});
