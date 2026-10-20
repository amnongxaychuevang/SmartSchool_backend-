import { describe, it, expect, vi } from 'vitest';
import CreateParentUseCase from './CreateParentUseCase';
import UpdateParentUseCase from './UpdateParentUseCase';
import { parentCreateSchema, parentUpdateSchema } from '../../../interfaces/validators/schemas';

const makeRepo = () => ({
  create: vi.fn().mockResolvedValue({ parentId: 1 }),
  update: vi.fn().mockResolvedValue({ parentId: 1 }),
});

describe('CreateParentUseCase', () => {
  it('creates the parent without a login (no password, never a default one)', async () => {
    const repo = makeRepo();
    await new CreateParentUseCase(repo).execute({ fullNameEn: 'A', fullNameLo: 'ກ', phoneNumber: '+856 20 5555 1234', password: 'secret123' });

    const [userData] = repo.create.mock.calls[0];
    expect(userData.passwordHash).toBeNull();
    expect(userData.phoneNumber).toBe('+856 20 5555 1234');
  });

  it('passes the address fields to the repository', async () => {
    const repo = makeRepo();
    await new CreateParentUseCase(repo).execute({
      fullNameEn: 'A', fullNameLo: 'ກ', phoneNumber: '+856 20 5555 1234',
      provinceId: 1, districtId: 101, village: 'ບ້ານ ໂພນໄຊ', address: 'ເຮືອນເລກທີ 12',
    });

    const [, parentData] = repo.create.mock.calls[0];
    expect(parentData).toMatchObject({ provinceId: 1, districtId: 101, village: 'ບ້ານ ໂພນໄຊ', address: 'ເຮືອນເລກທີ 12' });
  });
});

describe('UpdateParentUseCase', () => {
  it('never touches the password', async () => {
    const repo = makeRepo();
    await new UpdateParentUseCase(repo).execute(1, { fullNameEn: 'B', password: 'secret123' });

    const [, userData] = repo.update.mock.calls[0];
    expect(userData).toEqual({ fullNameEn: 'B' });
  });
});

describe('parent schemas', () => {
  const base = { fullNameEn: 'A', fullNameLo: 'ກ', phoneNumber: '020 5555 1234' };

  it('does not take a password or an email', () => {
    const parsed = parentCreateSchema.parse({ ...base, password: 'secret123', email: 'a@b.la' });
    expect('password' in parsed).toBe(false);
    expect('email' in parsed).toBe(false);
  });

  it('requires a phone number and never clears it', () => {
    expect(parentCreateSchema.safeParse({ fullNameEn: 'A', fullNameLo: 'ກ' }).success).toBe(false);
    expect(parentCreateSchema.safeParse({ ...base, phoneNumber: '' }).success).toBe(false);
    expect(parentUpdateSchema.safeParse({ phoneNumber: '' }).success).toBe(false);
    expect(parentUpdateSchema.safeParse({ fullNameEn: 'B' }).success).toBe(true);
    expect(parentUpdateSchema.parse({ phoneNumber: '02055551234' }).phoneNumber).toBe('+856 20 5555 1234');
  });

  it('stores the emergency contact in the standard phone format', () => {
    const parsed = parentCreateSchema.parse({ ...base, emergencyContact: '+8562029934353' });
    expect(parsed.emergencyContact).toBe('+856 20 2993 4353');
    expect(parentCreateSchema.safeParse({ ...base, emergencyContact: '12345' }).success).toBe(false);
  });
});
