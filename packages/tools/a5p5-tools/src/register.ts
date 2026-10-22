/**
 * `a5p5-tools` — THE REGISTRATION FACE (PR4/5 install round, pb-CONTRACT.md §2).
 *
 * What governance a model-visible search/shell tool needs from this lane is
 * fixed and reviewable: strict argument parsing (closed keys, typed bounds,
 * `..` refusal) → effect derivation → the injected admission verdict → the
 * ONE pipeline (deny-before-backend) → renderer-only presentation. This file
 * packages exactly that body into plain tool DEFINITIONS — name, description,
 * closed parameter schema, and an `execute(raw, exec?)` closure returning
 * `{ text }` — the shape every public assembly seam's `tools.register` takes
 * (the measured W5 row form, `evidence/alpha5/wiring/w5/a5w5-assembly-row.mjs`).
 * Since B3 the optional second argument is READ, not dropped: it carries the
 * host's cooperative cancel signal, which this face forwards onto the backend
 * call and nothing else (see GovernedToolExecContext).
 *
 * What this file deliberately does NOT do (the mount ruling is GLUE-4's, not
 * this lane's): it names no host module, knows no Agent/session scope, never
 * calls any registry, and imports nothing outside the lane + the read-only
 * `domain/tool-governance` algebra it already shares with `pipeline.ts`.
 * WHICH scope mounts these definitions, under WHICH names (aliases /
 * namespaces), and in WHICH order relative to the guard publish are
 * ASSEMBLY decisions — see pb-CONTRACT.md §2 (scoped 挂载归 GLUE-4 裁决).
 *
 * Purity: no `node:*`, no I/O, no clock — same law as `pipeline.ts`. The
 * verdicts come from `decide` (the injected admission face); a definition
 * built WITHOUT an admission face cannot be built here at all: `decide` is
 * a required field, so "registered ungated" is not expressible through this
 * face (the W5 ungated RED leg stays evidence-side on purpose).
 *
 * @module @dsh-agent-team/tools/a5p5-tools/register
 */

import type { RequestedEffectSet } from '../../../domain/tool-governance/src/index.js'
import { canonicalJsonFingerprint } from '../../../domain/tool-governance/src/index.js'
import type { ParseResult } from '../../../domain/tool-governance/src/parse-util.js'
import { parseBashArgs, parseGlobArgs, parseGrepArgs } from './args.js'
import type { ToolCancelSignal, ToolEffectBackend } from './backend-contract.js'
import { runToolCall, type AdmissionVerdict, type PaAdmitEdge } from './pipeline.js'
import { GREP_OUTPUT_MODES } from './types.js'
import type { SpillStore } from './spill.js'
import type { ParsedToolArgs } from './types.js'

/** The one JSON-schema fragment every closed target string shares. */
const TARGET_SCHEMA: Record<string, unknown> = { type: 'string' }

/** The model-facing parameter schemas — field sets EXACTLY the parsers accept (closedRecordKeys parity). */
const GREP_PARAMETERS: Record<string, unknown> = {
  type: 'object',
  properties: {
    pattern: { type: 'string' },
    path: TARGET_SCHEMA,
    glob: { type: 'string' },
    output_mode: { type: 'string', enum: [...GREP_OUTPUT_MODES] },
    fixed_string: { type: 'boolean' },
    ignore_case: { type: 'boolean' },
    multiline: { type: 'boolean' },
    context: { type: 'integer', minimum: 0, maximum: 20 },
    max_results: { type: 'integer', minimum: 1, maximum: 5000 },
  },
  required: ['pattern'],
  additionalProperties: false,
}

const GLOB_PARAMETERS: Record<string, unknown> = {
  type: 'object',
  properties: { pattern: { type: 'string' }, path: TARGET_SCHEMA },
  required: ['pattern'],
  additionalProperties: false,
}

const BASH_PARAMETERS: Record<string, unknown> = {
  type: 'object',
  properties: {
    command: { type: 'string' },
    cwd: TARGET_SCHEMA,
    timeout: { type: 'integer', minimum: 1, maximum: 600_000 },
    background: { type: 'boolean' },
  },
  required: ['command'],
  additionalProperties: false,
}

/**
 * The execution context the host's dispatch hands as the SECOND argument
 * (`tool.execute(exec.arguments, exec)` — public ToolExecutionInput, whose
 * cooperative `signal` the host's own law says async work must observe).
 * B3: this is the lane's cancel INPUT — optional, so every pre-B3 single-arg
 * caller stays exact, and an absent signal means "never asked to cancel"
 * (the fact B2's X6 books). The lane names it structurally (ToolCancelSignal):
 * no host type, no node type, lane purity untouched.
 */
export interface GovernedToolExecContext {
  readonly signal?: ToolCancelSignal
  /** fix-2b: the host registry's per-execution token (ToolExecution.token).
   *  It is the ONLY fact that cannot be recycled when a plane remounts, so
   *  it anchors the PA durable correlation. `rootCallId` is audit-only. */
  /** The Host's real per-execution token (ToolExecutionToken: an opaque
   *  object | symbol). Stringy values are NOT identities (PR358-A1). */
  readonly token?: object | symbol
  readonly rootCallId?: string
}

/** One registrable tool definition (the measured `tools.register` row shape). */
export interface GovernedToolDefinition {
  readonly name: string
  readonly description: string
  readonly parameters: Record<string, unknown>
  readonly execute: (raw: unknown, exec?: GovernedToolExecContext) => Promise<{ readonly text: string }>
}

/** The assembly inputs one governed tool family needs. `decide` is REQUIRED: no admission face, no definition. */
export interface A5P5Assembly {
  readonly realmId: string
  /** The injected admission face (guard/Grant kernel on the assembly side). */
  readonly decide: (effectSet: RequestedEffectSet) => AdmissionVerdict
  readonly searchBackend: ToolEffectBackend
  readonly shellBackend: ToolEffectBackend
  /** Optional glob backend; ABSENT reuses `searchBackend` (one graph, no second algebra). */
  readonly globBackend?: ToolEffectBackend
  readonly spillStore?: SpillStore
  /** Assembler-chosen model-facing names (scoped mounting is GLUE-4's ruling; ABSENT = the lane's own vocabulary). */
  readonly names?: { readonly grep?: string; readonly glob?: string; readonly bash?: string }
  /** Deterministic call-id prefix for the assembly (audit join key); default `a5p5`. */
  readonly callIdPrefix?: string
  /** M1 CENTER PA WIRING (frozen A): the async PA edge (admitCall → real
   *  Control ask when required → issueApprovedGrant → one-shot consume).
   *  The plane production mount injects it; archived pre-M1 kits omit it and
   *  keep their historical behavior untouched. */
  readonly pa?: PaAdmitEdge
}

/** The prefix every refusal this face emits wears (renderer structure never leaks into refusals). */
export const REFUSAL_PREFIX = 'a5p5-refused '

/** One deterministic single-line refusal fact (kind + code + bounded detail). */
function refusalText(kind: string, code: string, detail: string): string {
  return `${REFUSAL_PREFIX}kind=${kind} code=${code} detail=${detail.slice(0, 240).replace(/\s+/g, ' ')}`
}

/**
 * Build the governed search/shell tool definitions over the assembly's
 * backends and admission face. Returns definitions in the fixed lane order
 * (grep, glob, bash); the assembler decides WHICH of them to mount.
 */
export function createGovernedToolDefinitions(assembly: A5P5Assembly): readonly GovernedToolDefinition[] {
  const prefix = assembly.callIdPrefix ?? 'a5p5'
  const globBackend = assembly.globBackend ?? assembly.searchBackend
  const names = assembly.names ?? {}
  let callSeq = 0
  // fix-2b: fallback ids carry a per-mount nonce — a rebuilt plane can never
  // re-issue a call id a previous mount already spent a pending/allow on.
  const mountNonce = (((globalThis as unknown as {
        crypto?: { randomUUID?: () => string }
      }).crypto?.randomUUID?.() ?? `n-${String(Date.now())}-${String(Math.floor(Math.random() * 2 ** 31))}`))
  // PR358-A1: the REAL host token (object | symbol — never String(), which
  // would collide distinct symbol identities and let a forged string replay
  // an execution) is the in-process Map key. One token allocates ONE
  // correlation for its whole life; in-flight and terminal tokens are both
  // refused for a second call (the allocation is never reused).
  const tokenLedger = new Map<PropertyKey, { readonly correlation: string; readonly settled: boolean }>()

  const makeExecute =
    <T extends ParsedToolArgs>(
      toolKind: 'grep' | 'glob' | 'bash',
      parse: (raw: unknown) => ParseResult<T>,
      backend: ToolEffectBackend,
    ) =>
    async (raw: unknown, exec?: GovernedToolExecContext): Promise<{ readonly text: string }> => {
      const parsed = parse(raw)
      if (!parsed.ok) {
        return { text: refusalText('refused-schema', parsed.problems[0]?.code ?? 'unknown', JSON.stringify(parsed.problems).slice(0, 200)) }
      }
      // PR358-A1: ONLY a real per-execution token (object | symbol — the
      // Host's own ToolExecutionToken shape) anchors a correlation. A
      // stringy token is NOT an identity: it falls back to the mount-unique
      // per-call id, and no String() of it ever rides the wire.
      const tokenKey: PropertyKey | undefined =
        typeof exec?.token === 'object' && exec.token !== null ? exec.token as unknown as PropertyKey
        : typeof exec?.token === 'symbol' ? exec.token
        : undefined
      const existing = tokenKey !== undefined ? tokenLedger.get(tokenKey) : undefined
      if (existing !== undefined) {
        return { text: refusalText('refused-replay', 'exec-token-replay', existing.settled
          ? 'this host execution token is already terminal; a settled correlation is never re-used'
          : 'this host execution already owns an in-flight governed call') }
      }
      callSeq += 1
      const callSeq2 = callSeq
      const callId = `${prefix}-${toolKind}:${tokenKey !== undefined ? 'hexec' : 'mount'}:${mountNonce}-${String(callSeq2)}`
      if (tokenKey !== undefined) {
        tokenLedger.set(tokenKey, { correlation: callId, settled: false })
      }
      let result: Awaited<ReturnType<typeof runToolCall>>
      try {
        result = await runToolCall({
        request: {
          realmId: assembly.realmId,
          callId,
          parsedArgs: parsed.value,
          // M1: the canonical parameter fingerprint (Alpha.2 canonical-operation
          // law), computed here from the CLOSED parsed args — the fact the PA
          // edge asks, consumes and rechecks against.
          parametersFingerprint: canonicalJsonFingerprint(parsed.value),
          // B3: the host's cancel signal rides the call untouched. This face
          // only CARRIES it — the cancelled fact belongs to the row that can
          // actually stop a payload (the shell arm), never to the presentation.
          ...(exec?.signal === undefined ? {} : { signal: exec.signal }),
        },
        decide: assembly.decide,
        ...(assembly.pa === undefined ? {} : { pa: assembly.pa }),
        backend,
        ...(assembly.spillStore === undefined ? {} : { spill: { store: assembly.spillStore } }),
        })
      } finally {
        if (tokenKey !== undefined) {
          const entry = tokenLedger.get(tokenKey)
          if (entry !== undefined) tokenLedger.set(tokenKey, { correlation: entry.correlation, settled: true })
        }
      }
      if (result.kind === 'presented') return { text: result.rendered.text }
      if (result.kind === 'refused-schema') return { text: refusalText(result.kind, result.problems[0]?.code ?? 'unknown', JSON.stringify(result.problems).slice(0, 200)) }
      if (result.kind === 'refused-admission') return { text: refusalText(result.kind, result.denyCode, result.effectFingerprint) }
      if (result.kind === 'refused-spill') return { text: refusalText(result.kind, result.refusal.code, result.refusal.detail) }
      return { text: refusalText(result.kind, result.failure.code, result.failure.detail) }
    }

  return Object.freeze([
    Object.freeze({
      name: names.grep ?? 'grep',
      description: 'Governed search (a5p5 lane): strict pattern search over the realm; effects derived read-time, admission-gated before any backend runs.',
      parameters: GREP_PARAMETERS,
      execute: makeExecute('grep', parseGrepArgs, assembly.searchBackend),
    }),
    Object.freeze({
      name: names.glob ?? 'glob',
      description: 'Governed filename traversal (a5p5 lane): pattern + target ONLY; admission-gated before any backend runs.',
      parameters: GLOB_PARAMETERS,
      execute: makeExecute('glob', parseGlobArgs, globBackend),
    }),
    Object.freeze({
      name: names.bash ?? 'bash',
      description: 'Governed shell (a5p5 lane): opaque command text decided by admission + the confined backend; deny-before-backend.',
      parameters: BASH_PARAMETERS,
      execute: makeExecute('bash', parseBashArgs, assembly.shellBackend),
    }),
  ])
}
