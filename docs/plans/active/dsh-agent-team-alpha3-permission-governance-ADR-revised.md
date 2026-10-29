# ADR: Alpha.3 Dynamic Permission Governance Architecture (Revised)

## Status

Accepted --- Architecture Freeze

## Revision Notes

This revision adds implementation constraints discovered during
architecture review:

-   PermissionOverlayRepository is persistence only.
-   GovernanceMutationService remains the sole mutation authority.
-   Human provenance does not create permanent resolver precedence.
-   Effective permission assembly is separated from pure operation
    resolver.
-   Permission mutation uses a unified mutation model.

------------------------------------------------------------------------

# 1. Authority Model

All permission mutations MUST flow through:

    Leader/Human request
            |
    GovernanceMutationService
            |
    PermissionOverlayRepository
            |
    TeamDomain

PermissionOverlayRepository is only a persistence port.

It MUST NOT: - validate authority; - perform envelope checks; - bypass
mutation serialization; - become an alternative write path.

------------------------------------------------------------------------

# 2. PermissionOverlaySnapshot

Permission state uses append-only full snapshots.

A snapshot contains:

    identity:
      teamSessionId
      memberInstanceId

    state:
      permission overlay rules

    metadata:
      generation
      previousSnapshotId

    provenance:
      actor
      mutationId
      timestamp
      reason

Current authority:

    highest generation snapshot

History:

    audit only

No event replay is used for execution.

------------------------------------------------------------------------

# 3. Effective Permission Architecture

Execution permission is assembled in two stages.

## Stage 1: EffectivePermissionAssembler

Responsibilities:

-   load static permission baseline;
-   load MemberInstance overlay;
-   merge layers;
-   preserve provenance.

It may access runtime state.

## Stage 2: Operation Resolver

The Alpha.2 resolver remains a pure kernel.

Input:

    effective permission policy
    +
    canonical operation

Output:

    allow / ask / deny

The resolver MUST NOT: - read repositories; - know TeamDomain; - perform
mutation authority checks.

------------------------------------------------------------------------

# 4. Layer Semantics

Resolution order:

    MemberInstance overlay
            >
    Template static permission
            >
    Blueprint baseline

Within one layer:

    deny > ask > allow

Do not implement global deny precedence.

------------------------------------------------------------------------

# 5. Mutation Model

All mutation types use a unified internal representation:

    PermissionMutation

Examples:

-   grant_instance;
-   revoke;
-   Leader proactive change;
-   Human change.

Each mutation produces a new PermissionOverlaySnapshot.

------------------------------------------------------------------------

# 6. MutationEnvelope

MutationEnvelope defines Leader expansion authority.

It limits:

1.  resource matcher;
2.  maximum effect.

Leader expansion:

    deny → ask
    deny → allow
    ask → allow

requires envelope permission.

Leader tightening:

    allow → ask
    allow → deny
    ask → deny

does not require expansion permission.

------------------------------------------------------------------------

# 7. Human Mutation

Human mutation: - may exceed Leader envelope; - records Human
provenance; - changes current effective permission state.

Human provenance does NOT create permanent resolver priority.

Leader retains recovery authority:

-   can reduce permissions within envelope;
-   cannot expand beyond envelope.

------------------------------------------------------------------------

# 8. Lifecycle

RUNNING: - overlay effective.

ARCHIVED: - overlay retained; - execution disabled.

RESTORE: - same MemberInstance resumes.

DISPOSED: - overlay historical only; - never effective.

New instance: - no inheritance.

------------------------------------------------------------------------

# 9. Notification

Notification is awareness only.

Rules:

-   active agents: best-effort notification;
-   idle agents: no wakeup;
-   failure does not rollback mutation;
-   generation included.

Notification is never authorization evidence.
