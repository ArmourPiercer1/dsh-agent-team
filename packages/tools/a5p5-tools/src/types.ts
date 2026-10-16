/**
 * `a5p5-tools` Phase 1 — closed shapes for the Team-owned Search/Shell tool
 * surface (Alpha.5 PR5, implementation plan §8; design pipeline
 * post-poc-technical-design.md §4: `parse args → canonical target/resource
 * scope → … → render/presentationMeta`).
 *
 * DORMANT BY CONTRACT: nothing outside `packages/tools/a5p5-tools/` imports
 * this lane (pinned by `a5p5-dormant-audit`); the lane registers NOTHING into
 * any barrel, registry, tsconfig solution or scanner — wiring is a reviewed
 * integration move, exactly like the PR0 lane's `a5p0-layer-audit` precedent.
 *
 * WHAT LIVES HERE: only the CLOSED data shapes shared by the argument parser
 * (`args.ts`), the effect-schema derivation (`effects-schema.ts`) and the
 * renderer (`render.ts`). Security semantics deliberately do NOT live here:
 * the effect algebra is consumed READ-TIME from
 * `domain/tool-governance` (`effects.ts` / `resource.ts` / `parse-util.ts`),
 * never re-declared — this lane adds no second authorization fact (the
 * `INTERFACES-v1.md` C-ADM rule "接口面只读消费；禁第二授权库").
 *
 * THE THREE LAWS ENCODED BY THESE SHAPES:
 *
 *  1. NO REALM IN MODEL ARGS. `realmId` never appears in any `*Args` shape —
 *     the realm is injected by the caller (the admission context), so a model
 *     can never self-claim a Realm (design §1 realm non-confusion). An
 *     argument record that carries `realmId` is an `unknown-field` refusal.
 *  2. NO SIDE-EFFECT TEXTUAL PREDICTION. `ParsedShellArgs` keeps `command`
 *     opaque; the effect derivation for `bash` claims ONLY the tool-invoke
 *     effect (S0 matrix M-07: 禁命令文本网页级正则预测副作用). File/network
 *     reality is enforced by the confined-execution provider (PR4), never by
 *     regex-guessing the command string into claimed effects.
 *  3. UNTRUSTED RESULT CONTENT IS DATA. Every search path/match text and every
 *     shell stdout/stderr byte arrives only inside an `*Outcome` shape and is
 *     sanitized at render time (render.ts) — the renderer's structural lines
 *     are the only unindented lines of a presentation.
 *
 * Purity: no `node:*`, no I/O, no clock (mirrors the PR0 lane's law).
 *
 * @module @dsh-agent-team/tools/a5p5-tools/types
 */

import type { ResourceKind } from '../../../domain/tool-governance/src/index.js'

/** The Team tool names of this slice (closed set; wiring may alias, not extend, it). */
export const A5P5_TOOL_NAMES = ['grep', 'glob', 'bash'] as const

/** One tool name of this lane. */
export type A5P5ToolName = (typeof A5P5_TOOL_NAMES)[number]

/** The closed grep output modes (native-parity vocabulary, R3 route). */
export const GREP_OUTPUT_MODES = ['content', 'files_with_matches', 'count'] as const

/** One grep output mode. */
export type GrepOutputMode = (typeof GREP_OUTPUT_MODES)[number]

/**
 * The placements a tool target may carry: exactly the three filesystem
 * `ResourceKind`s whose locator syntax a model can spell (design §3.1 —
 * relative anchors at the immutable workspace; `~/` is Realm Home; absolute
 * paths are intentional out-of-workspace expressions). `directory`/`metadata`/
 * `network-destination` placements are NOT spellable from args: the effect
 * schema manufactures the `directory` arm itself when a `list` effect needs
 * one (the EFFECT↔RESOURCE coupling law in `effects.ts`).
 */
export const TARGET_PLACEMENTS = ['workspace', 'realm-home', 'absolute-path'] as const satisfies readonly ResourceKind[]

export type TargetPlacement = (typeof TARGET_PLACEMENTS)[number]

/**
 * One parsed, classified search/shell target. `locator` is the RAW spelling
 * with legal whitespace preserved (never trimmed — `trim()` would rename a
 * file, `resource.ts` locator law); the `..` walk and URI-scheme rules were
 * already refused by the parser before this shape exists.
 */
export interface ParsedTarget {
  readonly placement: TargetPlacement
  readonly locator: string
}

/** Parsed arguments of `grep` (all defaults materialized — nothing hidden). */
export interface ParsedGrepArgs {
  readonly tool: 'grep'
  readonly pattern: string
  readonly target: ParsedTarget
  /** Optional filename filter; ABSENT (never `undefined`-valued) when unset. */
  readonly globFilter?: string
  readonly outputMode: GrepOutputMode
  readonly fixedString: boolean
  readonly ignoreCase: boolean
  readonly multiline: boolean
  readonly contextLines: number
  readonly maxResults: number
}

/** Parsed arguments of `glob` (filename traversal only — never content). */
export interface ParsedGlobArgs {
  readonly tool: 'glob'
  readonly pattern: string
  readonly target: ParsedTarget
}

/** Parsed arguments of `bash` (foreground + background request accepted; scheduling is PR4/PR5-later, not this slice). */
export interface ParsedShellArgs {
  readonly tool: 'bash'
  /** Opaque command text: NEVER inspected for effect derivation (law 2). */
  readonly command: string
  readonly cwd: ParsedTarget
  /** Optional bound; absent means the provider default (never this lane's). */
  readonly timeoutMs?: number
  readonly background: boolean
}

/** Any parsed argument set of this lane. */
export type ParsedToolArgs = ParsedGrepArgs | ParsedGlobArgs | ParsedShellArgs

/** One content-mode match line (path/line/column are result-side strings — untrusted). */
export interface SearchMatchLine {
  readonly path: string
  readonly line?: number
  readonly column?: number
  readonly text: string
}

/** One count-mode row. */
export interface SearchCountRow {
  readonly path: string
  readonly count: number
}

/**
 * A completed search outcome (produced by a later phase's real-rg execution;
 * this slice only RENDERS it). Only ONE of the three arrays is populated per
 * `outputMode`; `truncated` means bounded output cut rows that exist — the
 * Spill/overflow attribution is a later PR5 slice, here it is honestly false-to-truncated with no spill pointer.
 */
export interface SearchOutcome {
  readonly outputMode: GrepOutputMode
  readonly matches: readonly SearchMatchLine[]
  readonly counts: readonly SearchCountRow[]
  readonly files: readonly string[]
  readonly totalMatches: number
  readonly truncated: boolean
}

/**
 * A completed shell outcome. `exitCode === null` means NOT OBSERVED (killed at
 * timeout before an exit was seen) — never a fabricated 0 and never conflated
 * with "stopped": `timedOut`/`cancelled` stay distinct (C-GW/C-PROC: 取消与
 * Job 未结束不能被误写为已停止).
 */
export interface ShellOutcome {
  readonly exitCode: number | null
  readonly stdout: string
  readonly stderr: string
  readonly timedOut: boolean
  readonly cancelled: boolean
  readonly truncated: boolean
}

/**
 * Phase 2 (spill slice): the attribution pointer a renderer adds when the
 * FULL payload lives in the world-bound spill store. The pointer states the
 * FACT (where the full bytes are, how many) — reading them re-checks
 * authorization at read time (`spill.ts`), so the pointer is attribution,
 * never an implicit grant.
 */
export interface SpillPointer {
  readonly spillId: string
  readonly bytes: number
}

/** Presentation meta of a rendered search (the closed `presentationMeta` arm, S0 D-3: the R3 renderer draws it itself). */
export interface SearchPresentationMeta {
  readonly kind: 'search'
  readonly outputMode: GrepOutputMode
  readonly totalMatches: number
  readonly truncated: boolean
  readonly spill?: SpillPointer
}

/** Presentation meta of a rendered shell run. */
export interface ShellPresentationMeta {
  readonly kind: 'shell'
  readonly exitCode: number | null
  readonly timedOut: boolean
  readonly cancelled: boolean
  readonly truncated: boolean
  readonly spill?: SpillPointer
}

/** Either presentation meta arm. */
export type PresentationMeta = SearchPresentationMeta | ShellPresentationMeta

/** A rendered presentation: model/UI-facing text plus the STRUCTURED meta twin. */
export interface RenderedPresentation<M extends PresentationMeta = PresentationMeta> {
  readonly text: string
  readonly presentationMeta: M
}
