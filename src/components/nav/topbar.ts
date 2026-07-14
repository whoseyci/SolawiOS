// Top bar with search, action button, notifications.
import { h } from '../../lib/dom';
import { icon } from '../../lib/icons';
import { openCommandPalette } from '../command-palette';

const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
  dashboard: { title: 'Dashboard', sub: 'Übersicht aller Bereiche' },
  members: { title: 'Mitglieder', sub: 'Stammdaten, Anteile und Kontakte' },
  shares: { title: 'Ernteanteile', sub: 'Verteilung der Ernteanteile' },
  distribution: { title: 'Verteilung', sub: 'Depots, Routen und Abholungen' },
  crops: { title: 'Kulturarten', sub: 'Kulturarten, Sorten, Anbauinformationen' },
  fieldplan: { title: 'Beetplanung', sub: 'Beete und Feldaufteilung' },
  calendar: { title: 'Anbaukalender', sub: 'Saat-, Pflanz- und Erntetermine' },
  harvest: { title: 'Ernteerfassung', sub: 'Erntemengen und Qualität' },
  tasks: { title: 'Aufgaben', sub: 'Anstehende Aufgaben und Einsätze' },
  inventory: { title: 'Lager & Saatgut', sub: 'Saatgut, Werkzeug, Verbrauchsmaterial' },
  orders: { title: 'Bestellungen', sub: 'Zusatzbestellungen und Hofladen' },
  finance: { title: 'Finanzen', sub: 'Einnahmen, Ausgaben, Beiträge' },
  messages: { title: 'Mitteilungen', sub: 'Rundschreiben an Mitglieder' },
  reports: { title: 'Berichte', sub: 'Saisonberichte und Auswertungen' },
  settings: { title: 'Stammdaten', sub: 'Hof, Saison, Stammdaten' },
};

export function renderTopbar(): HTMLElement {
  const bar = h('<header class="topbar"></header>') as HTMLElement;
  bar.innerHTML = `
    <button class="btn btn-ghost mobile-toggle" id="mobile-toggle">${icon('list')}</button>
    <div>
      <div class="topbar-title" id="topbar-title"></div>
      <div class="topbar-sub" id="topbar-sub"></div>
    </div>
    <div class="topbar-spacer"></div>
    <div class="topbar-search">
      <input type="text" placeholder="Suchen…" id="global-search" />
    </div>
    <button class="topbar-btn" id="cmd-btn" title="Schnellaktion (Cmd+K)">${icon('lightning')} Aktion</button>
    <button class="topbar-btn" id="notif-btn" style="position:relative" title="Benachrichtigungen">${icon('bell')}<span class="notif-dot"></span></button>
  `;
  bar.querySelector('#mobile-toggle')!.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });
  bar.querySelector('#cmd-btn')!.addEventListener('click', () => openCommandPalette());
  return bar;
}

export function setTopbarTitle(pageId: string): void {
  const t = document.getElementById('topbar-title');
  const s = document.getElementById('topbar-sub');
  if (!t || !s) return;
  const info = PAGE_TITLES[pageId] ?? { title: pageId, sub: '' };
  t.textContent = info.title;
  s.textContent = info.sub;
}
