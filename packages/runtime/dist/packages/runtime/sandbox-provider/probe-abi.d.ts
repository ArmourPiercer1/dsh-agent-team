/**
 * THE AUTHORITATIVE PROBE SURFACE — the ruling from
 * `evidence/alpha5/pr4-pre/findings-landlock-probe-divergence.md` §3, adopted
 * verbatim into C-PROC:
 *
 *   authoritative surface = BARE SYSCALL `GET_VERSION` + REAL enforcement,
 *   BOTH legs (the launcher self-confines inside its own process — the host
 *   process never calls `landlock_restrict_self`, and no system setting is
 *   touched); existence checks (python3 / launcher script / `runnerCommand`)
 *   are PRECONDITION REPORTS ONLY and their wording must carry NO
 *   kernel-capability assertion — the host bash backend's historical defect
 *   was exactly "a missing binary probes unusable the same way an unenforcing
 *   kernel does"; the host-side copy fix is an upstream seam request (lane
 *   doc), not an edit this lane may make.
 *
 * Every integer crosses the syscall boundary as `c_long` and the ruleset
 * attribute is `pack("@QQ")` / the rule `pack("@Qi")` — the exact measured
 * posture of `04-process/landlock-diag.sh` and `10-landlock-lanes`, kept in
 * the reference launcher this module shells out to (fixed argv arrays, never
 * a shell string).
 *
 * @module @dsh-agent-team/runtime/sandbox-provider/probe-abi
 */
import { type ProcessCapabilityRow } from './contract-stub.js';
import { type FdPlan } from './fd-inheritance.js';
/** One launcher invocation outcome (no shell — argv arrays only). */
export interface RunResult {
    readonly rc: number | null;
    readonly stdout: string;
    readonly stderr: string;
}
/** Everything this module needs from the outside world, injectable for tests. */
export interface LauncherDeps {
    readonly pythonPath: string;
    readonly launcherPath: string;
    readonly run: (argv: readonly string[], timeoutMs?: number) => RunResult;
}
/** The production deps: spawnSync without a shell, bounded buffers. */
export declare function createLauncherDeps(init: {
    pythonPath: string;
    launcherPath: string;
}): LauncherDeps;
/** The ABI probe verdict (bare `landlock_create_ruleset(NULL, 0, GET_VERSION)`). */
export interface AbiVerdict {
    readonly kind: 'abi-available' | 'abi-unavailable';
    readonly abiVersion: number | null;
    readonly rawLines: readonly string[];
    readonly syscall: string;
}
/** Run the ABI probe leg (GET_VERSION) through the launcher. */
export declare function runAbiProbe(deps: LauncherDeps): AbiVerdict;
/** The three enforcement legs pinned by the C-PROC ruling. */
export declare const ENFORCEMENT_LEGS: readonly ["selective", "denyall", "badhandled"];
export type LegName = (typeof ENFORCEMENT_LEGS)[number];
/** One check inside a leg (name / expect / got / match — raw errno words). */
export interface LegCheck {
    readonly name: string;
    readonly expect: string;
    readonly got: string;
    readonly match: boolean;
}
/** One enforcement leg verdict. */
export interface LegVerdict {
    readonly leg: LegName;
    readonly verdict: 'ENFORCE-CONFIRMED' | 'DEMO-CONFIRMED' | 'NO-ENFORCEMENT' | 'MIXED/FAILED' | 'ABI-UNAVAILABLE';
    readonly rc: number | null;
    readonly checks: readonly LegCheck[];
}
/** Run one real enforcement leg; the launcher self-confines, this process never does. */
export declare function runEnforcementLeg(deps: LauncherDeps, leg: LegName, scratchDir: string): LegVerdict;
/** The FD-closure leg (P2 fork-not-exec handoff). */
export interface FdCloseVerdict {
    readonly verdict: 'FD-CLOSURE-CONFIRMED' | 'NO-ENFORCEMENT' | 'MIXED/FAILED' | 'ABI-UNAVAILABLE';
    readonly declaredSeen: boolean | null;
    readonly undeclaredClosed: boolean | null;
    readonly rc: number | null;
}
/** Run the real FD-closure leg: ruleset compiled parent-side, fork (no exec), child closes undeclared + self-locks. */
export declare function runFdCloseProbe(deps: LauncherDeps, scratchDir: string, plan?: FdPlan): FdCloseVerdict;
/** The vocabulary an availability note must NEVER contain (ruling: 文案禁内核断言). */
export declare const KERNEL_ASSERTION_FORBIDDEN: readonly ["kernel", "landlock", "enforc", "abi", "syscall"];
/** One precondition row. */
export interface AvailabilityRow {
    readonly subject: 'python3' | 'launcher-script' | 'runner-command';
    readonly present: boolean;
    readonly note: string;
}
/** Preflight inputs (kept structural so tests can simulate an absent runtime). */
export interface PreflightInput {
    readonly pythonPath: string;
    readonly launcherPath: string;
    readonly runnerCommand: string | null;
}
/**
 * Run the existence preflight. Failure notes state ONLY what was looked for
 * and not found; whether the KERNEL can enforce is a question this function
 * has no way to answer and therefore never comments on.
 */
export declare function runAvailabilityPreflight(input: PreflightInput): readonly AvailabilityRow[];
/** The probe inputs the mapping reads (kept a pure function of verdicts). */
export interface ProbeFacts {
    readonly abiVersion: number | null;
    readonly legs: Partial<Record<LegName, LegVerdict>>;
}
/** Where the rows bind their claims. */
export interface ProbeBinding {
    readonly realmId: string;
    readonly trustRoot: string | null;
    readonly evidenceRef: string;
}
/**
 * Map probe facts to capability rows under the DOUBLE-EVIDENCE LAW:
 * `enforced` is issued only when GET_VERSION answered AND BOTH enforcement
 * legs confirmed; any missing or MIXED leg demotes. The rows the lane can
 * never claim (metadata hiding, alias safety, network deny) stay `unsupported`
 * whatever the host says (PoC-4a / PoC-4b posture, no-overclaim law).
 */
export declare function probeToCapabilities(abi: AbiVerdict, legs: Partial<Record<LegName, LegVerdict>>, binding: ProbeBinding): readonly ProcessCapabilityRow[];
//# sourceMappingURL=probe-abi.d.ts.map