// Icon system — swappable between Phosphor styles
// To switch icon style, change ICON_STYLE below.
// Each style uses a different CSS class prefix.
//
// To switch icon style globally, change ICON_STYLE in src/lib/icons.ts.
// Vite resolves the CSS at build/dev time so no network requests are made.

import regularCss from '@phosphor-icons/web/regular?url';
import duotoneCss from '@phosphor-icons/web/duotone?url';
import fillCss from '@phosphor-icons/web/fill?url';
import boldCss from '@phosphor-icons/web/bold?url';
import lightCss from '@phosphor-icons/web/light?url';
import thinCss from '@phosphor-icons/web/thin?url';

export type IconStyle = 'regular' | 'duotone' | 'fill' | 'bold' | 'light' | 'thin';

/** Change this single line to switch global icon style. */
export const ICON_STYLE: IconStyle = 'duotone';

const STYLE_CSS: Record<IconStyle, string> = {
  regular: regularCss,
  duotone: duotoneCss,
  fill: fillCss,
  bold: boldCss,
  light: lightCss,
  thin: thinCss,
};

const STYLE_PREFIX: Record<IconStyle, string> = {
  regular: 'ph',
  duotone: 'ph-duotone',
  fill: 'ph-fill',
  bold: 'ph-bold',
  light: 'ph-light',
  thin: 'ph-thin',
};

let injected = new Set<string>();

/** Inject the stylesheet for the current icon style. Idempotent. */
export function injectIconStyles(style: IconStyle = ICON_STYLE): void {
  if (injected.has(style)) return;
  injected.add(style);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.href = STYLE_CSS[style];
  document.head.appendChild(link);
}

/** Render a Phosphor icon as HTML string. */
export function icon(name: string, style: IconStyle = ICON_STYLE, attrs: Record<string, string | boolean> = {}): string {
  const attrStr = Object.entries(attrs).map(([k, v]) => v === true ? k : `${k}="${v}"`).join(' ');
  return `<i class="${STYLE_PREFIX[style]} ph-${name}"${attrStr ? ' ' + attrStr : ''} aria-hidden="true"></i>`;
}

/** Convenience: create an HTMLElement for an icon. */
export function iconEl(name: string, style: IconStyle = ICON_STYLE, attrs: Record<string, string | boolean> = {}): HTMLElement {
  const i = document.createElement('i');
  i.className = `${STYLE_PREFIX[style]} ph-${name}`;
  i.setAttribute('aria-hidden', 'true');
  for (const [k, v] of Object.entries(attrs)) {
    if (v === true) i.setAttribute(k, '');
    else i.setAttribute(k, String(v));
  }
  return i;
}
