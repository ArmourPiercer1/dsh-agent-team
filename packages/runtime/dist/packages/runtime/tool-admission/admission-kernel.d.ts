/**
 * Alpha.5 PR2 (plan §5, design §4.2/§4.3) — THE OPERATION ADMISSION KERNEL.
 *
 * THE POSITION (design §4.3, verbatim order):
 *
 *   per-call canonical effects → Team Admission + existing ApprovalCase →
 *   single-use OperationGrant → … → monotonic Guard → actual Dispatcher
 *
 * Admission sits BEFORE the body and decides exactly one of the three frozen
 * arms (PR0 `OperationAdmissionDecision`): `admitted` (carries the grant),
 * `requires-approval` (carries the WHOLE immutable effect set — the approver
 * legally covers all effects or none), `denied` (typed §5 error). There is no
 * arm meaning "run first, decide later", and the Guard stays the final
 * un-bypassable refusal BEHIND this door: a permission here never replaces the
 * Guard, and the Guard's abstention never replaces this decision.
 *
 * THE PER-CALL ORDER (each leg is pinned by `a5p2-admission-kernel`):
 *
 *  1. H1 clock gate (clock.ts) — before ANY authorization/expiry use; a
 *     non-finite clock denies with ZERO side effects: no probe, no plan, no
 *     mint, no ledger touch (`body = 0`).
 *  2. Identity/Realm/binding-legality checks (binding ACTIVE, realm of every
 *     effect = the call's Realm, generations current) — the same typed facts
 *     PR1's Guard established, same §5 codes.
 *  3. H2 assurance runtime verification (assurance-runtime.ts) — BEFORE any
 *     hard-profile consumption: the level never redeems alone; the record
 *     must be real and probe-matched. A denied assurance never reaches mint.
 *  4. The expansion plane (PR0 planes, realm-filtered), per the 2026-10-16
 *     ruling (问题2): `undetermined` poisons the WHOLE set (fail-closed,
 *     plan §5 unchanged); a decided policy `deny` is ROUTED, not refused —
 *     it enters the ONE ApprovalCase, whose rung is answered by the envelope
 *     WALK (the deny's owning authority), never by an invented short-circuit
 *     and never by a trusted assembler tag. Human Admin — the top rung
 *     inside envelope support — may approve once with no policy mutation;
 *     a deny whose walk cannot answer refuses as UNATTRIBUTED (ruling ③).
 *     externalHard capability facts and Domain answers are not policy rules:
 *     no approval changes facts (leg 3 gates them; ruling ②).
 *  5. Mint is LAST and only for a decided call: the ledger registers the
 *     grant; consumption stays a SEPARATE edge (`consumeForExecution`), so
 *     "admitted but never executed" cannot fake a spent approval, and
 *     "executed twice" is the one thing the ledger makes impossible.
 *
 * WHAT THE KERNEL NEVER DOES: no clock of its own (the host injects one per
 * call, gated by H1); no model-visible role or grant (every identity field is
 * a server-derived parameter — 无模型输入可信角色/Grant); no auto-narrowing,
 * no retry, no fallback (design §4.3: stale = refusal, full stop); no durable
 * store of its own (the ledger is the assembly's, the approval case stays in
 * Alpha.4's Control plane behind the caller-supplied plan/case identity).
 *
 * Purity: no `node:*`, no I/O, no timers. The `async` shape is the frozen
 * `OperationAdmission` seam, nothing more.
 *
 * PRODUCTION ASSEMBLY ENTRY (PR2/PR3 production-assembly round, P-A writer):
 * THE FILE ALSO CARRIES `deriveTeamPolicyAuthority` (template
 * `capabilities.permissions` → the PR0 policy document + R-1a deny sources —
 * the production replacement for the evidence kits' fixture-constant policy
 * arms) and `createProductionAdmissionAssembly` (the kernel admission
 * production entry class: derivation + kernel wiring + the default-deny gate
 * + the PR3 FS-admission port adapter). The kernel law above this marker is
 * byte-unchanged; the additions REUSE it, never restate it. The assembly
 * contract for the host (GLUE-5) lives at
 * `dev/agent-workflow/evidence/alpha5/prod/pa-CONTRACT.md`.
 *
 * @module @dsh-agent-team/runtime/tool-admission/admission-kernel
 */
import { type AdmissionRequest, type ExecutionLease, type ExecutionLeaseKind, type Effect, type GovernanceResult, type OperationAdmission, type OperationAdmissionDecision, type OperationGrant, type AssuranceDimension, type AssuranceRequirement, type GrantCallContext, type ToolPolicyDocument } from '../../domain/tool-governance/src/index.js';
import type { SubtreeContains } from '../../domain/authority-envelope/src/index.js';
import type { AuthorityEnvelopeDocuments } from '../governance/authority-ceiling.js';
import type { RuntimeAuthority } from '../governance/runtime-authority.js';
import type { TemplatePermissionPolicy } from '../../domain/blueprint/src/types.js';
import { type AssuranceProbe } from './assurance-runtime.js';
import { type PolicyDenySource, type EffectSetApprovalPlan, type PresentedApproval } from './approval-case.js';
import { type GrantLedger } from './grant-mint.js';
/** Which assurance demand the call derives from Policy, per dimension. */
export type RequiredAssuranceReader = (request: AdmissionRequest) => Readonly<Partial<Record<AssuranceDimension, AssuranceRequirement>>>;
/** Kernel wiring. Everything here is TRUSTED INPUT: the assembly, not the
 *  model, supplies documents, generations, clock and ledger. */
export interface AdmissionKernelOptions {
    /** The host wall clock, injected per call (never read by this lane). */
    readonly clock: () => number;
    readonly authorityGeneration: () => number;
    readonly documents: () => AuthorityEnvelopeDocuments;
    /** R-1a (user ruling 2026-10-16 + review 520a250d): the deny-source
     *  projection — derived read-time from the REAL authority state (blueprint
     *  §3.2 lanes / GovernanceMutationService overlay §8.2 entries), carrying
     *  (owning rung, sourceRef, sourceVersion); trusted only when its version
     *  matches the call's authority generation. ABSENT is the stated unwired
     *  state: every DENIED effect then meets a precise refusal — a live gap,
     *  deliberately NOT deferred behind DORMANT. Copying policy denies into
     *  the Envelope as their "source" is forgery, refused by design. */
    readonly denySources?: () => readonly PolicyDenySource[];
    readonly policyDocument: () => ToolPolicyDocument;
    /** The rung whose ask this is — derived server-side (the Member ask). */
    readonly beneficiaryAuthority: RuntimeAuthority;
    readonly assuranceProbe: AssuranceProbe;
    readonly requiredAssurance: RequiredAssuranceReader;
    readonly ledger: GrantLedger;
    readonly subtreeContains?: SubtreeContains;
    /**
     * One-shot grant expiry policy: `null` (default) = no expiry (PR0: NEVER an
     * expiry at zero). A finite reader returns a FUTURE finite instant; anything
     * else fails the mint closed (the parser refuses non-finite stamps).
     */
    readonly grantExpiry?: (issuedAt: number) => number | null;
    readonly onObserve?: (event: Readonly<Record<string, unknown>> & {
        readonly event: string;
    }) => void;
}
/** The call fields the consumption edge needs (clock added by the kernel). */
export type ExecutionCallFields = Omit<GrantCallContext, 'now'> & {
    /** The host's CURRENT cancellation view at the execution edge. */
    readonly cancelRequested?: boolean;
    /** When present, a lease is opened for the consumed grant (background/
     *  process-tree/remote-job); it never widens the grant (PR0 lease law). */
    readonly executionKind?: ExecutionLeaseKind;
    readonly leaseId?: string;
};
export interface AdmissionKernel extends OperationAdmission {
    /** The plan behind a `requires-approval` decision (case identity + rungs). */
    readonly planApproval: (request: AdmissionRequest) => GovernanceResult<EffectSetApprovalPlan>;
    /** After the Alpha.4 case resolves: re-verify PER EFFECT, then mint. */
    readonly issueApprovedGrant: (request: AdmissionRequest, approval: PresentedApproval) => Promise<GovernanceResult<OperationGrant>>;
    /** THE execution edge: finite clock → validate → consume (one-shot) →
     *  optional lease. Cancel-first refuses with ZERO ledger change. */
    readonly consumeForExecution: (grant: OperationGrant, call: ExecutionCallFields) => GovernanceResult<{
        readonly grant: OperationGrant;
        readonly lease: ExecutionLease | null;
    }>;
    /** Lease lifecycle pass-throughs (cancellation ≠ termination, PR0 law). */
    readonly requestCancellation: (lease: ExecutionLease) => GovernanceResult<ExecutionLease>;
    readonly settleTermination: (lease: ExecutionLease, confirmed: boolean) => GovernanceResult<ExecutionLease>;
}
/** The deterministic grantId: the same call identity mints the same id, so a
 *  double mint registers against the SAME id (refused) — no replay surface. */
export declare function grantIdForCall(request: AdmissionRequest, authorityGeneration: number): string;
/**
 * Create the kernel for one Team Agent assembly (per-closure state: only the
 * ledger, and only because consumption has to live SOMEWHERE in-process until
 * PR7's durable store lands behind the same view).
 */
export declare function createAdmissionKernel(options: AdmissionKernelOptions): AdmissionKernel;
/** Input of {@link deriveTeamPolicyAuthority} — the trusted projection arms. */
export interface TemplatePolicyProjectionInput {
    /** REAL authority input: `boundTemplate.capabilities.permissions` (A1-normalized). */
    readonly permissionPolicy: TemplatePermissionPolicy;
    readonly realmId: string;
    /** deny-source provenance prefix: `<templateId>#deny[<i>]`. */
    readonly templateId: string;
    /** The rung that OWNS the static template lane (who wrote the policy). */
    readonly definitionOwnerAuthority: RuntimeAuthority;
    /** The role of THIS install — the template grammar's shell-allow role gate. */
    readonly role: 'leader' | 'member';
    /** Declared path → the effect's canonical locator. Absent ⇒ only paths
     *  already absolute (`/…`) are accepted (identity mapping, the C-FS
     *  absolute-path instance law); anything else fails closed. */
    readonly canonicalizeResource?: (declaredPath: string) => string | null;
    /** The planes' containment law — REQUIRED whenever a subtree rule exists. */
    readonly subtreeContains?: SubtreeContains;
    /** Read-time version stamp for the deny sources (the assembly wires the
     *  SAME reader as `authorityGeneration`, so trust always tracks the call). */
    readonly sourceVersion: () => number;
    /** The Alpha.4 exec dual-gate readout for the leader's whole-tool shell
     *  ALLOW rule. Absent/false ⇒ the rule projects as `ask` + a note — an
     *  allow is never invented here. */
    readonly leaderExecTokenPresent?: () => boolean;
    /** U7-6 GLUE-4 (named center-interface PR) — the trusted assembly's
     *  ROW-CLASS law: effect `tool-invoke` arms for row classes that are not
     *  nameable by the closed rule grammar (`PERMISSION_TOOL_NAMES`), stated
     *  as `<effectClass> ← <ruleTool,…>`: every rule whose tool is a listed
     *  governing tool projects, IN ADDITION to its own arms, a tool-invoke
     *  arm matching `<realm>|tool:<effectClass>` with the SAME ceiling and
     *  the same deny-source treatment. It INVENTS NOTHING: without a
     *  governing rule the class arm stays unprojected (the default-deny gate
     *  still refuses); with one, the coverage question for the plane-
     *  adjudicated class answers with the SAME law the plane's lane already
     *  applies — the coherence this closes is the lane saying allow and the
     *  assembly gate saying IO_POLICY_UNSUPPORTED for one policy. Keys must
     *  be lower-case class tokens that are NOT themselves grammar tools (a
     *  nameable class never rides), MUST appear in the mount's declared
     *  `knownEffectClasses` inventory (an unknown or typo'd class is a typed
     *  refusal, never a silent projection — review R1 F1), and values must be
     *  grammar tools. The projection stays DATA-DRIVEN: no tool-name literal
     *  ever enters this file — the law AND the closed class world both live
     *  in the trusted mount that supplies them. */
    readonly invokeClasses?: Readonly<Record<string, readonly string[]>>;
    /** U7-6 review R1 F1 — the mount's CLOSED row-class inventory: the effect
     *  classes this mount's rows can ever derive. REQUIRED whenever
     *  `invokeClasses` is mounted: a class law whose class world is undeclared
     *  is incoherent and refused (`projection-inventory-missing`); a law key
     *  outside the inventory is refused (`projection-invoke-class-unknown`)
     *  — so a stub, typo, or attacker-shaped class cannot acquire tool-invoke
     *  authority by riding a valid governor. Declaring an inventory WITHOUT a
     *  class law is inert but legal: it states the world, projects nothing.
     *  Entries must be unique lower-case class tokens; grammar-tool names are
     *  legal here (the inventory describes the row world; only the LAW keys
     *  must stay outside the grammar). */
    readonly knownEffectClasses?: readonly string[];
}
/** Result of {@link deriveTeamPolicyAuthority} — the read-time arms. */
export interface TemplatePolicyProjection {
    readonly templateDefault: 'ask' | 'deny';
    /** Read-time document build (the leader exec dual gate answers per read). */
    readonly buildDocument: () => ToolPolicyDocument;
    /** Read-time R-1a deny-source projection (deny lane, declaration order). */
    readonly denySources: () => readonly PolicyDenySource[];
    /** Everything the closed family could not carry — stated, never silent. */
    readonly notes: readonly string[];
    /** Does ANY projected rule (any lane) cover this effect? (default-deny gate) */
    readonly coversEffect: (effect: Effect) => boolean;
}
/**
 * PROJECT the template's static permission policy into the PR0 authority
 * arms — the production replacement for the kits' `allowPolicy(tg, arms)`
 * fixture constants. Deterministic: lane order allow → ask → deny, rules in
 * declaration order, duplicates kept (mirrors the A1 normalization law).
 * Refusals are typed and name the exact rule (path `lane[i]`), because the
 * consumer is a host assembly, not a model.
 */
export declare function deriveTeamPolicyAuthority(input: TemplatePolicyProjectionInput): GovernanceResult<TemplatePolicyProjection>;
/** The trusted wiring of {@link createProductionAdmissionAssembly}. */
export interface ProductionAdmissionConfig {
    /** = `boundTemplate.capabilities.permissions` (the A1-normalized policy). */
    readonly permissionPolicy: TemplatePermissionPolicy;
    readonly realmId: string;
    readonly templateId: string;
    readonly definitionOwnerAuthority: RuntimeAuthority;
    readonly role: 'leader' | 'member';
    /** The host wall clock (H1 gates it per call; no lane-owned clock). */
    readonly clock: () => number;
    /** Same reader the guard publishes with; deny-source versions read it too. */
    readonly authorityGeneration: () => number;
    readonly beneficiaryAuthority: RuntimeAuthority;
    /** Absent ⇒ the documented no-narrowing state (exists, empty; mutation
     *  absent) — the same fact the Alpha.4 plane states for an unmoved team. */
    readonly documents?: () => AuthorityEnvelopeDocuments;
    readonly canonicalizeResource?: (declaredPath: string) => string | null;
    readonly subtreeContains?: SubtreeContains;
    readonly leaderExecTokenPresent?: () => boolean;
    /** Absent ⇒ the lane's honest stub probe (every dimension 'untested' — a
     *  hard profile is NEVER redeemed by it). Hosts wire the real probe when
     *  the OS enforcement (PR4) lands. */
    readonly assuranceProbe?: AssuranceProbe;
    readonly requiredAssurance?: RequiredAssuranceReader;
    /** U7-6 GLUE-4: the trusted plane's row-class law, forwarded verbatim to
     *  the projection (see TemplatePolicyProjectionInput.invokeClasses). */
    readonly invokeClasses?: Readonly<Record<string, readonly string[]>>;
    /** U7-6 review R1 F1: the mount's closed row-class inventory, REQUIRED by
     *  any mounted class law; forwarded verbatim to the projection. */
    readonly knownEffectClasses?: readonly string[];
    readonly grantExpiry?: (issuedAt: number) => number | null;
    readonly ledger?: GrantLedger;
    /** The host's cancellation view at the execution edge (port reads it). */
    readonly cancelRequested?: (callId: string) => boolean;
    readonly onObserve?: (event: Readonly<Record<string, unknown>> & {
        readonly event: string;
    }) => void;
}
/** Structurally the C-FS lane's `FsAdmissionPort` (the lanes stay decoupled:
 *  this is the kernel's OWN execution edge, shaped to the port the C-FS
 *  binding consumes — no second authorization fact, no lane-to-lane import). */
export interface ProductionFsAdmissionPort {
    readonly recheckCall: (intent: {
        readonly op: string;
        readonly canonicalLocator: string;
        readonly parametersFingerprint: string;
    }) => Promise<{
        readonly ok: true;
    } | {
        readonly ok: false;
        readonly reason: string;
    }>;
}
export interface ProductionAdmissionAssembly {
    /** The wired kernel (approval loop: planApproval / issueApprovedGrant ride
     *  it — the Alpha.4 ApprovalCase stays the ONE case, GLUE-5 owns the loop). */
    readonly kernel: AdmissionKernel;
    readonly realmId: string;
    /** Read-time projection (dual gate answers per read). */
    readonly policyDocument: () => ToolPolicyDocument;
    readonly denySources: () => readonly PolicyDenySource[];
    readonly projectionNotes: readonly string[];
    /** The consumption view to hand the C-FS provider (`consumed:` config arm). */
    readonly consumed: (grantId: string) => boolean;
    /** default-deny gate + `kernel.admit` (zero kernel touch on a gate denial). */
    readonly admitCall: (request: AdmissionRequest) => Promise<GovernanceResult<OperationAdmissionDecision>>;
    readonly planApproval: AdmissionKernel['planApproval'];
    readonly issueApprovedGrant: AdmissionKernel['issueApprovedGrant'];
    readonly consumeForExecution: AdmissionKernel['consumeForExecution'];
    /** ONE gated C-FS operation per admitted call (the lane's one-shot recheck
     *  law): this port IS the execution edge the C-04/05 kits drove by hand. */
    readonly createFsAdmissionPort: (request: AdmissionRequest, grant: OperationGrant) => ProductionFsAdmissionPort;
}
/**
 * THE KERNEL ADMISSION PRODUCTION ENTRY CLASS: derivation → kernel wiring →
 * default-deny gate → FS port, from the template's real policy object. A
 * construction failure is typed and complete (the host fails the AgentSetup
 * the same way a Guard install failure fails it — a permissions agent never
 * runs on a broken authority).
 */
export declare function createProductionAdmissionAssembly(config: ProductionAdmissionConfig): GovernanceResult<ProductionAdmissionAssembly>;
//# sourceMappingURL=admission-kernel.d.ts.map