/**
 * `governance-center/contribution-schema` — the CLOSED-WORLD Family
 * Contribution schema (U6 PR1; center-assembly-architecture §4 "six
 * boundaries" + §10.3 "Contribution schema, version negotiation and failure
 * isolation"; U6-SLICE-PLAN PR1 "Content").
 *
 * WHAT THIS FILE IS. Every Family that later registers with the
 * GovernedFamilyRegistry carries ONE contribution descriptor covering the
 * §4 boundaries: Source & Visibility, Definition & Arguments, Effects &
 * Constraints, Execution, Lifecycle(+cancel), Result — plus the fixed
 * `obligations` block that states, as data, WHICH authorities stay kernel-side
 * (admission, grant mint, grant consume). This validator is the single
 * fail-closed gate every registration passes: §10.3 — "unknown fields,
 * duplicate ID, invalid digest, unknown required capability, type mismatch or
 * an unsupported version all fail closed; unknown fields must not be ignored".
 *
 * CLOSED WORLD, BY CONSTRUCTION: every object this schema accepts is checked
 * key-by-key against a fixed key set, at every nesting level (`readClosed`).
 * An unlisted key is a refusal, never a silent drop — the only way
 * "unknown field" can be answered fail-closed without a second reader that
 * might ignore what this one rejected.
 *
 * SELF-APPROVAL IS UNEXPRESSABLE (§ CI-06): the `obligations` block is data
 * the KERNEL reads to confirm WHERE the authority lives; every value must be
 * the literal `'kernel'`. A Family that declares itself owning admission,
 * grant mint or grant consume — or a lifecycle it owns — is refused with the
 * dedicated `FAMILY_SELF_APPROVAL_FORBIDDEN` code, so an approval-attempt is
 * a visible, typed event in the registration ledger, never a shape that
 * parses. There is deliberately no field that could carry a grant, an
 * approval, or a permission: `readClosed` refuses such keys as UNKNOWN_FIELD.
 *
 * NO EXECUTION, NO CLOCKS, NO I/O: pure validation over plain data. Digest
 * fields are validated by SHAPE (64 lowercase hex — the digest law of the
 * durable lanes); the digest of what a contribution CLAIMS to bind is
 * computed by the registering side, never here.
 *
 * @module governance-center/contribution-schema
 */
/** The schema-generation this validator accepts (§10.3 major-version law). */
export declare const CONTRIBUTION_SCHEMA_MAJOR = 1;
/** A failure code is part of the registration ledger vocabulary: stable. */
export type ContributionFailureCode = 'CONTRIBUTION_NOT_OBJECT' | 'UNKNOWN_FIELD' | 'MISSING_FIELD' | 'BAD_TYPE' | 'BAD_VALUE' | 'BAD_ID' | 'BAD_NAME' | 'BAD_DIGEST' | 'NAME_ALIAS_COLLISION' | 'UNSUPPORTED_SCHEMA_VERSION' | 'FAMILY_SELF_APPROVAL_FORBIDDEN' | 'EFFECTS_WITHOUT_EXECUTION' | 'NAMED_BRIDGE_REQUIRED' | 'LIFECYCLE_OWNER_REQUIRED' | 'CAPABILITY_UNKNOWN' | 'CAPABILITY_UNBACKED';
export type ContributionValidation = {
    readonly ok: true;
    readonly contribution: FrozenContribution;
} | {
    readonly ok: false;
    readonly code: ContributionFailureCode;
    readonly path: string;
    readonly detail: string;
};
/** One entry of the Kernel's versioned capability manifest (§10.3). */
export type KernelCapability = {
    /**
     * Which execution shape actually backs this capability. A required
     * capability whose backing the contribution does not declare is a refusal
     * (`CAPABILITY_UNBACKED`) — "a capability not backed by a declared real
     * execution path" from the U6-SLICE-PLAN PR1 negative matrix.
     */
    readonly backsExecution?: 'family-body' | 'named-bridge';
};
export type KernelCapabilityManifest = {
    readonly capabilities: Readonly<Record<string, KernelCapability>>;
};
export type ContributionVersion = {
    readonly major: number;
    readonly minor: number;
    readonly patch: number;
};
export type FamilyContributionInput = {
    readonly schemaVersion: ContributionVersion;
    readonly familyId: string;
    readonly familyVersion: string;
    readonly source: {
        readonly kind: 'family-owned' | 'provider-backed';
        readonly selector: string;
        readonly digest: string;
    };
    readonly provider: {
        readonly id: string;
        readonly digest: string;
    };
    readonly requiredCapabilities: readonly string[];
    readonly optionalCapabilities: readonly string[];
    readonly visibility: {
        readonly owner: 'family';
        readonly nativeNames: readonly string[];
        readonly aliases: readonly string[];
        readonly profileRequirements: readonly string[];
    };
    readonly definition: {
        readonly owner: 'family';
        readonly inputContractDigest: string;
        readonly outputContractDigest: string;
        readonly normalization: 'pure';
    };
    readonly effects: {
        readonly declared: boolean;
        readonly kinds: readonly string[];
        readonly targets: readonly string[];
    };
    readonly execution: {
        readonly declared: boolean;
        readonly via: 'family-body' | 'named-bridge';
        readonly bridgeId?: string;
    };
    readonly lifecycle: {
        readonly owner: 'kernel';
        readonly drain: 'kernel-owned';
        readonly cancelBoundary: string;
    };
    readonly result: {
        readonly envelope: 'host';
        readonly correlation: 'kernel';
    };
    readonly obligations: {
        readonly admission: 'kernel';
        readonly grantMint: 'kernel';
        readonly grantConsume: 'kernel';
    };
};
export type FrozenContribution = FamilyContributionInput;
/**
 * Validate one contribution descriptor (§4 boundaries, §10.3 failure law).
 * `manifest` is the Kernel's PUBLISHED capability list — a required or
 * optional capability that the Kernel never published is a refusal, so the
 * capability negotiation is always against the center's real face, never
 * against a Family-authored list.
 */
export declare function validateFamilyContribution(input: unknown, manifest: KernelCapabilityManifest): ContributionValidation;
//# sourceMappingURL=contribution-schema.d.ts.map