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
export { CF_DESCRIPTOR_KEYS, descriptorIdentityKey, descriptorToResourceRef, parseFsDescriptor, resourceRefToDescriptor, type FsInstanceBinding, type FsResourceDescriptor, } from './cf-descriptor.js';
export { CF_DENIED_REASONS, CF_ERROR_CLASSES, CF_HIDDEN_REASONS, CF_UNDETERMINED_REASONS, cfsDenial, cfsErrorClassOfReason, cfsHidden, cfsUndetermined, isFailure, type CfDenyReason, type CfErrorClass, type CfHiddenReason, type CfReason, type CfUndeterminedReason, } from './cf-errors.js';
export { NO_RECHECK, isBeneath, verifyOpenedHandle, type AdmissionRecheck, type ExecTimeVerdict, type IdentitySnapshot, type OpenAtPort, } from './open-at-exec.js';
export { createControlledFsLane, type ControlledFsInstance, type ControlledFsLane, type ControlledFsLaneConfig, type LaneHooks, type LedgerEntry, type TrustedControlledFs, } from './controlled-fs.js';
export { ARBITRARY_TREE_PROFILE_PUBLISHED, bindAdmissionRecheck, createAdmissionGatedControlledFs, createProductionControlledFsProvider, UNBOUND_ADMISSION_RECHECK, type AdmissionBoundFsCall, type AdmissionGatedControlledFsConfig, type FsAdmissionPort, type ProductionControlledFsProvider, type ProductionControlledFsProviderConfig, } from './admission-binding.js';
export type { ControlledFs, FsObservation, FsReadWindow, FsTextContent, FsWriteReceipt, GovernanceError, GovernanceResult, MemberRef, OperationGrant, ResourceRef, } from '../../../domain/tool-governance/src/index.js';
//# sourceMappingURL=index.d.ts.map