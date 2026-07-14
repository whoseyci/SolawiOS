// Singleton state container with subscribers. Pattern: tiny redux-style store.
import { Emitter } from '../lib/events';
import { Store } from '../lib/store';
import { seedSampleData } from './seed-data';
import { TODAY } from '../lib/date';
import type { State, ShareType } from '../types';

class StateStore extends Emitter<{ change: void }> {
  private _state: State;

  constructor() {
    super();
    const loaded = Store.load();
    if (loaded) {
      this._state = loaded;
    } else {
      this._state = seedSampleData(2026, TODAY);
      Store.save(this._state);
      Store.markSeeded();
    }
  }

  get state(): State { return this._state; }
  get current(): State { return this._state; }

  /** Apply a mutator function and persist. */
  update(mutator: (s: State) => State | void): void {
    const draft = JSON.parse(JSON.stringify(this._state)) as State;
    const result = mutator(draft);
    this._state = (result ?? draft) as State;
    Store.save(this._state);
    this.emit('change', undefined);
  }

  /** Replace the whole state. */
  set(next: State): void {
    this._state = next;
    Store.save(this._state);
    this.emit('change', undefined);
  }

  reset(): void {
    Store.reset();
    this._state = seedSampleData(2026, TODAY);
    Store.save(this._state);
    Store.markSeeded();
    this.emit('change', undefined);
  }
}

export const stateStore = new StateStore();

/* ----------- Selectors (typed lookups) ----------- */

export const findMember = (id: string | null | undefined) =>
  id ? stateStore.state.members.find(m => m.id === id) ?? null : null;

export const findCrop = (id: string | null | undefined) =>
  id ? stateStore.state.crops.find(c => c.id === id) ?? null : null;

export const findBed = (id: string | null | undefined) =>
  id ? stateStore.state.beds.find(b => b.id === id) ?? null : null;

export const findDepot = (id: string | null | undefined) =>
  id ? stateStore.state.depots.find(d => d.id === id) ?? null : null;

export const activeShare = (memberId: string) =>
  stateStore.state.shares.find(s => s.member === memberId && s.active) ?? null;

export const shareLabel = (type: ShareType): string =>
  ({ small: 'Klein', medium: 'Mittel', large: 'Groß' }[type]);
