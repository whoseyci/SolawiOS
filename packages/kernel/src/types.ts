import type { Platform, Store, SqlValue } from '@solawi/platform';

/** Stable identifier for a farm (tenant). */
export type OrgId = string;
/** Stable identifier for a person (login-capable human). */
export type PersonId = string;

/**
 * Roles are coarse. Fine-grained permission lives in capabilities declared by
 * modules, so a farm can grant "may see bid amounts" without granting "admin".
 */
export type Role =
  | 'owner'        // founded the instance; can transfer ownership
  | 'admin'        // organisational lead
  | 'finance'      // may read individual bid amounts and payment data (ADR-0005)
  | 'grower'       // gardener / farm staff
  | 'depot'        // depot caretaker
  | 'member'       // ordinary member household contact
  | 'guest';       // read-only, e.g. prospective member

export const ALL_ROLES: readonly Role[] = [
  'owner', 'admin', 'finance', 'grower', 'depot', 'member', 'guest',
] as const;

/** Lifecycle phase of a farm. Drives which modules are suggested, never enforced. */
export type Phase = 'founding' | 'operating' | 'developing';

/**
 * An event is something that happened, in the past tense, that other modules
 * may legitimately care about. Internal state changes are NOT events.
 */
export interface DomainEvent<T = unknown> {
  /** e.g. "harvest.recorded" */
  readonly type: string;
  readonly orgId: OrgId;
  readonly at: string; // ISO-8601
  readonly payload: T;
  /** Module that emitted it, for tracing. */
  readonly source: string;
}

export type EventHandler = (event: DomainEvent) => Promise<void> | void;

/**
 * A capability is a synchronous question one module asks of another, brokered by
 * the kernel. If the provider is disabled the kernel returns the declared empty
 * value — never an error. This is what makes modules independently disableable.
 */
export interface CapabilityDefinition<Args extends unknown[] = unknown[], R = unknown> {
  readonly name: string;
  /** Value returned when no module provides this capability. */
  readonly whenAbsent: R;
}

export interface ModuleContext {
  readonly orgId: OrgId;
  readonly platform: Platform;
  readonly store: Store;
  /** Emit an event. Fire-and-forget from the caller's perspective. */
  emit(type: string, payload: unknown): Promise<void>;
  /** Ask another module a question, safely. */
  ask<R>(capability: string, ...args: unknown[]): Promise<R>;
  /** Translate a key in the org's locale. */
  t(key: string, vars?: Record<string, string | number>): string;
  readonly log: Logger;
}

export interface Logger {
  debug(msg: string, data?: Record<string, unknown>): void;
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
}

/** A database migration owned by a module. Applied in order, once per org. */
export interface Migration {
  /** Monotonic within a module, e.g. 1, 2, 3. */
  readonly version: number;
  readonly description: string;
  /** SQLite DDL/DML. Runs inside the module's own table namespace. */
  readonly statements: string[];
}

/** Maturity, mirrored from docs/10-modulkatalog.md. Keep honest. */
export type Maturity = 'idea' | 'spec' | 'alpha' | 'stable';

export interface ModuleManifest {
  /** Stable machine name, e.g. "cultivation". Also the table prefix. */
  readonly id: string;
  /** Catalogue number from docs/10-modulkatalog.md. */
  readonly number: number;
  readonly maturity: Maturity;
  /**
   * Modules this one needs to be *useful*. The system still boots without them;
   * capabilities degrade to their empty values. Used to drive suggestions, not
   * to block activation.
   */
  readonly suggests?: readonly string[];
  /** Phases in which this module is normally relevant. */
  readonly phases: readonly Phase[];
  /** Capabilities this module provides to others. */
  readonly provides?: readonly string[];
  readonly migrations: readonly Migration[];
}

export interface SolawiModule {
  readonly manifest: ModuleManifest;
  /** Register event handlers and capability providers. Called once at boot. */
  register?(reg: ModuleRegistrar): void;
}

export interface ModuleRegistrar {
  on(eventType: string, handler: EventHandler): void;
  provide(capability: string, impl: (ctx: ModuleContext, ...args: never[]) => Promise<unknown>): void;
}

export type { Platform, Store, SqlValue };
