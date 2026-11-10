// Backup of user files: uploads/ (photos, slips) and storage/ (private documents).
// The database dump does not contain them, so without this a lost disk loses every
// photo and document even when the database can be restored.
//
//   tar -czf <BACKUP_DIR>/files_YYYY-MM-DD_HHMM.tar.gz uploads storage
//
// Runs together with the nightly database backup (and `npm run db:backup`).
// Same retention as the dumps, counted separately (scripts/lib/retention.js).
// Set BACKUP_FILES=0 to switch it off.
const fs = require('node:fs');
const path = require('node:path');
const { run } = require('./lib/mysql');

const ROOT = path.join(__dirname, '..');
const FOLDERS = ['uploads', 'storage'];
// System tar: GNU tar in the Debian image, bsdtar in Windows 10+. On Windows use the
// System32 one by path: a GNU tar from Git Bash earlier on PATH reads "C:\..." as a
// remote host and fails.
const TAR = process.platform === 'win32'
  ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe')
  : 'tar';

function stamp(date = new Date()) {
  const local = new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString();
  return `${local.slice(0, 10)}_${local.slice(11, 13)}${local.slice(14, 16)}`;
}

function enabled() {
  return process.env.BACKUP_FILES !== '0';
}

/** Archives the file folders into `dir`; returns the archive path, or null if there is nothing to back up. */
async function backupFiles(dir) {
  const present = FOLDERS.filter((f) => fs.existsSync(path.join(ROOT, f)));
  if (!present.length) return null;

  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `files_${stamp()}.tar.gz`);
  const tmp = `${file}.tmp`;
  try {
    const { code, stderr } = await run(TAR, ['-czf', tmp, '-C', ROOT, ...present]);
    if (code !== 0) throw new Error(`tar exited with ${code}: ${stderr}`);
    if (fs.statSync(tmp).size === 0) throw new Error('file archive is empty');
    fs.renameSync(tmp, file);
    return file;
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw err;
  }
}

module.exports = { backupFiles, enabled, FOLDERS };
