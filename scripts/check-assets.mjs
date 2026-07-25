#!/usr/bin/env node
/**
 * Fail the deploy if the web bundle is missing or inconsistent.
 *
 * This exists because of a real outage: `packages/server-cf/public/` was
 * gitignored, Cloudflare cloned a repo without it, and the deploy "succeeded"
 * while serving nothing. The browser asked for /assets/index-*.js, the SPA
 * fallback returned index.html, and the console said:
 *
 *   Expected a JavaScript-or-Wasm module script but the server responded with
 *   a MIME type of "text/html"
 *
 * A deploy that ships no app should be an error, not a blank page.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'packages/server-cf/public');

const problems = [];

if (!existsSync(pub)) {
  problems.push(`missing directory: ${pub}`);
} else {
  const indexPath = join(pub, 'index.html');
  if (!existsSync(indexPath)) {
    problems.push('public/index.html is missing — did `npm run build` run?');
  } else {
    const html = readFileSync(indexPath, 'utf8');

    // Every local asset the document references must actually be on disk,
    // otherwise the browser gets the SPA fallback and dies on the MIME check.
    const refs = [...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1]);
    for (const ref of refs) {
      if (ref.startsWith('//') || ref.startsWith('http')) continue;
      if (!existsSync(join(pub, ref))) problems.push(`index.html references ${ref}, which does not exist`);
    }

    const assetsDir = join(pub, 'assets');
    if (!existsSync(assetsDir)) {
      problems.push('public/assets/ is missing');
    } else {
      const files = readdirSync(assetsDir);
      if (!files.some((f) => f.endsWith('.js'))) problems.push('no JavaScript bundle in public/assets/');
      if (!files.some((f) => f.endsWith('.css'))) problems.push('no stylesheet in public/assets/');
    }
  }
}

if (problems.length > 0) {
  console.error('\n✗ Web bundle check failed:\n');
  for (const p of problems) console.error(`  • ${p}`);
  console.error('\n  Run: npm run build\n');
  process.exit(1);
}

console.log('✓ web bundle present and consistent');
