// Tabs component
import { h, esc } from '../../lib/dom';

export interface Tab { id: string; label: string; }

export function tabs(tabs: Tab[], current: string, onChange: (id: string) => void, attrs: Record<string, string> = {}): HTMLElement {
  const node = h(`<div class="tabs"></div>`) as HTMLElement;
  for (const t of tabs) {
    const tab = h(`<div class="tab ${t.id === current ? 'active' : ''}" data-tab="${esc(t.id)}">${esc(t.label)}</div>`) as HTMLElement;
    tab.addEventListener('click', () => onChange(t.id));
    node.appendChild(tab);
  }
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}
