// Dashboard page
import { h, clear } from '../lib/dom';
import { stateStore } from '../store/state';
import { TODAY, addDays, fmtDate, monthName, isoWeek, startOfWeek } from '../lib/date';
import { fmtMoney, fmtNum } from '../lib/format';
import { icon } from '../lib/icons';
import { pageH } from '../components/ui/page-h';
import { badge } from '../components/ui/badge';
import { emptyState } from '../components/ui/empty-state';
import { drawTimeSeries } from '../components/charts/time-series';
import { drawDonut } from '../components/charts/donut';
import { activityFeed, TASK_ICON, STATUS_LABEL, counts } from './utils';

const SEASON_START = new Date(2026, 2, 15);
const SEASON_END   = new Date(2026, 11, 15);

export function render(root: HTMLElement): void {
  clear(root);

  const s = stateStore.state;
  const today = TODAY;
  const seasonDay = Math.round((today.getTime() - SEASON_START.getTime()) / 86_400_000);
  const seasonTotal = Math.round((SEASON_END.getTime() - SEASON_START.getTime()) / 86_400_000);
  const seasonPct = Math.min(100, Math.max(0, Math.round(seasonDay / seasonTotal * 100)));

  const activeMembers = s.members.filter(m => m.status === 'aktiv').length;
  const totalShares = s.shares.filter(x => x.active).reduce((sum, sh) => sum + (sh.type === 'small' ? 1 : sh.type === 'medium' ? 2 : 3), 0);
  const monthRevenue = s.payments.filter(p => p.kind === 'beitrag' && p.date && sameMonth(p.date, today)).reduce((acc, p) => acc + p.amount, 0);
  const monthExpenses = s.payments.filter(p => p.kind === 'ausgabe' && p.date && sameMonth(p.date, today)).reduce((acc, p) => acc + p.amount, 0);
  const tasksOpen = s.tasks.filter(t => t.status !== 'done').length;
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const harvestWeek = s.harvest.filter(h => h.date && new Date(h.date) >= weekStart && new Date(h.date) <= weekEnd).reduce((acc, h) => acc + h.amount, 0);
  const harvestSeason = s.harvest.reduce((acc, h) => acc + h.amount, 0);

  root.appendChild(pageH({
    title: 'Dashboard',
    desc: 'Übersicht aller Bereiche',
  }));

  // Hero
  const hero = h(`
    <div class="hero mb-4">
      <h2>Willkommen zurück, Anna</h2>
      <p>Saison-Tag ${seasonDay} von ${seasonTotal} · ${activeMembers} aktive Mitglieder · ${fmtNum(totalShares)} Ernteanteile · Wetter: sonnig 24°C</p>
    </div>
  `);
  root.appendChild(hero);

  // Stats
  const stats = h(`<div class="grid grid-5 mb-4"></div>`);
  stats.innerHTML = [
    stat('users', 'Mitglieder', activeMembers, 'trend-up', '▲ 3 seit Vormonat'),
    stat('basket', 'Ernteanteile', fmtNum(totalShares), '', `Ziel: ${s.meta.farm.members_target}`, 'accent'),
    stat('currency-eur', `Einnahmen ${monthName(today)}`, fmtMoney(monthRevenue), '', `Ausgaben: ${fmtMoney(monthExpenses)}`, 'info'),
    stat('plant', 'Ernte diese Woche', `${fmtNum(harvestWeek)} <span class="text-sm text-muted">kg</span>`, '', `Saison: ${fmtNum(harvestSeason)} kg`, 'warn'),
    stat('check-square', 'Offene Aufgaben', tasksOpen, '', `${s.tasks.filter(t => t.status === 'in_progress').length} in Arbeit`),
  ].join('');
  root.appendChild(stats);

  // Saisonverlauf + Tasks
  const row1 = h(`<div class="grid grid-2 mb-4"></div>`);
  row1.innerHTML = `
    <div class="card">
      <div class="card-h">
        <div class="card-title">Saisonverlauf</div>
        <div class="row gap-1">
          <button class="btn btn-sm btn-ghost" data-range="7">7T</button>
          <button class="btn btn-sm btn-ghost" data-range="30">30T</button>
          <button class="btn btn-sm btn-ghost" data-range="90">Saison</button>
        </div>
      </div>
      <div class="card-body">
        <div class="progress mb-3" title="${seasonPct}% der Saison"><div class="progress-bar" style="width:${seasonPct}%"></div></div>
        <canvas id="dash-harvest" style="height:200px"></canvas>
      </div>
    </div>
    <div class="card">
      <div class="card-h">
        <div class="card-title">Anstehende Aufgaben</div>
        <button class="btn btn-sm" data-goto="tasks">Alle anzeigen</button>
      </div>
      <div class="card-body" id="dash-tasks"></div>
    </div>
  `;
  root.appendChild(row1);
  drawHarvest(90);

  // Tasks list
  const dashTasks = row1.querySelector('#dash-tasks')!;
  const openTasks = s.tasks.filter(t => t.status !== 'done').sort((a, b) => (a.due || 'z').localeCompare(b.due || 'z')).slice(0, 6);
  if (openTasks.length === 0) {
    dashTasks.appendChild(emptyState('Keine offenen Aufgaben', 'Alles erledigt!', 'check-circle'));
  } else {
    const list = h('<div class="activity"></div>');
    openTasks.forEach(t => {
      const item = h(`
        <div class="activity-item">
          <div class="activity-icon">${icon(TASK_ICON[t.category])}</div>
          <div class="activity-body">
            <div><b></b> <span class="text-soft">· </span></div>
            <div class="activity-time">Fällig: · </div>
          </div>
        </div>
      `);
      (item.querySelector('b') as HTMLElement).textContent = t.title;
      (item.querySelector('.text-soft') as HTMLElement).textContent = t.assignee || '—';
      (item.querySelector('.activity-time') as HTMLElement).textContent = `Fällig: ${fmtDate(t.due)} · ${STATUS_LABEL[t.status]}`;
      list.appendChild(item);
    });
    dashTasks.appendChild(list);
  }

  // Row 2: members by share, activity, today
  const row2 = h(`<div class="grid grid-3"></div>`);
  row2.innerHTML = `
    <div class="card">
      <div class="card-h"><div class="card-title">Mitglieder nach Anteil</div></div>
      <div class="card-body"><canvas id="dash-shares" style="height:200px"></canvas></div>
    </div>
    <div class="card">
      <div class="card-h"><div class="card-title">Aktivität</div></div>
      <div class="card-body" id="dash-activity"></div>
    </div>
    <div class="card">
      <div class="card-h"><div class="card-title">Heute auf dem Hof</div></div>
      <div class="card-body" id="dash-today"></div>
    </div>
  `;
  root.appendChild(row2);
  drawShares();

  // Activity
  const dashActivity = row2.querySelector('#dash-activity')!;
  const feed = activityFeed(6);
  if (feed.length === 0) {
    dashActivity.appendChild(emptyState('Noch keine Aktivität', '', 'calendar'));
  } else {
    const list = h('<div class="activity"></div>');
    feed.forEach(f => {
      const item = h(`
        <div class="activity-item">
          <div class="activity-icon">${icon(f.icon)}</div>
          <div class="activity-body">
            <div></div>
            <div class="activity-time"></div>
          </div>
        </div>
      `);
      (item.querySelector('.activity-body > div:first-child') as HTMLElement).textContent = f.text;
      (item.querySelector('.activity-time') as HTMLElement).textContent = f.date.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
      list.appendChild(item);
    });
    dashActivity.appendChild(list);
  }

  // Today
  const dashToday = row2.querySelector('#dash-today')!;
  const kw = isoWeek(today);
  const weekHarvest = s.harvest.filter(h => h.date && new Date(h.date) >= weekStart && new Date(h.date) <= weekEnd);
  dashToday.innerHTML = `
    <div class="col gap-2">
      <div class="row gap-2">${badge(`KW ${kw.week}`, 'info')}<span class="text-sm text-soft">${fmtDate(today)}</span></div>
      <div class="text-sm"><b>${s.harvest.filter(h => h.date && sameDay(h.date, today)).length}</b> Erträge heute · <b>${fmtNum(weekHarvest.reduce((a, h) => a + h.amount, 0))} kg</b> diese Woche</div>
      <div class="text-sm"><b>${s.tasks.filter(t => t.due && sameDay(t.due, today)).length}</b> Aufgaben fällig</div>
      <div class="text-sm"><b>${s.events.filter((e: any) => e.date && sameDay(e.date, today)).length}</b> Termine heute</div>
      <div class="text-sm"><b>${s.orders.filter(o => o.delivery && sameDay(o.delivery, today)).length}</b> Zusatzlieferungen</div>
      <div class="divider"></div>
      <div class="text-xs text-muted">Nächste Verteilung: ${fmtDate(NEXT_FRIDAY())}</div>
    </div>
  `;

  // Wire up
  row1.querySelectorAll('[data-range]').forEach(b => {
    b.addEventListener('click', () => {
      row1.querySelectorAll('[data-range]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      const r = (b as HTMLElement).dataset.range;
      drawHarvest(r === '7' ? 7 : r === '30' ? 30 : 90);
    });
  });
  row1.querySelector('[data-range="90"]')!.classList.add('active');
  row1.querySelector('[data-goto="tasks"]')!.addEventListener('click', () => location.hash = '#tasks');

  function drawHarvest(days: number) {
    const canvas = root.querySelector('#dash-harvest') as HTMLCanvasElement;
    if (!canvas) return;
    const start = addDays(today, -days);
    const dates: Date[] = [];
    const values: number[] = [];
    for (let i = 0; i < days; i++) {
      const d = addDays(start, i);
      dates.push(d);
      const v = s.harvest.filter(h => h.date && sameDay(h.date, d)).reduce((a, h) => a + h.amount, 0);
      values.push(v);
    }
    canvas.height = 200;
    drawTimeSeries(canvas, dates, values);
  }

  function drawShares() {
    const canvas = root.querySelector('#dash-shares') as HTMLCanvasElement;
    if (!canvas) return;
    const c = counts();
    drawDonut(canvas, [
      { label: `Klein (${c.small})`, value: c.small, color: '#3a6e8a' },
      { label: `Mittel (${c.medium})`, value: c.medium, color: '#4a7c3a' },
      { label: `Groß (${c.large})`, value: c.large, color: '#c97a3a' },
    ]);
  }
}

function sameMonth(d: string | Date, ref: Date): boolean {
  const x = new Date(d);
  return x.getFullYear() === ref.getFullYear() && x.getMonth() === ref.getMonth();
}
function sameDay(a: string | Date, b: Date): boolean {
  return new Date(a).toDateString() === b.toDateString();
}
function NEXT_FRIDAY(): Date {
  const d = new Date(TODAY);
  while (d.getDay() !== 5) d.setDate(d.getDate() + 1);
  return d;
}

function stat(iconName: string, label: string, value: string | number, trend: '' | 'trend-up' | 'trend-down', sub: string, kind: '' | 'accent' | 'warn' | 'info' | 'danger' = ''): string {
  return `<div class="stat ${kind}">
    <div class="stat-icon">${icon(iconName)}</div>
    <div class="stat-label">${label}</div>
    <div class="stat-value">${value}</div>
    <div class="stat-trend ${trend}">${sub}</div>
  </div>`;
}
