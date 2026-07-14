// Sidebar navigation
import { h, clear } from '../../lib/dom';
import { icon } from '../../lib/icons';
import { NAV } from '../../data/nav';
import { stateStore } from '../../store/state';
import type { PageId } from '../../types';

let currentPage: PageId = 'dashboard';
let onNav: (id: PageId) => void = () => {};

export function setNavHandler(handler: (id: PageId) => void): void { onNav = handler; }
export function setCurrentPage(id: PageId): void { currentPage = id; }

export function renderSidebar(): HTMLElement {
  const sidebar = h('<aside class="sidebar" id="sidebar"></aside>') as HTMLElement;
  sidebar.innerHTML = `
    <div class="brand">
      <div class="brand-name">${icon('leaf')}<span style="margin-left:8px">SolawiOS</span></div>
      <div class="brand-sub">Hof Wurzelreich · Saison ${stateStore.state.meta.season}</div>
    </div>
    <nav class="nav" id="sidebar-nav"></nav>
    <div class="user-block">
      <div class="user-avatar">AM</div>
      <div class="user-info">
        <div class="user-name">Anna Müller</div>
        <div class="user-role">Gärtnermeisterin</div>
      </div>
      <button class="icon-btn" title="Abmelden">${icon('sign-out')}</button>
    </div>
  `;
  const nav = sidebar.querySelector('#sidebar-nav') as HTMLElement;
  for (const g of NAV) {
    const group = h(`<div class="nav-group"><div class="nav-group-title"></div></div>`) as HTMLElement;
    (group.querySelector('.nav-group-title') as HTMLElement).textContent = g.group;
    for (const it of g.items) {
      const badge = it.badge?.() ?? 0;
      const item = h(`
        <div class="nav-item ${currentPage === it.id ? 'active' : ''}" data-page="${it.id}">
          <span class="nav-icon"></span>
          <span class="nav-text"></span>
          ${badge ? `<span class="nav-badge">${badge}</span>` : ''}
        </div>
      `) as HTMLElement;
      (item.querySelector('.nav-icon') as HTMLElement).innerHTML = icon(it.icon);
      (item.querySelector('.nav-text') as HTMLElement).textContent = it.label;
      item.addEventListener('click', () => onNav(it.id));
      group.appendChild(item);
    }
    nav.appendChild(group);
  }
  return sidebar;
}

/** Refresh only the badge counts — called when state changes. */
export function refreshBadges(): void {
  const nav = document.querySelector('#sidebar-nav');
  if (!nav) return;
  for (const g of NAV) {
    for (const it of g.items) {
      const el = nav.querySelector(`[data-page="${it.id}"]`);
      if (!el) continue;
      const badge = it.badge?.() ?? 0;
      const existing = el.querySelector('.nav-badge');
      if (badge > 0) {
        if (existing) existing.textContent = String(badge);
        else {
          const b = h(`<span class="nav-badge">${badge}</span>`);
          el.appendChild(b);
        }
      } else if (existing) {
        existing.remove();
      }
    }
  }
}

/** Update active page highlight. */
export function setActivePage(id: PageId): void {
  currentPage = id;
  document.querySelectorAll('[data-page]').forEach(el => {
    el.classList.toggle('active', (el as HTMLElement).dataset.page === id);
  });
}

export { clear };
