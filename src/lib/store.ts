// localStorage wrapper with JSON serialization
import type { State } from '../types';

const STORAGE_KEY = 'solawios_v1';
const SEEDED_KEY = 'solawios_seeded_v1';

export const Store = {
  load(): State | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as State) : null;
    } catch { return null; }
  },

  save(state: State): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Store.save failed:', e);
    }
  },

  reset(): void {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SEEDED_KEY);
  },

  isSeeded(): boolean {
    return localStorage.getItem(SEEDED_KEY) === '1';
  },

  markSeeded(): void {
    localStorage.setItem(SEEDED_KEY, '1');
  },
};
