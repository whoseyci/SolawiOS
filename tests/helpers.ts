import { Kernel as RealKernel, type Logger } from '@solawi/kernel';
import { Translator } from '@solawi/i18n';
import { ALL_MODULES } from '@solawi/app';
import type { Platform } from '@solawi/platform';
import { de } from '@solawi/app';

const silentLogger: Logger = {
  debug() {}, info() {}, warn() {},
  error(msg, data) {
    if (process.env.TEST_VERBOSE) console.error(msg, data);
  },
};

export function buildTranslatorForTest(): Translator {
  return new Translator({ de });
}

/** A migrated kernel with every module registered, for tests. */
export async function Kernel(platform: Platform): Promise<RealKernel> {
  const k = new RealKernel(platform, silentLogger, buildTranslatorForTest());
  k.use(...ALL_MODULES);
  k.registry.declareEmpty('locations.list', []);
  k.registry.declareEmpty('shares.count', 0);
  k.registry.declareEmpty('shares.equivalents', 0);
  k.registry.declareEmpty('budget.target', 0);
  k.registry.declareEmpty('plantings.active', []);
  k.registry.declareEmpty('founding.progress', null);
  k.registry.declareEmpty('observations.rhythm', null);
  await k.migrate();
  return k;
}
