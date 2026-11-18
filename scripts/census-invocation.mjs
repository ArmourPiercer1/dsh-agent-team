#!/usr/bin/env node
/**
 * census-invocation — the census `vitest` argv, in ONE place.
 *
 * WHY THIS FILE EXISTS. TINF M4 has to put a runnable command on every plan task, and the plan
 * must not invent one: the command has to be the invocation the census actually executes. Before
 * this file that argv lived inline in `scripts/ci-pr-gate.mjs` (the `census` leg, twice: the full
 * capture and the load-family re-sample). A planner that copied those strings would be a second
 * source that can drift from the runner, and a plan whose command is not the runner's command is a
 * plan for a different census. So the argv is extracted here and `ci-pr-gate.mjs` imports it: the
 * plan and the gate now build the command with the same function, and changing the census
 * invocation is a one-line diff in one file that both callers see.
 *
 * WHAT THIS IS NOT. It is not a schedule, a root list or a capture count — those come from the
 * collection authority (`scripts/test-catalog.mjs` for the roots, `scripts/census-plan.mjs` for the
 * captures). This module only knows the shape of one vitest invocation.
 *
 * THE ARGUMENT ORDER IS LOAD-BEARING AND UNCHANGED from the gate's inline literals:
 *   pnpm exec vitest run [<file>] --reporter=default --reporter=json --outputFile.json=<path>
 *                    [--testTimeout=<ms>] --maxWorkers=<N>
 * `--reporter=default` is kept because the transcript's human-readable summary is what the re-grade
 * step reads; `--reporter=json` is what the census is graded from; `--outputFile.json` is the file
 * the aggregator's per-task evidence points at. `--testTimeout` is appended ONLY when an operator
 * passed a clock (the gate prints which clock was in force on every leg line, and the plan records
 * it in its digest), so a plan for a run under the suite default carries no `--testTimeout` at all.
 *
 * THE WORKER CEILING IS EXPLICIT. Vitest's default is `max(availableParallelism() - 1, 1)`; the
 * perf-diag memo measured the effective 3-worker capture on a 4-CPU mask and found 4 workers on the
 * same 4 CPUs finishing ~102 s sooner on a wait-heavy population
 * (`docs/plans/memo/perf-diag-20261115/README.md` §5). Before perf-rank1 this argv carried no
 * `--maxWorkers` at all, so the ceiling was whatever the machine implied; it is now named here, in
 * the module that builds the argv for the census capture, its load-family re-sample and every census
 * plan task, so those three cannot carry different ceilings. The value is NOT derived from the
 * machine's core count — the hosted runner's own shape is an external assumption — so every gate run
 * logs `available_parallelism` and `workers` on its `DSH-CI-RUN` line, and an L2 can judge the
 * ceiling against the machine it actually got. The rest of the invocation — reporters, the JSON
 * report path, the optional clock, one `vitest run` over the whole population, two serial captures —
 * is unchanged.
 *
 * @module scripts/census-invocation
 */

/**
 * The census `vitest` worker ceiling. 4 = the approved perf-diag rank-1 value (2026-11-16), one
 * above the previous EFFECTIVE 3 (vitest's `availableParallelism() - 1` on the measured 4-CPU
 * shape). Named, exported and used by `censusVitestArgv` so no caller can carry a different number.
 */
export const CENSUS_MAX_WORKERS = 4

/**
 * The census command for one capture (or one re-sample of a single file).
 *
 * @param {object} p
 * @param {string} p.jsonPath        where vitest writes its JSON report
 * @param {number|null} [p.testTimeout]  operator clock override in ms; null = the suite's own
 * @param {string|null} [p.file]     re-sample one file instead of the whole config population
 * @returns {string[]} the argv to hand to `pnpm`
 */
export function censusVitestArgv({ jsonPath, testTimeout = null, file = null } = {}) {
  if (typeof jsonPath !== 'string' || jsonPath === '') {
    throw new Error('censusVitestArgv: jsonPath is required (the census is graded from the JSON report)')
  }
  return [
    'exec', 'vitest', 'run',
    ...(file === null ? [] : [String(file)]),
    '--reporter=default',
    '--reporter=json',
    `--outputFile.json=${jsonPath}`,
    ...(testTimeout === null ? [] : [`--testTimeout=${String(testTimeout)}`]),
    `--maxWorkers=${String(CENSUS_MAX_WORKERS)}`,
  ]
}

/** The command word the argv above is executed with (the gate spawns `pnpm`). */
export const CENSUS_COMMAND = 'pnpm'

/** One capture's report path relative to the repository root, as the gate writes it. */
export function censusCaptureRel(jsonPath) {
  return String(jsonPath).replace(/\\/g, '/')
}
