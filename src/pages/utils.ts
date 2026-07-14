// Shared page utilities
import { h } from '../lib/dom';
import { stateStore, findMember, findDepot, findBed, findCrop, activeShare, shareLabel } from '../store/state';
import { addDays, fmtDate, isoWeek, TODAY } from '../lib/date';
import { fmtMoney } from '../lib/format';
import { esc } from '../lib/dom';
import { icon } from '../lib/icons';
import { CROP_PALETTE } from '../data/seed';
import type { Member, Payment, Pickup, Share, State, Task, TaskCategory, Harvest } from '../types';

export const NEXT_FRIDAY = (): Date => {
  const d = new Date(TODAY);
  while (d.getDay() !== 5) d.setDate(d.getDate() + 1);
  return d;
};

export { stateStore, findMember, findDepot, findBed, findCrop, activeShare, shareLabel };

/** Convert the state into a flat list of recent activity items. */
export function activityFeed(limit = 10): Array<{ date: Date; icon: string; text: string }> {
  const items: Array<{ date: Date; icon: string; text: string }> = [];
  const s = stateStore.state;
  s.payments.filter(p => p.date).forEach(p => items.push({
    date: new Date(p.date),
    icon: p.kind === 'beitrag' ? 'currency-eur' : p.kind === 'ausgabe' ? 'receipt' : 'tag',
    text: `${p.kind === 'beitrag' ? 'Beitrag' : p.kind === 'ausgabe' ? 'Ausgabe' : 'Buchung'} ${p.name ? '· ' + p.name : ''} ${fmtMoney(p.amount)}`,
  }));
  s.harvest.filter(h => h.date).forEach(h => {
    const c = findCrop(h.crop);
    items.push({ date: new Date(h.date), icon: 'plant', text: `Ernte ${c?.name ?? ''} · ${h.amount} ${h.unit}` });
  });
  s.tasks.filter(t => t.status === 'done' && t.doneAt).forEach(t =>
    items.push({ date: new Date(t.doneAt!), icon: 'check-square', text: `Erledigt: ${t.title}` }));
  s.messages.filter((m): m is typeof m & { date: string } => Boolean(m.date)).forEach(m =>
    items.push({ date: new Date(m.date), icon: 'envelope-simple', text: `Mitteilung: ${m.title}` }));
  return items.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, limit);
}

export { fmtDate, fmtMoney, addDays, isoWeek, TODAY };
export type { Member, Payment, Pickup, Share, State, Task, TaskCategory, Harvest };

export const TASK_ICON: Record<TaskCategory, string> = {
  Aussaat: 'plant', Pflanzung: 'plant', Pflege: 'scissors',
  Ernte: 'basket', Verteilung: 'truck',
  Infrastruktur: 'wrench', Verwaltung: 'clipboard-text',
};

export const STATUS_LABEL: Record<Task['status'], string> = {
  backlog: 'Backlog', todo: 'Geplant', in_progress: 'In Arbeit', done: 'Erledigt',
};

export const STATUS_TONE: Record<Task['status'], 'primary' | 'warn' | 'info' | 'neutral'> = {
  done: 'primary', in_progress: 'warn', todo: 'info', backlog: 'neutral',
};

export const HARVEST_QUALITY_TONE: Record<Harvest['quality'], 'primary' | 'warn' | 'neutral'> = {
  A: 'primary', B: 'warn', C: 'neutral',
};

export { CROP_PALETTE };
export { esc, icon };
export { h };

/** Counts of active shares by type. */
export function counts(): { small: number; medium: number; large: number } {
  const c = { small: 0, medium: 0, large: 0 };
  stateStore.state.shares.filter(s => s.active).forEach(s => { c[s.type]++; });
  return c;
}
