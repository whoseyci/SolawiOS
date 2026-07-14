// Cmd+K command palette with search and keyboard navigation
import { icon } from '../lib/icons';
import { openModal } from './ui/modal';
import type { CommandAction, PageId } from '../types';

let navHandler: (id: PageId) => void = () => {};

export function setCommandNav(handler: (id: PageId) => void): void { navHandler = handler; }

const ACTIONS: CommandAction[] = [
  { id: 'm-new',   label: 'Neues Mitglied anlegen',  icon: 'user-plus',      action: () => import('../pages/members').then(m => m.openMemberForm()) },
  { id: 'm-list',  label: 'Mitglieder verwalten',     icon: 'users',          action: () => navHandler('members') },
  { id: 'h-new',   label: 'Neue Ernte buchen',        icon: 'basket',         action: () => import('../pages/harvest').then(m => m.openHarvestForm()) },
  { id: 'h-list',  label: 'Ernteerfassung',           icon: 'plant',          action: () => navHandler('harvest') },
  { id: 't-new',   label: 'Neue Aufgabe',             icon: 'check-square',   action: () => import('../pages/tasks').then(m => m.openTaskForm()) },
  { id: 't-list',  label: 'Aufgaben',                 icon: 'check-square',   action: () => navHandler('tasks') },
  { id: 'p-new',   label: 'Buchung erfassen',         icon: 'currency-eur',   action: () => import('../pages/finance').then(m => m.openPaymentForm()) },
  { id: 'f-list',  label: 'Finanzen',                 icon: 'currency-eur',   action: () => navHandler('finance') },
  { id: 'msg-new', label: 'Mitteilung senden',        icon: 'envelope-simple', action: () => import('../pages/messages').then(m => m.openMessageForm()) },
  { id: 'msg-list',label: 'Mitteilungen',             icon: 'envelope-simple', action: () => navHandler('messages') },
  { id: 'c-new',   label: 'Neue Kultur anlegen',      icon: 'plant',          action: () => import('../pages/crops').then(m => m.openCropForm()) },
  { id: 'b-new',   label: 'Neues Beet anlegen',       icon: 'map-trifold',    action: () => import('../pages/fieldplan').then(m => m.openBedForm()) },
  { id: 'bed-plan',label: 'Bepflanzung planen',       icon: 'plant',          action: () => import('../pages/fieldplan').then(m => m.openPlantingForm()) },
  { id: 'd-new',   label: 'Neues Depot anlegen',      icon: 'truck',          action: () => import('../pages/distribution').then(m => m.openDepotForm()) },
  { id: 'i-new',   label: 'Neuer Artikel',            icon: 'package',        action: () => import('../pages/inventory').then(m => m.openInventoryForm()) },
  { id: 'o-new',   label: 'Bestellung anlegen',       icon: 'shopping-cart',  action: () => import('../pages/orders').then(m => m.openOrderForm()) },
  { id: 's-list',  label: 'Ernteanteile',             icon: 'basket',         action: () => navHandler('shares') },
  { id: 's-settings', label: 'Stammdaten',            icon: 'gear',           action: () => navHandler('settings') },
  { id: 'reports', label: 'Berichte',                 icon: 'chart-line-up',  action: () => navHandler('reports') },
  { id: 'dashboard', label: 'Dashboard',              icon: 'house',          action: () => navHandler('dashboard') },
  { id: 'crops',   label: 'Kulturarten',              icon: 'plant',          action: () => navHandler('crops') },
  { id: 'calendar',label: 'Anbaukalender',            icon: 'calendar-blank', action: () => navHandler('calendar') },
  { id: 'fieldplan',label: 'Beetplanung',             icon: 'map-trifold',    action: () => navHandler('fieldplan') },
  { id: 'distribution', label: 'Verteilung',          icon: 'truck',          action: () => navHandler('distribution') },
  { id: 'inventory', label: 'Lager & Saatgut',        icon: 'package',        action: () => navHandler('inventory') },
  { id: 'orders',  label: 'Bestellungen',             icon: 'shopping-cart',  action: () => navHandler('orders') },
  { id: 'backup',  label: 'Backup erstellen (JSON)',  icon: 'download',       action: () => import('../pages/settings').then(m => m.exportJSON()) },
  { id: 'reset',   label: 'Alle Daten zurücksetzen',  icon: 'trash',          action: () => import('../pages/settings').then(m => m.resetAllData()) },
];

export function openCommandPalette(): void {
  const m = openModal({
    title: 'Schnellaktion',
    wide: true,
    body: `
      <div class="form-row"><input id="cmd-q" placeholder="Aktion suchen…" style="font-size:16px;padding:10px" autofocus/></div>
      <div id="cmd-list" style="max-height:50vh;overflow:auto"></div>
    `,
    footer: `<button class="btn" data-close>Schließen <span class="text-soft">Esc</span></button>`,
  });
  m.footer!.querySelector('[data-close]')!.addEventListener('click', () => m.close());
  const input = m.body.querySelector('#cmd-q') as HTMLInputElement;
  const list = m.body.querySelector('#cmd-list') as HTMLElement;

  function render(q = ''): void {
    const ql = q.toLowerCase();
    const items = ACTIONS.filter(a => a.label.toLowerCase().includes(ql));
    list.innerHTML = items.map((a, i) => `
      <div class="activity-item" data-i="${i}" style="cursor:pointer;padding:10px;border-radius:6px">
        <div class="activity-icon">${icon(a.icon)}</div>
        <div class="activity-body"><div><b>${a.label}</b></div></div>
      </div>
    `).join('') || '<div class="text-soft text-sm" style="padding:12px">Keine Treffer</div>';
    list.querySelectorAll<HTMLElement>('[data-i]').forEach(el => {
      el.addEventListener('mouseenter', () => {
        list.querySelectorAll<HTMLElement>('[data-i]').forEach(x => x.style.background = '');
        el.style.background = 'var(--bg-soft)';
      });
      el.addEventListener('click', () => { items[Number(el.dataset.i)].action(); m.close(); });
    });
  }
  render();
  setTimeout(() => input.focus(), 50);
  input.addEventListener('input', () => render(input.value));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const first = list.querySelector<HTMLElement>('[data-i]');
      if (first) first.click();
    }
  });
}

// Global keyboard shortcut
let initialized = false;
export function initCommandPalette(): void {
  if (initialized) return;
  initialized = true;
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      openCommandPalette();
    }
  });
}
