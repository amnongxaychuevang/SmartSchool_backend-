import prisma from '../database/PrismaClient';
import { isFeeReminderDue, readFeeReminderSettings } from '../../domain/feeReminders';
import SendFeeReminders from '../../application/use-cases/fees/SendFeeReminders';
import { startDailyJob } from './dailyJob';

const sendFeeReminders = new SendFeeReminders();

/** Sends the day's fee reminders once the send time has passed (each invoice remembers what it got). */
export function startFeeReminderJob() {
  return startDailyJob(
    'FeeReminders',
    async (now) => {
      const row = await prisma.schoolSetting.findUnique({ where: { key: 'feeReminders' } });
      return isFeeReminderDue(now, readFeeReminderSettings(row?.value));
    },
    (now) => sendFeeReminders.execute(now),
  );
}
