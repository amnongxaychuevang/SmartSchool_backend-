// Pure fee rules, shared by the repository and its tests. Money is handled in
// whole kip (LAK has no minor unit in practice), so amounts are compared exactly.

export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'void';

/** What the family owes in total for an invoice: amount less any discount, never negative. */
export function amountDue(amount: number, discount: number): number {
  return Math.max(amount - discount, 0);
}

export function outstanding(amount: number, discount: number, paid: number): number {
  return Math.max(amountDue(amount, discount) - paid, 0);
}

/** Status after a payment or discount change. A voided invoice stays void. */
export function invoiceStatus(amount: number, discount: number, paid: number, current?: InvoiceStatus): InvoiceStatus {
  if (current === 'void') return 'void';
  if (paid >= amountDue(amount, discount)) return 'paid';
  return paid > 0 ? 'partial' : 'unpaid';
}

/** Overdue is derived, not stored: still owing after the due date (school calendar date). */
export function isOverdue(status: InvoiceStatus, dueDate: Date, today: Date): boolean {
  return (status === 'unpaid' || status === 'partial') && dueDate.getTime() < today.getTime();
}

/** Why a payment of `amount` cannot be recorded, or null when it can. */
export function paymentProblem(status: InvoiceStatus, amount: number, owed: number): string | null {
  if (status === 'void') return 'This invoice has been voided';
  if (status === 'paid') return 'This invoice is already paid';
  if (!(amount > 0)) return 'The amount must be greater than zero';
  if (amount > owed) return `The amount is more than the ${owed} still owed`;
  return null;
}

/** INV-2026-00042 / RCPT-2026-00042 — the id keeps them unique, the year keeps them readable. */
export const documentNo = (prefix: 'INV' | 'RCPT', year: number, id: number) => `${prefix}-${year}-${String(id).padStart(5, '0')}`;
