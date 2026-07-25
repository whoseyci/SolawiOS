import { describe, it, expect } from 'vitest';
import {
  hashPassword, verifyPassword, CHUNK_ITERATIONS, TOTAL_ITERATIONS,
} from '../packages/platform-cf/src/password.js';

/**
 * Regression tests for the bug that made signing up impossible in production.
 *
 * The Workers FREE plan allows 10 ms of CPU per request. A single-shot PBKDF2
 * at 210 000 iterations costs ~63 ms, so every registration was killed with
 * Error 1102 — while `wrangler dev`, which does NOT enforce CPU limits, happily
 * returned 201. That gap is why it survived local testing.
 */
describe('Workers password hashing stays inside the CPU budget', () => {
  it('keeps each slice well under the 10 ms limit', async () => {
    const enc = new TextEncoder();
    let material: Uint8Array = enc.encode('a-reasonable-password');
    let worstMs = 0;

    const chunks = Math.ceil(TOTAL_ITERATIONS / CHUNK_ITERATIONS);
    for (let i = 0; i < chunks; i++) {
      const t0 = performance.now();
      const key = await crypto.subtle.importKey('raw', material, 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: enc.encode(`s:${i}`), iterations: CHUNK_ITERATIONS, hash: 'SHA-256' },
        key, 256,
      );
      worstMs = Math.max(worstMs, performance.now() - t0);
      material = new Uint8Array(bits);
    }
    expect(worstMs).toBeLessThan(10);
  });

  it('does not weaken the hash to buy speed', () => {
    // Chunking must preserve total work. Lowering the iteration count would be
    // a security regression dressed up as a performance fix.
    expect(TOTAL_ITERATIONS).toBeGreaterThanOrEqual(210_000);
    expect(CHUNK_ITERATIONS).toBeLessThanOrEqual(25_000);
  });

  it('round-trips a password and rejects a wrong one', async () => {
    const salt = 'deadbeefdeadbeef';
    const hash = await hashPassword('correct horse battery', salt);

    expect(await verifyPassword('correct horse battery', salt, hash)).toBe(true);
    expect(await verifyPassword('wrong horse battery', salt, hash)).toBe(false);
    // A different salt must not validate, or the salt is decorative.
    expect(await verifyPassword('correct horse battery', 'otherotherother1', hash)).toBe(false);
  });

  it('is deterministic for the same input', async () => {
    const a = await hashPassword('pw', 'salt1234salt1234');
    const b = await hashPassword('pw', 'salt1234salt1234');
    expect(a).toBe(b);
  });
});
