import path from 'path';
import fs from 'fs';
import { startDailyJob } from './dailyJob';
import { schoolMinutesOfDay } from '../../domain/schoolTime';
import { BACKEND_ROOT } from '../backendRoot';

// Plain-JS CLI script that tsc doesn't copy into dist/: load it from backend/scripts
// so the same file is used under ts-node and in a production build.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { backup, applyRetention } = require(path.join(BACKEND_ROOT, 'scripts', 'db-backup'));

export function getBackupDirectory(): string {
  const dir = process.env.BACKUP_DIR || path.join(BACKEND_ROOT, 'backups');
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
