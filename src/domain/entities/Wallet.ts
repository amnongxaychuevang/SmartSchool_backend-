class Wallet {
  walletId: number;
  studentId: number;
  balance: number;
  status: string;
  currencyCode: string;
  createdAt: Date;
  updatedAt: Date;


  constructor({
    walletId,
    studentId,
    balance = 0.00,
    status = 'active',
    currencyCode = 'LAK',
    createdAt,
    updatedAt,
  }) {
    this.walletId = walletId;
    this.studentId = studentId;
    this.balance = Number(balance);
    this.status = status;
    this.currencyCode = currencyCode;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  isFrozen(): boolean {
    return this.status === 'frozen';
  }

  canAfford(amount: any): boolean {
    return this.balance >= parseFloat(amount);
  }

  deductBalance(amount: any): number {
    const val = parseFloat(amount);
    if (!this.canAfford(val)) {
      throw new Error('Insufficient balance');
    }
    if (this.isFrozen()) {
      throw new Error('Wallet is frozen');
    }
    this.balance -= val;
    return this.balance;
  }

  addBalance(amount: any): number {
    const val = parseFloat(amount);
    if (this.isFrozen()) {
      throw new Error('Wallet is frozen');
    }
    this.balance += val;
    return this.balance;
  }
}

export default Wallet;
