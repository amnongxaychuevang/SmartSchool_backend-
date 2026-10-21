import prisma from '../database/PrismaClient';
import { schoolDateString } from '../../domain/schoolTime';
import { isAutoAbsenceDue, readAutoAbsenceSettings } from '../../domain/autoAbsence';
import MarkAutoAbsences from '../../application/use-cases/attendance/MarkAutoAbsences';

const CHECK_EVERY_MS = 60 * 1000;
const markAutoAbsences = new MarkAutoAbsences();

/**
 * Checks once a minute whether today's absence cut-off has passed and, if so,
 * runs the auto-absence marking once for the day. After a restart it may run
 * again the same day, which is harmless: the marking only fills gaps.
 */
export function startAutoAbsenceJob() {
  let lastRunDate: string | null = null;
  let running = false;

  const tick = async () => {
    if (running) return;
    const now = new Date();
    const today = schoolDateString(now);
    if (lastRunDate === today) return;

    running = true;
    try {
      const row = await prisma.schoolSetting.findUnique({ where: { key: 'autoAbsence' } });
      if (!isAutoAbsenceDue(now, readAutoAbsenceSettings(row?.value))) return;
      const result = await markAutoAbsences.execute(now);
      lastRunDate = today;
      console.log('[AutoAbsence]', JSON.stringify(result));
    } catch (err) {
      console.error('[AutoAbsence] run failed:', (err as Error).message);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, CHECK_EVERY_MS);
  timer.unref();
  return timer;
}
