import { describe, it, expect } from 'vitest';
import { feeReminderKind, readFeeReminderSettings, FEE_REMINDER_DEFAULTS } from './feeReminders';

const s = { ...FEE_REMINDER_DEFAULTS, enabled: true }; // 3 days before, every 7 days, max 3
const day = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);
const inv = (over: Partial<Parameters<typeof feeReminderKind>[0]> = {}) => ({
  status: 'unpaid', dueDate: day('2026-10-25'), reminderBeforeAt: null, overdueReminders: 0, lastReminderAt: null, ...over,
});

describe('feeReminderKind', () => {
  it('reminds once, from 3 days before the due date', () => {
    expect(feeReminderKind(inv(), day('2026-10-21'), s)).toBeNull(); // 4 days ahead
    expect(feeReminderKind(inv(), day('2026-10-22'), s)).toBe('before');
    expect(feeReminderKind(inv(), day('2026-10-25'), s)).toBe('before'); // due today
    expect(feeReminderKind(inv({ reminderBeforeAt: day('2026-10-22') }), day('2026-10-24'), s)).toBeNull();
  });

  it('reminds when overdue, then every 7 days, at most 3 times', () => {
    expect(feeReminderKind(inv(), day('2026-10-26'), s)).toBe('overdue');
    const sent = (n: number, last: string) => inv({ overdueReminders: n, lastReminderAt: new Date(`${last}T01:00:00.000Z`) });
    expect(feeReminderKind(sent(1, '2026-10-26'), day('2026-11-01'), s)).toBeNull(); // 6 days later
    expect(feeReminderKind(sent(1, '2026-10-26'), day('2026-11-02'), s)).toBe('overdue'); // 7 days later
    expect(feeReminderKind(sent(3, '2026-11-09'), day('2026-12-30'), s)).toBeNull(); // limit reached
  });

  it('uses the school date of the last reminder (Vientiane, not UTC)', () => {
    // 2026-10-26 20:00 UTC is already 27 October in Vientiane, so 7 days later is 3 November.
    const sentLate = inv({ overdueReminders: 1, lastReminderAt: new Date('2026-10-26T20:00:00.000Z') });
    expect(feeReminderKind(sentLate, day('2026-11-02'), s)).toBeNull();
    expect(feeReminderKind(sentLate, day('2026-11-03'), s)).toBe('overdue');
  });

  it('never reminds about paid or voided invoices', () => {
    expect(feeReminderKind(inv({ status: 'paid' }), day('2026-10-26'), s)).toBeNull();
    expect(feeReminderKind(inv({ status: 'void' }), day('2026-10-23'), s)).toBeNull();
    expect(feeReminderKind(inv({ status: 'partial' }), day('2026-10-26'), s)).toBe('overdue');
  });

  it('reads a missing setting as switched off with defaults', () => {
    expect(readFeeReminderSettings(undefined)).toEqual(FEE_REMINDER_DEFAULTS);
    expect(readFeeReminderSettings({ enabled: true, daysBefore: -1, maxOverdue: 99 })).toMatchObject({ enabled: true, daysBefore: 3, maxOverdue: 3 });
  });
});
