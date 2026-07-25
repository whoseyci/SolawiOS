import { buildApp, createLogger } from '@solawi/app';
import { createCloudflarePlatform, type CfBindings } from '@solawi/platform-cf';
import { BiddingRoom } from './bidding-room.js';

/**
 * Cloudflare Workers entry point.
 *
 * Note how little is here: everything above the platform boundary is shared with
 * the Node server (ADR-0004 §1). If this file grows business logic, the
 * portability guarantee is being violated.
 */

export interface Env extends CfBindings {
  MIGRATE_ON_BOOT?: string;
}

let migrated = false;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const platform = createCloudflarePlatform(env);
    const logger = createLogger();
    const app = buildApp({ platform, logger });

    // D1 has no migration hook, so we run migrations lazily on first request of
    // an isolate. They are idempotent and cheap once applied.
    if (!migrated && env.MIGRATE_ON_BOOT !== 'false') {
      migrated = true;
      ctx.waitUntil((async () => {
        try {
          const { Kernel } = await import('@solawi/kernel');
          const { buildTranslator } = await import('@solawi/app');
          const { ALL_MODULES } = await import('@solawi/app');
          const k = new Kernel(platform, logger, buildTranslator());
          k.use(...ALL_MODULES);
          await k.migrate();
        } catch (err) {
          logger.error('migration failed', { error: err instanceof Error ? err.message : String(err) });
          migrated = false;
        }
      })());
    }

    // Hono's ExecutionContext type carries an extra `props` field that the
    // Workers runtime supplies; the cast keeps us off @cloudflare/workers-types.
    return app.fetch(request, env, ctx as unknown as Parameters<typeof app.fetch>[2]);
  },

  /** Cron triggers: reminders, overdue tool nudges, season rollovers. */
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const platform = createCloudflarePlatform(env);
    const logger = createLogger();
    logger.info('scheduled run', { flavour: platform.flavour });
  },
};

export { BiddingRoom };

// Minimal ambient types so this builds without @cloudflare/workers-types.
declare global {
  interface ExecutionContext {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
  }
  interface ScheduledEvent { readonly cron: string; readonly scheduledTime: number }
}
