import { describe, it, expect } from 'vitest';
import { gradeRank, byGradeOrder } from './gradeOrder';

const cls = (classNameLo: string, extra: Record<string, string | null> = {}) => ({ classNameLo, classNameEn: classNameLo, ...extra });

describe('gradeOrder', () => {
  it('ranks ປ.1–ປ.5 then ມ.1–ມ.7 from the class name, however it is written', () => {
    expect(gradeRank(cls('ປ.1/1'))).toBe(1);
    expect(gradeRank(cls('ປ5'))).toBe(5);
    expect(gradeRank(cls('ມ.1/2'))).toBe(6);
    expect(gradeRank(cls('ມ4/1'))).toBe(9);
    expect(gradeRank(cls('M.7/1'))).toBe(12);
    expect(gradeRank(cls('P3'))).toBe(3);
  });

  it('falls back to the grade level text', () => {
    expect(gradeRank(cls('ຫ້ອງ A', { gradeLevelLo: 'ປະຖົມ 2' }))).toBe(2);
    expect(gradeRank(cls('Room A', { gradeLevelLo: 'ມັດທະຍົມ 5' }))).toBe(10);
    expect(gradeRank(cls('Room A', { gradeLevelEn: 'Grade 11' }))).toBe(11);
    expect(gradeRank(cls('Room A'))).toBe(Infinity);
  });

  it('sorts ປ.1 → ມ.7, numbers as numbers, unknown last', () => {
    const names = ['ມ.7/1', 'ຫ້ອງພິເສດ', 'ມ.5/10', 'ປ.2/1', 'ມ.5/2', 'ມ4/1', 'ປ.1/1', 'ມ.1/1'];
    expect(names.map((n) => cls(n)).sort(byGradeOrder).map((c) => c.classNameLo))
      .toEqual(['ປ.1/1', 'ປ.2/1', 'ມ.1/1', 'ມ4/1', 'ມ.5/2', 'ມ.5/10', 'ມ.7/1', 'ຫ້ອງພິເສດ']);
  });
});
