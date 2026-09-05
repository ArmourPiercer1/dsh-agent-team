/**
 * P8-S5 Production Projection Source — the durable TeamDomain read port
 * (the P8-T2 port contract, TaskDoc §11.9; production composition P8-S5).
 *
 * {@link createTeamDomainReadPort} adapts a REAL open `TeamDomain`
 * (invariant 41 — the durable sidecar authority) to the P8-T2
 * `TeamDomainReadPort`, the bounded source the projection fold consumes:
 *
 * ```text
 * teamSessionId
 *   → teamSessions.get(rootSessionId)        (the TeamSession row — identity core)
 *   → memberInstances.list(rootSessionId)    (the MemberInstance rows)
 *   → compatibility.get(rootSessionId)       (the CompatibilityStateRecord)
 *   → ledger.list() (root-filtered)          (the TeamLedger entries)
 *   → TeamDomainProjectionSource
 * ```
 *
 * The read surface is exactly those four repositories: the port NEVER scans
 * `Root + child Session logs` (P8-T2 — the projection's complexity is
 * independent of child Session log volume), never writes, never touches the
 * (ephemeral) SessionController Team mirror, and takes no clock (the source
 * is durable; the fold stamps the produced-at time).
 *
 * Fail-closed surface (the closed code object
 * `TEAM_DOMAIN_READ_PORT_ERROR_CODES`; every thrown Error carries its code
 * verbatim in the message — the P8-T2 service does not wrap port errors, so
 * the plain Errors propagate to its caller):
 *
 * - `TEAM_PROJECTION_SOURCE_TEAM_SESSION_ABSENT` — the provided domain
 *   carries no durable `team_sessions` row under the TeamSession id;
 * - `TEAM_PROJECTION_SOURCE_TEMPLATES_UNAVAILABLE` — the bound blueprint
 *   snapshot's template content is not durably readable through this port
 *   (the v1 TeamSessionRecord freezes the identity core only and this port
 *   has no catalog read surface). S6 installs the catalog-backed source and
 *   replaces this throw. Inventing template rows from the member rows'
 *   `templateId`s is the silent weakening this port refuses;
 * - `TEAM_PROJECTION_SOURCE_POLICY_STATE_UNAVAILABLE` — no policy state is
 *   durably carried. Checked surfaces (documented derivation): the v1
 *   TeamSessionRecord field set (identity core only — "Category A's
 *   remaining fields (PolicyState, ...) are added by later versions") and
 *   the CompatibilityStateRecord field set (status, fingerprint, probe
 *   generation, outcome counts, acknowledgements — no policy state); no
 *   production TeamLedger fact family records a policy state, and the
 *   operation journal's production intents are provisioning-only. A silent
 *   `'active'` default is forbidden by the P8-S5 contract;
 * - `TEAM_PROJECTION_SOURCE_LEDGER_CATEGORY_UNKNOWN` — a durable ledger
 *   fact type with no mapping to the eight frozen ledger categories. The
 *   frozen contract invariant `totalEntries == sum(byCategory)` makes a
 *   silent misclassification data fabrication, so the read fails instead;
 * - `TEAM_PROJECTION_SOURCE_ADMISSION_STATE_INVALID` — a durable
 *   compatibility status outside the frozen four-state admission vocabulary.
 *   Unreachable for a storage-validated record (the repository parser
 *   rejects any other status on read); the port fails closed on drift
 *   anyway and never maps an unknown state silently.
 *
 * What S6 replaces / extends: the catalog-backed template source (replacing
 * the TEMPLATES throw) and the durable policy state (a later record version
 * with its owning task, or the S6 catalog-backed source; replacing the
 * POLICY_STATE throw). The live half of the P8-T2 service — the
 * `LiveResidencyOverlayPort` seam — is NOT part of this port; this adapter
 * is the durable half only.
 *
 * Pure module: no I/O beyond the repository reads, no DSH imports, no
 * `node:` builtin imports.
 * @module @dsh-agent-team/runtime/plugin/projection-source
 */
import type { EffectiveConfigDto, EffectiveConfigDtoV2, MemberLifecycleState, MemberModelStateDto, TeamSessionRecordDto } from '../../../contracts/src/index.js';
import type { DurableTemplateRow, TeamDomainReadPort } from '../../projection/index.js';
import type { TeamDomain } from '../../../storage/repositories/index.js';
/**
 * The closed error-code vocabulary of the production read port (see the
 * module docs for the fail-closed conditions each code names).
 */
export declare const TEAM_DOMAIN_READ_PORT_ERROR_CODES: {
    /** The durable domain carries no `team_sessions` row for the TeamSession id. */
    readonly TEAM_SESSION_ABSENT: "TEAM_PROJECTION_SOURCE_TEAM_SESSION_ABSENT";
    /** The bound snapshot's template content is not durably readable through this port (S6 supplies the catalog-backed source). */
    readonly TEMPLATES_UNAVAILABLE: "TEAM_PROJECTION_SOURCE_TEMPLATES_UNAVAILABLE";
    /** No policy state is durably carried by the v1 record surfaces. */
    readonly POLICY_STATE_UNAVAILABLE: "TEAM_PROJECTION_SOURCE_POLICY_STATE_UNAVAILABLE";
    /** A durable ledger fact type with no mapping to the eight frozen categories. */
    readonly LEDGER_CATEGORY_UNKNOWN: "TEAM_PROJECTION_SOURCE_LEDGER_CATEGORY_UNKNOWN";
    /** A durable compatibility status outside the frozen admission vocabulary. */
    readonly ADMISSION_STATE_INVALID: "TEAM_PROJECTION_SOURCE_ADMISSION_STATE_INVALID";
    /**
     * A DISPOSED member row without a durable child session (S7-R2 R2-6):
     * structurally unreachable (invariant 23 — every MemberInstance binds
     * exactly one durable child session, and the record validator requires
     * the field), but the port fails closed on the drift instead of
     * fabricating a bundle key.
     */
    readonly DISPOSED_CHILD_SESSION_ABSENT: "TEAM_PROJECTION_SOURCE_DISPOSED_CHILD_SESSION_ABSENT";
};
/** One of the closed read-port error codes. */
export type TeamDomainReadPortErrorCode = (typeof TEAM_DOMAIN_READ_PORT_ERROR_CODES)[keyof typeof TEAM_DOMAIN_READ_PORT_ERROR_CODES];
/**
 * The optional S6 catalog-backed resolvers of the two v1 limitations the
 * plain TeamDomain read port cannot durably resolve (module docs):
 *
 * - {@link templates} — the bound blueprint snapshot's template rows, read
 *   from the CATALOG (the blueprint snapshot store), replacing the
 *   `TEMPLATES_UNAVAILABLE` fail-closed;
 * - {@link policyState} — the durable PolicyState id, replacing the
 *   `POLICY_STATE_UNAVAILABLE` fail-closed.
 *
 * Both are OPTIONAL: without them the port keeps its S5A fail-closed
 * behavior (every read hits the matching code), so the frozen P8-T2 contract
 * and the S5A world are unchanged. The production root (S6) installs both.
 */
export interface TeamDomainReadPortDeps {
    /**
     * Resolve the bound snapshot's template rows (leader + members) from the
     * catalog for one durable TeamSession row.
     * @param row - the durable `team_sessions` row (carries the snapshot ref).
     * @returns the frozen template rows of the bound snapshot.
     */
    readonly templates?: (row: TeamSessionRecordDto) => readonly DurableTemplateRow[];
    /**
     * Derive the durable PolicyState id for one TeamSession.
     * @param rootSessionId - the TeamSession (root session) id.
     * @returns the current PolicyState name (opaque to the contract).
     */
    readonly policyState?: (rootSessionId: string) => string;
    /**
     * Resolve the per-member effective-config view (projection v2, S7-R2
     * repair R2-2 — the UI §18.1 per-field provenance surface) from the
     * production mutation + governance state.
     * @param rootSessionId - the TeamSession (root session) id.
     * @param member - the durable member row's identity, lifecycle, and
     *   (optional) own workspace.
     * @returns the resolved v2 four-lane view, or `null` when the view
     *   cannot be derived (the row keeps the fail-closed empty view).
     */
    readonly effectiveConfig?: (rootSessionId: string, member: {
        readonly instanceId: string;
        readonly lifecycle: MemberLifecycleState;
        readonly workspace?: string;
    }) => EffectiveConfigDto | EffectiveConfigDtoV2 | null;
    /**
     * Resolve the per-member BQ-11 model state view (projection v2, S7-R2
     * repair R2-3 — current model / next-boundary pending model / Team
     * constraint+provenance / availability) from the production mutation +
     * governance state.
     * @param rootSessionId - the TeamSession (root session) id.
     * @param instanceId - the member's stable instance id.
     * @returns the resolved view, or `undefined` when the view cannot be
     *   derived (the row carries NO `modelState` key — DURATIONAL-optional).
     */
    readonly modelState?: (rootSessionId: string, instanceId: string) => MemberModelStateDto | undefined;
}
/**
 * Adapt a real open `TeamDomain` to the P8-T2 `TeamDomainReadPort`.
 *
 * The adapter is a closure over the given domain's repositories: one
 * `readProjectionSource(teamSessionId)` performs the four bounded reads
 * (module docs) and derives the `TeamDomainProjectionSource` field by field
 * (each helper documents its derivation and its fail-closed branch). No
 * state is kept between reads — every call re-reads the durable rows
 * (invariant 45: durable state is read fresh).
 * @param domain - the open TeamDomain to read (its repositories; the port
 *   never closes it — ownership stays with the caller).
 * @param deps - optional S6 catalog-backed resolvers (templates + policy
 *   state + the S7-R2 per-member effective-config view); absent when the
 *   port keeps its S5A fail-closed behavior.
 * @returns the read port over that domain.
 */
export declare function createTeamDomainReadPort(domain: TeamDomain, deps?: TeamDomainReadPortDeps): TeamDomainReadPort;
//# sourceMappingURL=projection-source.d.ts.map