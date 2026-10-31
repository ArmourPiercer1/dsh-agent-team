/**
 * Ambient declarations for `tests/kits/pr-i1b-real-host/gate-order.mjs` — the PR-I1b gate-order measurement.
 * The kit module is plain ESM JavaScript; the TypeScript merge-gate spec that RE-RUNS this measurement at
 * read time (round 3 of #522, F-I1b3-3) needs the same strict-mode treatment as `tests/paths.mjs` (TS7016),
 * so the API is declared here and kept in sync with the runtime module. The shape mirrors the capture's
 * `resolvePathOrder` field in `packages/runtime/test/a6-pr-i1b-admission.test.ts`: if the two drift, the
 * field-for-field comparison in `readRealHostCapture` reddens, which is the enforcement of this file.
 */

export interface GateOrderMeasurement {
  /** True only when the role-closure check precedes the envelope call inside `resolveControl`, with exactly one of each. */
  readonly ok: boolean
  /** 1-based line of the closure marker in `packages/runtime/control/service.ts`, or null when absent. */
  readonly closureLine: number | null
  /** 1-based line of the envelope call in `packages/runtime/control/service.ts`, or null when absent. */
  readonly envelopeLine: number | null
  /** The measurement sentence the capture records verbatim. */
  readonly measured: string
}

export declare function measureResolvePathGateOrder(src: string): GateOrderMeasurement
