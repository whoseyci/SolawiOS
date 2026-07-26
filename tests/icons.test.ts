import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { iconSvg, hasIcon } from '../packages/web/src/lib/icons.js';

const root = join(import.meta.dirname, '..');

/**
 * Two shipped bugs, both visible in one screenshot:
 *
 *  1. Every icon rendered upside down. I had wrapped the paths in a
 *     `scale(1,-1)` flip, assuming selection.json used an inverted Y axis.
 *     Rendering caret-down both ways proved it does not.
 *
 *  2. Raw SVG source appeared as text on the map. `icon()` returned a markup
 *     string, and `el()` turns string children into text nodes — so every
 *     `el('span', {}, icon('x'))` printed the markup instead of drawing it.
 */
describe('icons render the right way up', () => {
  it('does not wrap paths in a vertical flip', () => {
    const svg = iconSvg('caret-down', 20);
    expect(svg).not.toContain('scale(1,-1)');
    expect(svg).not.toContain('translate(0,896)');
  });

  it('emits a plain viewBox with the paths unmodified', () => {
    const svg = iconSvg('check', 24);
    expect(svg).toContain('viewBox="0 0 1024 1024"');
    expect(svg).toContain('width="24"');
    expect(svg).toContain('fill="currentColor"');
    expect(svg).toMatch(/<path d="/);
  });

  it('knows the icons the navigation depends on', () => {
    for (const name of [
      'map', 'stack', 'carrot', 'package', 'users', 'wrench',
      'gavel', 'coins', 'seedling', 'gear', 'flag',
    ]) {
      expect(hasIcon(name), `missing nav icon: ${name}`).toBe(true);
    }
  });

  it('returns empty markup for an unknown name rather than broken SVG', () => {
    expect(iconSvg('definitely-not-an-icon')).toBe('');
  });
});

describe('icons are never passed to the DOM as text', () => {
  const files = [
    'packages/web/src/main.ts',
    ...['auth', 'map', 'board', 'bed-detail', 'crops', 'tasks', 'members',
        'distribution', 'inventory', 'finance', 'founding', 'more', 'bidding', 'field']
      .map((n) => `packages/web/src/pages/${n}.ts`),
  ];

  it('never uses `html: icon(...)` — that helper returns an element now', () => {
    for (const rel of files) {
      let src: string;
      try { src = readFileSync(join(root, rel), 'utf8'); } catch { continue; }
      // `html:` takes a string, so it must be iconMarkup; `icon()` is a node.
      expect(src, `${rel} passes an element where markup is expected`)
        .not.toMatch(/html:\s*icon\(/);
    }
  });

  it('only uses iconMarkup inside an attribute object', () => {
    for (const rel of files) {
      let src: string;
      try { src = readFileSync(join(root, rel), 'utf8'); } catch { continue; }
      for (const line of src.split('\n')) {
        if (!line.includes('iconMarkup(')) continue;
        // Legitimate: `html: iconMarkup(...)` or `emptyIcon(iconMarkup(...)`.
        const ok = /html:\s*iconMarkup\(/.test(line) || /emptyIcon\(iconMarkup\(/.test(line);
        expect(ok, `${rel}: iconMarkup used as a child — it would render as text\n  ${line.trim()}`)
          .toBe(true);
      }
    }
  });
});
