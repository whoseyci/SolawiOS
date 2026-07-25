import { get } from './api.js';

/**
 * Session context, fetched once per boot and shared by every screen.
 *
 * This replaces the `solawi.household` localStorage value the earlier build
 * expected but never set — which is why neighbour discovery and bidding
 * silently did nothing. Now the server answers "who am I, here?" and the UI
 * can act on it.
 */
export interface Ctx {
  person: { id: string; email: string; displayName: string };
  org: { id: string; slug: string; name: string; phase: string; locale: string } | null;
  roles: string[];
  modules: string[];
  household: { id: string; name: string; discoverable: boolean } | null;
  openRound: { id: string; season: string; richtwertCents: number } | null;
}

let cached: Ctx | null = null;

export async function loadCtx(force = false): Promise<Ctx> {
  if (cached && !force) return cached;
  const { data } = await get<Ctx>('/api/me/context');
  cached = data;
  return data;
}

export function ctx(): Ctx {
  if (!cached) throw new Error('context not loaded');
  return cached;
}

export function invalidateCtx(): void { cached = null; }

/** Roles imply one another server-side; mirror the important ones here. */
export function can(role: string): boolean {
  const roles = cached?.roles ?? [];
  if (roles.includes('owner')) return true;
  if (roles.includes('admin')) return role !== 'finance' || roles.includes('finance');
  return roles.includes(role);
}

export function hasModule(id: string): boolean {
  return cached?.modules.includes(id) ?? false;
}
