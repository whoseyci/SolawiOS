// Number / currency / string formatters

const LOCALE = 'de-DE';
const CURRENCY = 'EUR';

export const fmtMoney = (v: number | null | undefined): string =>
  new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY }).format(v ?? 0);

export const fmtNum = (v: number | null | undefined, decimals = 1): string =>
  new Intl.NumberFormat(LOCALE, { maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(v ?? 0);

export const fmtInt = (v: number | null | undefined): string =>
  new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }).format(v ?? 0);

export const fmtPct = (v: number | null | undefined, decimals = 0): string =>
  `${(v ?? 0).toFixed(decimals)}%`;

/** Title-case for status, categories, etc. */
export const titleCase = (s: string): string =>
  s ? s[0].toUpperCase() + s.slice(1) : s;

/** Truncate a string with ellipsis. */
export const truncate = (s: string, n: number): string =>
  s.length > n ? s.slice(0, n - 1) + '…' : s;

/** Initials from a name. */
export const initials = (name: string, max = 2): string =>
  name.split(/\s+/).filter(Boolean).map(p => p[0]).slice(0, max).join('').toUpperCase();
