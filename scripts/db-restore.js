// Restores a backup made by db-backup.js.
//
//   npm run db:restore -- <file.sql.gz>
//       Restores into a separate database, smart_school_restore_check, and prints row
//       counts — a safe way to test that a backup really works. The live data is untouched.
//
//   npm run db:restore -- <file.sql.gz> --into smart_school --yes
//       Replaces the live database. A fresh backup of the current data is made first,
//       so this step can itself be undone. Stop the backend while doing this.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { connection, findProgram, withOptionFile, run, query } = require('./lib/mysql');
const { backup } = require('./db-backup');

const KEY_TABLES = ['students', 'users', 'wallet_accounts', 'wallet_transactions', 'grades', 'daily_attendance', 'invoices'];

function parseArgs(argv) {
  const args = { file: null, into: null, yes: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--into') args.into = argv[++i];
    else if (argv[i] === '--yes') args.yes = true;
    else if (!args.file) args.file = argv[i];
  }
  return args;
}

async function main() {
  const conn = connection();
  const { file, into: intoArg, yes } = parseArgs(process.argv.slice(2));
  const into = intoArg ?? `${conn.database}_restore_check`;

  if (!file || !fs.existsSync(file)) {
    console.error('Usage: npm run db:restore -- <backup.sql.gz> [--into <database> --yes]');
    process.exit(1);
  }
  if (!/^[A-Za-z0-9_]+$/.test(into)) throw new Error(`Invalid database name: ${into}`);

  const live = into === conn.database;
  if (live && !yes) {
    console.error(`This replaces ALL data in "${into}". Add --yes to confirm (a backup of the current data is made first).`);
    process.exit(1);
  }
  if (live) {
    if (!process.env.BACKUP_DIR) throw new Error('BACKUP_DIR must be set so the current data can be backed up first');
    console.log(`Backed up the current data first: ${await backup(process.env.BACKUP_DIR)}`);
  }

  console.log(`Restoring ${path.basename(file)} into "${into}"...`);
  await query(conn, `DROP DATABASE IF EXISTS \`${into}\`; CREATE DATABASE \`${into}\` CHARACTER SET utf8mb4;`);

  await withOptionFile(conn, async (optionFile) => {
    const { code, stderr } = await run(
      findProgram('mysql'),
      [`--defaults-extra-file=${optionFile}`, '--default-character-set=utf8mb4', into],
      { stdin: fs.createReadStream(file).pipe(zlib.createGunzip()) },
    );
    if (code !== 0) throw new Error(`mysql exited with ${code}: ${stderr}`);
  });

  const counts = await query(conn, KEY_TABLES.map((t) => `SELECT '${t}', COUNT(*) FROM \`${t}\``).join(' UNION ALL '), into);
  console.log(`Done. Rows in "${into}":`);
  for (const line of counts.split('\n')) console.log(`  ${line.replace('\t', ': ')}`);
  if (!live) console.log(`\nThis is a copy for checking. Remove it when finished: DROP DATABASE \`${into}\`;`);
}

main().catch((err) => {
  console.error(`Restore FAILED: ${err.message}`);
  process.exit(1);
});
