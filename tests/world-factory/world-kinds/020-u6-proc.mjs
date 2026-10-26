/**
 * u6-proc — U6 PR3 C2: the governed SHELL lane's probe World (mirror of u6-fs).
 *
 * Migrated verbatim from lib/world-factory.mjs at origin/master 88107ad71.
 */
import { resolve } from 'node:path'

export default {
  option: 'u6Proc',
  probe: {
    src: resolve(import.meta.dirname, '..', 'canary', 'u6-proc-probe-host.mjs'),
    rowId: 'u6-proc-probe-host',
    fileName: 'u6-proc-probe-host.mjs',
  },
  paths: {
    u6procLedgerPath: ['home', 'u6proc-probe-ledger.jsonl'],
    u6procMarkerDir: ['workspace', 'u6proc-markers'],
  },
  ledgerRows: { u6procLedgerRows: 'u6procLedgerPath' },
  envKeys: ['U6PROC_LEDGER', 'U6PROC_MARKER_DIR', 'U6PROC_WORLD'],
  env: ({ world }) => ({
    U6PROC_LEDGER: world.u6procLedgerPath,
    U6PROC_MARKER_DIR: world.u6procMarkerDir,
    U6PROC_WORLD: world.id,
  }),
  patchHeader: [
    'U6-proc World: canary + shell-probe rows + the production Team row,',
    'p6t6 observer and preset declarations, one public profile-patch layer.',
  ],
}
