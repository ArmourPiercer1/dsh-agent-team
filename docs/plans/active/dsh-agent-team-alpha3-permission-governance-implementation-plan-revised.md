# Alpha.3 Dynamic Permission Governance Implementation Plan (Revised)

# Overview

Implementation remains five PRs.

    PR1
     |
    PR2
     |
    PR3
     |
    PR4
     |
    PR5

------------------------------------------------------------------------

# PR1: PermissionOverlay Foundation

## Goal

Create durable permission overlay infrastructure.

## Implement

Create:

    packages/runtime/permission-governance/

Add:

-   PermissionOverlaySnapshot types;
-   repository port;
-   TeamDomain schema;
-   generation;
-   provenance.

Do NOT add: - resolver logic; - notification; - UI.

## Tests

-   append snapshot;
-   latest generation;
-   restart persistence;
-   immutable history;
-   generation conflict.

------------------------------------------------------------------------

# PR2: Effective Permission Assembly

## Goal

Integrate dynamic overlay with Alpha.2.

## Implement

Create:

    EffectivePermissionAssembler

Responsibilities:

-   merge overlay;
-   merge static permission;
-   preserve provenance.

Keep:

    resolveOperationPermission()

pure.

## Tests

-   overlay overrides static deny;
-   fallback;
-   same-layer deny/ask/allow;
-   provenance.

------------------------------------------------------------------------

# PR3: Governance Mutation Integration

## Goal

Connect mutation authority.

## Implement

Through:

    GovernanceMutationService

Add:

-   PermissionMutation;
-   Leader mutation;
-   Human mutation;
-   MutationEnvelope validation.

Support:

-   exact;
-   subtree;
-   exec fingerprint.

## Tests

-   Leader inside envelope;
-   Leader outside envelope;
-   Human exceeding envelope;
-   Leader recovery after Human mutation;
-   CAS conflict.

------------------------------------------------------------------------

# PR4: Grant/Revoke/Lifecycle

## Goal

Implement permission lifecycle.

## Implement

All through PermissionMutation:

-   grant_instance;
-   revoke;
-   restore.

Rules:

-   revoke creates snapshot;
-   no delete;
-   no inheritance.

## Tests

-   exact grant;
-   subtree grant;
-   exec exact grant;
-   revoke history;
-   archive;
-   restore;
-   dispose.

------------------------------------------------------------------------

# PR5: Notification and Projection

## Goal

Add awareness layer.

## Implement

-   active Agent notification;
-   generation-tagged message;
-   read projection.

Rules:

-   notification failure does not affect mutation;
-   idle Agent not awakened.

## Tests

-   active notification;
-   idle behavior;
-   stale notification;
-   failed delivery.

------------------------------------------------------------------------

# Final Acceptance

Verify:

1.  Permission authority remains single-path.
2.  Overlay persistence survives restart.
3.  Resolver remains pure.
4.  MutationEnvelope bounds Leader expansion.
5.  Human recovery semantics work.
6.  MemberInstance isolation works.
7.  Exec permissions remain exact.
