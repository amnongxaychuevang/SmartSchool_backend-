/**
 * Domain rules and pure calculations for Summer Extra Classes.
 */

export function computeSummerFee(
  courses: { monthlyFee: number }[],
  monthsCount: number,
  discount: number = 0
): { subtotal: number; discount: number; totalAmount: number } {
  const safeMonths = Math.max(1, monthsCount);
  const subtotal = courses.reduce((sum, c) => sum + Math.max(0, c.monthlyFee) * safeMonths, 0);
  const safeDiscount = Math.max(0, Math.min(discount, subtotal));
  const totalAmount = Math.max(0, subtotal - safeDiscount);

  return {
    subtotal,
    discount: safeDiscount,
    totalAmount,
  };
}

export function getSummerPaymentStatus(
  totalAmount: number,
  paidAmount: number
): 'unpaid' | 'partial' | 'paid' {
  if (paidAmount <= 0) return 'unpaid';
  if (paidAmount >= totalAmount) return 'paid';
  return 'partial';
}

export function formatSummerStudentCode(yearSuffix: string | number, seq: number): string {
  const pad = String(seq).padStart(3, '0');
  return `SM-${yearSuffix}${pad}`;
}

export function formatSummerReceiptNo(year: string | number, seq: number): string {
  const pad = String(seq).padStart(4, '0');
  return `SMR-${year}-${pad}`;
}

export function parseSummerMonths(monthsStr: string | null | undefined): number[] {
  if (!monthsStr) return [];
  try {
    const parsed = JSON.parse(monthsStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
