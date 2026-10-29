# Alpha.3 Dynamic Permission Governance Detailed Architecture Design (Revised)

# 1. Runtime Architecture

    Blueprint baseline
            |
    Template static permission
            |
    PermissionOverlaySnapshot
            |
    EffectivePermissionAssembler
            |
    Operation Permission Resolver
            |
    tools/pre-execute

------------------------------------------------------------------------

# 2. Component Responsibilities

## PermissionOverlayRepository

Role:

-   durable storage;
-   append-only snapshot management;
-   generation lookup.

Non-responsibilities:

-   no authorization;
-   no envelope validation;
-   no actor checking.

All writes go through:

    GovernanceMutationService

------------------------------------------------------------------------

## GovernanceMutationService

Responsibilities:

-   authenticate mutation authority;
-   validate MutationEnvelope;
-   serialize mutations;
-   commit snapshot;
-   emit provenance.

It is the only permission mutation authority.

------------------------------------------------------------------------

## EffectivePermissionAssembler

New runtime component.

Responsibilities:

-   combine static and dynamic permission;
-   produce effective policy;
-   preserve source provenance.

Example:

    Blueprint:
    write output/result.json = ask

    Overlay:
    write output/result.json = allow

    Effective:
    write output/result.json = allow
    source = Leader mutation

------------------------------------------------------------------------

## Operation Permission Resolver

Keep Alpha.2 resolver pure.

It consumes:

    EffectivePermissionPolicy
    +
    CanonicalOperation

It does not: - access storage; - understand mutation authority.

------------------------------------------------------------------------

# 3. Critical Conflict Points

## 3.1 Layer precedence

Correct:

    higher layer wins
    then same layer:
    deny > ask > allow

Incorrect:

    all denies globally override all allows

------------------------------------------------------------------------

## 3.2 Human and Leader

Human does not create permanent higher resolver layer.

Instead:

    effective state
    +
    provenance

Leader can perform recovery within envelope.

------------------------------------------------------------------------

## 3.3 Snapshot vs event sourcing

Do not introduce replay-based authority.

Reason:

execution permission must depend on current durable snapshot.

------------------------------------------------------------------------

## 3.4 PermissionMutation unification

Do not create separate systems:

    grant_instance
    update_permission
    revoke_permission

They should all become:

    PermissionMutation
            |
    new PermissionOverlaySnapshot

------------------------------------------------------------------------

# 4. MutationEnvelope Schema Direction

The schema should represent:

    operation
    +
    resource matcher
    +
    maximum effect

Recommended conceptual form:

    MutationEnvelopeRule {
        operationClass
        matcher
        maximumEffect
    }

Avoid operation-specific nested schemas.

------------------------------------------------------------------------

# 5. Exec Special Case

Filesystem/resource:

    exact
    subtree

Exec:

    exact canonical fingerprint only

No: - subtree; - any.

------------------------------------------------------------------------

# 6. Testing Focus

Required:

-   resolver layer precedence;
-   overlay/static merge;
-   Human mutation followed by Leader recovery;
-   envelope rejection;
-   generation conflicts;
-   restart persistence;
-   lifecycle;
-   exec fingerprint isolation.
