import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProcessTransaction from './ProcessTransaction';
import Wallet from '../../../domain/entities/Wallet';

// These tests exist because this exact flow shipped broken in production:
// the use-case called repository methods that didn't exist on the concrete
// WalletRepository (findByStudentId/updateBalance), so every purchase threw
// a TypeError, and spending limits were silently never enforced. Both bugs
// were fixed at the same time these tests were added — they're here so a
// future refactor can't reintroduce either one unnoticed.

function makeWallet(overrides: Partial<ConstructorParameters<typeof Wallet>[0]> = {}) {
  return new Wallet({
    walletId: 1,
    studentId: 10,
    balance: 100,
    status: 'active',
    ...overrides,
  } as any);
}

function makeRepos() {
  return {
    walletRepository: {
      findByStudentId: vi.fn(),
      updateBalance: vi.fn().mockResolvedValue({}),
      getSpentSince: vi.fn().mockResolvedValue(0),
    },
    shopRepository: {
      findById: vi.fn().mockResolvedValue({ shopId: 5, isActive: true }),
    },
    spendingLimitRepository: {
      findByStudent: vi.fn().mockResolvedValue(null),
    },
    notificationService: {
      notifyParentTransaction: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe('ProcessTransaction', () => {
  let repos: ReturnType<typeof makeRepos>;
  let useCase: ProcessTransaction;

  beforeEach(() => {
    repos = makeRepos();
    useCase = new ProcessTransaction(
      repos.walletRepository,
      repos.shopRepository,
      repos.spendingLimitRepository,
      repos.notificationService
    );
  });

  it('deducts the balance and records the transaction on a valid purchase', async () => {
    repos.walletRepository.findByStudentId.mockResolvedValue(makeWallet({ balance: 100 }));

    const result = await useCase.execute(10, 30, 5, 99);

    expect(result.success).toBe(true);
    expect(result.balanceBefore).toBe(100);
    expect(result.balanceAfter).toBe(70);
    // This is the exact call shape WalletRepository.updateBalance expects —
    // a mismatch here is precisely the bug that made this endpoint 100% broken.
    expect(repos.walletRepository.updateBalance).toHaveBeenCalledWith(
      1, // walletId
      70, // balanceAfter
      expect.objectContaining({ transactionType: 'purchase', amount: 30, shopId: 5 }),
      100 // expectedBalanceBefore, for the optimistic-lock guard
    );
  });

  it('rejects a purchase larger than the wallet balance', async () => {
    repos.walletRepository.findByStudentId.mockResolvedValue(makeWallet({ balance: 10 }));

    await expect(useCase.execute(10, 50, 5, 99)).rejects.toThrow('Insufficient balance');
    expect(repos.walletRepository.updateBalance).not.toHaveBeenCalled();
  });

  it('rejects a purchase on a frozen wallet', async () => {
    repos.walletRepository.findByStudentId.mockResolvedValue(makeWallet({ balance: 100, status: 'frozen' }));

    await expect(useCase.execute(10, 30, 5, 99)).rejects.toThrow('frozen');
  });

  it('rejects a zero or negative amount', async () => {
    repos.walletRepository.findByStudentId.mockResolvedValue(makeWallet());

    await expect(useCase.execute(10, 0, 5, 99)).rejects.toThrow('Missing required fields');
    await expect(useCase.execute(10, -5, 5, 99)).rejects.toThrow('positive number');
  });

  it('rejects a purchase at an inactive shop', async () => {
    repos.walletRepository.findByStudentId.mockResolvedValue(makeWallet());
    repos.shopRepository.findById.mockResolvedValue({ shopId: 5, isActive: false });

    await expect(useCase.execute(10, 30, 5, 99)).rejects.toThrow('Shop not found or inactive');
  });

  it('enforces the per-transaction spending limit set by a parent', async () => {
    repos.walletRepository.findByStudentId.mockResolvedValue(makeWallet({ balance: 100 }));
    repos.spendingLimitRepository.findByStudent.mockResolvedValue({ perTransactionMax: 20 });

    await expect(useCase.execute(10, 30, 5, 99)).rejects.toThrow('per-transaction spending limit');
  });

  it('enforces the daily spending limit, counting purchases already made today', async () => {
    repos.walletRepository.findByStudentId.mockResolvedValue(makeWallet({ balance: 100 }));
    repos.spendingLimitRepository.findByStudent.mockResolvedValue({ dailyMax: 50 });
    repos.walletRepository.getSpentSince.mockResolvedValue(40); // already spent today

    await expect(useCase.execute(10, 20, 5, 99)).rejects.toThrow('daily spending limit');
  });

  it('blocks a purchase at a shop on the blocked-shops list', async () => {
    repos.walletRepository.findByStudentId.mockResolvedValue(makeWallet());
    repos.spendingLimitRepository.findByStudent.mockResolvedValue({ blockedShops: [5] });

    await expect(useCase.execute(10, 30, 5, 99)).rejects.toThrow('blocked for this student');
  });

  it('allows a purchase within all configured limits', async () => {
    repos.walletRepository.findByStudentId.mockResolvedValue(makeWallet({ balance: 100 }));
    repos.spendingLimitRepository.findByStudent.mockResolvedValue({
      dailyMax: 50,
      weeklyMax: 200,
      perTransactionMax: 40,
      blockedShops: [999],
    });
    repos.walletRepository.getSpentSince.mockResolvedValue(0);

    const result = await useCase.execute(10, 30, 5, 99);
    expect(result.success).toBe(true);
  });
});
