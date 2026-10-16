/**
 * Alpha.5 PR2 (plan §5, hard clause H2 @ user 05:4x/07:0xZ) — THE RUNTIME
 * ASSURANCE VERIFICATION THAT RUNS AHEAD OF ANY HARD-PROFILE CONSUMPTION.
 *
 * THE HOLE THIS CLOSES. `assuranceSatisfies` (PR0) answers the CAPABILITY
 * question from the LEVEL alone — by design, because the derivation law keeps
 * it a capability question. The schema (PR0 M-2) lets a dimension record
 * `level: 'enforced'` with `mechanism: null`, `trustRoot: null`,
 * `evidence: null`: an authored CLAIM that nothing backs it. A runtime that
 * consumes assurance by reading the level would let exactly that claim cash a
 * hard profile — the overclaim design §1.4/§5 refuses, and the user's H2 makes
 * a hard law: **a level never redeems a capability by itself**. At runtime,
 * every demanded dimension must carry REAL `mechanism` / `trustRoot` /
 * `evidence` values and a REAL `realmId`, and they must MATCH the record an
 * independent probe observed. `enforced` + `null` mechanism = REFUSAL.
 *
 * THE ORDER (H2 verbatim: 先于 hard-profile): this verification runs INSIDE
 * Admission, before an `admitted` decision can be minted into a grant, and
 * therefore before PR3's ControlledFs / PR4's ConfinedProcessProvider are ever
 * asked to enforce the profile. `a5p2-assurance-probe` pins the ordering too:
 * the probe answers before the ledger sees the call.
 *
 * THE PROBE IS AN INJECTED PORT. Until PR4 lands the real capability probe
 * (backend/OS/permission detection, design §5), the assembly injects
 * {@link createStubAssuranceProbe}; its semantics (explicitly-stated
 * dimensions answer, everything else is the honest `{ ok: false }`) and the
 * PR4 replacement contract are pinned in this lane's README. A stub that
 * guessed "probably fine" would reintroduce the hole with extra steps.
 *
 * THE TWO REFUSALS, kept apart (§5 distinctions):
 *  - the LEVEL does not meet the demand → `IO_POLICY_UNSUPPORTED`
 *    (Provider capability insufficient — the honest "this profile cannot run");
 *  - the level claims to meet the demand but the RECORD is unverifiable —
 *    a null mechanism/trustRoot/evidence, a blank string, a probe that cannot
 *    observe, or a claim that CONTRADICTS the probe (any field, including
 *    `realmId`) → `TOOL_BINDING_UNVERIFIED` (the Binding's claim cannot be
 *    verified at call time; PR1's Guard established the same code for the same
 *    class of fact).
 * Every demanded dimension is checked and every failure reported — never just
 * the first (PR0's `assuranceSatisfies` precedent).
 *
 * Purity: no `node:*`, no I/O, no clock.
 *
 * @module @dsh-agent-team/runtime/tool-admission/assurance-runtime
 */
import { type AssuranceContract, type AssuranceDimension, type AssuranceRequirement, type GovernanceError, type GovernanceResult, type ToolBinding } from '../../domain/tool-governance/src/index.js';
/** What a probe OBSERVED for one dimension — all four fields real strings. */
export interface AssuranceProbeRecord {
    readonly mechanism: string;
    readonly realmId: string;
    readonly trustRoot: string;
    readonly evidence: string;
}
/** One probe answer: the observation, or the honest reason it has none. */
export type AssuranceProbeAnswer = ({
    readonly ok: true;
} & AssuranceProbeRecord) | {
    readonly ok: false;
    readonly detail: string;
};
/** The probe port: asked per (binding, dimension), on every consuming call. */
export type AssuranceProbe = (binding: ToolBinding, dimension: AssuranceDimension) => AssuranceProbeAnswer;
/** A record the probe cannot confirm answers `{ ok: false }` — never a guess. */
export declare function createStubAssuranceProbe(observed: Readonly<Partial<Record<AssuranceDimension, AssuranceProbeRecord>>>): AssuranceProbe;
/** One verified dimension, recorded with what backed the verification. */
export interface VerifiedAssurance {
    readonly dimension: AssuranceDimension;
    readonly requirement: AssuranceRequirement;
    readonly mechanism: string;
    readonly realmId: string;
    readonly trustRoot: string;
    readonly evidence: string;
}
/** Why one dimension was refused at runtime. */
export interface AssuranceRuntimeRefusal {
    readonly dimension: AssuranceDimension;
    readonly requirement: AssuranceRequirement;
    readonly code: GovernanceError['code'];
    readonly detail: string;
}
/**
 * Verify the contract's demanded dimensions AGAINST THE PROBE before any
 * hard-profile consumption. `required` maps a dimension to what the effective
 * Policy derives from it (the derivation law: the POLICY demands, the
 * Provider proves; a level never demands for itself).
 * @param contract - the Binding's assurance contract (authored claim).
 * @param required - the per-dimension demands the call derives from Policy.
 * @param probe - the independent observation port (stub until PR4).
 */
export declare function verifyAssuranceForHardProfile(contract: AssuranceContract, required: Readonly<Partial<Record<AssuranceDimension, AssuranceRequirement>>>, probe: AssuranceProbe, binding: ToolBinding): GovernanceResult<{
    readonly verified: readonly VerifiedAssurance[];
}>;
//# sourceMappingURL=assurance-runtime.d.ts.map