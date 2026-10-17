/**
 * THE REALM / TRUST-ROOT EVIDENCE SURFACE — PR4's obligation from the PR2
 * freeze (COORDINATION: "PR4 必须以真实 probe 的 evidence/realmId/trustRoot
 * 校验先于 hard-profile 执行") and the PR0 review M-1 cross-law (an
 * `enforced` level with a null mechanism is a runtime refusal, not a schema
 * pass). This lane ships the EVIDENCE INTERFACE plus the negative controls
 * only: `HARD_PROFILE_ENABLED` is compiled OFF and nothing here turns a
 * verification ACCEPT into any runtime enablement — the verifier answers a
 * capability question, never grants (derivation law, design §1.4).
 *
 * The fabrication guard is the point: a row's `evidence` reference must
 * resolve to a RECORDED leg row — legs are recorded by the real probe runner
 * (`recordLegEvidence` is the single factory), so "enforced" cannot be typed
 * in by hand.
 *
 * Purity: no `node:*`, no I/O.
 *
 * @module @dsh-agent-team/runtime/sandbox-provider/realm-evidence
 */
import { type AssuranceDimension, type ProcessCapabilityRow, type ProviderResult } from './contract-stub.js';
/** Which leg produced a recorded verdict. */
export type EvidenceLegName = 'abi-version' | 'selective' | 'denyall' | 'badhandled' | 'fd-close' | 'confined-exec';
/** One recorded leg. Factories below are the ONLY honest construction path. */
export interface LegEvidenceRow {
    readonly leg: EvidenceLegName;
    readonly verdict: string;
    readonly rawEvidenceRef: string | null;
    readonly argv: readonly string[];
    readonly capturedAt: string;
}
/** One probe session, bound to ONE realm (Realm 不可混淆). */
export interface ProviderProbeEvidence {
    readonly realmId: string;
    readonly trustRoot: string | null;
    readonly abiVersion: number | null;
    readonly legs: readonly LegEvidenceRow[];
    readonly capabilities: readonly ProcessCapabilityRow[];
}
/** The enablement constant of THIS lane: the gate exists, the switch does not. */
export declare const HARD_PROFILE_ENABLED = false;
/** Record one real leg verdict (single factory; stamps capture time once). */
export declare function recordLegEvidence(leg: EvidenceLegName, verdict: string, rawEvidenceRef: string | null, argv: readonly string[], capturedAt?: string): LegEvidenceRow;
/** One hard-profile request: the realm the call runs in + the hard dimensions. */
export interface HardProfileCheck {
    readonly realmId: string;
    readonly hardDimensions: readonly AssuranceDimension[];
}
/**
 * Verify the hard-profile evidence BEFORE acceptance. Every rule below is a
 * negative control pinned by `a5p4-realm-evidence`; an accept is a statement
 * about EVIDENCE, never a grant, and (in this lane) never an enablement.
 */
export declare function verifyHardProfileEvidence(evidence: ProviderProbeEvidence, check: HardProfileCheck): ProviderResult<readonly ProcessCapabilityRow[]>;
//# sourceMappingURL=realm-evidence.d.ts.map