import { describe, it, expect } from 'vitest';
import {
  computeSummerFee,
  getSummerPaymentStatus,
  formatSummerStudentCode,
  formatSummerReceiptNo,
  parseSummerMonths,
} from './summer';

describe('Summer Extra Classes Domain Rules', () => {
  it('correctly calculates subtotal and total for multiple subjects across months', () => {
    const courses = [
      { monthlyFee: 250_000 }, // Math
      { monthlyFee: 200_000 }, // English
    ];

    // 1 month
    const res1 = computeSummerFee(courses, 1);
    expect(res1.subtotal).toBe(450_000);
    expect(res1.totalAmount).toBe(450_000);

    // 3 months
    const res3 = computeSummerFee(courses, 3);
    expect(res3.subtotal).toBe(1_350_000);
    expect(res3.totalAmount).toBe(1_350_000);

    // With discount
    const withDisc = computeSummerFee(courses, 3, 150_000);
    expect(withDisc.subtotal).toBe(1_350_000);
    expect(withDisc.discount).toBe(150_000);
    expect(withDisc.totalAmount).toBe(1_200_000);
  });

  it('handles negative or oversized discount gracefully without negative totals', () => {
    const courses = [{ monthlyFee: 100_000 }];
    const res = computeSummerFee(courses, 1, 500_000);
    expect(res.discount).toBe(100_000);
    expect(res.totalAmount).toBe(0);

    const negativeDisc = computeSummerFee(courses, 1, -50_000);
    expect(negativeDisc.discount).toBe(0);
    expect(negativeDisc.totalAmount).toBe(100_000);
  });

  it('determines payment status accurately', () => {
    expect(getSummerPaymentStatus(500_000, 0)).toBe('unpaid');
    expect(getSummerPaymentStatus(500_000, 200_000)).toBe('partial');
    expect(getSummerPaymentStatus(500_000, 500_000)).toBe('paid');
    expect(getSummerPaymentStatus(500_000, 600_000)).toBe('paid');
  });

  it('formats student codes and receipt numbers consistently', () => {
    expect(formatSummerStudentCode('26', 1)).toBe('SM-26001');
    expect(formatSummerStudentCode('26', 42)).toBe('SM-26042');
    expect(formatSummerStudentCode('26', 999)).toBe('SM-26999');

    expect(formatSummerReceiptNo(2026, 1)).toBe('SMR-2026-0001');
    expect(formatSummerReceiptNo(2026, 125)).toBe('SMR-2026-0125');
  });

  it('parses JSON stringified month arrays safely', () => {
    expect(parseSummerMonths('[1,2,3]')).toEqual([1, 2, 3]);
    expect(parseSummerMonths('[2]')).toEqual([2]);
    expect(parseSummerMonths('')).toEqual([]);
    expect(parseSummerMonths('invalid')).toEqual([]);
    expect(parseSummerMonths(null)).toEqual([]);
  });
});
