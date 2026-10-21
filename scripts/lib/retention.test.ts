import { describe, it, expect } from 'vitest';
import { planRetention, parseBackupName, weekOf } from './retention';

const name = (day: string, time = '2300') => `smart_school_${day}_${time}.sql.gz`;
// One backup a night from start to end (inclusive).
function nightly(start: string, end: string) {
  const names: string[] = [];
  for (let d = new Date(`${start}T00:00:00Z`); d <= new Date(`${end}T00:00:00Z`); d = new Date(d.getTime() + 86400000)) {
    names.push(name(d.toISOString().slice(0, 10)));
  }
  return names;
}
const policy = { daily: 7, weekly: 4, monthly: 12 };

describe('backup retention', () => {
  it('reads only its own file names', () => {
    expect(parseBackupName('smart_school_2026-10-21_2300.sql.gz')).toMatchObject({ day: '2026-10-21', month: '2026-10' });
    expect(parseBackupName('backup.log')).toBeNull();
    expect(parseBackupName('smart_school_2026-10-21_2300.sql.gz.tmp')).toBeNull();
  });

  it('weeks start on Monday', () => {
    expect(weekOf('2026-10-21')).toBe('2026-10-19'); // Wednesday
    expect(weekOf('2026-10-25')).toBe('2026-10-19'); // Sunday
    expect(weekOf('2026-10-26')).toBe('2026-10-26'); // Monday
  });

  it('keeps everything while there are fewer backups than the policy', () => {
    const names = nightly('2026-10-18', '2026-10-21');
    expect(planRetention(names, policy)).toEqual({ keep: [...names].reverse(), remove: [] });
  });

  it('after a year of nightly backups keeps 7 days, 4 weeks and 12 months', () => {
    const names = nightly('2025-10-01', '2026-10-21');
    const { keep, remove } = planRetention(names, policy);

    // The last 7 nights.
    for (const day of ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21']) {
      expect(keep).toContain(name(day));
    }
    // The last night of each earlier week (Sundays) and month.
    expect(keep).toContain(name('2026-10-11'));
    expect(keep).toContain(name('2026-10-04'));
    expect(keep).toContain(name('2026-09-30'));
    expect(keep).toContain(name('2025-11-30'));
    // Older than 12 months, and ordinary nights inside the kept periods, go.
    expect(remove).toContain(name('2025-10-31'));
    expect(remove).toContain(name('2026-10-14'));
    expect(keep.length).toBeLessThanOrEqual(7 + 4 + 12);
    expect(keep.length + remove.length).toBe(names.length);
  });

  it('keeps the newest backup of a day when it ran twice', () => {
    const { keep, remove } = planRetention([name('2026-10-21', '0900'), name('2026-10-21', '2300')], policy);
    expect(keep).toEqual([name('2026-10-21', '2300')]);
    expect(remove).toEqual([name('2026-10-21', '0900')]);
  });
});
