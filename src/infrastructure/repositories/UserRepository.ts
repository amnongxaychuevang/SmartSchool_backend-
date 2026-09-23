import { IUserRepository } from '../../domain/interfaces/IUserRepository';
import User from '../../domain/entities/User';
import prisma from '../database/PrismaClient';

class UserRepository implements IUserRepository {
  /**
   * Maps a Prisma User model to our Domain User Entity
   * @param {Object} prismaUser 
   * @returns {User|null}
   */
  _toDomain(prismaUser) {
    if (!prismaUser) return null;
    const data = { ...prismaUser };
    if (prismaUser.role && prismaUser.role.code) {
      data.role = prismaUser.role.code;
    }
    return new User(data);
  }

  async findByPhoneNumber(phoneNumber) {
    const user = await prisma.user.findUnique({
      where: { phoneNumber },
      include: { role: true }
    });
    return this._toDomain(user);
  }

  async findByEmail(email) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true }
    });
    return this._toDomain(user);
  }

  async findById(userId) {
    const user = await prisma.user.findUnique({
      where: { userId },
      include: { role: true }
    });
    return this._toDomain(user);
  }

  async create(userData) {
    const user = await prisma.user.create({
      data: userData,
      include: { role: true }
    });
    return this._toDomain(user);
  }

  async update(userId, updates) {
    const user = await prisma.user.update({
      where: { userId },
      data: updates,
      include: { role: true }
    });
    return this._toDomain(user);
  }
}

export default UserRepository;
