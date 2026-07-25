/**
 * i18n runtime (docs/30-i18n-und-lokalisierung.md).
 *
 * Rules enforced here:
 *  - German is the source locale; missing translations fall back to it, never to blank.
 *  - Keys are semantic and namespaced, never the German text itself.
 *  - Interpolation uses named placeholders; no string concatenation anywhere.
 *  - Plurals use explicit CLDR categories, because `if (n === 1)` is a bug in
 *    most of the world's languages.
 */

export type Catalog = Record<string, string | PluralForms>;

export interface PluralForms {
  zero?: string; one?: string; two?: string; few?: string; many?: string; other: string;
}

export const SOURCE_LOCALE = 'de';

export class Translator {
  private readonly catalogs = new Map<string, Catalog>();
  private readonly missing = new Set<string>();

  constructor(catalogs: Record<string, Catalog> = {}) {
    for (const [locale, cat] of Object.entries(catalogs)) this.catalogs.set(locale, cat);
  }

  add(locale: string, catalog: Catalog): void {
    this.catalogs.set(locale, { ...(this.catalogs.get(locale) ?? {}), ...catalog });
  }

  has(locale: string): boolean { return this.catalogs.has(locale); }

  locales(): string[] { return [...this.catalogs.keys()]; }

  /**
   * Translate. `vars.count` selects a plural form when the entry has one.
   * Falls back: requested locale → base language → source locale → the key itself.
   */
  t(locale: string, key: string, vars: Record<string, string | number> = {}): string {
    const entry = this.lookup(locale, key);
    if (entry === undefined) {
      this.missing.add(`${locale}:${key}`);
      return key;
    }
    const template = typeof entry === 'string'
      ? entry
      : selectPlural(entry, locale, Number(vars.count ?? 0));
    return interpolate(template, vars);
  }

  private lookup(locale: string, key: string): string | PluralForms | undefined {
    const chain = [locale, locale.split('-')[0] ?? locale, SOURCE_LOCALE];
    for (const loc of chain) {
      const hit = this.catalogs.get(loc)?.[key];
      if (hit !== undefined) return hit;
    }
    return undefined;
  }

  /** Keys requested but not found — surfaced in the admin UI, not swallowed. */
  missingKeys(): string[] { return [...this.missing].sort(); }

  /** Translation completeness against the source locale, for the language picker. */
  completeness(locale: string): number {
    const source = this.catalogs.get(SOURCE_LOCALE);
    const target = this.catalogs.get(locale);
    if (!source || !target) return 0;
    const keys = Object.keys(source);
    if (keys.length === 0) return 1;
    const present = keys.filter((k) => target[k] !== undefined).length;
    return present / keys.length;
  }
}

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole,
  );
}

function selectPlural(forms: PluralForms, locale: string, count: number): string {
  const category = pluralCategory(locale, count);
  return forms[category] ?? forms.other;
}

/**
 * Minimal CLDR plural selection. Uses Intl.PluralRules where available so we get
 * correct behaviour for Polish, Arabic, Russian etc. without shipping tables.
 */
function pluralCategory(locale: string, count: number): keyof PluralForms {
  try {
    const rules = new Intl.PluralRules(locale);
    return rules.select(count) as keyof PluralForms;
  } catch {
    return count === 1 ? 'one' : 'other';
  }
}

/** Formatting helpers — always Intl, never hand-rolled (docs/30 §6). */
export const fmt = {
  date(locale: string, value: Date | string, timeZone = 'Europe/Berlin'): string {
    const d = typeof value === 'string' ? new Date(value) : value;
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone }).format(d);
  },
  dateTime(locale: string, value: Date | string, timeZone = 'Europe/Berlin'): string {
    const d = typeof value === 'string' ? new Date(value) : value;
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(d);
  },
  number(locale: string, value: number, digits = 0): string {
    return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  },
  currency(locale: string, value: number, currency = 'EUR'): string {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
  },
  /**
   * Quantities. Solawi reality is "3 Bund Radieschen", not "0.4 kg", so units are
   * domain values with their own translations rather than Intl units.
   */
  quantity(locale: string, t: Translator, value: number, unit: string): string {
    const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
    return `${n} ${t.t(locale, `unit.${unit}`, { count: value })}`;
  },
};

/** ISO week number — critical for cultivation planning, and not in Intl. */
export function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}
