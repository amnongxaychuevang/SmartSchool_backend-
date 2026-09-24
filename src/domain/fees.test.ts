import { describe, it, expect } from 'vitest';
import { amountDue, outstanding, invoiceStatus, isOverdue, paymentProblem, documentNo } from './fees';

describe('fee rules', () => {
  it('subtracts the discount and never goes below zero', () => {
    expect(amountDue(1_500_000, 200_000)).toBe(1_300_000);
    expect(amountDue(100_000, 150_000)).toBe(0);
    expect(outstanding(1_500_000, 0, 600_000)).toBe(900_000);
  });

  it('derives unpaid, partial and paid from what has been paid', () => {
    expect(invoiceStatus(1_000_000, 0, 0)).toBe('unpaid');
    expect(invoiceStatus(1_000_000, 0, 400_000)).toBe('partial');
    expect(invoiceStatus(1_000_000, 0, 1_000_000)).toBe('paid');
    expect(invoiceStatus(1_000_000, 100_000, 900_000)).toBe('paid');
  });

  it('keeps a voided invoice void', () => {
    expect(invoiceStatus(1_000_000, 0, 0, 'void')).toBe('void');
  });

  it('marks only owing invoices past their due date as overdue', () => {
    const today = new Date('2026-09-24T00:00:00Z');
    expect(isOverdue('unpaid', new Date('2026-09-23T00:00:00Z'), today)).toBe(true);
    expect(isOverdue('partial', new Date('2026-09-23T00:00:00Z'), today)).toBe(true);
    expect(isOverdue('unpaid', new Date('2026-09-24T00:00:00Z'), today)).toBe(false);
    expect(isOverdue('paid', new Date('2026-01-01T00:00:00Z'), today)).toBe(false);
    expect(isOverdue('void', new Date('2026-01-01T00:00:00Z'), today)).toBe(false);
  });

  it('refuses payments on void or paid invoices, zero amounts and overpayment', () => {
    expect(paymentProblem('void', 1000, 5000)).toMatch(/voided/);
    expect(paymentProblem('paid', 1000, 0)).toMatch(/already paid/);
    expect(paymentProblem('unpaid', 0, 5000)).toMatch(/greater than zero/);
    expect(paymentProblem('partial', 6000, 5000)).toMatch(/more than/);
    expect(paymentProblem('partial', 5000, 5000)).toBeNull();
  });

  it('formats document numbers', () => {
    expect(documentNo('INV', 2026, 42)).toBe('INV-2026-00042');
    expect(documentNo('RCPT', 2026, 7)).toBe('RCPT-2026-00007');
  });
});
