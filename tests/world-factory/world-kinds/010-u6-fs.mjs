/**
 * u6-fs — U6 PR2 C2: the governed READ lane's probe World.
 *
 * Migrated verbatim from lib/world-factory.mjs at origin/master 88107ad71
 * (U6FS_* env block, `u6fsLedgerPath`/`u6fsMarkerDir` paths, `u6fsLedgerRows`
 * reader, the probe row copy and the patch-layer header). The row observes the
 * governed read lane and performs the identity-swap / re-registration-window
 * PLANTS on command; its ledger/markers are evidence channels independent of
 * the model transcript.
 */
import { resolve } from 'node:path'

export default {
  option: 'u6Fs',
  probe: {
    src: resolve(import.meta.dirname, '..', 'canary', 'u6-fs-probe-host.mjs'),
    rowId: 'u6-fs-probe-host',
    fileName: 'u6-fs-probe-host.mjs',
  },
  paths: {
    u6fsLedgerPath: ['home', 'u6fs-probe-ledger.jsonl'],
    u6fsMarkerDir: ['workspace', 'u6fs-markers'],
  },
  ledgerRows: { u6fsLedgerRows: 'u6fsLedgerPath' },
  envKeys: ['U6FS_LEDGER', 'U6FS_MARKER_DIR', 'U6FS_WORLD'],
  env: ({ world }) => ({
    U6FS_LEDGER: world.u6fsLedgerPath,
    U6FS_MARKER_DIR: world.u6fsMarkerDir,
    U6FS_WORLD: world.id,
  }),
  patchHeader: [
    'U6-fs World: canary + probe rows + the production Team row, p6t6',
    'observer and preset declarations, one public profile-patch layer.',
  ],
}
