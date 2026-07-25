import type {
  SolawiModule, ModuleContext, EventHandler, DomainEvent, OrgId, Logger,
} from './types.js';
import type { Platform } from '@solawi/platform';

/**
 * The module registry: the only thing that knows about all modules at once.
 *
 * Enforces the central architectural rule (AGENTS.md §3.2): modules never import
 * each other. They talk through events (async, fire-and-forget) and capabilities
 * (sync, brokered, degrade to an empty value when the provider is off).
 */
export class Registry {
  private readonly modules = new Map<string, SolawiModule>();
  private readonly handlers = new Map<string, Array<{ moduleId: string; fn: EventHandler }>>();
  private readonly providers = new Map<string, { moduleId: string; fn: CapabilityImpl }>();
  private readonly emptyValues = new Map<string, unknown>();

  constructor(private readonly platform: Platform, private readonly log: Logger) {}

  /** Register a module. Idempotent per id. */
  add(mod: SolawiModule): void {
    const id = mod.manifest.id;
    if (this.modules.has(id)) throw new Error(`Duplicate module id: ${id}`);
    this.modules.set(id, mod);

    mod.register?.({
      on: (eventType, handler) => {
        const list = this.handlers.get(eventType) ?? [];
        list.push({ moduleId: id, fn: handler });
        this.handlers.set(eventType, list);
      },
      provide: (capability, impl) => {
        const existing = this.providers.get(capability);
        if (existing) {
          throw new Error(
            `Capability "${capability}" already provided by "${existing.moduleId}"; ` +
            `"${id}" cannot provide it too.`,
          );
        }
        this.providers.set(capability, { moduleId: id, fn: impl as CapabilityImpl });
      },
    });
  }

  /** Declare the value a capability returns when nobody provides it. */
  declareEmpty(capability: string, value: unknown): void {
    this.emptyValues.set(capability, value);
  }

  list(): SolawiModule[] {
    return [...this.modules.values()].sort((a, b) => a.manifest.number - b.manifest.number);
  }

  get(id: string): SolawiModule | undefined {
    return this.modules.get(id);
  }

  /**
   * Dispatch an event to every handler whose module is enabled for this org.
   *
   * Handler failures are logged and swallowed: one module breaking must never
   * roll back another module's work or fail the user's request.
   */
  async dispatch(event: DomainEvent, enabled: ReadonlySet<string>): Promise<void> {
    const list = this.handlers.get(event.type) ?? [];
    for (const { moduleId, fn } of list) {
      if (!enabled.has(moduleId)) continue;
      try {
        await fn(event);
      } catch (err) {
        this.log.error('event handler failed', {
          event: event.type, module: moduleId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  /**
   * Invoke a capability. Returns the declared empty value when the provider is
   * absent or disabled, so callers never need to handle "module missing".
   */
  async ask<R>(
    capability: string,
    ctx: ModuleContext,
    enabled: ReadonlySet<string>,
    args: unknown[],
  ): Promise<R> {
    const provider = this.providers.get(capability);
    if (!provider || !enabled.has(provider.moduleId)) {
      if (this.emptyValues.has(capability)) return this.emptyValues.get(capability) as R;
      throw new Error(
        `Capability "${capability}" is unavailable and has no declared empty value. ` +
        `Declare one with registry.declareEmpty().`,
      );
    }
    return (await provider.fn(ctx, ...(args as never[]))) as R;
  }

  /** Every migration across all modules, for schema setup. */
  allMigrations(): Array<{ moduleId: string; version: number; description: string; statements: readonly string[] }> {
    const out: Array<{ moduleId: string; version: number; description: string; statements: readonly string[] }> = [];
    for (const mod of this.list()) {
      for (const m of mod.manifest.migrations) {
        out.push({
          moduleId: mod.manifest.id,
          version: m.version,
          description: m.description,
          statements: m.statements,
        });
      }
    }
    return out;
  }

  get platformFlavour(): string {
    return this.platform.flavour;
  }
}

type CapabilityImpl = (ctx: ModuleContext, ...args: never[]) => Promise<unknown>;

/** Well-known capability names, so typos surface at build time. */
export const CAP = {
  /** land → tasks, inventory, markets */
  LOCATIONS_LIST: 'locations.list',
  /** members → distribution, finance-model, bidding */
  SHARE_COUNT: 'shares.count',
  /** members → bidding */
  SHARE_EQUIVALENTS: 'shares.equivalents',
  /** finance-model → bidding */
  BUDGET_TARGET: 'budget.target',
  /** cultivation → tasks */
  PLANTINGS_ACTIVE: 'plantings.active',
} as const;

export type OrgScoped<T> = T & { orgId: OrgId };
