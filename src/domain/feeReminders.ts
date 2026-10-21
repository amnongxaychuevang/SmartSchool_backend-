// Automatic reminders for unpaid school fees (setting "feeReminders"):
//   - once, `daysBefore` days ahead of the due date (or on the day itself);
//   - once the invoice is overdue, then again every `repeatEveryDays` days,
//     at most `maxOverdue` times, so parents are reminded but not pestered.
// Paid and voided invoices never get one. What was sent is stored on the invoice.

import { parseClockTime, schoolDateValue, schoolMinutesOfDay } from './schoolTime';

export interface FeeReminderSettings {
  enabled: boolean;
  daysBefore: number; // 0 = no reminder before the due date
  repeatEveryDays: number;
  maxOverdue: number; // 0 = no overdue reminders
  sendTime: string; // "HH:MM", school time
}

export const FEE_REMINDER_DEFAULTS: FeeReminderSettings = {
  enabled: false,
  daysBefore: 3,
  repeatEveryDays: 7,
  maxOverdue: 3,
  sendTime: '08:00',
};

const int = (v: unknown, min: number, max: number, fallback: number) =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : fallback;

export function readFeeReminderSettings(value: unknown): FeeReminderSettings {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<FeeReminderSettings>;
  return {
    enabled: v.enabled === true,
    daysBefore: int(v.daysBefore, 0, 60, FEE_REMINDER_DEFAULTS.daysBefore),
    repeatEveryDays: int(v.repeatEveryDays, 1, 60, FEE_REMINDER_DEFAULTS.repeatEveryDays),
    maxOverdue: int(v.maxOverdue, 0, 12, FEE_REMINDER_DEFAULTS.maxOverdue),
    sendTime: typeof v.sendTime === 'string' && /^\d{2}:\d{2}$/.test(v.sendTime) ? v.sendTime : FEE_REMINDER_DEFAULTS.sendTime,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Whole days from `a` to `b`; both are school-calendar dates stored as UTC midnight. */
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY_MS);

export interface InvoiceReminderState {
  status: string;
  dueDate: Date;
  reminderBeforeAt: Date | null;
  overdueReminders: number;
  lastReminderAt: Date | null;
}

/** Which reminder (if any) this invoice should get on `today` (a school date at UTC midnight). */
export function feeReminderKind(inv: InvoiceReminderState, today: Date, s: FeeReminderSettings): 'before' | 'overdue' | null {
  if (inv.status !== 'unpaid' && inv.status !== 'partial') return null;
  const daysToDue = daysBetween(today, inv.dueDate);

  if (daysToDue >= 0) {
    return s.daysBefore > 0 && daysToDue <= s.daysBefore && !inv.reminderBeforeAt ? 'before' : null;
  }

  if (inv.overdueReminders >= s.maxOverdue) return null;
  if (inv.overdueReminders === 0 || !inv.lastReminderAt) return 'overdue';
  const sinceLast = daysBetween(schoolDateValue(inv.lastReminderAt), today);
  return sinceLast >= s.repeatEveryDays ? 'overdue' : null;
}

/** True once today's send time has passed (the job then runs once that day). */
export function isFeeReminderDue(now: Date, s: FeeReminderSettings): boolean {
  return s.enabled && schoolMinutesOfDay(now) >= parseClockTime(s.sendTime);
}
