// Which backups to keep: the newest backup of each of the last N days, weeks and
// months ("grandfather-father-son"). Everything else may be deleted. Pure: no I/O.

const NAME = /^smart_school_(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})\.sql\.gz$/;

/** "smart_school_2026-10-21_2300.sql.gz" → { name, day: "2026-10-21", stamp: "2026-10-21 23:00" }, or null. */
function parseBackupName(name) {
  const m = NAME.exec(name);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  return { name, day: `${y}-${mo}-${d}`, month: `${y}-${mo}`, week: weekOf(`${y}-${mo}-${d}`), stamp: `${y}-${mo}-${d} ${h}:${mi}` };
}

/** Monday of the week containing a "YYYY-MM-DD" day, as "YYYY-MM-DD". */
function weekOf(day) {
  const date = new Date(`${day}T00:00:00Z`);
  const sinceMonday = (date.getUTCDay() + 6) % 7;
  return new Date(date.getTime() - sinceMonday * 86400000).toISOString().slice(0, 10);
}

/**
 * @param {string[]} names file names in the backup folder (others are ignored)
 * @param {{ daily: number, weekly: number, monthly: number }} policy
 * @returns {{ keep: string[], remove: string[] }}
 */
function planRetention(names, policy) {
  const backups = names.map(parseBackupName).filter(Boolean).sort((a, b) => b.stamp.localeCompare(a.stamp));
  const keep = new Set();

  for (const [field, count] of [['day', policy.daily], ['week', policy.weekly], ['month', policy.monthly]]) {
    const seen = new Set();
    for (const b of backups) {
      if (seen.has(b[field])) continue; // an older backup of a period already represented
      if (seen.size >= count) break;
      seen.add(b[field]);
      keep.add(b.name);
    }
  }

  return {
    keep: backups.filter((b) => keep.has(b.name)).map((b) => b.name),
    remove: backups.filter((b) => !keep.has(b.name)).map((b) => b.name),
  };
}

module.exports = { parseBackupName, planRetention, weekOf };
