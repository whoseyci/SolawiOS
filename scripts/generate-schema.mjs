#!/usr/bin/env node
/**
 * Generate a single idempotent schema.sql from every module's migrations.
 *
 * Why this exists: Cloudflare Workers Builds runs `npm run build` in the cloud
 * and then deploys — there is no hook where we can run application code against
 * D1 first. So we emit the DDL at build time and apply it with
 * `wrangler d1 execute` as part of the deploy command.
 *
 * Every statement is CREATE TABLE/INDEX IF NOT EXISTS, so applying it to an
 * existing database is a no-op. Schema *changes* still need a new migration
 * version in the owning module — this file is generated, never hand-edited.
 */

import { writeFileSync } from 'node:fs';
import { KERNEL_MIGRATIONS } from '../packages/kernel/dist/schema.js';
import { ALL_MODULES } from '../packages/app/dist/modules.js';

const parts = [
  '-- GENERATED FILE — do not edit.',
  '-- Regenerate with: npm run schema',
  '--',
  '-- Idempotent: safe to run against a fresh or an existing database.',
  '-- Schema changes belong in a module migration, not here.',
  '',
];

let statementCount = 0;

parts.push('-- ============================================================');
parts.push('-- kernel');
parts.push('-- ============================================================', '');
for (const m of KERNEL_MIGRATIONS) {
  parts.push(`-- v${m.version}: ${m.description}`);
  for (const sql of m.statements) {
    parts.push(`${sql.trim()};`, '');
    statementCount++;
  }
}

const modules = [...ALL_MODULES].sort((a, b) => a.manifest.number - b.manifest.number);
for (const mod of modules) {
  if (mod.manifest.migrations.length === 0) continue;
  parts.push('-- ============================================================');
  parts.push(`-- ${mod.manifest.id} (module ${mod.manifest.number})`);
  parts.push('-- ============================================================', '');
  for (const m of mod.manifest.migrations) {
    parts.push(`-- v${m.version}: ${m.description}`);
    for (const sql of m.statements) {
      parts.push(`${sql.trim()};`, '');
      statementCount++;
    }
  }
}

// Record applied versions so the runtime migrator skips them.
parts.push('-- ============================================================');
parts.push('-- migration bookkeeping');
parts.push('-- ============================================================', '');
const now = new Date().toISOString();
for (const m of KERNEL_MIGRATIONS) {
  parts.push(
    `INSERT OR IGNORE INTO schema_version (module_id, version, applied_at) ` +
    `VALUES ('kernel', ${m.version}, '${now}');`,
  );
}
for (const mod of modules) {
  for (const m of mod.manifest.migrations) {
    parts.push(
      `INSERT OR IGNORE INTO schema_version (module_id, version, applied_at) ` +
      `VALUES ('${mod.manifest.id}', ${m.version}, '${now}');`,
    );
  }
}
parts.push('');

const out = parts.join('\n');
const target = new URL('../packages/server-cf/schema.sql', import.meta.url);
writeFileSync(target, out);

console.log(`schema.sql written: ${statementCount} statements, ${modules.length + 1} components`);
