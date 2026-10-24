/** Type surface for the ISOLATED bind-after-def module (center 00:3x law). */

export interface ScheduleBindBreakpoint {
  kind: string
  expected: string
  actual: string
  where: string
}

export interface ScheduleBindDeps {
  readToolDefinition: (name: string, agent: unknown) => unknown
  subscribeAgentCreated: (listener: (payload: { agent: unknown }) => void) => () => void
  agentEventsFor?: (agent: unknown) => { on: (event: string, handler: (...args: never[]) => unknown) => () => void }
  agentEvents?: { on: (event: string, handler: (...args: never[]) => unknown) => () => void }
  registerGuardFor?: (agent: unknown) => ((guard: (exec: unknown) => string | undefined) => (() => void) | undefined) | undefined
  registerGuard?: ((guard: (exec: unknown) => string | undefined) => (() => void) | undefined) | undefined
  scheduleServiceFeed?: () => unknown
  consumePa?: ((callId: unknown, definition: unknown) => boolean | Promise<boolean>) & { peekConsumed?: (callId: unknown) => unknown }
  onBindRefused?: (error: Error & { breakpoint?: ScheduleBindBreakpoint }) => void
  observe?: (row: { event: string; [key: string]: unknown }) => void
}

export interface ScheduleBindHandle {
  start: (runtimeAgent: unknown) => void
  dispose: () => void
  isBound: () => boolean
  bindPoints: Readonly<Record<string, string>>
}

export declare function createScheduleBindAfterDef (deps: ScheduleBindDeps): ScheduleBindHandle
