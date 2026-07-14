// Tasks page
import { h, clear, esc } from '../lib/dom';
import { icon } from '../lib/icons';
import { stateStore, fmtDate, STATUS_LABEL, STATUS_TONE, TASK_ICON } from './utils';
import { pageH } from '../components/ui/page-h';
import { openModal, confirmDialog } from '../components/ui/modal';
import { toast } from '../components/ui/toast';
import { badge } from '../components/ui/badge';
import { uid } from '../lib/uid';
import type { Task } from '../types';

let currentView: 'kanban' | 'list' | 'cal' = 'kanban';

export function render(root: HTMLElement): void {
  clear(root);
  const s = stateStore.state;
  const open = s.tasks.filter(t => t.status !== 'done').length;
  root.appendChild(pageH({
    title: 'Aufgaben',
    desc: `${open} offen · ${s.tasks.length} gesamt`,
    actions: `<div class="btn-group">
                 <button class="btn ${currentView === 'kanban' ? 'active' : ''}" data-view="kanban">Kanban</button>
                 <button class="btn ${currentView === 'list' ? 'active' : ''}" data-view="list">Liste</button>
                 <button class="btn ${currentView === 'cal' ? 'active' : ''}" data-view="cal">Kalender</button>
               </div>
               <button class="btn btn-primary" id="task-new">${icon('plus')} Aufgabe</button>`,
  }));
  const body = h('<div id="tasks-body"></div>');
  root.appendChild(body);
  if (currentView === 'kanban') tasksKanban(body);
  if (currentView === 'list') tasksList(body);
  if (currentView === 'cal') tasksCal(body);
  root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b => b.addEventListener('click', () => {
    currentView = b.dataset.view as typeof currentView;
    render(root);
  }));
  root.querySelector('#task-new')!.addEventListener('click', () => openTaskForm());
}

const COLS: Array<{ id: Task['status']; title: string }> = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'todo', title: 'Geplant' },
  { id: 'in_progress', title: 'In Arbeit' },
  { id: 'done', title: 'Erledigt' },
];

function tasksKanban(body: HTMLElement) {
  const board = h('<div class="kanban"></div>');
  COLS.forEach(c => {
    const items = stateStore.state.tasks.filter(t => t.status === c.id);
    const col = h(`
      <div class="kanban-col" data-col="${c.id}">
        <div class="kanban-col-h">${c.title} <span class="count">${items.length}</span></div>
      </div>
    `) as HTMLElement;
    items.forEach(t => {
      const card = h(`
        <div class="kanban-card" draggable="true" data-id="${t.id}">
          <div class="kanban-card-title"></div>
          <div class="kanban-card-meta">
            <span>${icon(TASK_ICON[t.category])}</span>
            <span></span>
            <div class="grow"></div>
            <span></span>
          </div>
          ${t.priority === 'high' ? '<div class="kanban-card-tags"><span class="badge badge-danger">Hoch</span></div>' : t.priority === 'low' ? '<div class="kanban-card-tags"><span class="badge badge-neutral">Niedrig</span></div>' : ''}
        </div>
      `) as HTMLElement;
      (card.querySelector('.kanban-card-title') as HTMLElement).textContent = t.title;
      const meta = card.querySelectorAll<HTMLElement>('.kanban-card-meta > span');
      if (meta[1]) meta[1].textContent = t.assignee || '—';
      if (meta[2]) meta[2].textContent = t.due ? fmtDate(t.due) : '—';
      card.addEventListener('dragstart', e => {
        e.dataTransfer!.effectAllowed = 'move';
        e.dataTransfer!.setData('text/plain', t.id);
      });
      card.addEventListener('dblclick', () => openTaskForm(t.id));
      col.appendChild(card);
    });
    col.addEventListener('dragover', e => { e.preventDefault(); col.style.background = 'var(--primary-soft)'; });
    col.addEventListener('dragleave', () => { col.style.background = ''; });
    col.addEventListener('drop', e => {
      e.preventDefault();
      col.style.background = '';
      const id = e.dataTransfer!.getData('text/plain');
      stateStore.update(s => {
        const t = s.tasks.find(x => x.id === id);
        if (t) { t.status = c.id; t.doneAt = c.id === 'done' ? new Date().toISOString() : null; }
      });
      toast('Status aktualisiert');
      document.dispatchEvent(new CustomEvent('solawios:refresh'));
    });
    board.appendChild(col);
  });
  body.appendChild(board);
}

function tasksList(body: HTMLElement) {
  const sorted = stateStore.state.tasks.slice().sort((a, b) => (a.due || 'z').localeCompare(b.due || 'z'));
  body.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Titel</th><th>Kategorie</th><th>Zuordnung</th><th>Priorität</th><th>Fällig</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${sorted.map(t => `<tr data-id="${t.id}">
            <td><b></b>${t.description ? `<div class="text-sm text-soft">${esc(t.description.slice(0,80))}</div>` : ''}</td>
            <td>${icon(TASK_ICON[t.category])} ${t.category}</td>
            <td>${t.assignee || '—'}</td>
            <td>${t.priority === 'high' ? badge('Hoch', 'danger') : t.priority === 'low' ? badge('Niedrig', 'neutral') : badge('Mittel', 'warn')}</td>
            <td>${fmtDate(t.due)}</td>
            <td>${badge(STATUS_LABEL[t.status], STATUS_TONE[t.status])}</td>
            <td class="text-right"><button class="btn btn-sm btn-danger" data-del="${t.id}">${icon('x')}</button></td>
          </tr>`).join('') || '<tr><td colspan="7" class="table-empty">Keine Aufgaben</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
  body.querySelectorAll<HTMLElement>('tr[data-id]').forEach(row => {
    const id = row.dataset.id!;
    (row.querySelector('b') as HTMLElement).textContent = stateStore.state.tasks.find(x => x.id === id)!.title;
    row.addEventListener('click', e => { if (!(e.target as HTMLElement).closest('[data-del]')) openTaskForm(id); });
  });
  body.querySelectorAll<HTMLButtonElement>('[data-del]').forEach(b => b.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (await confirmDialog({ message: 'Aufgabe löschen?', okClass: 'btn-danger' })) {
      stateStore.update(s => { s.tasks = s.tasks.filter(t => t.id !== b.dataset.del); });
      toast('Gelöscht');
      document.dispatchEvent(new CustomEvent('solawios:refresh'));
    }
  }));
}

function tasksCal(body: HTMLElement) {
  const year = stateStore.state.meta.season;
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const totalDays = (yearEnd.getTime() - yearStart.getTime()) / 86_400_000;
  const months = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  const items = stateStore.state.tasks.filter((t): t is Task & { due: string } => Boolean(t.due)).map(t => {
    const start = new Date(t.due);
    return { id: t.id, label: t.title, start, color: t.priority === 'high' ? 'var(--danger)' : t.status === 'done' ? 'var(--ink-muted)' : 'var(--primary)' };
  });
  body.innerHTML = `
    <div class="card" style="overflow:auto">
      <div class="gantt-row" style="background:var(--bg-soft);font-size:11px;font-weight:600;color:var(--ink-soft)">
        <div class="gantt-label">Aufgabe</div>
        <div class="gantt-months" style="grid-template-columns:repeat(12,1fr)">${months.map(m => `<div class="gantt-month">${m}</div>`).join('')}</div>
      </div>
      ${items.length ? items.map(it => {
        const leftPct = Math.max(0, (it.start.getTime() - yearStart.getTime()) / totalDays * 100);
        return `<div class="gantt-row">
          <div class="gantt-label">${esc(it.label)}</div>
          <div class="gantt-track" style="position:relative">
            <div class="gantt-grid" style="grid-template-columns:repeat(12,1fr)">${Array(12).fill(0).map(() => '<div></div>').join('')}</div>
            <div class="gantt-bar" style="left:${leftPct}%;width:1.5%;background:${it.color}" title="${fmtDate(it.start)}"></div>
          </div>
        </div>`;
      }).join('') : '<div class="empty-state"><div class="icon">📅</div><h3>Keine Aufgaben mit Datum</h3></div>'}
    </div>
  `;
}

export function openTaskForm(id: string | null = null): void {
  const t = id ? stateStore.state.tasks.find(x => x.id === id) : null;
  const body = h(`
    <div class="form-row"><label>Titel *</label><input id="t-title"/></div>
    <div class="form-row"><label>Beschreibung</label><textarea id="t-desc" rows="3"></textarea></div>
    <div class="form-grid-3">
      <div class="form-row"><label>Kategorie</label>
        <select id="t-cat">
          <option value="Aussaat">Aussaat</option>
          <option value="Pflanzung">Pflanzung</option>
          <option value="Pflege">Pflege</option>
          <option value="Ernte">Ernte</option>
          <option value="Verteilung">Verteilung</option>
          <option value="Infrastruktur">Infrastruktur</option>
          <option value="Verwaltung">Verwaltung</option>
        </select>
      </div>
      <div class="form-row"><label>Priorität</label>
        <select id="t-prio">
          <option value="low">Niedrig</option>
          <option value="medium" selected>Mittel</option>
          <option value="high">Hoch</option>
        </select>
      </div>
      <div class="form-row"><label>Status</label>
        <select id="t-status">
          <option value="backlog">Backlog</option>
          <option value="todo">Geplant</option>
          <option value="in_progress">In Arbeit</option>
          <option value="done">Erledigt</option>
        </select>
      </div>
    </div>
    <div class="form-grid-3">
      <div class="form-row"><label>Fällig am</label><input id="t-due" type="date"/></div>
      <div class="form-row"><label>Zuständig</label><input id="t-assignee"/></div>
      <div class="form-row"><label>Aufwand (Std.)</label><input id="t-hours" type="number" step="0.25"/></div>
    </div>
    <div class="form-row"><label>Schlagworte (Komma-getrennt)</label><input id="t-tags"/></div>
  `);
  if (t) {
    (body.querySelector('#t-title') as HTMLInputElement).value = t.title;
    (body.querySelector('#t-desc') as HTMLTextAreaElement).value = t.description || '';
    (body.querySelector('#t-cat') as HTMLSelectElement).value = t.category || 'Pflege';
    (body.querySelector('#t-prio') as HTMLSelectElement).value = t.priority || 'medium';
    (body.querySelector('#t-status') as HTMLSelectElement).value = t.status || 'todo';
    (body.querySelector('#t-due') as HTMLInputElement).value = t.due || '';
    (body.querySelector('#t-assignee') as HTMLInputElement).value = t.assignee || '';
    (body.querySelector('#t-hours') as HTMLInputElement).value = String(t.hours || '');
    (body.querySelector('#t-tags') as HTMLInputElement).value = (t.tags || []).join(', ');
  }
  const m = openModal({ title: t ? 'Aufgabe bearbeiten' : 'Neue Aufgabe', body, wide: true, footer: `<button class="btn" data-cancel>Abbrechen</button><button class="btn btn-primary" data-save>Speichern</button>` });
  m.footer!.querySelector('[data-cancel]')!.addEventListener('click', () => m.close());
  m.footer!.querySelector('[data-save]')!.addEventListener('click', () => {
    const data: Partial<Task> = {
      title: (body.querySelector('#t-title') as HTMLInputElement).value.trim(),
      description: (body.querySelector('#t-desc') as HTMLTextAreaElement).value,
      category: (body.querySelector('#t-cat') as HTMLSelectElement).value as Task['category'],
      priority: (body.querySelector('#t-prio') as HTMLSelectElement).value as Task['priority'],
      status: (body.querySelector('#t-status') as HTMLSelectElement).value as Task['status'],
      due: (body.querySelector('#t-due') as HTMLInputElement).value || null,
      assignee: (body.querySelector('#t-assignee') as HTMLInputElement).value,
      hours: Number((body.querySelector('#t-hours') as HTMLInputElement).value) || 0,
      tags: (body.querySelector('#t-tags') as HTMLInputElement).value.split(',').map(s => s.trim()).filter(Boolean),
    };
    if (!data.title) { toast('Titel erforderlich', { kind: 'error' }); return; }
    if (t) {
      stateStore.update(() => { Object.assign(t, data); if (t.status === 'done') t.doneAt = new Date().toISOString(); });
    } else {
      stateStore.update(s => { s.tasks.push({ id: uid('t'), ...data, createdAt: new Date().toISOString(), doneAt: data.status === 'done' ? new Date().toISOString() : null } as Task); });
    }
    m.close();
    toast('Aufgabe gespeichert', { kind: 'success' });
    document.dispatchEvent(new CustomEvent('solawios:refresh'));
  });
}
