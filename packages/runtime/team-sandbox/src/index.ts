/**
 * `@dsh-agent-team/runtime/team-sandbox` — Alpha.5 P1-07: compile a Member's
 * effective policy into an OS execution profile, run it through the confined
 * provider (no bare-process fallback), and expose a native-compatible
 * `SubprocessHandle`.
 *
 * @module @dsh-agent-team/runtime/team-sandbox
 */

export { compileExecutionProfile, PROFILE_REFUSAL_CODES } from './profile.js'
export type { ExecutionProfile, ProfilePolicy, ProfileRefusal, ProfileResult } from './profile.js'
export { createTeamConfinedRunner, RUNNER_REFUSAL_CODES } from './runner.js'
export type { ConfinedProcessProvider, RunnerRefusal, TeamExecutionRequest, TeamRunner } from './runner.js'
export { toSubprocessHandle } from './subprocess.js'
export type { ConfinedSubprocessHandle } from './subprocess.js'
export { createTerminalDomainRegistry, TERMINAL_REFUSAL_CODES } from './terminal.js'
export type {
  PtyHandle,
  TerminalAcquireReceipt,
  TerminalAcquireSpec,
  TerminalDomain,
  TerminalDomainRegistry,
  TerminalOwner,
  TerminalRefusal,
  TerminalShutdownReceipt,
} from './terminal.js'
