import nodemailer from 'nodemailer';
import prisma from '../database/PrismaClient';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

async function getEmailConfig(): Promise<EmailConfig | null> {
  const row = await prisma.schoolSetting.findUnique({ where: { key: 'email' } });
  if (!row) return null;

  const value = row.value as any;
  if (!value?.host || !value?.user || !value?.pass || !value?.from) return null;

  return {
    host: String(value.host),
    port: Number(value.port || 587),
    secure: Boolean(value.secure ?? false),
    user: String(value.user),
    pass: String(value.pass),
    from: String(value.from),
  };
}

class EmailService {
  async isConfigured(): Promise<boolean> {
    return (await getEmailConfig()) !== null;
  }

  async sendMail({
    to,
    subject,
    text,
    html,
  }: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const config = await getEmailConfig();
    if (!config) {
      console.warn('[Email] Not configured — message skipped:', subject);
      return { success: false, error: 'Email not configured' };
    }

    try {
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.pass,
        },
      });

      const info = await transporter.sendMail({
        from: config.from,
        to,
        subject,
        text,
        html: html || text,
      });

      console.log(`[Email] Sent to ${to}, messageId: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      console.error('[Email] Send error:', error.message);
      return { success: false, error: error.message };
    }
  }
}

export default new EmailService();
