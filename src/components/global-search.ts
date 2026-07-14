// Global search across all entities.
import { icon } from '../lib/icons';
import { openModal } from './ui/modal';
import { stateStore } from '../store/state';
import type { PageId } from '../types';

let navHandler: (id: PageId) => void = () => {};

export function setSearchNav(handler: (id: PageId) => void): void { navHandler = handler; }

function searchAll(q: string): Array<{ label: string; page: PageId; icon: string }> {
  const ql = q.toLowerCase();
  const s = stateStore.state;
  const out: Array<{ label: string; page: PageId; icon: string }> = [];
  s.members.forEach(m => {
    if ((m.name + m.email + m.city).toLowerCase().includes(ql))
      out.push({ label: `${icon('user')} ${m.name}${m.city ? ' · ' + m.city : ''}`, page: 'members', icon: 'user' });
  });
  s.crops.forEach(c => {
    if (c.name.toLowerCase().includes(ql))
      out.push({ label: `${icon('plant')} ${c.name}${c.family ? ' · ' + c.family : ''}`, page: 'crops', icon: 'plant' });
  });
  s.tasks.forEach(t => {
    if (t.title.toLowerCase().includes(ql))
      out.push({ label: `${icon('check-square')} ${t.title}`, page: 'tasks', icon: 'check-square' });
  });
  s.inventory.forEach(i => {
    if (i.name.toLowerCase().includes(ql))
      out.push({ label: `${icon('package')} ${i.name}`, page: 'inventory', icon: 'package' });
  });
  return out;
}

let searchTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;

export function initGlobalSearch(): void {
  if (initialized) return;
  initialized = true;
  const input = document.getElementById('global-search') as HTMLInputElement | null;
  if (!input) return;
  input.addEventListener('input', () => {
    if (searchTimer) clearTimeout(searchTimer);
    const q = input.value;
    searchTimer = setTimeout(() => {
      if (q.length < 2) return;
      const results = searchAll(q);
      if (!results.length) return;
      const m = openModal({
        title: `Suche: "${q}"`,
        body: results.slice(0, 12).map((r, i) => `
          <div class="activity-item" data-page="${r.page}" data-i="${i}" style="cursor:pointer;padding:8px">
            <div class="activity-icon">${icon(r.icon)}</div>
            <div class="activity-body">${r.label}</div>
          </div>
        `).join(''),
        footer: `<button class="btn" data-close>Schließen</button>`,
      });
      m.footer!.querySelector('[data-close]')!.addEventListener('click', () => m.close());
      m.body.querySelectorAll<HTMLElement>('[data-page]').forEach(el => {
        el.addEventListener('click', () => {
          navHandler(el.dataset.page as PageId);
          m.close();
          input.value = '';
        });
      });
    }, 200);
  });
}
