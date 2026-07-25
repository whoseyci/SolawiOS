import { serve } from '@hono/node-server';
import { buildApp, buildTranslator, createLogger, ALL_MODULES } from '@solawi/app';
import { createNodePlatform } from '@solawi/platform-node';
import { Kernel } from '@solawi/kernel';

/**
 * Self-hosted entry point (ADR-0004).
 *
 * This path is a first-class citizen, not a courtesy: it runs in CI alongside
 * the Cloudflare build, because a self-host path that is not continuously tested
 * degrades into a broken path within two releases.
 */
async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 8787);
  const dbPath = process.env.DATABASE_PATH ?? './data/solawi.db';
  const blobRoot = process.env.BLOB_ROOT ?? './data/blobs';

  const platform = createNodePlatform({ databasePath: dbPath, blobRoot });
  const logger = createLogger();

  // Migrate at boot — unlike Workers, we have a real startup phase.
  const kernel = new Kernel(platform, logger, buildTranslator());
  kernel.use(...ALL_MODULES);
  const { applied } = await kernel.migrate();
  logger.info('ready', { applied, dbPath, port, modules: ALL_MODULES.length });

  const app = buildApp({ platform, logger });

  serve({ fetch: app.fetch, port }, (info) => {
    logger.info('listening', { port: info.port, url: `http://localhost:${info.port}` });
  });
}

main().catch((err) => {
  console.error('fatal', err);
  process.exit(1);
});
