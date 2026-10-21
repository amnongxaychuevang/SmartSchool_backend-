import prisma from '../database/PrismaClient';
import { isAutoAbsenceDue, readAutoAbsenceSettings } from '../../domain/autoAbsence';
import MarkAutoAbsences from '../../application/use-cases/attendance/MarkAutoAbsences';
import { startDailyJob } from './dailyJob';

const markAutoAbsences = new MarkAutoAbsences();

/** Marks the day's missing students absent once the cut-off has passed (marking only fills gaps). */
export function startAutoAbsenceJob() {
  return startDailyJob(
    'AutoAbsence',
    async (now) => {
      const row = await prisma.schoolSetting.findUnique({ where: { key: 'autoAbsence' } });
      return isAutoAbsenceDue(now, readAutoAbsenceSettings(row?.value));
    },
    (now) => markAutoAbsences.execute(now),
  );
}
