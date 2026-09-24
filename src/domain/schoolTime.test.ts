import { describe, it, expect } from 'vitest';
import {
  startOfSchoolDay, startOfSchoolWeek, schoolDateString, schoolMinutesOfDay, academicYearForDate,
} from './schoolTime';

describe('schoolTime (Asia/Vientiane, UTC+7)', () => {
  it('a 06:30 Vientiane tap (23:30 UTC the day before) belongs to the local day', () => {
    const tap = new Date('2026-09-23T23:30:00Z'); // 2026-09-24 06:30 in Vientiane
    expect(schoolDateString(tap)).toBe('2026-09-24');
    expect(startOfSchoolDay(tap).toISOString()).toBe('2026-09-23T17:00:00.000Z');
  });

  it('reports wall-clock minutes for late checks', () => {
    expect(schoolMinutesOfDay(new Date('2026-09-24T00:30:00Z'))).toBe(7 * 60 + 30); // 07:30 local
  });

  it('weeks start on Sunday local time', () => {
    // Thursday 2026-09-24 10:00 local → Sunday 2026-09-20 00:00 local = 09-19 17:00Z
    expect(startOfSchoolWeek(new Date('2026-09-24T03:00:00Z')).toISOString()).toBe('2026-09-19T17:00:00.000Z');
  });

  it('switches academic year on 1 September local time', () => {
    expect(academicYearForDate(new Date('2026-08-31T16:59:00Z'))).toBe('2025-2026'); // 08-31 23:59 local
    expect(academicYearForDate(new Date('2026-08-31T17:00:00Z'))).toBe('2026-2027'); // 09-01 00:00 local
  });
});
