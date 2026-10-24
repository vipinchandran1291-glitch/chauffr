/** Accepts a 10-digit Indian mobile with optional +91/0 prefix; returns +91XXXXXXXXXX or null. */
export function normalizeIndianPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

export function normalizeRegNumber(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '');
}

/** State series (KA01AB1234) or Bharat series (22BH1234AA). */
export function isValidRegNumber(reg: string): boolean {
  return /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/.test(reg) || /^\d{2}BH\d{4}[A-Z]{1,2}$/.test(reg);
}
