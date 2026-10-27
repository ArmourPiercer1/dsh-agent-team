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
export { buildProcessShellContribution, DECLARED_TO_REQUESTED } from './bash-contribution.mjs'
export { normalizeShellProjection } from './bash-normalizer.js'
// U7-F: the shell-class SECOND row (governed `pwsh`) — the same confined
// provider law, its own closed parameter schema and faithful command form.
export { createConfinedPwshBackend } from './pwsh-confined.mjs'
export { createGovernedPwshExecutor } from './pwsh-executor.mjs'
export { buildPwshRowDefinition, PWSH_ROW_PARAMETERS } from './pwsh-row.mjs'
export {
  parseGovernedPwshArgs,
  resolvePwshExecutable,
  buildPwshSpawnRequest,
  renderPwshResult,
  PWSH_ROW_PARAMS,
  PWSH_ARGV_FLAGS,
  PWSH_ENCODING_PREAMBLE,
  PWSH_SPAWN_ENV,
  PWSH_CANDIDATE_PATHS,
  PWSH_DEFAULT_TIMEOUT_MS,
} from './pwsh-mechanics.mjs'
