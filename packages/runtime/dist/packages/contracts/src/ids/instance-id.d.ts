/**
 * Instance id contract: the stable runtime identity of a MemberInstance.
 *
 * Frozen Architecture facts (invariant numbers refer to Architecture §42):
 *
 * - **Member runtime identity is the composite key `(rootSessionId, instanceId)`**
 *   (invariant 18, Architecture §10.2). The composite key prevents
 *   cross-TeamSession confusion: the same `instanceId` under two different
 *   roots names two different members.
 * - **`instanceId` is system-generated, stable, and unique within one
 *   TeamSession** (Architecture §10.2). The generator lives in the runtime
 *   (ActivationProvider, invariant 26); this module freezes only the
 *   format, the validators, and the composite-key helpers.
 * - **label / templateId / groupId are NOT runtime identities**
 *   (invariant 19).
 *
 * Format: `inst-` followed by 1..32 lowercase alphanumerics
 * (`inst-A`, `inst-a1b2c3`). The architecture's own examples use the
 * `inst-` prefix (§10.2: `instanceId = inst-A`); the strict charset keeps
 * ids safe in file names, log lines, and remote addressing (§24.1
 * instance-first addressing).
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/ids/instance-id
 */
import type { Brand } from './brand.js';
/** The single strict format of an instance id. */
export declare const INSTANCE_ID_PATTERN: RegExp;
/** Structural max length: `inst-` (5) + 32 alphanumerics. */
export declare const INSTANCE_ID_MAX_LENGTH = 37;
/**
 * The stable runtime identity of one MemberInstance, unique within its
 * TeamSession. NOT a runtime identity on its own — see
 * {@link import('./identity.js').MemberIdentity}.
 */
export type InstanceId = string & Brand<'InstanceId'>;
/**
 * Parse and validate an instance id.
 * @param raw - the unknown input.
 * @returns the branded `InstanceId`.
 * @throws `INVALID_INSTANCE_ID` when the value does not match `inst-<1..32 lowercase alphanumerics>`.
 */
export declare function parseInstanceId(raw: unknown): InstanceId;
/** Type guard for the instance id rule. */
export declare function isInstanceId(raw: unknown): raw is InstanceId;
//# sourceMappingURL=instance-id.d.ts.map