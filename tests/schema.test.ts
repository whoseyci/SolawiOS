import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

const root = join(import.meta.dirname, '..');
const cf = join(root, 'packages/server-cf');

/**
 * The deploy silently stopped working and the live site served a stale bundle
 * for two releases.
 *
 * Cause: `ALTER TABLE ADD COLUMN` is not idempotent. SQLite has no
 * `IF NOT EXISTS` for columns, so the second deploy failed with "duplicate
 * column name" — and because the deploy command is a `&&` chain, that took
 * `wrangler deploy` down with it. Every build after the first looked like a
 * schema error while the real symptom was "my fix never shipped".
 *
 * These tests apply the generated schema repeatedly, exactly as a deploy does.
 */
describe('generated schema survives repeated deploys', () => {
  beforeAll(() => {
    execFileSync('npm', ['run', 'schema'], { cwd: root, stdio: 'pipe' });
  });

  it('keeps no bare ALTER TABLE in the file applied wholesale', () => {
    const sql = readFileSync(join(cf, 'schema.sql'), 'utf8');
    const statements = sql
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n');
    expect(statements).not.toMatch(/ALTER\s+TABLE/i);
  });

  it('routes every additive column through the guarded list', () => {
    const additive = JSON.parse(readFileSync(join(cf, 'schema-additive.json'), 'utf8'));
    expect(Array.isArray(additive)).toBe(true);
    for (const a of additive) {
      expect(a).toHaveProperty('table');
      expect(a).toHaveProperty('column');
      expect(a.sql).toMatch(/ALTER\s+TABLE/i);
    }
  });

  it('applies cleanly three times in a row', () => {
    const base = readFileSync(join(cf, 'schema.sql'), 'utf8');
    const additive = JSON.parse(readFileSync(join(cf, 'schema-additive.json'), 'utf8')) as
      Array<{ table: string; column: string; sql: string }>;
    const indexes = existsSync(join(cf, 'schema-indexes.sql'))
      ? readFileSync(join(cf, 'schema-indexes.sql'), 'utf8') : '';

    const db = new Database(':memory:');

    const applyOnce = (): { added: number; present: number } => {
      db.exec(base);
      let added = 0, present = 0;
      for (const a of additive) {
        try { db.exec(a.sql); added++; } catch (err) {
          // Column already there: the desired end state, not a failure.
          if (/duplicate column name/i.test(String(err))) present++;
          else throw err;
        }
      }
      if (indexes.trim()) db.exec(indexes);
      return { added, present };
    };

    const first = applyOnce();
    expect(first.added).toBeGreaterThan(0);

    // The runs that used to break the deploy.
    const second = applyOnce();
    const third = applyOnce();
    expect(second.added).toBe(0);
    expect(second.present).toBe(first.added);
    expect(third.present).toBe(first.added);

    const tables = db.prepare(
      `SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table'`,
    ).get() as { n: number };
    expect(tables.n).toBeGreaterThan(20);
    db.close();
  });

  it('creates indexes after the columns they reference exist', () => {
    // idx_task_board covers board_column/board_order, which the additive phase
    // adds — so it must not live in the file applied before that phase.
    const base = readFileSync(join(cf, 'schema.sql'), 'utf8');
    expect(base).not.toContain('idx_task_board');

    const indexes = readFileSync(join(cf, 'schema-indexes.sql'), 'utf8');
    expect(indexes).toContain('idx_task_board');
  });
});
