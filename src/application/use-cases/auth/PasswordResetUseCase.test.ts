import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import PasswordResetUseCase from './PasswordResetUseCase';
import User from '../../../domain/entities/User';

function makeUser(overrides: Record<string, unknown> = {}) {
  return new User({
    userId: 7, fullNameEn: 'Parent', fullNameLo: 'ຜູ້ປົກຄອງ', role: 'parent',
    phoneNumber: '+856 20 5550 0105', email: 'p@school.test', passwordHash: 'old-hash',
    langPref: 'lo', isActive: true,
    ...overrides,
  } as any);
}

function makeDeps() {
  return {
    userRepository: {
      findByEmail: vi.fn(),
      findByPhoneNumber: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    resetRepository: {
      create: vi.fn().mockResolvedValue({}),
      findActive: vi.fn(),
      countSince: vi.fn().mockResolvedValue(0),
      addAttempt: vi.fn().mockResolvedValue({}),
      markUsed: vi.fn().mockResolvedValue({}),
    },
    refreshTokenRepository: { revokeAllForUser: vi.fn().mockResolvedValue(undefined) },
    sender: {
      isAvailable: vi.fn().mockResolvedValue(true),
      whatsApp: vi.fn().mockResolvedValue({ success: true }),
      email: vi.fn().mockResolvedValue({ success: true }),
    },
  };
}

describe('PasswordResetUseCase.request', () => {
  let deps: ReturnType<typeof makeDeps>;
  let useCase: PasswordResetUseCase;

  beforeEach(() => {
    deps = makeDeps();
    useCase = new PasswordResetUseCase(deps.userRepository, deps.resetRepository, deps.refreshTokenRepository, deps.sender);
  });

  it('sends a 6-digit code by WhatsApp to a phone login, however the number is typed', async () => {
    deps.userRepository.findByPhoneNumber.mockResolvedValue(makeUser());
    await useCase.request('020 5550 0105');

    expect(deps.userRepository.findByPhoneNumber).toHaveBeenCalledWith('+856 20 5550 0105');
    const [phone, text] = deps.sender.whatsApp.mock.calls[0];
    expect(phone).toBe('+856 20 5550 0105');
    const code = text.match(/\d{6}/)[0];
    // Only the hash is stored, and it matches the code that was sent.
    const storedHash = deps.resetRepository.create.mock.calls[0][1];
    expect(storedHash).not.toContain(code);
    expect(await bcrypt.compare(code, storedHash)).toBe(true);
  });

  it('sends the code by email to an email login', async () => {
    deps.userRepository.findByEmail.mockResolvedValue(makeUser());
    await useCase.request('p@school.test');
    expect(deps.sender.email).toHaveBeenCalledWith('p@school.test', expect.any(String), expect.stringMatching(/\d{6}/));
    expect(deps.sender.whatsApp).not.toHaveBeenCalled();
  });

  it('answers the same, sending nothing, for an unknown or inactive account', async () => {
    deps.userRepository.findByPhoneNumber.mockResolvedValue(null);
    await expect(useCase.request('02099999999')).resolves.toBeUndefined();
    deps.userRepository.findByEmail.mockResolvedValue(makeUser({ isActive: false }));
    await expect(useCase.request('p@school.test')).resolves.toBeUndefined();
    expect(deps.resetRepository.create).not.toHaveBeenCalled();
    expect(deps.sender.whatsApp).not.toHaveBeenCalled();
    expect(deps.sender.email).not.toHaveBeenCalled();
  });

  it('sends no fourth code within an hour, without telling (an error would reveal the account)', async () => {
    deps.userRepository.findByPhoneNumber.mockResolvedValue(makeUser());
    deps.resetRepository.countSince.mockResolvedValue(3);
    await expect(useCase.request('02055500105')).resolves.toBeUndefined();
    expect(deps.resetRepository.create).not.toHaveBeenCalled();
    expect(deps.sender.whatsApp).not.toHaveBeenCalled();
  });

  it('answers the same when one delivery fails', async () => {
    deps.userRepository.findByPhoneNumber.mockResolvedValue(makeUser());
    deps.sender.whatsApp.mockResolvedValue({ success: false, error: 'network' });
    await expect(useCase.request('02055500105')).resolves.toBeUndefined();
  });

  it('fails for everyone, before any lookup, when the channel is not set up', async () => {
    deps.sender.isAvailable.mockResolvedValue(false);
    await expect(useCase.request('02055500105')).rejects.toMatchObject({ statusCode: 503 });
    await expect(useCase.request('02099999999')).rejects.toMatchObject({ statusCode: 503 });
    expect(deps.userRepository.findByPhoneNumber).not.toHaveBeenCalled();
  });
});

describe('PasswordResetUseCase.confirm', () => {
  let deps: ReturnType<typeof makeDeps>;
  let useCase: PasswordResetUseCase;

  beforeEach(async () => {
    deps = makeDeps();
    useCase = new PasswordResetUseCase(deps.userRepository, deps.resetRepository, deps.refreshTokenRepository, deps.sender);
    deps.userRepository.findByPhoneNumber.mockResolvedValue(makeUser());
    deps.resetRepository.findActive.mockResolvedValue({ id: 3, attempts: 0, codeHash: await bcrypt.hash('123456', 4) });
  });

  it('sets the new password, uses up the code and signs out every session', async () => {
    await useCase.confirm('02055500105', '123456', 'new-secret');

    expect(deps.resetRepository.markUsed).toHaveBeenCalledWith(3);
    const { passwordHash } = deps.userRepository.update.mock.calls[0][1];
    expect(await bcrypt.compare('new-secret', passwordHash)).toBe(true);
    expect(deps.refreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith(7);
  });

  it('counts a wrong code as an attempt and changes nothing', async () => {
    await expect(useCase.confirm('02055500105', '000000', 'new-secret')).rejects.toMatchObject({ statusCode: 400 });
    expect(deps.resetRepository.addAttempt).toHaveBeenCalledWith(3);
    expect(deps.userRepository.update).not.toHaveBeenCalled();
  });

  it('rejects even the right code after too many wrong attempts', async () => {
    deps.resetRepository.findActive.mockResolvedValue({ id: 3, attempts: 5, codeHash: await bcrypt.hash('123456', 4) });
    await expect(useCase.confirm('02055500105', '123456', 'new-secret')).rejects.toMatchObject({ statusCode: 400 });
    expect(deps.userRepository.update).not.toHaveBeenCalled();
  });

  it('rejects when there is no live code', async () => {
    deps.resetRepository.findActive.mockResolvedValue(null);
    await expect(useCase.confirm('02055500105', '123456', 'new-secret')).rejects.toMatchObject({ statusCode: 400 });
  });
});
