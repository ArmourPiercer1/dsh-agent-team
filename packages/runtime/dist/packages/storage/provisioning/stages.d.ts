/**
 * The durable provisioning stage vocabulary (TaskDoc §11.5 P4-T4).
 *
 * A member provisioning drives FOUR durable stages (the task card's
 * `ALLOCATED → CHILD_SESSION_CREATED → CHILD_BOUND → INSTANCE_COMMITTED`),
 * each stage transition being a DURABLE WRITE before the next external /
 * effect step (Development Plan §17.3 crash model):
 *
 * ```text
 * ALLOCATED            the operation row is PREPARED (the member is
 *                      allocated/reserved); no external effect yet
 * → CHILD_SESSION_CREATED  the external child-session effect has run and
 *                      its id is durably recorded (operation row carries
 *                      childSessionId; the MemberInstanceRecord — which
 *                      MUST carry the child per invariant 23 and the
 *                      binding service's precondition — is written)
 * → CHILD_BOUND        the team-member SessionBinding linking the child
 *                      session <-> (rootSessionId, instanceId) is durable
 * → INSTANCE_COMMITTED the MemberInstance is the authoritative committed
 *                      instance: the operation row is COMMITTED and its
 *                      ledger fact exists (the creation commit point,
 *                      Architecture §17.4)
 * ```
 *
 * **The stage is DERIVED from durable TeamDomain state — there is no
 * separate stage row.** TeamDomain v1 has exactly eight stores (frozen,
 * P4-T1) and none of them is a "provisioning stage" store; the stage is a
 * pure function of (operation row, MemberInstanceRecord, SessionBinding,
 * ledger fact). That is what makes the machine a DURABLE PROTOCOL ADAPTER:
 * a crash at any point leaves durable state, and re-deriving the stage from
 * that state is exactly the recovery entry (roll-forward, Development Plan
 * §17.3; Architecture §18.3's five recovery cases map onto these stages).
 *
 * `NONE` is the pre-allocation state (no operation row yet): it is a
 * machine-internal state, not one of the four protocol stages.
 *
 * Pure module: types and constants only, no I/O.
 * @module @dsh-agent-team/storage/provisioning/stages
 */
/**
 * The closed set of provisioning stages: the four durable protocol stages
 * plus the pre-allocation state.
 */
export declare const PROVISIONING_STAGES: {
    /** No durable provisioning state yet (no operation row). */
    readonly NONE: "NONE";
    /** The operation is PREPARED; the member is allocated; no external effect. */
    readonly ALLOCATED: "ALLOCATED";
    /** The child session id is durably recorded (and the member record written). */
    readonly CHILD_SESSION_CREATED: "CHILD_SESSION_CREATED";
    /** The team-member SessionBinding is durable; the instance is not yet committed. */
    readonly CHILD_BOUND: "CHILD_BOUND";
    /** The committed terminal: operation COMMITTED + ledger fact. */
    readonly INSTANCE_COMMITTED: "INSTANCE_COMMITTED";
};
/** One of the closed provisioning stages. */
export type ProvisioningStage = (typeof PROVISIONING_STAGES)[keyof typeof PROVISIONING_STAGES];
/** Every stage value, for membership checks. */
export declare const PROVISIONING_STAGE_VALUES: readonly string[];
/** Is `value` one of the closed provisioning stages? */
export declare function isProvisioningStage(value: unknown): value is ProvisioningStage;
/** The stage of the terminal protocol state (the only "done" stage). */
export declare const PROVISIONING_TERMINAL_STAGE: ProvisioningStage;
//# sourceMappingURL=stages.d.ts.map