/**
 * `@dsh-agent-team/tools/process-family` — the U6 PR3 process/shell Family
 * lane barrel. Owner role + protected set: see this lane's README.
 *
 * LANE BARREL, NOT THE SHARED ONE (the a5p5/fs-family law): the shared
 * `packages/tools/src/index.ts` and the registry deliberately do NOT know
 * this directory; mounting is the trusted assembly's reviewed move.
 *
 * @module @dsh-agent-team/tools/process-family
 */
export {
  SYSTEM_RX,
  raceShellSettle,
  shellCancelled,
  SHELL_STREAM_DRAIN_MS,
  drainShellStdio,
} from './shell-mechanics.mjs'
export { createConfinedShellBackend } from './confined-shell-executor.mjs'
export { buildBashRowDefinition } from './bash-row.mjs'
export { buildProcessShellContribution } from './bash-contribution.mjs'
export { normalizeShellProjection } from './bash-normalizer.js'
