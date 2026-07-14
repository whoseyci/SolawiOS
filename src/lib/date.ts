// Date utilities

const LOCALE = 'de-DE';

const monthNames = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** Today, used for "current date" in the demo. */
export const TODAY = new Date('2026-07-14T08:00:00');

export const toDate = (d: string | Date | null | undefined): Date | null =>
  d == null ? null : (d instanceof Date ? d : new Date(d));

export const addDays = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const daysBetween = (a: Date | string, b: Date | string): number =>
  Math.round((toDate(b)!.getTime() - toDate(a)!.getTime()) / 86_400_000);

export const sameDay = (a: Date | string, b: Date | string): boolean =>
  toDate(a)!.toDateString() === toDate(b)!.toDateString();

export const sameMonth = (a: Date | string, b: Date | string): boolean => {
  const x = toDate(a)!, y = toDate(b)!;
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth();
};

export const startOfWeek = (d: Date): Date => {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const fmtDate = (d: string | Date | null | undefined): string =>
  d ? new Date(d).toLocaleDateString(LOCALE, { year: 'numeric', month: 'short', day: '2-digit' }) : '—';

export const fmtDateTime = (d: string | Date | null | undefined): string =>
  d ? new Date(d).toLocaleString(LOCALE, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

export const fmtDay = (d: Date): string => dayNames[d.getDay()];

export const monthName = (d: Date | string): string => monthNames[toDate(d)!.getMonth()];

export const monthShort = (d: Date | string): string => monthNames[toDate(d)!.getMonth()].slice(0, 3);

export interface IsoWeek { week: number; year: number; }

export const isoWeek = (d: Date | string): IsoWeek => {
  const x = new Date(Date.UTC(toDate(d)!.getFullYear(), toDate(d)!.getMonth(), toDate(d)!.getDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return { week: Math.ceil((((x.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7), year: x.getUTCFullYear() };
};
