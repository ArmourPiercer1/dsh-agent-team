/**
 * A5-PR3 (Lane B) — ControlledFs lane barrel (lane-internal surface).
 *
 * NOT wired into `packages/runtime/index.ts`, the runtime tsconfigs, or any
 * registry: the integration owner wires the lane after C-ADM freeze
 * (README §4 wiring notes). The frozen contract types come from
 * `domain/tool-governance` and are re-exported for consumer convenience
 * only — this lane owns no second contract.
 *
 * @module packages/runtime/controlled-fs/src
 */
export { CF_DESCRIPTOR_KEYS, descriptorIdentityKey, descriptorToResourceRef, parseFsDescriptor, resourceRefToDescriptor, } from './cf-descriptor.js';
export { CF_DENIED_REASONS, CF_ERROR_CLASSES, CF_HIDDEN_REASONS, CF_UNDETERMINED_REASONS, cfsDenial, cfsErrorClassOfReason, cfsHidden, cfsUndetermined, isFailure, } from './cf-errors.js';
export { NO_RECHECK, isBeneath, verifyOpenedHandle, } from './open-at-exec.js';
// U7-9a (FS mutation family): the POST-CONSUME execution closures. These are
// the provider half of the governed `write`/`edit` rows — minted by the
// trusted assembly ONLY after the kernel's one-shot edge consumed the grant,
// and they carry the whole boundary law internally (approved-root agreement,
// O_NOFOLLOW opens, verify-before-truncate, fd-bound exclusive create,
// honest undetermined states). The FAMILY lane imports them through THIS
// barrel (its one reviewed controlled-fs edge, lane README): the family never
// re-implements the boundary, it only composes the injected edge and passes
// frozen plan facts (CI-07 — the family never self-attests the FS effect).
// Deliberate export per the closure headers' own law ("the integration owner
// adds exports deliberately"): the ONLY sanctioned consumers are the
// `packages/tools/fs-family` executors and their tests.
export { createPostConsumeWriteClosure, } from './post-consume-write.js';
export { createPostConsumeCreateClosure, } from './post-consume-create.js';
export { createPostConsumeEditClosure, } from './post-consume-edit.js';
export { createControlledFsLane, } from './controlled-fs.js';
// G-d integration wiring (Scope-2): the PR2-admission GATED consumption face
// (README §4). This is the ONLY sanctioned wiring entry — the raw factory's
// pre-freeze NO_RECHECK default must never be the wiring default.
export { ARBITRARY_TREE_PROFILE_PUBLISHED, bindAdmissionRecheck, createAdmissionGatedControlledFs, 
// PR2/PR3 production-assembly round: the production provider (per-call
// gated lane from reader arms; contract: evidence `alpha5/prod/pa-CONTRACT.md`).
createProductionControlledFsProvider, UNBOUND_ADMISSION_RECHECK, } from './admission-binding.js';
//# sourceMappingURL=index.js.map