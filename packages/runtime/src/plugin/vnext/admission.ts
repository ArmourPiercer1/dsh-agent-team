/**
 * admission.ts — the one place a bound call can be refused before its body runs.
 *
 * WHY THIS EXISTS AT ALL. The host's dispatch already decides *whether a tool exists*; it does not
 * decide whether THIS agent may perform THIS operation on THIS locator. That decision is the
 * centre's, and it must be made in one place, before the body, for every tool — otherwise the
 * answer depends on which lane happened to be reached first, which is the defect the old route
 * shipped: a name-only check that passed while the body executed on the base provider.
 *
 * WHAT IT DOES NOT DO. It does not decide path containment, approval precedence, or grant
 * consumption. `member-io-policy` owns those (`matchLocator`'s precedence is deny → ask → allow,
 * and an uncovered locator is deny). This module supplies the two things that package cannot know:
 * **which axis a tool name belongs to**, and **that a call with no binding is refused rather than
 * admitted**. That is the whole delta, deliberately.
 *
 * THE UNWIRED RULE, AS CODE. `admit` refuses when the binding is absent, when the tool has no
 * declared axis, or when the arguments carry no locator the axis can be judged on. A controlled
 * call that the centre has not been wired for is refused — never forwarded to the composition
 * provider, and never admitted on the grounds that "nothing objected".
 *
 * @module packages/runtime/src/plugin/vnext/admission
 */

import { matchLocator } from '../../../member-io-policy/src/path-rules.js'
import type { PathRuleSet } from '../../../member-io-policy/src/types.js'

/** The axes a tool name can be admitted on. A name outside this table is not admitted at all. */
export const TOOL_AXES = Object.freeze({
  read: 'fs.read',
  read_image: 'fs.read',
  grep: 'fs.read',
  glob: 'fs.read',
  write: 'fs.write',
  edit: 'fs.write',
  web_fetch: 'net.fetch',
  bash: 'process.exec',
  pwsh: 'process.exec',
  run_code: 'process.exec',
} as const)

export type ToolAxis = (typeof TOOL_AXES)[keyof typeof TOOL_AXES]

/** Argument keys that carry the locator, in the order they are tried. */
const LOCATOR_KEYS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  read: ['file_path', 'path'],
  read_image: ['file_path', 'path'],
  grep: ['path'],
  glob: ['path'],
  write: ['file_path', 'path'],
  edit: ['file_path', 'path'],
  web_fetch: ['url'],
})

/**
 * Tools whose locator may be OMITTED, with the locator that omission actually means. `grep`/`glob`
 * search their working directory when the model gives no path, so "no locator" is not "unjudgeable":
 * it is the member's workspace root, and the lane judges that like any other locator. Leaving them
 * in the no-locator refusal would have refused the ordinary case - and taught the model to pass a
 * path just to get through, which is a worse surface than the one we started with.
 */
const DEFAULTED_LOCATORS: Readonly<Record<string, 'workspaceRoot'>> = Object.freeze({
  grep: 'workspaceRoot',
  glob: 'workspaceRoot',
})

export interface Binding {
  /** The runtime Agent this binding is for. The object itself is the key; never a session id. */
  readonly agentId: string
  readonly sessionId: string
  readonly instanceGeneration: number
  /** The compiled lanes. Never recomputed here; `member-io-policy` produced them. */
  readonly read: PathRuleSet
  readonly write: PathRuleSet
  /** The member's workspace root: what an omitted search path means. */
  readonly workspaceRoot?: string
  /** The compiled network axis. Absent is NOT allow. */
  readonly network?: 'allow' | 'deny'
  /** The declared source of the definitions this binding mounted (a host package specifier). */
  readonly definitionSource: string
  /** The policy generation the lanes were compiled under. */
  readonly policyGeneration: string
  readonly blueprintRevision: string
  readonly owner: string
}

export type AdmissionRefusalCode =
  | 'ADMISSION_NO_BINDING'
  | 'ADMISSION_TOOL_UNBOUND'
  | 'ADMISSION_NO_LOCATOR'
  /** The axis is known but has no enforceable lane this round: refusing is the contract, not a TODO. */
  | 'ADMISSION_AXIS_UNSUPPORTED'

export type Admission =
  | { readonly kind: 'allow' }
  | { readonly kind: 'ask'; readonly reason: string }
  | { readonly kind: 'deny'; readonly code: 'LANE_DENY' | 'NETWORK_DENY' | AdmissionRefusalCode; readonly reason: string }

/**
 * The durable record of *what was asked and under what authority*, written at admission time.
 *
 * It is keyed by `callId` and carries no execution token: the host's token is a per-execution
 * symbol and is not durable (`pipeline.ts:119,715`), so anything keyed on it would be
 * unrecoverable after a restart.
 */
export interface InvocationAuthorityFacts {
  readonly callId: string
  readonly agentId: string
  readonly sessionId: string
  readonly instanceGeneration: number
  readonly toolName: string
  readonly axis: ToolAxis
  readonly locator: string
  readonly definitionSource: string
  readonly policyGeneration: string
  readonly blueprintRevision: string
  readonly owner: string
  readonly decision: Admission['kind']
  /** Present for a refusal or an ask; absent for a plain allow. */
  readonly refusalCode?: string
  readonly reason?: string
}

const refuse = (code: AdmissionRefusalCode, reason: string): Admission => ({ kind: 'deny', code, reason })

/** Read the locator an axis needs. Absent means the call cannot be judged, so it is refused. */
function locatorOf (toolName: string, args: unknown): string | undefined {
  if (args === null || typeof args !== 'object') return undefined
  for (const key of LOCATOR_KEYS[toolName] ?? []) {
    const value = (args as Record<string, unknown>)[key]
    if (typeof value === 'string' && value.trim() !== '') return value
  }
  return undefined
}

/**
 * Decide one call. Pure: no I/O, no clock, no binding mutation. A caller that needs the decision
 * to depend on state must pass that state in.
 */
export function admit (input: {
  readonly binding: Binding | undefined
  readonly toolName: string
  readonly arguments: unknown
}): Admission {
  const { binding, toolName, arguments: args } = input
  if (binding === undefined) {
    // THE UNWIRED RULE. Not "no policy says no": there is no binding, so there is no governing
    // authority for this call, and admitting it would mean the composition provider decides.
    return refuse('ADMISSION_NO_BINDING', `no binding for tool ${JSON.stringify(toolName)} on this agent; a call the centre has not been wired for is refused, not forwarded`)
  }
  const axis = TOOL_AXES[toolName as keyof typeof TOOL_AXES]
  if (axis === undefined) {
    return refuse('ADMISSION_TOOL_UNBOUND', `tool ${JSON.stringify(toolName)} has no declared I/O axis; an unclassified tool is never admitted by default`)
  }
  if (axis === 'process.exec') {
    // EXPLICITLY UNAVAILABLE, NOT SILENTLY ALLOWED. The compiled policy has no subprocess lane this
    // round, so there is nothing to judge a shell command against; a centre that admitted it anyway
    // would be claiming an enforcement it does not have. C wires this family for real.
    return refuse('ADMISSION_AXIS_UNSUPPORTED', `tool ${JSON.stringify(toolName)} needs a subprocess lane, which this policy generation does not compile; a call the centre cannot judge is refused`)
  }
  const defaulted = DEFAULTED_LOCATORS[toolName]
  const locator = locatorOf(toolName, args) ?? (defaulted === 'workspaceRoot' ? binding.workspaceRoot : undefined)
  if (axis === 'net.fetch') {
    if (binding.network !== 'allow') {
      return refuse('NETWORK_DENY', `${JSON.stringify(locator ?? '')} is refused: the binding's network axis is ${binding.network === 'deny' ? 'deny' : 'unset'}, and an unset axis is not a permission`)
    }
    return { kind: 'allow' }
  }
  if (locator === undefined) {
    return refuse('ADMISSION_NO_LOCATOR', `tool ${JSON.stringify(toolName)} was called without a locator the ${axis} lane can be judged on`)
  }
  const lane = axis === 'fs.read' ? binding.read : binding.write
  switch (matchLocator(lane, locator)) {
    case 'allow':
      return { kind: 'allow' }
    case 'ask':
      return { kind: 'ask', reason: `${axis} ${JSON.stringify(locator)} requires approval under policy generation ${binding.policyGeneration}` }
    case 'deny':
      return { kind: 'deny', code: 'LANE_DENY', reason: `${axis} ${JSON.stringify(locator)} is outside the binding's ${axis} lane (policy generation ${binding.policyGeneration})` }
  }
}

/** Project the decision into the durable record. One call produces exactly one record. */
export function invocationFactsOf (input: {
  readonly binding: Binding | undefined
  readonly toolName: string
  readonly callId: string
  readonly arguments: unknown
  readonly admission: Admission
}): InvocationAuthorityFacts {
  const { binding, toolName, callId, arguments: args, admission } = input
  const axis = (TOOL_AXES[toolName as keyof typeof TOOL_AXES] ?? 'fs.read') as ToolAxis
  const defaulted = DEFAULTED_LOCATORS[toolName]
  const locator = locatorOf(toolName, args) ?? (defaulted === 'workspaceRoot' ? binding?.workspaceRoot ?? '' : '')
  // A refused call still records what was ASKED — that is the point of the record: after an
  // incident, "which locator did the model try, under which generation" must not be reconstructible
  // only from a refusal message.
  return Object.freeze({
    callId,
    agentId: binding?.agentId ?? '',
    sessionId: binding?.sessionId ?? '',
    instanceGeneration: binding?.instanceGeneration ?? 0,
    toolName,
    axis,
    locator,
    definitionSource: binding?.definitionSource ?? '',
    policyGeneration: binding?.policyGeneration ?? '',
    blueprintRevision: binding?.blueprintRevision ?? '',
    owner: binding?.owner ?? '',
    decision: admission.kind,
    ...(admission.kind === 'deny' ? { refusalCode: admission.code, reason: admission.reason } : {}),
    ...(admission.kind === 'ask' ? { reason: admission.reason } : {}),
  })
}
