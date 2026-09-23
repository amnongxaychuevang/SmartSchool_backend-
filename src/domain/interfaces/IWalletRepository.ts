export interface IWalletRepository {
  findByStudentId(studentId: number): Promise<any | null>;
  updateBalance(
    walletId: number,
    newBalance: number,
    transactionData: any,
    expectedBalanceBefore: number
  ): Promise<any>;
  getSpentSince(walletId: number, since: Date): Promise<number>;
}
