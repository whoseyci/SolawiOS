import './styles/app.css';
import { el, mount } from './lib/ui.js';
import { t } from './lib/i18n.js';
import { auth, get, online, flushOutbox, outboxCount } from './lib/api.js';
import { renderAuth, renderOrgPicker } from './pages/auth.js';
import { renderField } from './pages/field.js';
import { renderTasks } from './pages/tasks.js';
import { renderMembers } from './pages/members.js';
import { renderBidding } from './pages/bidding.js';
import { renderMore, feedbackSheet } from './pages/more.js';
import { renderFounding } from './pages/founding.js';

const app = document.getElementById('app')!;

interface Tab { id: string; icon: string; label: string; module?: string; render: (r: HTMLElement) => void }

const TABS: Tab[] = [
  { id: 'field', icon: '\u{1F33F}', label: 'nav.field', module: 'land', render: renderField },
  { id: 'tasks', icon: '\u{2713}', label: 'nav.tasks', module: 'tasks', render: renderTasks },
  { id: 'members', icon: '\u{1F465}', label: 'nav.members', module: 'members', render: renderMembers },
  { id: 'bidding', icon: '\u{1F5F3}', label: 'nav.bidding', module: 'bidding', render: (r) => renderBidding(r) },
  { id: 'founding', icon: '\u{1F331}', label: 'nav.founding', module: 'founding', render: renderFounding },
  { id: 'more', icon: '\u{2699}', label: 'nav.settings', render: renderMore },
];

let enabled = new Set<string>();

async function boot(): Promise<void> {
  if (!auth.signedIn) return renderAuth(app, () => void boot());
  if (!auth.org) return renderOrgPicker(app, () => void boot());

  try {
    const { data } = await get<{ modules: Array<{ id: string; enabled: boolean }> }>('/api/org');
    enabled = new Set(data.modules.filter((m) => m.enabled).map((m) => m.id));
  } catch {
    // Offline on a cold start: show everything rather than an empty shell.
    enabled = new Set(TABS.map((tb) => tb.module).filter(Boolean) as string[]);
  }
  shell();
}

function visibleTabs(): Tab[] {
  // Disabled modules are ABSENT, not greyed out (docs/40 §3).
  return TABS.filter((tb) => !tb.module || enabled.has(tb.module));
}

function shell(): void {
  const content = el('div', { class: 'main' });
  const offlineBanner = el('div', {
    class: 'banner banner-offline', style: online.is ? 'display:none' : '',
  }, t('common.offline'));
  const pendingBadge = el('span', { class: 'badge badge-warn', style: 'display:none' }, '');

  const tabbar = el('nav', { class: 'tabbar' });
  const topbar = el('header', { class: 'topbar' },
    el('h1', {}, t('app.name')),
    pendingBadge,
    el('button', {
      class: 'btn btn-ghost', style: 'min-height:36px;padding:.2rem .6rem',
      title: t('feedback.title'), onclick: feedbackSheet,
    }, '\u{2691}'),
  );

  mount(app, topbar, offlineBanner, content, tabbar);

  function route(): void {
    const id = location.hash.replace(/^#\/?/, '').split('?')[0] || visibleTabs()[0]?.id || 'more';
    const tab = TABS.find((tb) => tb.id === id) ?? visibleTabs()[0];
    if (!tab) return;

    (topbar.firstChild as HTMLElement).textContent = t(tab.label);
    mount(content);
    tab.render(content);

    mount(tabbar, ...visibleTabs().map((tb) =>
      el('a', { href: `#/${tb.id}`, class: tb.id === tab.id ? 'active' : '' },
        el('span', { class: 'ico' }, tb.icon),
        el('span', {}, t(tb.label)),
      )));
  }

  window.addEventListener('hashchange', route);
  window.addEventListener('solawi:modules', () => void boot());

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
  // Anything captured offline goes out as soon as we have a connection.
  if (online.is) void flushOutbox();
}

void boot();

// Service worker: makes the app installable and usable with no connection.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
