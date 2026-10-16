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
export { createControlledFsLane, } from './controlled-fs.js';
// G-d integration wiring (Scope-2): the PR2-admission GATED consumption face
// (README §4). This is the ONLY sanctioned wiring entry — the raw factory's
// pre-freeze NO_RECHECK default must never be the wiring default.
export { ARBITRARY_TREE_PROFILE_PUBLISHED, bindAdmissionRecheck, createAdmissionGatedControlledFs, UNBOUND_ADMISSION_RECHECK, } from './admission-binding.js';
//# sourceMappingURL=index.js.map