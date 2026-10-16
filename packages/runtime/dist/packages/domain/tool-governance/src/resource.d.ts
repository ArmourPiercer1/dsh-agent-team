/**
 * `ResourceRef` — the one resource identity of the Alpha.5 governance planes
 * (design §4.2: `ResourceRef = {realmId, kind, canonicalLocator, rights}`).
 *
 * WHY `kind` EXISTS (design §3/§4.2, plan §3: "不预先将实体对象简化为无安全
 * 含义的字符串"): a real workspace path, a Realm Home (`~/`) path, an OS
 * absolute path, a directory scope, a metadata view and a network destination
 * have DIFFERENT security meanings even when two of them happen to print the
 * same characters. Collapsing them into one string would let a workspace
 * grant reach a Realm Home file, or a file grant authorize a listing. The
 * `kind` + `rights` pair is therefore a CLOSED MATRIX, not a hint.
 *
 * REALM RULES (design §1 architecture invariant, S0 matrix §3): `realmId`
 * participates in every identity and every fingerprint. Two resources with
 * the same locator in different Realms are NEVER the same resource, never
 * authorize each other, and never narrow each other.
 *
 * LOCATOR RULES (design §3.1 "文件对象身份"): relative paths are fixed to the
 * immutable Workspace; `~/` belongs to the execution Realm Home; relative `..`
 * is refused; LEGAL leading/trailing whitespace is PRESERVED (no trimming —
 * `trim()` would rename a file); a filesystem locator never wears a URI
 * scheme, and a destination never looks like a path.
 *
 * Purity: no `node:*`, no I/O — canonicalization to a `canonicalLocator` is
 * the injected provider's job (Alpha.4 A2-3: domain manufactures no canonical
 * key); this module only VALIDATES what a provider produced.
 *
 * @module @dsh-agent-team/domain/tool-governance/resource
 */
import { type ParseResult } from './parse-util.js';
/** The closed resource kinds (design §4.2, verbatim distinctions). */
export declare const RESOURCE_KINDS: readonly ["workspace", "realm-home", "absolute-path", "directory", "metadata", "network-destination"];
/** One resource kind. */
export type ResourceKind = (typeof RESOURCE_KINDS)[number];
/** The closed rights vocabulary. */
export declare const RESOURCE_RIGHTS: readonly ["read", "write", "list", "meta", "connect"];
/** One right. */
export type ResourceRight = (typeof RESOURCE_RIGHTS)[number];
/**
 * The kind ↔ rights matrix: which rights a kind can carry AT ALL. `list`
 * belongs to directories, `connect` to network destinations, `metadata` only
 * ever carries `meta`. A right outside the matrix is a typed refusal, never a
 * silently inert entry.
 */
export declare const RESOURCE_RIGHT_MATRIX: Readonly<Record<ResourceKind, readonly ResourceRight[]>>;
/** One canonical resource reference (deep-frozen by the parser). */
export interface ResourceRef {
    readonly realmId: string;
    readonly kind: ResourceKind;
    readonly canonicalLocator: string;
    readonly rights: readonly ResourceRight[];
}
/**
 * Strictly parse one raw value into a canonical, deep-frozen `ResourceRef`:
 * closed fields, closed kind, closed rights, the kind↔rights matrix, the
 * locator rules. Rights arrive normalized (canonical order, deduplicated).
 */
export declare function parseResourceRef(raw: unknown): ParseResult<ResourceRef>;
/** The canonical identity of one resource: realm FIRST (never confusable). */
export declare function resourceIdentityKey(ref: ResourceRef): string;
/** Realm-aware resource equality (identity, not string equality). */
export declare function resourceEquals(a: ResourceRef, b: ResourceRef): boolean;
//# sourceMappingURL=resource.d.ts.map