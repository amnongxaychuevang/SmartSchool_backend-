import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../database/PrismaClient', () => ({
  default: {
    class: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    teacher: { findUnique: vi.fn() },
  },
}));

import prisma from '../database/PrismaClient';
import classRepository from './ClassRepository';
import { classCreateSchema, classUpdateSchema } from '../../interfaces/validators/schemas';

const db = prisma as unknown as {
  class: Record<'findUnique' | 'findFirst' | 'create' | 'update' | 'delete', ReturnType<typeof vi.fn>>;
  teacher: { findUnique: ReturnType<typeof vi.fn> };
};
const counts = (n: Partial<Record<'classStudents' | 'classSubjects' | 'announcements' | 'feeStructures', number>>) =>
  ({ _count: { classStudents: 0, classSubjects: 0, announcements: 0, feeStructures: 0, ...n } });
const newClass = { classNameEn: 'M5/1', classNameLo: 'ມ.5/1', academicYear: '2026-2027' };

beforeEach(() => vi.clearAllMocks());

describe('ClassRepository.delete', () => {
  it('refuses a class that is already in use (it would cascade to its data)', async () => {
    db.class.findUnique.mockResolvedValue(counts({ classStudents: 9 }));
    await expect(classRepository.delete(33)).rejects.toMatchObject({ statusCode: 409 });
    expect(db.class.delete).not.toHaveBeenCalled();
  });

  it('deletes a class that was never used', async () => {
    db.class.findUnique.mockResolvedValue(counts({}));
    await classRepository.delete(40);
    expect(db.class.delete).toHaveBeenCalledWith({ where: { classId: 40 } });
  });
});

describe('ClassRepository.create', () => {
  it('rejects a homeroom teacher who is not an active teacher', async () => {
    db.teacher.findUnique.mockResolvedValue(null);
    await expect(classRepository.create({ ...newClass, homeroomTeacherId: 5 })).rejects.toMatchObject({ statusCode: 400 });
    expect(db.class.create).not.toHaveBeenCalled();
  });

  it('rejects a second class with the same name in the same year', async () => {
    db.class.findFirst.mockResolvedValue({ classId: 33 });
    await expect(classRepository.create(newClass)).rejects.toMatchObject({ statusCode: 409 });
    expect(db.class.create).not.toHaveBeenCalled();
  });

  it('creates the class when the teacher and name are fine', async () => {
    db.teacher.findUnique.mockResolvedValue({ user: { isActive: true } });
    db.class.findFirst.mockResolvedValue(null);
    await classRepository.create({ ...newClass, homeroomTeacherId: 145 });
    expect(db.class.create.mock.calls[0][0].data).toMatchObject({ ...newClass, homeroomTeacherId: 145, isActive: true });
  });
});

describe('class schemas', () => {
  it('only accepts "YYYY-YYYY" with consecutive years', () => {
    expect(classCreateSchema.safeParse(newClass).success).toBe(true);
    expect(classCreateSchema.safeParse({ ...newClass, academicYear: '2026' }).success).toBe(false);
    expect(classCreateSchema.safeParse({ ...newClass, academicYear: '2026-2028' }).success).toBe(false);
  });

  it('lets the homeroom teacher be removed', () => {
    expect(classUpdateSchema.parse({ homeroomTeacherId: null }).homeroomTeacherId).toBeNull();
    expect(classUpdateSchema.parse({ homeroomTeacherId: '' }).homeroomTeacherId).toBeNull();
    expect(classUpdateSchema.parse({ homeroomTeacherId: '145' }).homeroomTeacherId).toBe(145);
  });
});
