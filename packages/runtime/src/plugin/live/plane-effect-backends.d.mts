/**
 * plane-effect-backends.d.mts — the tsc type surface of
 * `plane-effect-backends.mjs` (the same `.mjs` + adjacent `.d.mts` pattern
 * as `a2-canonical-operation-realfs`, `p7t5-no-creation-scan`, the
 * `p8s5a-*` helpers, and `t12a-live-bridge`: only `.mjs` files import
 * `node:` builtins, and tsc (NodeNext) resolves THESE declarations for
 * importers of the `.mjs`; the plain-node/vitest runtime keeps loading
 * the untouched `.mjs` natively).
 *
 * SCOPE HONESTY: this is the MINIMAL surface actually consumed by
 * `test/a5-read-slice-window.test.ts` (D1 leg A, P4 leg B) — NOT the
 * module's full runtime API. Other exports exist at runtime and are
 * deliberately NOT typed here; a future typed importer must widen this
 * file with real signatures (never by widening to `any`).
 *
 * @module @dsh-agent-team/runtime/src/plugin/live/plane-effect-backends (type surface)
 */

/**
 * The governed `read` executor: a callable that RESOLVES a discriminated
 * ok/refused outcome — refusals come back as VALUES from the executor;
 * the THROW transport lives in the OUTER read def, not here.
 */
export interface GovernedReadExecutor {
  (raw: unknown, corr?: unknown): Promise<unknown>
  /**
   * BYTE-FETCH-STAGE ENTRY count: incremented when a call ENTERS the
   * byte-reading stage (after admission); later in-stage refusals
   * (over-cap once the fetch began, read errors) may still have
   * incremented it. NOT a syscall meter, NOT a completion meter, and by
   * itself NOT evidence of zero I/O.
   */
  execCount(): number
  /**
   * A5-M2 pre-dispatch leg: run ONLY the PA admission (Part A) for this
   * execution token and hold the answer for its body. Resolves
   * `{ kind: 'authorized' | 'refused' | 'cancelled', … }`; it never reads a
   * byte and never terminalises the token.
   */
  paHandoffOpen(raw: unknown, corr?: unknown): Promise<unknown>
  /**
   * The terminal close (`tools/result`, and the adapter's own deny legs):
   * idempotent, synchronous, and it leaves a state the same token cannot
   * revive. Returns the correlation whose plan fact the caller must drop.
   */
  paHandoffClose(token: unknown): string | undefined
  /** Mount teardown: no hand-off survives its mount. */
  paHandoffCloseAll(): void
}

/**
 * Build the governed `read` executor over the controlled-fs instance
 * root. The input bag is the assembly's own open shape (`realmId`,
 * `rootDir`, `policy`, `decide`, `observe`, optionally `subtreeContains`
 * and the host seams) — the semantics live in the `.mjs`; this surface
 * only lets typed consumers hand the bag over and take the executor
 * back.
 */
export function createGovernedReadExecutor(
  input: Record<string, unknown>,
): GovernedReadExecutor

/**
 * The PURE-LEXICAL layer of the anchored resolution (PR358 fix-5): the same
 * front refusals and the same lexical join/normalize the full resolver
 * performs, with ZERO filesystem calls. A5-M2 r7: typed consumers (the
 * production resource-canonicalization seam and the R-C1-13 fixed point)
 * anchor WORKSPACE-RELATIVE rule paths with it — declaration only, the
 * semantics live in the `.mjs`.
 */
export function lexicalAnchor(
  rootDir: string,
  rawPath: string,
): { ok: true; path: string } | { ok: false; code: string; detail: string }
