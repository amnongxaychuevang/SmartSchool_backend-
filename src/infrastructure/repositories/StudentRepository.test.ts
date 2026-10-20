import { describe, it, expect } from 'vitest';
import { nextStudentCode } from './StudentRepository';

const txWith = (codes: string[]) => ({
  student: {
    findMany: async ({ where }: { where: { studentCode: { startsWith: string } } }) => {
      expect(where.studentCode.startsWith).toBe('STU-2026-');
      return codes.map((studentCode) => ({ studentCode }));
    },
  },
});

const jan2026 = new Date(2026, 0, 15);

describe('nextStudentCode', () => {
  it('starts at 0001 when the year has no students yet', async () => {
    expect(await nextStudentCode(txWith([]), jan2026)).toBe('STU-2026-0001');
  });

  it('continues after the highest existing code', async () => {
    expect(await nextStudentCode(txWith(['STU-2026-0007', 'STU-2026-0041', 'STU-2026-0012']), jan2026)).toBe('STU-2026-0042');
  });

  it('compares numerically, not as text', async () => {
    expect(await nextStudentCode(txWith(['STU-2026-9999', 'STU-2026-10000']), jan2026)).toBe('STU-2026-10001');
  });

  it('respects older 3-digit hand-typed codes', async () => {
    expect(await nextStudentCode(txWith(['STU-2026-001', 'STU-2026-050']), jan2026)).toBe('STU-2026-0051');
  });
});
