// Tiny DOM helpers — type-safe, minimal.

/** Shorthand querySelector. */
export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T | null =>
  root.querySelector(sel) as T | null;

/** Shorthand querySelectorAll. Returns a real array. */
export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T[] =>
  Array.from(root.querySelectorAll(sel)) as T[];

/**
 * Parse an HTML string into an element. If multiple top-level elements are
 * present, they are wrapped in a `<div>` so the return type is always an HTMLElement.
 */
export function h(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  if (t.content.childElementCount === 1) return t.content.firstElementChild as HTMLElement;
  const wrap = document.createElement('div');
  wrap.append(...Array.from(t.content.childNodes));
  return wrap;
}

/** Parse an HTML string into an HTMLElement (assumes exactly one root). */
export function h1<K extends keyof HTMLElementTagNameMap = 'div'>(html: string): HTMLElementTagNameMap[K] {
  return h(html) as HTMLElementTagNameMap[K];
}

/** Escape HTML entities to prevent XSS when interpolating user content. */
export const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)
);

/** Make a DOM element from a tag name and props. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { class?: string; html?: string; text?: string; on?: Partial<Record<keyof HTMLElementEventMap, EventListener>> } = {},
  children: (Node | string)[] = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = String(v);
    else if (k === 'html') node.innerHTML = String(v);
    else if (k === 'text') node.textContent = String(v);
    else if (k === 'on' && v) {
      for (const [event, handler] of Object.entries(v as Record<string, EventListener>)) {
        node.addEventListener(event, handler);
      }
    } else {
      (node as Record<string, unknown>)[k] = v;
    }
  }
  for (const child of children) {
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Empty the contents of an element and return it (for chaining). */
export function clear<T extends HTMLElement>(node: T): T {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}
