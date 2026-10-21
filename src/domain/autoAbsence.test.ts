import { describe, it, expect } from 'vitest';
import { isAutoAbsenceDue, readAutoAbsenceSettings, schoolWeekday } from './autoAbsence';

const on = { enabled: true, cutoffTime: '09:00', schoolDays: [1, 2, 3, 4, 5], notifyParents: true };

describe('autoAbsence', () => {
  it('uses the school calendar for the weekday, not UTC', () => {
    // Sunday 20:00 UTC is already Monday 03:00 in Vientiane.
    expect(schoolWeekday(new Date('2026-10-18T20:00:00Z'))).toBe(1);
  });

  it('is due from the cut-off on a school day', () => {
    // Wednesday 2026-10-21: 08:59 and 09:00 Vientiane time.
    expect(isAutoAbsenceDue(new Date('2026-10-21T01:59:00Z'), on)).toBe(false);
    expect(isAutoAbsenceDue(new Date('2026-10-21T02:00:00Z'), on)).toBe(true);
  });

  it('is never due on a non-school day or when switched off', () => {
    expect(isAutoAbsenceDue(new Date('2026-10-24T05:00:00Z'), on)).toBe(false); // Saturday
    expect(isAutoAbsenceDue(new Date('2026-10-21T05:00:00Z'), { ...on, enabled: false })).toBe(false);
  });

  it('reads a missing or partial setting as switched off with defaults', () => {
    expect(readAutoAbsenceSettings(undefined)).toEqual({ enabled: false, cutoffTime: '09:00', schoolDays: [1, 2, 3, 4, 5], notifyParents: true });
    expect(readAutoAbsenceSettings({ enabled: true, cutoffTime: 'soon', schoolDays: [1, 9] })).toMatchObject({
      enabled: true, cutoffTime: '09:00', schoolDays: [1],
    });
  });
});
