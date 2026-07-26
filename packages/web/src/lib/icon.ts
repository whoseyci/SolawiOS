import { iconSvg, hasIcon } from './icons.js';
import { el } from './ui.js';

/**
 * Icon helper.
 *
 * Emojis were removed throughout: they render differently on every platform,
 * cannot be recoloured to match state, and align inconsistently inside buttons.
 * These are Phosphor paths inlined at build time (see lib/icons.ts).
 */

/** Returns an SVG string, for use with the `html` attribute or innerHTML. */
export function icon(name: string, size = 20, cls = ''): string {
  if (!hasIcon(name)) {
    // Warn rather than render an invisible gap; a missing icon is a typo.
    console.warn(`[icon] unknown: ${name}`);
    return '';
  }
  return iconSvg(name, size, cls);
}

/** Returns an element, for places that take nodes rather than markup. */
export function iconEl(name: string, size = 20, cls = ''): HTMLElement {
  return el('span', { class: 'ico-wrap', html: icon(name, size, cls) });
}
