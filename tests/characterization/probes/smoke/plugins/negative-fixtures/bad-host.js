/**
 * P2-T1 demo probe plugin — BAD host half (private-import negative fixture).
 *
 * This module intentionally imports an upstream subpath that is NOT declared
 * in the package's `exports` map (`./internal/*` is not a public entry of
 * @deepseek-ai/dsh-util-crypto). Two layers must catch it:
 *
 *   1. STATIC — the harness's private-import scanner (C4-equivalent) must
 *      detect and reject this file before it is ever mounted;
 *   2. RUNTIME — if it were mounted anyway (this negative probe bypasses the
 *      static gate to prove the gate is not the only line of defense), the
 *      Node ESM loader inside the booted host rejects the import with
 *      ERR_PACKAGE_PATH_NOT_EXPORTED and `app-boot`'s
 *      `assertEntriesActivated` fails the boot loudly.
 *
 * This file must never be mounted by the positive probe path; it is test
 * data for the negative chain. It is excluded from the verify-zero-core
 * self-check of the harness source (the self-check scans the harness code,
 * not its negative fixtures).
 */
// Negative fixture: subpath outside the public exports whitelist.
const internalModule = await import('@deepseek-ai/dsh-util-crypto/internal/random')

export const name = 'p2t1-smoke-probe-bad'

export function apply() {
  void internalModule
}
