import { buildApp, createLogger, buildTranslator, ALL_MODULES } from '@solawi/app';
import { createCloudflarePlatform, type CfBindings } from '@solawi/platform-cf';
import { Kernel } from '@solawi/kernel';
import { BiddingRoom } from './bidding-room.js';

/**
 * Cloudflare Workers entry point.
 *
 * Everything above the platform boundary is shared with the Node server
 * (ADR-0004 §1). If this file grows business logic, the portability guarantee
 * is being violated.
 */

export interface Env extends CfBindings {
  MIGRATE_ON_BOOT?: string;
}

/**
 * Migration state per isolate.
 *
 * This used to run in `ctx.waitUntil()`, which was a bug: waitUntil does not
 * block the response, so the very first request after a cold start could reach
 * the database before the tables existed and fail with an opaque 500 — exactly
 * the "cannot create an account" symptom.
 *
 * Now the first request AWAITS migration. It is idempotent and costs a couple
 * of milliseconds once per isolate; correctness beats that saving.
 */
let migration: Promise<void> | null = null;

async function ensureMigrated(platform: ReturnType<typeof createCloudflarePlatform>, logger: ReturnType<typeof createLogger>): Promise<void> {
  if (!migration) {
    migration = (async () => {
      const k = new Kernel(platform, logger, buildTranslator());
      k.use(...ALL_MODULES);
      await k.migrate();
    })().catch((err) => {
      // Reset so the next request retries rather than caching a broken state.
      migration = null;
      logger.error('migration failed', { error: err instanceof Error ? err.message : String(err) });
      throw err;
    });
  }
  return migration;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const platform = createCloudflarePlatform(env);
    const logger = createLogger();

    if (env.MIGRATE_ON_BOOT !== 'false') {
      try {
        await ensureMigrated(platform, logger);
      } catch {
        return Response.json(
          { error: 'database_unavailable', hint: 'Migration failed — check the D1 binding and redeploy.' },
          { status: 503 },
        );
      }
    }

    const app = buildApp({ platform, logger });
    return app.fetch(request, env, ctx as unknown as Parameters<typeof app.fetch>[2]);
  },

  /** Cron: reminders, overdue tool nudges, retry of undelivered feedback. */
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const platform = createCloudflarePlatform(env);
    const logger = createLogger();
    try {
      await ensureMigrated(platform, logger);
      logger.info('scheduled run complete', { flavour: platform.flavour });
    } catch (err) {
      logger.error('scheduled run failed', { error: err instanceof Error ? err.message : String(err) });
    }
  },
};

export { BiddingRoom };

declare global {
  interface ExecutionContext {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
  }
  interface ScheduledEvent { readonly cron: string; readonly scheduledTime: number }
}
