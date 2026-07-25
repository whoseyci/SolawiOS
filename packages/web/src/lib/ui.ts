/**
 * Tiny DOM helpers. No framework: the target device is an old phone and the
 * whole app is a few screens, so a virtual DOM would cost more than it saves.
 */

type Attrs = Record<string, string | number | boolean | ((e: Event) => void) | undefined>;
type Child = Node | string | number | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Attrs = {}, ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (k === 'class') node.className = String(v);
    else if (k === 'html') node.innerHTML = String(v);
    else node.setAttribute(k, String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function mount(node: HTMLElement, ...children: Child[]): void {
  clear(node);
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
}

/** Bottom sheet — the reachable place for actions on a phone held one-handed. */
export function sheet(title: string, body: HTMLElement, onClose?: () => void): () => void {
  const back = el('div', { class: 'sheet-back' });
  const panel = el('div', { class: 'sheet' }, el('h2', {}, title), body);
  back.appendChild(panel);
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  document.body.appendChild(back);
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  function close() {
    back.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  }
  return close;
}

export function toast(message: string, kind: 'ok' | 'warn' | 'error' = 'ok'): void {
  const cls = kind === 'ok' ? 'banner-ok' : kind === 'warn' ? 'banner-offline' : 'banner-error';
  const node = el('div', {
    class: `banner ${cls}`,
    style: 'position:fixed;left:1rem;right:1rem;bottom:6rem;z-index:50;text-align:center;box-shadow:var(--shadow)',
  }, message);
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 3200);
}

export function spinner(): HTMLElement {
  return el('div', { class: 'spinner' });
}

export function empty(icon: string, text: string, action?: HTMLElement): HTMLElement {
  return el('div', { class: 'empty' }, el('span', { class: 'ico' }, icon), el('p', {}, text), action);
}
