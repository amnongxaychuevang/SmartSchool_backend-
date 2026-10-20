// Lao mobile numbers: +856 20 followed by 8 digits. Stored in one canonical form
// so login and uniqueness work however the number was typed.
export const LAO_PHONE_PATTERN = /^\+856 20 \d{4} \d{4}$/;

/**
 * "02055500105", "20 5550 0105", "+8562055500105", "+856 20 5550-0105" →
 * "+856 20 5550 0105". Returns null when it isn't a Lao 020 mobile number.
 */
export function normalizeLaoPhone(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('856')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  if (!/^20\d{8}$/.test(digits)) return null;
  return `+856 20 ${digits.slice(2, 6)} ${digits.slice(6)}`;
}
