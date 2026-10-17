/**
 * C-FS resource descriptor — `{ fs, path, fd? }` (INTERFACES-v1 C-FS).
 *
 * The lane-level handle view of a resource. The FROZEN contract identity is
 * still the PR0 `ResourceRef` ({realmId, kind, canonicalLocator, rights});
 * the descriptor is what the ControlledFs instance keeps internally and what
 * fd-carrying calls present:
 *
 *  - `fs`   — the registered instance id (which controlled tree);
 *  - `path` — the instance-RELATIVE canonical path (`'.'` = instance root).
 *             Relative `..` is refused (design §3.1), legal whitespace is
 *             preserved (a `trim()` would rename a file), POSIX separators
 *             only, no trailing/empty segments;
 *  - `fd`   — a kernel handle the CALLER claims. It is NEVER authority: the
 *             open-at-exec law re-establishes the handle under the grant and
 *             verifies identity; a presented fd is matched against the
 *             lane's own registry (see controlled-fs.ts). fd never
 *             participates in identity.
 *
 * Purity: no I/O — validation and mapping only.
 *
 * @module packages/runtime/controlled-fs/src/cf-descriptor
 */
import { type ParseResult, type ResourceRef, type ResourceRight } from '../../../domain/tool-governance/src/index.js';
/** The closed key set of the descriptor (C-FS contract, verbatim). */
export declare const CF_DESCRIPTOR_KEYS: readonly ["fs", "path", "fd"];
/** The C-FS resource descriptor. */
export interface FsResourceDescriptor {
    readonly fs: string;
    readonly path: string;
    /** Present only while a kernel handle is (or was) claimed; never authority. */
    readonly fd?: number;
}
/** Instance metadata the descriptor maps against (registered at the lane). */
export interface FsInstanceBinding {
    readonly realmId: string;
    readonly rootLocator: string;
}
/**
 * Strictly parse one raw descriptor: closed keys, closed path law.
 * The parse NEVER trims and NEVER normalizes case — identity is literal.
 */
export declare function parseFsDescriptor(raw: unknown): ParseResult<FsResourceDescriptor>;
/** Identity is (fs, path) ONLY — a handle is never part of an identity. */
export declare function descriptorIdentityKey(desc: FsResourceDescriptor): string;
/**
 * Map a descriptor to the frozen `ResourceRef` identity of its instance
 * (kind `absolute-path` under the instance root). `rights` is the minimal
 * observation right unless the caller states the operation right — actual
 * authority always comes from the grant's effects, never from here.
 */
export declare function descriptorToResourceRef(desc: FsResourceDescriptor, binding: FsInstanceBinding, rights?: readonly ResourceRight[]): ParseResult<ResourceRef>;
/** Map a ResourceRef back to the descriptor, or refuse (outside the instance). */
export declare function resourceRefToDescriptor(ref: ResourceRef, fsId: string, binding: FsInstanceBinding): ParseResult<FsResourceDescriptor>;
//# sourceMappingURL=cf-descriptor.d.ts.map