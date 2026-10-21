import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { normalizeLaoPhone } from '../../../domain/phone';

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 3;

const fail = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

export interface ResetCodeSender {
  /** Whether codes can go out on this channel at all (it is set up in the settings). */
  isAvailable(channel: 'whatsapp' | 'email'): Promise<boolean>;
  whatsApp(phone: string, text: string): Promise<{ success: boolean; error?: string }>;
  email(to: string, subject: string, text: string): Promise<{ success: boolean; error?: string }>;
}

/**
 * "Forgot password": a 6-digit code goes to the phone (WhatsApp) or email the
 * person signs in with, and that code lets them choose a new password.
 *
 * request() answers the same way whether or not the account exists, so the form
 * can't be used to find out who has an account: the only error it gives (channel
 * not set up) depends on the school's settings, never on the account. Per-account
 * limits and delivery failures are logged, not reported.
 */
class PasswordResetUseCase {
  userRepository: any;
  resetRepository: any;
  refreshTokenRepository: any;
  sender: ResetCodeSender;

  constructor(userRepository, resetRepository, refreshTokenRepository, sender: ResetCodeSender) {
    this.userRepository = userRepository;
    this.resetRepository = resetRepository;
    this.refreshTokenRepository = refreshTokenRepository;
    this.sender = sender;
  }

  private async findUser(identifier: string) {
    const value = identifier.trim();
    if (value.includes('@')) return this.userRepository.findByEmail(value);
    const phone = normalizeLaoPhone(value);
    return phone ? this.userRepository.findByPhoneNumber(phone) : null;
  }

  async request(identifier: string) {
    const byEmail = identifier.includes('@');
    if (!(await this.sender.isAvailable(byEmail ? 'email' : 'whatsapp'))) {
      throw fail('The code could not be sent. Please ask the school office to reset your password.', 503);
    }

    const user = await this.findUser(identifier);
    if (!user || !user.passwordHash || !user.isActiveUser()) return;

    const recent = await this.resetRepository.countSince(user.userId, new Date(Date.now() - 60 * 60 * 1000));
    if (recent >= MAX_CODES_PER_HOUR) {
      console.warn(`[PasswordReset] hourly code limit reached for user ${user.userId}`);
      return;
    }

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.resetRepository.create(user.userId, await bcrypt.hash(code, 10), new Date(Date.now() + CODE_TTL_MS));

    const text = user.langPref === 'en'
      ? `Smart School: your password reset code is ${code}. It expires in 10 minutes. If you did not ask for it, ignore this message.`
      : `Smart School: ລະຫັດຢືນຢັນເພື່ອຕັ້ງລະຫັດຜ່ານໃໝ່ແມ່ນ ${code}. ໃຊ້ໄດ້ 10 ນາທີ. ຖ້າທ່ານບໍ່ໄດ້ຂໍ, ບໍ່ຕ້ອງສົນໃຈຂໍ້ຄວາມນີ້.`;
    const result = byEmail
      ? await this.sender.email(user.email, 'Smart School password reset', text)
      : await this.sender.whatsApp(user.phoneNumber, text);
    if (!result.success) {
      console.error(`[PasswordReset] code not delivered to user ${user.userId}:`, result.error);
    }
  }

  async confirm(identifier: string, code: string, newPassword: string) {
    const user = await this.findUser(identifier);
    const record = user ? await this.resetRepository.findActive(user.userId) : null;
    if (!user || !record || record.attempts >= MAX_ATTEMPTS) throw fail('The code is wrong or has expired', 400);

    if (!(await bcrypt.compare(code, record.codeHash))) {
      await this.resetRepository.addAttempt(record.id);
      throw fail('The code is wrong or has expired', 400);
    }

    await this.resetRepository.markUsed(record.id);
    await this.userRepository.update(user.userId, { passwordHash: await bcrypt.hash(newPassword, 10) });
    // Whoever knew the old password is signed out everywhere.
    await this.refreshTokenRepository.revokeAllForUser(user.userId);
    return { userId: user.userId };
  }
}

export default PasswordResetUseCase;
