#!/usr/bin/env node
/**
 * Apply the D1 schema during deployment.
 *
 * Two phases:
 *   1. schema.sql          — fully idempotent, applied as one file
 *   2. schema-additive.json — ALTER TABLE ADD COLUMN, applied one at a time
 *
 * Phase 2 exists because SQLite has no `ADD COLUMN IF NOT EXISTS`. Re-running a
 * bare ALTER fails with "duplicate column name", and since the deploy command
 * is a `&&` chain that failure previously took `wrangler deploy` with it — the
 * schema step succeeded once and then silently blocked every later deploy, so
 * the site kept serving a stale bundle.
 *
 * Here each ALTER is applied individually and a duplicate-column error is
 * treated as success, because it means the column is already there. Anything
 * else still fails the deploy, loudly.
 */

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = join(here, '../packages/server-cf');
const DB = process.env.D1_DATABASE ?? 'solawi-os';
const remote = process.argv.includes('--local') ? '--local' : '--remote';

function wrangler(args) {
  return execFileSync('npx', ['wrangler', ...args], {
    cwd: serverDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
}

// ---------------------------------------------------------------- phase 1
console.log(`→ applying schema.sql (${remote})`);
try {
  wrangler(['d1', 'execute', DB, remote, '--file=./schema.sql', '--yes']);
  console.log('  ✓ base schema applied');
} catch (err) {
  console.error('  ✗ base schema failed');
  console.error(err.stdout?.toString() ?? '', err.stderr?.toString() ?? '');
  process.exit(1);
}

// ---------------------------------------------------------------- phase 2
const additivePath = join(serverDir, 'schema-additive.json');
if (!existsSync(additivePath)) {
  console.log('→ no additive statements');
  process.exit(0);
}

const additive = JSON.parse(readFileSync(additivePath, 'utf8'));
if (additive.length === 0) {
  console.log('→ no additive statements');
  process.exit(0);
}

console.log(`→ applying ${additive.length} additive column(s)`);
let added = 0, present = 0;

for (const { table, column, sql } of additive) {
  try {
    wrangler(['d1', 'execute', DB, remote, `--command=${sql}`, '--yes']);
    console.log(`  + ${table}.${column}`);
    added++;
  } catch (err) {
    const out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
    // The column already exists — the desired end state, so not an error.
    if (/duplicate column name/i.test(out)) {
      console.log(`  = ${table}.${column} (already present)`);
      present++;
    } else {
      console.error(`  ✗ ${table}.${column}`);
      console.error(out);
      process.exit(1);
    }
  }
}

console.log(`  ✓ ${added} added, ${present} already present`);

// ---------------------------------------------------------------- phase 3
// Indexes last: some reference columns the additive phase just created.
const indexPath = join(serverDir, 'schema-indexes.sql');
if (existsSync(indexPath)) {
  console.log('→ applying indexes');
  try {
    wrangler(['d1', 'execute', DB, remote, '--file=./schema-indexes.sql', '--yes']);
    console.log('  ✓ indexes applied');
  } catch (err) {
    console.error('  ✗ indexes failed');
    console.error(err.stdout?.toString() ?? '', err.stderr?.toString() ?? '');
    process.exit(1);
  }
}
