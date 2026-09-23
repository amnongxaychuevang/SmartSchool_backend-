class ProcessTransaction { walletRepository: any; shopRepository: any; spendingLimitRepository: any; notificationService: any;
  constructor(walletRepository, shopRepository, spendingLimitRepository, notificationService) {
    this.walletRepository = walletRepository;
    this.shopRepository = shopRepository;
    this.spendingLimitRepository = spendingLimitRepository;
    this.notificationService = notificationService;
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
      throw new Error('Missing required fields for transaction');
    }

    const numericAmount = parseFloat(amount);
    if (!(numericAmount > 0)) {
      throw new Error('Amount must be a positive number');
    }

    const shop = await this.shopRepository.findById(shopId);
    if (!shop || shop.isActive === false) {
      throw new Error('Shop not found or inactive');
    }

    const wallet = await this.walletRepository.findByStudentId(studentId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    if (wallet.isFrozen()) {
      throw new Error('Wallet is frozen. Cannot process transaction.');
    }

    if (!wallet.canAfford(numericAmount)) {
      throw new Error('Insufficient balance');
    }

    await this.enforceSpendingLimits(studentId, wallet.walletId, shopId, numericAmount);

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
      descriptionEn: `Purchase at shop ID ${shopId}`,
      descriptionLo: `ຊຳລະເງິນທີ່ຮ້ານ ID ${shopId}`
    };

    // Optimistic-locked write: guards against another concurrent purchase on the
    // same wallet racing us between the read above and this write.
    await this.walletRepository.updateBalance(
      wallet.walletId,
      balanceAfter,
      transactionData,
      balanceBefore
    );

    // Notify Parent asynchronously
    this.notificationService.notifyParentTransaction(studentId, numericAmount, balanceAfter, shopId)
      .catch(err => console.error('Failed to notify parent transaction:', err));

    return {
      success: true,
      transactionId: transactionData.referenceNo,
      balanceBefore,
      balanceAfter,
      amount: numericAmount
    };
  }

  /**
   * Enforces the per-student SpendingLimit configuration (set by a parent) against
   * this purchase: blocked shops, per-transaction cap, and daily/weekly rolling caps.
   * Previously this was a no-op — the SpendingLimit table had zero effect on purchases.
   */
  async enforceSpendingLimits(studentId, walletId, shopId, amount) {
    const limits = await this.spendingLimitRepository.findByStudent(studentId);
    if (!limits) return; // No limits configured for this student

    if (Array.isArray(limits.blockedShops) && limits.blockedShops.includes(shopId)) {
      throw new Error('This shop is blocked for this student');
    }

    if (limits.perTransactionMax != null && amount > Number(limits.perTransactionMax)) {
      throw new Error('Amount exceeds the per-transaction spending limit');
    }

    if (limits.dailyMax != null) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const spentToday = await this.walletRepository.getSpentSince(walletId, startOfDay);
      if (spentToday + amount > Number(limits.dailyMax)) {
        throw new Error('This purchase would exceed the daily spending limit');
      }
    }

    if (limits.weeklyMax != null) {
      const startOfWeek = new Date();
      startOfWeek.setHours(0, 0, 0, 0);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      const spentThisWeek = await this.walletRepository.getSpentSince(walletId, startOfWeek);
      if (spentThisWeek + amount > Number(limits.weeklyMax)) {
        throw new Error('This purchase would exceed the weekly spending limit');
      }
    }
  }
}

export default ProcessTransaction;
