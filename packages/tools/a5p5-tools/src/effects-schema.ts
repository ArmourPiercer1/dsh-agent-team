/**
 * `a5p5-tools` Phase 1 — the EFFECT SCHEMA of the Search/Shell tools: a pure
 * derivation from a PARSED argument set (+ the injected realm) to the
 * canonical, fingerprinted `RequestedEffectSet` of the frozen PR0 algebra.
 *
 * READ-TIME CONSUMPTION, NOT A SECOND FACT (INTERFACES-v1.md C-ADM: "接口面
 * … 只读消费；禁第二授权库"): every arm built here is fed through
 * `parseRequestedEffectSet` from `domain/tool-governance` — the closed-set
 * check, the EFFECT↔RESOURCE coupling law (`list` binds a directory, a right
 * must be carried), the dedup/sort/fingerprint canonicalization and the whole
 * problem vocabulary all come from that module. This file manufactures NO
 * algebra, NO identity key and NO digest of its own.
 *
 * THE DERIVATION LAW (what each tool legally claims — and CLAIMS NOTHING
 * ELSE; over-claiming is as illegal as under-claiming):
 *
 *  - `grep`  → tool-invoke(grep)
 *              + list  on a `directory` resource  (the rg tree walk)
 *              + read  on the placement resource  (file contents are matched)
 *  - `glob`  → tool-invoke(glob)
 *              + list  on a `directory` resource  ONLY — glob answers
 *              filenames; it NEVER claims a `read` effect.
 *  - `bash`  → tool-invoke(bash) ONLY — the command text is opaque (law 2 of
 *              `types.ts`; S0 M-07 禁以命令文本预测副作用). Its file/network
 *              reality is bounded by the confined-execution provider at exec
 *              (PR4), so no effect is claimed and NONE may be back-derived.
 *
 * THE ANCHORED FORM (U7-6 GLUE-4; `effectAnchorRoot` injected by the trusted
 * assembly of an ANCHORED row — the plane's governed search rows):
 *
 *  - `grep`  → tool-invoke(grep) + list + read on the GOVERNED ROOT.
 *  - `glob`  → tool-invoke(glob) + list on the GOVERNED ROOT ONLY.
 *  - `bash`  → unchanged (the anchor never enters the shell arm).
 *
 *  Why the root, not the raw target, is the TRUTHFUL claim of an anchored
 *  row: such a row's canonical operation is bounded by its anchor law
 *  (`resolveAnchored`) — it can enumerate/read ONLY inside the governed
 *  root, and a target outside the root is refused by that law BEFORE any
 *  byte is consumed. Claiming the raw target describes a demand over a
 *  resource the row's own law forbids it ever to touch (the /etc call does
 *  not consume /etc — it consumes NOTHING), and it makes the authority
 *  question target-shaped while the row's capability never varies. The
 *  envelope claim is the row's demand: stable per row, never exceeding the
 *  row's own boundary, and exactly the question a policy can answer (may
 *  this member walk THIS governed surface). The raw target still decides
 *  what the body does with the surface — and the anchor law still refuses
 *  outside targets with zero effect, AFTER admission, which is where the
 *  anchored refusal leg belongs. Absent `effectAnchorRoot` the law is the
 *  historical one, byte-identical for every pre-U7-6 consumer.
 *
 * `realmId` is INJECTED by the admission caller and is required — model args
 * carry no realm (law 1 of `types.ts`), so a forged-realm argument set cannot
 * even reach this function, and one forged realm string cannot be parsed as
 * another (realm non-confusion, `resource.ts`).
 *
 * Purity: no `node:*`, no I/O, no clock.
 *
 * @module @dsh-agent-team/tools/a5p5-tools/effects-schema
 */

import {
  parseRequestedEffectSet,
  type RequestedEffectSet,
} from '../../../domain/tool-governance/src/index.js'
import type { ParseResult, ProblemSink, ToolContractProblem } from '../../../domain/tool-governance/src/parse-util.js'
import type { ParsedTarget, ParsedToolArgs } from './types.js'

/**
 * Derive the canonical requested effect set of one parsed call.
 *
 * `realmId` comes from the trusted admission context (never from tool args).
 * A malformed realm is a typed refusal inside the frozen problem vocabulary
 * (`field-type` / `empty-string`); every other refusal is the algebra's own —
 * re-pathed under `$.effects` so a reader sees which arm of WHICH tool leg
 * broke the law.
 *
 * `effectAnchorRoot` (U7-6, optional) is the governed root of an ANCHORED
 * row, injected by the trusted assembly (never from tool args). Present and
 * well-formed ⇒ the search arms claim the governed walk surface (see the
 * anchored form of the law above); present and malformed ⇒ typed refusal
 * (`field-type` / `empty-string` / `locator-rejected`) — an anchored row
 * with an unlocatable root claims NOTHING, fail closed. Absent ⇒ the
 * historical target-scoped law, byte-identical for every pre-U7-6 consumer.
 */
export function deriveToolEffectSet(
  realmId: unknown,
  parsed: ParsedToolArgs,
  effectAnchorRoot?: unknown,
): ParseResult<RequestedEffectSet> {
  const problems: ProblemSink = []
  if (typeof realmId !== 'string') {
    problems.push({ code: 'field-type', path: '$.realmId', detail: 'the realm id is injected by admission and must be a string' })
  } else if (realmId.length === 0) {
    problems.push({ code: 'empty-string', path: '$.realmId', detail: 'the realm id must be non-empty' })
  }
  let anchor: string | null = null
  if (effectAnchorRoot !== undefined) {
    if (typeof effectAnchorRoot !== 'string') {
      problems.push({ code: 'field-type', path: '$.effectAnchorRoot', detail: 'the anchored row\'s governed root is injected by the trusted assembly and must be a string' })
    } else if (effectAnchorRoot.trim().length === 0) {
      problems.push({ code: 'empty-string', path: '$.effectAnchorRoot', detail: 'an anchored row must carry its governed root; an empty root claims nothing' })
    } else if (!(effectAnchorRoot.startsWith('/') || /^[A-Za-z]:[\\/]/.test(effectAnchorRoot))) {
      problems.push({ code: 'locator-rejected', path: '$.effectAnchorRoot', detail: 'the governed root of an anchored row must be an absolute path (the plane mounts anchored rows on absolute governed roots only)' })
    } else {
      anchor = effectAnchorRoot
    }
  }
  if (problems.length > 0) return { ok: false, problems }
  const realm = realmId as string
  const arms = anchor === null ? effectArms(realm, parsed) : anchoredEffectArms(realm, parsed, anchor)
  const derived = parseRequestedEffectSet(arms)
  if (!derived.ok) {
    return { ok: false, problems: repath(derived.problems) }
  }
  return { ok: true, value: derived.value }
}

/** One raw effect arm (pre-canonicalization; the algebra validates/frozen-forms every one). */
type EffectArm =
  | { readonly kind: 'tool-invoke'; readonly toolName: string; readonly resource: null }
  | { readonly kind: 'list' | 'read'; readonly resource: Record<string, unknown> }

function effectArms(realm: string, parsed: ParsedToolArgs): readonly EffectArm[] {
  const invoke: EffectArm = { kind: 'tool-invoke', toolName: parsed.tool, resource: null }
  if (parsed.tool === 'bash') {
    // Law 2: the tool itself is the ONLY claimed effect of a shell call.
    return [invoke]
  }
  const walk: EffectArm = {
    kind: 'list',
    // `directory` is manufactured here, never spellable from args: the
    // EFFECT↔RESOURCE coupling law demands it for `list`.
    resource: { realmId: realm, kind: 'directory', canonicalLocator: parsed.target.locator, rights: ['list'] },
  }
  if (parsed.tool === 'glob') return [invoke, walk]
  const content: EffectArm = {
    kind: 'read',
    resource: { realmId: realm, kind: parsed.target.placement, canonicalLocator: parsed.target.locator, rights: ['read'] },
  }
  return [invoke, walk, content]
}

/**
 * U7-6 GLUE-4 — the anchored form of the law (module header): the search
 * arms claim the row's GOVERNED WALK SURFACE (the absolute managed root the
 * assembly injected), never the raw target. The invoke arm still names the
 * row's real class; the shell arm is untouched by the anchor. The governed
 * root is an ABSOLUTE governed root — the same resource-kind rule the
 * governed read row carries (`fs-family/read-executor`: absolute ⇒
 * `absolute-path`).
 */
function anchoredEffectArms(realm: string, parsed: ParsedToolArgs, root: string): readonly EffectArm[] {
  const invoke: EffectArm = { kind: 'tool-invoke', toolName: parsed.tool, resource: null }
  if (parsed.tool === 'bash') return [invoke]
  const walk: EffectArm = {
    kind: 'list',
    resource: { realmId: realm, kind: 'directory', canonicalLocator: root, rights: ['list'] },
  }
  if (parsed.tool === 'glob') return [invoke, walk]
  const content: EffectArm = {
    kind: 'read',
    resource: { realmId: realm, kind: 'absolute-path', canonicalLocator: root, rights: ['read'] },
  }
  return [invoke, walk, content]
}

function repath(problems: readonly ToolContractProblem[]): readonly ToolContractProblem[] {
  return problems.map((problem) => ({
    ...problem,
    path: problem.path === '$' ? '$.effects' : `$.effects${problem.path.slice(1)}`,
  }))
}

/**
 * The `ParsedTarget` → `canonicalLocator` bridge kept as a named export so the
 * parser tests and the schema tests speak of ONE locator rule (the raw
 * spelling, whitespace included — canonicalization to an OS path is the
 * trusted provider's job at exec, `resource.ts` LOCATOR RULES).
 */
export function targetLocatorOf(target: ParsedTarget): string {
  return target.locator
}
