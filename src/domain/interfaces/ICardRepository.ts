export interface ICardRepository {
  findByUid(uid: string): Promise<{cardId: number, studentId: number, status: string} | null>;
}
