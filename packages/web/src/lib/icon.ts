import { iconSvg, hasIcon } from './icons.js';

/**
 * Icon helper.
 *
 * Emojis were removed throughout: they render differently on every platform,
 * cannot be recoloured to match state, and align inconsistently in buttons.
 *
 * `icon()` returns an ELEMENT, not a string. That is deliberate: an earlier
 * version returned markup, and every call site that passed it as a child of
 * `el()` had the SVG source rendered as visible text, because `el()` turns
 * string children into text nodes. Returning a node makes that mistake
 * impossible and lets TypeScript catch the remaining `html:` usages.
 */
export function icon(name: string, size = 20, cls = ''): HTMLElement {
  const span = document.createElement('span');
  span.className = 'ico-wrap';
  if (!hasIcon(name)) {
    // Warn rather than render an invisible gap; a missing icon is a typo.
    console.warn(`[icon] unknown: ${name}`);
    return span;
  }
  span.innerHTML = iconSvg(name, size, cls);
  return span;
}

/** Raw markup, for the few places that genuinely need a string. */
export function iconMarkup(name: string, size = 20, cls = ''): string {
  return hasIcon(name) ? iconSvg(name, size, cls) : '';
}
