import fs from 'fs';
import path from 'path';

/**
 * The backend folder (the one holding package.json), whether this code runs from
 * src/ under ts-node or from dist/src/ after `tsc`. Data folders (uploads, storage,
 * backups) live here, so they must not be resolved with a fixed number of "..":
 * that lands in dist/ in production, where existing files are missing and new
 * ones would be lost on the next clean build.
 */
export const BACKEND_ROOT = ((): string => {
  let dir = __dirname;
  for (;;) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return process.cwd();
    dir = up;
  }
})();
