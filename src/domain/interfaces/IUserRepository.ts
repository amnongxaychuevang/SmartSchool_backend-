import User from '../entities/User';

export interface IUserRepository {
  findByPhoneNumber(phoneNumber: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findById(userId: number): Promise<User | null>;
  create(userData: any): Promise<User>;
  update(userId: number, updates: any): Promise<User>;
}
