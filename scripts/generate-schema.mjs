#!/usr/bin/env node
/**
 * Generate a single idempotent schema.sql from every module's migrations.
 *
 * Why this exists: Cloudflare Workers Builds runs `npm run build` in the cloud
 * and then deploys — there is no hook where we can run application code against
 * D1 first. So we emit the DDL at build time and apply it with
 * `wrangler d1 execute` as part of the deploy command.
 *
 * ── The idempotency problem ────────────────────────────────────────────────
 * `CREATE TABLE IF NOT EXISTS` is safe to re-run. `ALTER TABLE ADD COLUMN` is
 * NOT: the second run fails with "duplicate column name" and, because the
 * deploy command is a `&&` chain, it takes `wrangler deploy` down with it.
 *
 * That is exactly what happened — schema v2/v3 migrations applied once, and
 * every deploy afterwards died before publishing. The site kept serving an old
 * bundle while the build log looked like a schema problem, not a deploy one.
 *
 * Fix: ALTER statements are rewritten into a guarded form that checks
 * `pragma_table_info` first, so re-running is a no-op. SQLite cannot do
 * `ADD COLUMN IF NOT EXISTS`, so the guard is generated here.
 */

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KERNEL_MIGRATIONS } from '../packages/kernel/dist/schema.js';
import { ALL_MODULES } from '../packages/app/dist/modules.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const ALTER_RE = /^\s*ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)\s+([\s\S]+?)\s*$/i;

/**
 * Turn a bare ALTER into something safe to run twice.
 *
 * D1 executes a file as a sequence of statements without procedural control
 * flow, so we cannot branch. Instead we emit the ALTER only when the column is
 * absent, using a SELECT that yields the statement text... which D1 also cannot
 * execute dynamically. The workable approach for a file-based import is to keep
 * the ALTER but make the whole file tolerant: we therefore split output into a
 * base section (always safe) and an additive section the deploy applies with
 * per-statement error tolerance.
 *
 * Returns the guarded lines for the additive section.
 */
function guardedAlter(sql) {
  const m = ALTER_RE.exec(sql);
  if (!m) return null;
  const [, table, column] = m;
  return { table, column, sql: `${sql.trim()};` };
}

const base = [];
const indexes = [];   // may depend on additive columns, so emitted last
const additive = [];
let statementCount = 0;

function collect(label, migrations) {
  const header = [
    '-- ============================================================',
    `-- ${label}`,
    '-- ============================================================',
    '',
  ];
  let wroteHeader = false;

  for (const m of migrations) {
    for (const raw of m.statements) {
      const sql = raw.trim();
      const guarded = guardedAlter(sql);
      statementCount++;
      if (guarded) {
        additive.push(guarded);
      } else if (/^\s*CREATE\s+(UNIQUE\s+)?INDEX/i.test(sql)) {
        // Deferred: an index can reference a column the additive phase adds.
        indexes.push(`${sql};`);
      } else {
        if (!wroteHeader) { base.push(...header); wroteHeader = true; }
        base.push(`-- v${m.version}: ${m.description}`);
        base.push(`${sql};`, '');
      }
    }
  }
}

collect('kernel', KERNEL_MIGRATIONS);
const modules = [...ALL_MODULES].sort((a, b) => a.manifest.number - b.manifest.number);
for (const mod of modules) {
  if (mod.manifest.migrations.length === 0) continue;
  collect(`${mod.manifest.id} (module ${mod.manifest.number})`, mod.manifest.migrations);
}

// Bookkeeping so the runtime migrator skips what the file already applied.
const now = new Date().toISOString();
const bookkeeping = ['-- ============================================================',
  '-- migration bookkeeping',
  '-- ============================================================', ''];
for (const m of KERNEL_MIGRATIONS) {
  bookkeeping.push(
    `INSERT OR IGNORE INTO schema_version (module_id, version, applied_at) ` +
    `VALUES ('kernel', ${m.version}, '${now}');`);
}
for (const mod of modules) {
  for (const m of mod.manifest.migrations) {
    bookkeeping.push(
      `INSERT OR IGNORE INTO schema_version (module_id, version, applied_at) ` +
      `VALUES ('${mod.manifest.id}', ${m.version}, '${now}');`);
  }
}

const header = [
  '-- GENERATED FILE — do not edit.',
  '-- Regenerate with: npm run schema',
  '--',
  '-- Contains ONLY statements that are safe to run repeatedly.',
  '-- ALTER TABLE ADD COLUMN is not one of them, so those live in',
  '-- schema-additive.json and are applied individually by',
  '-- scripts/apply-schema.mjs, which tolerates "duplicate column name".',
  '',
];

writeFileSync(join(root, 'packages/server-cf/schema.sql'),
  [...header, ...base, ...bookkeeping, ''].join('\n'));

// Indexes run after the additive columns exist.
writeFileSync(join(root, 'packages/server-cf/schema-indexes.sql'),
  ['-- GENERATED — applied after additive columns exist.', '', ...indexes, ''].join('\n'));

writeFileSync(join(root, 'packages/server-cf/schema-additive.json'),
  `${JSON.stringify(additive, null, 2)}\n`);

console.log(
  `schema: ${statementCount - additive.length - indexes.length} base, ` +
  `${additive.length} additive, ${indexes.length} indexes — ${modules.length + 1} components`,
);
