import { startOfSchoolDay, startOfSchoolWeek } from '../../../domain/schoolTime';
import dispatcher from '../../../infrastructure/notifications/NotificationDispatcher';
import { crossedLowBalance, effectiveThreshold, readLowBalanceDefault } from '../../../domain/lowBalance';

// Business-rule failures carry a 4xx status so the cashier sees the reason;
// the error handler hides the message of anything that ends up as a 500.
const fail = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

class ProcessTransaction { walletRepository: any; shopRepository: any; spendingLimitRepository: any; settingsRepository: any;
  constructor(walletRepository, shopRepository, spendingLimitRepository, settingsRepository) {
    this.walletRepository = walletRepository;
    this.shopRepository = shopRepository;
    this.spendingLimitRepository = spendingLimitRepository;
    this.settingsRepository = settingsRepository;
  }

  /**
   * Execute a wallet transaction
   * @param {number} studentId
   * @param {number} amount
   * @param {number} shopId
   * @param {number} processedBy
   */
  async execute(studentId, amount, shopId, processedBy) {
    if (!studentId || !amount || !shopId) {
      throw fail('Missing required fields for transaction', 400);
    }

    const numericAmount = parseFloat(amount);
    if (!(numericAmount > 0)) {
      throw fail('Amount must be a positive number', 400);
    }

    const shop = await this.shopRepository.findById(shopId);
    if (!shop || shop.isActive === false) {
      throw fail('Shop not found or inactive', 404);
    }

    const wallet = await this.walletRepository.findByStudentId(studentId);
    if (!wallet) {
      throw fail('This student has no wallet yet', 404);
    }

    if (wallet.isFrozen()) {
      throw fail('Wallet is frozen. Cannot process transaction.', 422);
    }

    if (!wallet.canAfford(numericAmount)) {
      throw fail('Insufficient balance', 422);
    }

    const limits = await this.enforceSpendingLimits(studentId, wallet.walletId, shopId, numericAmount);

    const shopNameEn = shop.shopNameEn || shop.shopNameLo || `shop #${shopId}`;
    const shopNameLo = shop.shopNameLo || shop.shopNameEn || `ຮ້ານ #${shopId}`;
    const balanceBefore = wallet.balance;
    const balanceAfter = wallet.deductBalance(numericAmount);

    const transactionData = {
      transactionType: 'purchase',
      amount: numericAmount,
      shopId,
      balanceBefore,
      balanceAfter,
      processedBy,
      referenceNo: `TX-${Date.now()}-${studentId}-${Math.random().toString(36).slice(2, 8)}`,
      descriptionEn: `Purchase at ${shopNameEn}`,
      descriptionLo: `ຊຳລະເງິນທີ່ ${shopNameLo}`
    };

    // Optimistic-locked write: guards against another concurrent purchase on the
    // same wallet racing us between the read above and this write.
    await this.walletRepository.updateBalance(
      wallet.walletId,
      balanceAfter,
      transactionData,
      balanceBefore
    );

    // One message per purchase; a low-balance warning rides along on the purchase that crosses the threshold.
    // The money has moved already: a settings read that fails must not fail the sale.
    const schoolDefault = await this.settingsRepository.getAll()
      .then((s) => readLowBalanceDefault(s.lowBalanceAlert))
      .catch(() => null);
    const threshold = effectiveThreshold(limits?.alertThreshold, schoolDefault);
    const low = crossedLowBalance(Number(balanceBefore), Number(balanceAfter), threshold);
    const kip = (n: number) => n.toLocaleString('en-US');
    dispatcher.notifyParents(
      studentId,
      'transaction',
      `Purchase of ${kip(numericAmount)} LAK at ${shopNameEn}. Balance: ${kip(balanceAfter)} LAK.`
        + (low ? ` The balance is now below ${kip(threshold!)} LAK — please top up.` : ''),
      `ຊຳລະເງິນ ${kip(numericAmount)} ກີບ ທີ່ ${shopNameLo}. ຍອດເຫຼືອ: ${kip(balanceAfter)} ກີບ.`
        + (low ? ` ຍອດເງິນຕ່ຳກວ່າ ${kip(threshold!)} ກີບແລ້ວ — ກະລຸນາເຕີມເງິນ.` : ''),
    ).catch(err => console.error('Failed to notify parent transaction:', err));

    return {
      success: true,
      transactionId: transactionData.referenceNo,
      balanceBefore,
      balanceAfter,
      amount: numericAmount,
      lowBalance: low,
    };
  }

  /**
   * Enforces the per-student SpendingLimit configuration (set by a parent) against
   * this purchase: blocked shops, per-transaction cap, and daily/weekly rolling caps.
   * Previously this was a no-op — the SpendingLimit table had zero effect on purchases.
   * Returns the limits (or null) so the caller can read the low-balance threshold.
   */
  async enforceSpendingLimits(studentId, walletId, shopId, amount) {
    const limits = await this.spendingLimitRepository.findByStudent(studentId);
    if (!limits) return null; // No limits configured for this student

    if (Array.isArray(limits.blockedShops) && limits.blockedShops.includes(shopId)) {
      throw fail('This shop is blocked for this student', 422);
    }

    if (limits.perTransactionMax != null && amount > Number(limits.perTransactionMax)) {
      throw fail('Amount exceeds the per-transaction spending limit', 422);
    }

    if (limits.dailyMax != null) {
      const spentToday = await this.walletRepository.getSpentSince(walletId, startOfSchoolDay());
      if (spentToday + amount > Number(limits.dailyMax)) {
        throw fail('This purchase would exceed the daily spending limit', 422);
      }
    }

    if (limits.weeklyMax != null) {
      const spentThisWeek = await this.walletRepository.getSpentSince(walletId, startOfSchoolWeek());
      if (spentThisWeek + amount > Number(limits.weeklyMax)) {
        throw fail('This purchase would exceed the weekly spending limit', 422);
      }
    }

    return limits;
  }
}

export default ProcessTransaction;
