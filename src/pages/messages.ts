// Messages page
import { h, clear, esc } from '../lib/dom';
import { icon } from '../lib/icons';
import { stateStore, findDepot, fmtDate } from './utils';
import { fmtDateTime } from '../lib/date';
import { pageH } from '../components/ui/page-h';
import { tabs, Tab } from '../components/ui/tabs';
import { openModal } from '../components/ui/modal';
import { toast } from '../components/ui/toast';
import { badge } from '../components/ui/badge';
import { emptyState } from '../components/ui/empty-state';
import { uid } from '../lib/uid';
import type { MessageAudience } from '../types';

let currentTab: 'inbox' | 'draft' = 'inbox';

export function render(root: HTMLElement): void {
  clear(root);
  root.appendChild(pageH({
    title: 'Mitteilungen',
    desc: 'Rundschreiben an Mitglieder',
    actions: `<button class="btn btn-primary" id="msg-new">${icon('paper-plane-tilt')} Neue Mitteilung</button>`,
  }));
  const tabsEl = tabs([
    { id: 'inbox', label: 'Gesendet' },
    { id: 'draft', label: 'Entwürfe' },
  ] as Tab[], currentTab, t => { currentTab = t as typeof currentTab; render(root); });
  root.appendChild(tabsEl);
  const body = h('<div id="msg-body"></div>');
  root.appendChild(body);
  const list = stateStore.state.messages.filter(m => currentTab === 'draft' ? m.status === 'draft' : m.status === 'sent');
  if (!list.length) {
    body.appendChild(emptyState('Keine Mitteilungen', '', 'envelope-simple'));
  } else {
    const grid = h('<div class="grid grid-2"></div>');
    list.forEach(m => {
      const card = h(`
        <div class="card card-pad" data-id="${m.id}">
          <div class="row gap-2 mb-2"><div class="grow"><b></b></div>${badge(m.status === 'draft' ? 'Entwurf' : 'Gesendet', m.status === 'draft' ? 'warn' : 'primary')}</div>
          <div class="text-sm text-soft mb-2"></div>
          <div class="text-sm"></div>
          <div class="divider"></div>
          <div class="row gap-2 text-xs text-soft">
            <span id="msg-aud"></span>
            ${m.status === 'sent' ? `<span>· ${m.recipients} Empfänger</span>` : ''}
          </div>
        </div>
      `) as HTMLElement;
      (card.querySelector('b') as HTMLElement).textContent = m.title;
      (card.querySelector('.text-sm.text-soft') as HTMLElement).textContent = m.status === 'sent' ? `Gesendet: ${fmtDateTime(m.date)}` : `Erstellt: ${fmtDate(m.createdAt)}`;
      const bodyDiv = card.querySelectorAll('.text-sm')[1] as HTMLElement;
      bodyDiv.textContent = (m.body || '').slice(0, 200) + ((m.body || '').length > 200 ? '…' : '');
      const aud = m.audience === 'all' ? 'Alle' : m.audience === 'active' ? 'Aktive Mitglieder' : m.audience === 'warteliste' ? 'Warteliste' : m.audience === 'depot' ? 'Depot ' + (findDepot(m.depot)?.name || '') : m.audience;
      card.querySelector('#msg-aud')!.textContent = `Empfänger: ${aud}`;
      card.addEventListener('click', () => openMessageDetail(m.id));
      grid.appendChild(card);
    });
    body.appendChild(grid);
  }
  root.querySelector('#msg-new')!.addEventListener('click', () => openMessageForm());
}

export function openMessageDetail(id: string): void {
  const m = stateStore.state.messages.find(x => x.id === id);
  if (!m) return;
  const body = h(`<div class="text-sm text-soft mb-2"></div>
    <h2></h2>
    <div class="divider"></div>
    <div style="white-space:pre-wrap"></div>
  `);
  (body.querySelector('.text-sm') as HTMLElement).textContent = m.status === 'sent' ? `Gesendet: ${fmtDateTime(m.date)}` : 'Entwurf';
  (body.querySelector('h2') as HTMLElement).textContent = m.title;
  const content = body.querySelector('div[style*="white-space"]') as HTMLElement;
  content.textContent = m.body || '';
  openModal({ title: 'Mitteilung', body, footer: `<button class="btn" data-close>Schließen</button>` });
}

export function openMessageForm(): void {
  const body = h(`
    <div class="form-row"><label>Betreff *</label><input id="msg-title"/></div>
    <div class="form-grid">
      <div class="form-row"><label>Empfänger</label>
        <select id="msg-audience">
          <option value="all">Alle Mitglieder</option>
          <option value="active">Aktive Mitglieder</option>
          <option value="warteliste">Warteliste</option>
          <option value="depot">Bestimmtes Depot</option>
        </select>
      </div>
      <div class="form-row"><label>Depot</label>
        <select id="msg-depot"><option value="">—</option>${stateStore.state.depots.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select>
      </div>
    </div>
    <div class="form-row"><label>Nachricht *</label><textarea id="msg-body" rows="10" placeholder="Liebe Mitglieder, …"></textarea></div>
    <div class="row gap-2 text-sm text-soft">
      <label class="toggle"><input type="checkbox" id="msg-schedule"/><span class="toggle-slider"></span></label>
      <span>Geplant versenden</span>
      <input id="msg-when" type="datetime-local" style="margin-left:8px"/>
    </div>
  `);
  const m = openModal({ title: 'Neue Mitteilung', body, xwide: true, footer: `<button class="btn" data-cancel>Abbrechen</button><button class="btn" data-draft>Als Entwurf</button><button class="btn btn-primary" data-send>Senden</button>` });
  m.footer!.querySelector('[data-cancel]')!.addEventListener('click', () => m.close());
  m.footer!.querySelector('[data-draft]')!.addEventListener('click', () => saveMessage(m, 'draft'));
  m.footer!.querySelector('[data-send]')!.addEventListener('click', () => saveMessage(m, 'sent'));
}

function saveMessage(m: { body: HTMLElement; close: () => void }, status: 'draft' | 'sent') {
  const title = (m.body.querySelector('#msg-title') as HTMLInputElement).value.trim();
  const audience = (m.body.querySelector('#msg-audience') as HTMLSelectElement).value as MessageAudience;
  const depot = (m.body.querySelector('#msg-depot') as HTMLSelectElement).value || null;
  const body = (m.body.querySelector('#msg-body') as HTMLTextAreaElement).value;
  if (!title || !body) { toast('Betreff und Nachricht erforderlich', { kind: 'error' }); return; }
  let recipients = 0;
  if (audience === 'all') recipients = stateStore.state.members.length;
  else if (audience === 'active') recipients = stateStore.state.members.filter(x => x.status === 'aktiv').length;
  else if (audience === 'warteliste') recipients = stateStore.state.members.filter(x => x.status === 'warteliste').length;
  else if (audience === 'depot') recipients = stateStore.state.members.filter(x => x.depot === depot).length;
  stateStore.update(s => {
    s.messages.push({
      id: uid('msg'),
      title, audience, depot, body,
      status, recipients,
      createdAt: new Date().toISOString(),
      date: status === 'sent' ? new Date().toISOString() : null,
    });
  });
  m.close();
  toast(status === 'sent' ? `An ${recipients} Mitglieder gesendet` : 'Als Entwurf gespeichert', { kind: 'success' });
  document.dispatchEvent(new CustomEvent('solawios:refresh'));
}
