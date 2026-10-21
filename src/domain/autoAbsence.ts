import { parseClockTime, schoolMinutesOfDay, schoolDateValue } from './schoolTime';

// School setting "autoAbsence": at the cut-off time on a school day, every enrolled
// student with no gate tap, no approved leave and no teacher mark is marked absent.
export interface AutoAbsenceSettings {
  enabled: boolean;
  cutoffTime: string; // "HH:MM", school (Vientiane) time
  schoolDays: number[]; // 0 = Sunday … 6 = Saturday
  notifyParents: boolean;
}

export const AUTO_ABSENCE_DEFAULTS: AutoAbsenceSettings = {
  enabled: false,
  cutoffTime: '09:00',
  schoolDays: [1, 2, 3, 4, 5],
  notifyParents: true,
};

/** Fills gaps in a stored setting with the defaults (older rows, partial saves). */
export function readAutoAbsenceSettings(value: unknown): AutoAbsenceSettings {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<AutoAbsenceSettings>;
  return {
    enabled: v.enabled === true,
    cutoffTime: typeof v.cutoffTime === 'string' && /^\d{2}:\d{2}$/.test(v.cutoffTime) ? v.cutoffTime : AUTO_ABSENCE_DEFAULTS.cutoffTime,
    schoolDays: Array.isArray(v.schoolDays) ? v.schoolDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : AUTO_ABSENCE_DEFAULTS.schoolDays,
    notifyParents: v.notifyParents !== false,
  };
}

/** Weekday (0 = Sunday) of `now` on the school's calendar. */
export function schoolWeekday(now: Date): number {
  return schoolDateValue(now).getUTCDay();
}

export function isSchoolDay(now: Date, settings: AutoAbsenceSettings): boolean {
  return settings.schoolDays.includes(schoolWeekday(now));
}

/** True once the cut-off has passed on a school day (the job then runs once that day). */
export function isAutoAbsenceDue(now: Date, settings: AutoAbsenceSettings): boolean {
  return settings.enabled && isSchoolDay(now, settings) && schoolMinutesOfDay(now) >= parseClockTime(settings.cutoffTime);
}
