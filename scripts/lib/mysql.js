// Shared helpers for the backup/restore scripts: the connection from DATABASE_URL,
// the MySQL client programs, and a temporary option file for the password (so it
// never appears on a command line, where other processes could read it).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

function connection() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set (backend/.env)');
  const url = new URL(process.env.DATABASE_URL);
  return {
    host: url.hostname,
    port: url.port || '3306',
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
  };
}

/** mysqldump / mysql: from MYSQL_BIN_DIR, else PATH, else the usual Windows install folders. */
function findProgram(name) {
  const exe = process.platform === 'win32' ? `${name}.exe` : name;
  const dirs = [
    process.env.MYSQL_BIN_DIR,
    ...(process.env.PATH || '').split(path.delimiter),
  ];
  if (process.platform === 'win32') {
    for (const base of ['C:\\Program Files\\MySQL', 'C:\\Program Files (x86)\\MySQL']) {
      if (!fs.existsSync(base)) continue;
      for (const server of fs.readdirSync(base).filter((d) => /^MySQL Server/i.test(d)).sort().reverse()) {
        dirs.push(path.join(base, server, 'bin'));
      }
    }
    dirs.push('C:\\xampp\\mysql\\bin');
  }
  for (const dir of dirs.filter(Boolean)) {
    const candidate = path.join(dir, exe);
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`${name} not found. Install the MySQL client tools or set MYSQL_BIN_DIR in backend/.env`);
}

/** Runs fn(optionFilePath) with a private [client] option file that holds the login. */
async function withOptionFile(conn, fn) {
  const file = path.join(os.tmpdir(), `smart-school-${crypto.randomBytes(8).toString('hex')}.cnf`);
  const quote = (v) => `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  fs.writeFileSync(file, `[client]\nhost=${quote(conn.host)}\nport=${conn.port}\nuser=${quote(conn.user)}\npassword=${quote(conn.password)}\n`, { mode: 0o600 });
  try {
    return await fn(file);
  } finally {
    fs.rmSync(file, { force: true });
  }
}

/** Spawns a program; resolves with its exit code and stderr text. */
function run(program, args, { stdin, stdout } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { stdio: [stdin ? 'pipe' : 'ignore', stdout ? 'pipe' : 'ignore', 'pipe'], windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    if (stdin) stdin.pipe(child.stdin);
    if (stdout) child.stdout.pipe(stdout);
    child.on('close', (code) => resolve({ code, stderr: stderr.trim() }));
  });
}

/** Runs one SQL statement with the mysql client and returns its tab-separated output. */
async function query(conn, sql, database) {
  return withOptionFile(conn, async (optionFile) => {
    const { PassThrough } = require('node:stream');
    const out = new PassThrough();
    let text = '';
    out.on('data', (d) => { text += d; });
    const args = [`--defaults-extra-file=${optionFile}`, '--batch', '--skip-column-names', '-e', sql];
    if (database) args.push(database);
    const { code, stderr } = await run(findProgram('mysql'), args, { stdout: out });
    if (code !== 0) throw new Error(`mysql failed: ${stderr}`);
    return text.trim();
  });
}

module.exports = { connection, findProgram, withOptionFile, run, query };
