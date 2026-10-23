import path from 'path';
import fs from 'fs';
import { startDailyJob } from './dailyJob';
import { schoolMinutesOfDay } from '../../domain/schoolTime';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { backup, applyRetention } = require('../../../scripts/db-backup');

export function getBackupDirectory(): string {
  const dir = process.env.BACKUP_DIR || path.join(__dirname, '../../../backups');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/** Nightly automated database backup job (runs at 02:00 AM Lao local time). */
export function startDatabaseBackupJob() {
  return startDailyJob(
    'DatabaseBackup',
    async (now) => {
      // 02:00 AM or later (120 minutes from midnight)
      return schoolMinutesOfDay(now) >= 120;
    },
    async () => {
      const dir = getBackupDirectory();
      const file = await backup(dir);
      const removed = applyRetention(dir);
      const sizeKb = Math.round(fs.statSync(file).size / 1024);
      return { file: path.basename(file), sizeKb, removedOldCount: removed };
    },
  );
}
