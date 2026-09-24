// Writes database/schema.sql from prisma/schema.prisma (reference snapshot only;
// the database itself is managed with `prisma db push`). Run: npm run db:sql
const { execSync } = require('node:child_process');
const { writeFileSync } = require('node:fs');

const sql = execSync('npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script', {
  encoding: 'utf8',
});
writeFileSync(
  'database/schema.sql',
  `-- GENERATED from prisma/schema.prisma — do not edit by hand.\n-- Regenerate with: npm run db:sql\n\n${sql}`,
);
console.log('database/schema.sql updated');
