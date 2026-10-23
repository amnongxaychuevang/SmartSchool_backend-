import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { getBackupDirectory } from '../../infrastructure/jobs/DatabaseBackupJob';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { backup, applyRetention } = require('../../../scripts/db-backup');

class BackupController {
  async listBackups(req: Request, res: Response, next: NextFunction) {
    try {
      const dir = getBackupDirectory();
      const files = fs.readdirSync(dir)
        .filter((f) => f.endsWith('.sql.gz') && !f.endsWith('.tmp'))
        .sort((a, b) => b.localeCompare(a)); // newest first

      let totalBytes = 0;
      const list = files.map((fileName) => {
        const fullPath = path.join(dir, fileName);
        const stat = fs.statSync(fullPath);
        totalBytes += stat.size;
        return {
          fileName,
          sizeBytes: stat.size,
          sizeKb: Math.round(stat.size / 1024),
          createdAt: stat.mtime.toISOString(),
        };
      });

      res.json({
        success: true,
        data: {
          backups: list,
          totalCount: list.length,
          totalSizeBytes: totalBytes,
          backupDir: dir,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async runBackup(req: Request, res: Response, next: NextFunction) {
    try {
      const dir = getBackupDirectory();
      const filePath = await backup(dir);
      const stat = fs.statSync(filePath);
      const removed = applyRetention(dir);

      res.status(201).json({
        success: true,
        data: {
          fileName: path.basename(filePath),
          sizeKb: Math.round(stat.size / 1024),
          createdAt: stat.mtime.toISOString(),
          removedOldCount: removed,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async downloadBackup(req: Request, res: Response, next: NextFunction) {
    try {
      const fileName = String(req.params.fileName || '');
      // Security: prevent path traversal
      if (!fileName || !/^smart_school_[\w-]+\.sql\.gz$/.test(fileName)) {
        return res.status(400).json({ success: false, message: 'Invalid backup file name' });
      }

      const dir = getBackupDirectory();
      const fullPath = path.join(dir, fileName);
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ success: false, message: 'Backup file not found' });
      }

      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/gzip');
      const stream = fs.createReadStream(fullPath);
      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  }
}

export default new BackupController();
