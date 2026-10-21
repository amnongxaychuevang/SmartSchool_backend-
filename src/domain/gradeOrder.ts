// Lao school order: ປ.1–ປ.5 (primary), then ມ.1–ມ.7 (secondary) — one rank per year,
// so ປ.1 = 1 … ປ.5 = 5, ມ.1 = 6 … ມ.7 = 12 (the same as "Grade 1" … "Grade 12").
// Class names and grade levels are typed freely, so several spellings are read.

const PRIMARY_YEARS = 5;

const RULES: { pattern: RegExp; rank: (n: number) => number }[] = [
  // Class names: "ປ.1/2", "ປ1", "P.3/1", "ມ.5/1", "M4/1"
  { pattern: /^\s*(?:ປ|P)\s*\.?\s*(\d{1,2})(?!\d)/i, rank: (n) => n },
  { pattern: /^\s*(?:ມ|M)\s*\.?\s*(\d{1,2})(?!\d)/i, rank: (n) => PRIMARY_YEARS + n },
  // Grade levels: "ປະຖົມ 3", "Primary 3", "ມັດທະຍົມ 5", "Secondary 5", "Mattayom 5", "Grade 10"
  { pattern: /(?:ປະຖົມ|primary)\s*(?:ປີ(?:ທີ)?)?\s*(\d{1,2})/i, rank: (n) => n },
  { pattern: /(?:ມັດທະຍົມ|ມັດທະຍົມສຶກສາ|secondary|mattayom)\s*(?:ປີ(?:ທີ)?)?\s*(\d{1,2})/i, rank: (n) => PRIMARY_YEARS + n },
  { pattern: /grade\s*(\d{1,2})/i, rank: (n) => n },
];

/** 1–12 for ປ.1–ມ.7, or Infinity when nothing says which year it is (those go last). */
export function gradeRank(cls: { classNameLo?: string | null; classNameEn?: string | null; gradeLevelLo?: string | null; gradeLevelEn?: string | null }): number {
  for (const text of [cls.classNameLo, cls.classNameEn, cls.gradeLevelLo, cls.gradeLevelEn]) {
    if (!text) continue;
    for (const { pattern, rank } of RULES) {
      const m = pattern.exec(text);
      if (m) return rank(Number(m[1]));
    }
  }
  return Infinity;
}

const natural = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** Sort comparator: by school year (ປ.1 → ມ.7), then by name ("ມ.5/2" before "ມ.5/10"). */
export function byGradeOrder(
  a: { classNameLo?: string | null; classNameEn: string; gradeLevelLo?: string | null; gradeLevelEn?: string | null },
  b: { classNameLo?: string | null; classNameEn: string; gradeLevelLo?: string | null; gradeLevelEn?: string | null },
): number {
  const ra = gradeRank(a);
  const rb = gradeRank(b);
  if (ra !== rb) return ra === Infinity ? 1 : rb === Infinity ? -1 : ra - rb;
  return natural.compare(a.classNameLo || a.classNameEn, b.classNameLo || b.classNameEn);
}
