import './styles/app.css';
import { el, mount } from './lib/ui.js';
import { icon } from './lib/icon.js';
import { t } from './lib/i18n.js';
import { auth, online, flushOutbox, outboxCount } from './lib/api.js';
import { loadCtx, ctx, invalidateCtx, can } from './lib/session.js';
import { renderAuth, renderOrgPicker } from './pages/auth.js';
import { renderHouseholdLink } from './pages/household.js';
import { renderMap } from './pages/map.js';
import { renderBoard } from './pages/board.js';
import { renderCrops } from './pages/crops.js';
import { renderTasks } from './pages/tasks.js';
import { renderMembers } from './pages/members.js';
import { renderDistribution } from './pages/distribution.js';
import { renderInventory } from './pages/inventory.js';
import { renderFinance } from './pages/finance.js';
import { renderBidding } from './pages/bidding.js';
import { renderMore, feedbackSheet } from './pages/more.js';
import { renderFounding } from './pages/founding.js';

const app = document.getElementById('app')!;

interface Tab {
  id: string; icon: string; label: string;
  module?: string; role?: string;
  /** Full-bleed screens (map, board) manage their own padding. */
  flush?: boolean;
  render: (r: HTMLElement) => void;
}

/**
 * Navigation. A tab appears only when its module is enabled AND the person has
 * the role for it — someone who just collects vegetables never sees a crop
 * rotation matrix (docs/00 §3).
 */
const TABS: Tab[] = [
  { id: 'map', icon: 'map', label: 'nav.map', module: 'land', render: renderMap, flush: true },
  { id: 'board', icon: 'stack', label: 'nav.board', module: 'tasks', render: renderBoard, flush: true },
  { id: 'crops', icon: 'carrot', label: 'nav.crops', module: 'cultivation', role: 'grower', render: renderCrops },
  { id: 'dist', icon: 'package', label: 'nav.dist', module: 'distribution', render: renderDistribution },
  { id: 'members', icon: 'users', label: 'nav.members', module: 'members', render: renderMembers },
  { id: 'inventory', icon: 'wrench', label: 'nav.inventory', module: 'inventory', render: renderInventory },
  { id: 'bidding', icon: 'gavel', label: 'nav.bidding', module: 'bidding', render: (r) => renderBidding(r) },
  { id: 'finance', icon: 'coins', label: 'nav.finance', module: 'finance', role: 'finance', render: renderFinance },
  { id: 'founding', icon: 'seedling', label: 'nav.founding', module: 'founding', render: renderFounding },
  { id: 'more', icon: 'gear', label: 'nav.settings', render: renderMore },
];

/** Phones fit about five; the rest live behind "More". */
const MAX_TABS = 5;

async function boot(): Promise<void> {
  if (!auth.signedIn) return renderAuth(app, () => void boot());
  if (!auth.org) return renderOrgPicker(app, () => void boot());

  try {
    await loadCtx(true);
  } catch {
    // A stale org slug (farm deleted, or a wrong header) would otherwise loop.
    auth.org = null;
    return renderOrgPicker(app, () => void boot());
  }

  // Members module on, but this person is not linked to a household yet:
  // ask once, allow skipping.
  const c = ctx();
  if (c.modules.includes('members') && !c.household && !sessionStorage.getItem('skipHousehold')) {
    return renderHouseholdLink(app, () => {
      sessionStorage.setItem('skipHousehold', '1');
      void boot();
    });
  }

  shell();
}

function visibleTabs(): Tab[] {
  const c = ctx();
  return TABS.filter((tb) =>
    (!tb.module || c.modules.includes(tb.module)) && (!tb.role || can(tb.role)));
}

function shell(): void {
  const content = el('div', { class: 'main' });
  const offlineBanner = el('div', {
    class: 'banner banner-offline', style: online.is ? 'display:none' : '',
  }, t('common.offline'));
  const pendingBadge = el('span', { class: 'badge badge-warn', style: 'display:none' }, '');
  const title = el('h1', {}, t('app.name'));

  const tabbar = el('nav', { class: 'tabbar' });
  const topbar = el('header', { class: 'topbar' },
    title,
    pendingBadge,
    el('button', {
      class: 'btn btn-ghost', style: 'min-height:36px;padding:.2rem .6rem',
      title: t('feedback.title'), 'aria-label': t('feedback.title'), onclick: feedbackSheet,
    }, el('span', { html: icon('flag', 18) })),
  );

  mount(app, topbar, offlineBanner, content, tabbar);

  function route(): void {
    const vis = visibleTabs();
    const id = location.hash.replace(/^#\/?/, '').split('?')[0] || vis[0]?.id || 'more';
    const tab = TABS.find((tb) => tb.id === id && vis.includes(tb)) ?? vis[0];
    if (!tab) return;

    title.textContent = t(tab.label);
    content.className = tab.flush ? 'main main-flush' : 'main';
    mount(content);
    tab.render(content);

    const primary = vis.slice(0, MAX_TABS - 1);
    const overflow = vis.slice(MAX_TABS - 1);
    const more = TABS.find((x) => x.id === 'more')!;
    const bar = overflow.length > 1 ? [...primary, more] : vis;

    mount(tabbar, ...bar.map((tb) =>
      el('a', {
        href: `#/${tb.id}`,
        class: tb.id === tab.id ? 'active' : '',
        'aria-current': tb.id === tab.id ? 'page' : undefined,
      },
        el('span', { html: icon(tb.icon, 22) }),
        el('span', {}, t(tb.label)),
      )));
  }

  window.addEventListener('hashchange', route);
  window.addEventListener('solawi:modules', () => { invalidateCtx(); void boot(); });

  online.listen((isOnline) => {
    offlineBanner.style.display = isOnline ? 'none' : '';
    void refreshPending();
  });
  window.addEventListener('solawi:outbox', () => void refreshPending());

  async function refreshPending(): Promise<void> {
    const n = await outboxCount();
    pendingBadge.textContent = String(n);
    pendingBadge.style.display = n > 0 ? 'inline-block' : 'none';
  }

  route();
  void refreshPending();
  if (online.is) void flushOutbox();
}

void boot();

/*
 * Service worker.
 *
 * An earlier version fell back to index.html for ANY failed request, so a
 * cached bad state served HTML for /assets/*.js and the app went blank with a
 * MIME error. Anyone who loaded that version still has it installed, so we
 * update aggressively and reload once when a new worker takes over.
 */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').then((reg) => {
      void reg.update();
      reg.addEventListener('updatefound', () => {
        const next = reg.installing;
        next?.addEventListener('statechange', () => {
          // Only reload for a genuine replacement, not the very first install.
          if (next.state === 'activated' && navigator.serviceWorker.controller) {
            location.reload();
          }
        });
      });
    }).catch(() => {});
  });
}

/**
 * Last-resort recovery: /?reset=sw unregisters every worker and clears caches.
 * Cheap to keep, and the difference between "reinstall the app" and a blank
 * screen someone cannot get out of.
 */
if (location.search.includes('reset=sw') && 'serviceWorker' in navigator) {
  void (async () => {
    for (const reg of await navigator.serviceWorker.getRegistrations()) await reg.unregister();
    if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k);
    location.replace('/');
  })();
}
