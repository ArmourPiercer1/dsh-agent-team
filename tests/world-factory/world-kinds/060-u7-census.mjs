/**
 * u7-census — U7-0 (EB2-A): the ObservedRuntimeInventory census World.
 *
 * Migrated verbatim from lib/world-factory.mjs at origin/master 88107ad71. The
 * row resolves the ONE identity minter at its DIST face (the same file the
 * production glue imports) and the ONE canonical-digest module the offline
 * reconciler uses — probe and reconciler can never disagree by drifting
 * implementations.
 */
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export default {
  option: 'u7Census',
  probe: {
    src: resolve(import.meta.dirname, '..', 'canary', 'u7-census-probe-host.mjs'),
    rowId: 'u7-census-probe',
    fileName: 'u7-census-probe-host.mjs',
  },
  paths: { u7cLedgerPath: ['home', 'u7c-census-ledger.jsonl'] },
  ledgerRows: {},
  envKeys: ['U7C_LEDGER', 'U7C_WORLD', 'U7C_BOOT_ID', 'U7C_TD_URL', 'U7C_CANON_URL', 'U7C_AUTO_SNAPSHOT_MS'],
  env: ({ world, factory }) => ({
    U7C_LEDGER: world.u7cLedgerPath,
    U7C_WORLD: world.id,
    U7C_BOOT_ID: world.restartIndex === null ? 'boot-1' : `boot-r${String(world.restartIndex)}`,
    U7C_TD_URL: pathToFileURL(join(factory.repoRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'tool-dispatch', 'index.js')).href,
    U7C_CANON_URL: pathToFileURL(join(factory.repoRoot, 'packages', 'testkit', 'census', 'json-canonical.mjs')).href,
    U7C_AUTO_SNAPSHOT_MS: (world.u7Census.autoSnapshotMs ?? []).map((n) => String(Math.trunc(Number(n)))).filter((s) => /^-?\d+$/.test(s)).join(','),
  }),
  patchHeader: [
    'U7-0 census World: canary + the read-only census row',
    '(+ the production Team row and preset declarations when the',
    'caller composes a governed-Team World), one public patch layer.',
  ],
}
