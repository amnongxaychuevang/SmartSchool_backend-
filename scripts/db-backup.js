// Daily database backup. Run: npm run db:backup (Windows Task Scheduler runs it nightly,
// see scripts/register-backup-task.ps1).
//
//   1. mysqldump → gzip → <BACKUP_DIR>/smart_school_YYYY-MM-DD_HHMM.sql.gz
//   2. checks the file is complete (gzip reads to the end, the dump says "Dump completed")
//   3. only then deletes old backups: keeps the newest of each of the last
//      7 days, 4 weeks and 12 months (BACKUP_KEEP_DAILY / _WEEKLY / _MONTHLY)
//   4. copies it to BACKUP_COPY_DIR as well, if set (e.g. a Google Drive or USB folder)
// Every run appends one line to <BACKUP_DIR>/backup.log. Exit code 1 on failure.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { pipeline } = require('node:stream/promises');
const { connection, findProgram, withOptionFile, run } = require('./lib/mysql');
const { planRetention } = require('./lib/retention');

const policy = {
  daily: Number(process.env.BACKUP_KEEP_DAILY || 7),
  weekly: Number(process.env.BACKUP_KEEP_WEEKLY || 4),
  monthly: Number(process.env.BACKUP_KEEP_MONTHLY || 12),
};

// File names use the school's clock (Asia/Vientiane), whatever the server's time zone.
function stamp(date = new Date()) {
  const local = new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString();
  return `${local.slice(0, 10)}_${local.slice(11, 13)}${local.slice(14, 16)}`;
}

function log(dir, line) {
  const text = `${new Date().toISOString()} ${line}`;
  console.log(text);
  try {
    fs.appendFileSync(path.join(dir, 'backup.log'), `${text}\n`);
  } catch {
    // The folder itself may be the problem; the console line still shows it.
  }
}

/** Reads the whole .gz (proves it is not truncated) and returns the dump's last bytes. */
async function readTail(file) {
  let tail = '';
  const gunzip = zlib.createGunzip();
  gunzip.on('data', (chunk) => { tail = (tail + chunk.toString('utf8')).slice(-500); });
  await pipeline(fs.createReadStream(file), gunzip);
  return tail;
}

function applyRetention(dir) {
  const { remove } = planRetention(fs.readdirSync(dir), policy);
  for (const name of remove) fs.rmSync(path.join(dir, name), { force: true });
  return remove.length;
}

/** Makes one verified backup in `dir`; returns its path. Used by db-restore.js too. */
async function backup(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const conn = connection();
  const file = path.join(dir, `smart_school_${stamp()}.sql.gz`);
  const tmp = `${file}.tmp`;

  try {
    await withOptionFile(conn, async (optionFile) => {
      const gzip = zlib.createGzip({ level: 9 });
      const written = pipeline(gzip, fs.createWriteStream(tmp));
      const { code, stderr } = await run(findProgram('mysqldump'), [
        `--defaults-extra-file=${optionFile}`,
        '--single-transaction', // consistent snapshot without locking the school out
        '--quick',
        '--routines', '--triggers', '--events',
        '--hex-blob',
        '--no-tablespaces',
        '--default-character-set=utf8mb4',
        '--set-gtid-purged=OFF',
        conn.database,
      ], { stdout: gzip });
      await written;
      if (code !== 0) throw new Error(`mysqldump exited with ${code}: ${stderr}`);
    });

    if (fs.statSync(tmp).size === 0) throw new Error('backup file is empty');
    if (!(await readTail(tmp)).includes('-- Dump completed')) throw new Error('backup file is incomplete');
    fs.renameSync(tmp, file);
    return file;
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw err;
  }
}

async function main() {
  const dir = process.env.BACKUP_DIR || path.join(__dirname, '../backups');

  try {
    const file = await backup(dir);
    const sizeKb = Math.round(fs.statSync(file).size / 1024);
    const removed = applyRetention(dir);
    let copied = '';
    const copyDir = process.env.BACKUP_COPY_DIR;
    if (copyDir) {
      fs.mkdirSync(copyDir, { recursive: true });
      fs.copyFileSync(file, path.join(copyDir, path.basename(file)));
      copied = `, copied to ${copyDir} (removed ${applyRetention(copyDir)} old there)`;
    }
    log(dir, `OK ${path.basename(file)} ${sizeKb} KB, removed ${removed} old${copied}`);
  } catch (err) {
    // Old backups are never touched when the new one failed.
    log(dir, `FAILED ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { backup, applyRetention, policy, stamp, readTail };
