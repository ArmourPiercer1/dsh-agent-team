# remote-mount-race — ROOT-CAUSE CONFIRMATION (supersedes the handoff's primary race hypothesis as the USER trigger)

Date: 2026-09-05. World: references/.dsh-diag-405-2026-09-05T16-35-38 (user-home copy).
Build: D:\AgentDev\deepseek-harness @ a66e470 (0.1.2-rc.1). Plugin: origin master 05721fd install content.

## Finding: the user's 405 is DETERMINISTIC, not the connection race

The shipped bundle layer (installed plugin root `cordis.patch.yml`, row `dsh-agent-team`)
hardcodes:

    config:
      bootPhase: "create"

host.ts L512-515: `bootPhase === 'create' ? createTeamDomain(seam) : openTeamDomain(seam)`.
`createTeamDomain` (packages/storage/repositories/team-domain.ts L170) THROWS
`team_domain already exists (schema_meta holds N stamp row(s)); use openTeamDomain`
when the domain is already stamped. The throw happens EARLY in the host row bootstrap —
BEFORE the remote mount step (host.ts L610 one-shot `ctx.get('connection')` read).
The bootstrap rejection is swallowed by `void ready.catch(() => undefined)` (L653; the
facade `ready` is "the single observable failure channel" but NOTHING logs it) →
zero terminal signal → the `/team-remote` prefix route is never registered →
any POST under it falls to the frontend-static fallback → **HTTP 405**.

## Evidence chain

1. **User home (read-only probe, C:\Users\user\.dsh-dev):**
   - `storages\team_domain.json` exists, 1338 B, mtime **2026-09-05 12:37:43 local**
     — BEFORE the 16:16 plugin install and the ~16:25 failing boot.
   - Content: `schema_meta` holds exactly **8 stamp rows** (schemaVersion 1, all
     stampedAt 2026-09-05T04:37:43Z = 12:37:43 local); ALL data tables EMPTY
     (`team_sessions: {}`, `member_instances: {}`, `session_bindings: {}`,
     `overrides: {}`, `compatibility: {}`, `operations: {}`, `ledger: {}`)
     → the domain was stamped but no team was ever created (consistent with the
     user hitting 405 on their first 新建团队 attempt).
   - `storages\workspace.json`: workspace D:\test (id 5e3c4480-…), createdAt
     2026-09-01T16:28:13Z, updatedAt 2026-09-05T08:15:29Z (=16:15:29 local, right
     before the install) — prior team-plugin usage on this home.
   - `session_projcache`: session-1f20f5bf mtime 2026-09-02 00:28:22 (first use);
     session-2f3b74df 03:05:50; session-925d6234 03:09:07; session-062d962c 16:16:21.
   - Timeline: domain stamped 12:37:43 (a 12:37 boot of the team plugin on this home —
     the FIRST successful create; that boot's mount outcome is unknown but the domain
     persisted) → 16:16 install (plugin updated to master 05721fd) → 16:25 fresh boot:
     createTeamDomain → TEAM_DOMAIN_EXISTS (8 stamps) → swallowed → 405.
     The 405 PERSISTS on every restart of this home (domain persists, config still
     "create"). **The handoff's stopgap advice "restart likely recovers" is WRONG** —
     restart re-loses 100%. (It held in the handoff's 4 controlled worlds only because
     they were fresh DSH_HOMEs where create succeeds.)

2. **Scratch-world reproduction (this evidence dir):**
   - Boot A (fresh scratch copy, no storages/): bootPhase create → domain CREATED
     (8 stamps) → bootstrap completes → mount step runs → connection present →
     ROUTE REGISTERED. Probes: unauth POST /team-remote/catalog.list → 401 (route
     present, auth gate); authenticated → **200** {ok:true, blueprints:[my-team-bp-1]}.
   - Boot B-1 (same scratch home, domain now exists; instrumented scratch host.js with
     [team-diag] env-gated logging — product code untouched otherwise):
     - terminal:
       ```
       dsh web: http://127.0.0.1:3180/?token=5tDySQh292EPMTYtcs5B89Zw0St-dLTNdaLwAW8A37w
       [team-diag] 2026-09-05T09:42:37.838Z T_apply=+0ms (team row apply entered; connection poller 50ms/15s)
       [team-diag] 2026-09-05T09:42:38.389Z BOOTSTRAP FAILED (swallowed by product 'void ready.catch(() => undefined)'): team_domain already exists (schema_meta holds 8 stamp row(s)); use openTeamDomain
       [team-diag] 2026-09-05T09:42:38.441Z T_connection_appear=+603ms (first non-null ctx.get('connection'))
       ```
       (without the [team-diag] instrumentation the terminal shows ONLY the boot line —
       the product face is completely silent: the swallowed ready rejection is the only
       failure signal and it is never logged)
     - probes: GET / → 401 (server up, auth gate); **POST /team-remote/catalog.list →
       HTTP 405** (route absent — the user's exact symptom).
     - T_connection_appear=+603ms proves the connection service WAS available; the mount
       was lost because the bootstrap DIED AT THE DOMAIN STEP, before the mount read —
       the race never even got a chance. Deterministic, no load dependence.

3. **Why the controlled worlds never saw it:** every D5/PBA/boot gate world used a
   FRESH DSH_HOME (create succeeds) — or a harness row whose config came from the
   p6t6 directive (phase-driven, not the shipped bundle's "create"). The shipped
   bundle's bootPhase:"create" was never exercised against a returning home in any
   controlled world.

## The connection race (handoff hypothesis A) — status

Still a REAL LATENT product defect (one-shot `ctx.get('connection')` at host.ts L610,
silent skipped branch L614-618, no retry, swallowed ready) — it WILL lose under slow
web startups (tsx cold + load) even with the domain issue fixed. It is fixed +
regression-tested in this task as required by the handoff §5.3, but it was NOT the
user's 16:25 trigger (the bootstrap never reached the mount read). Confirmation of the
race mechanism (forced-early-read boot B-2) is captured in the follow-up notes below.

## Consequences

- Stopgap for the user (corrected): deleting the EMPTY domain file
  `C:\Users\user\.dsh-dev\storages\team_domain.json` (all data tables empty — no user
  data loss; back it up first) makes the next boot's create succeed → 200. Restart alone
  does NOT help. (User-home changes are the user's call — red line: read-only to us.)
- Product fix must cover BOTH mechanisms:
  (B) idempotent production domain bootstrap (shipped restart-safe semantics) — the
      user's actual bug;
  (A) connection mount must not depend on the one-shot read (race) — latent;
  (C) observability: bootstrap failure + mount outcome must be logged (both silent
      today; my [team-diag] lines above are the shape of what is missing).

## Race mechanism (hypothesis A) — deterministic confirmation, Boot B-2

Same scratch world; scratch bundle config patched bootPhase "create" → "resume" (so the
domain step SUCCEEDS via openTeamDomain and the mount step is actually reached);
instrumentation kept + forced-early-read enabled. Terminal:

    dsh web: http://127.0.0.1:3180/?token=vE_a8JnXLtlY74KgyC1bGL52RbIKpFdOpfx18MoGK7Q
    [team-diag] 2026-09-05T09:47:31.911Z T_apply=+0ms (team row apply entered; connection poller 50ms/15s; FORCED-EARLY-READ ACTIVE)
    [team-diag] 2026-09-05T09:47:31.934Z T_read_early=+23ms connection-at-early-read=undefined
    [team-diag] 2026-09-05T09:47:32.628Z T_mount_read=+717ms connection-at-mount-read=PRESENT
    [team-diag] 2026-09-05T09:47:32.628Z forced-early: mount decision uses the EARLY one-shot snapshot (no retry — product semantics)
    [team-diag] 2026-09-05T09:47:32.628Z bootstrap settled OK; remoteMountState={"state":"skipped","reason":"the \"connection\" public service is absent (headless host)"}
    [team-diag] 2026-09-05T09:47:32.635Z T_connection_appear=+724ms (first non-null ctx.get('connection'))

Read: the one-shot read (+23 ms) saw `undefined`; the product never retries; at the real
mount point (+717 ms) the connection service was PRESENT (appeared ~+717–724 ms); the
mount was nevertheless skipped forever → probe:

    POST /team-remote/catalog.list → HTTP 405   (GET / → 401, server up)

This is the EXACT user symptom produced by the race mechanism alone (domain step green):
one-shot read + silent skip + no retry = permanent remote loss whenever the read instant
precedes connection provision. In B-2 the product terminal (sans [team-diag]) shows only
the boot line — the skipped branch and the pending-ness of the remote are unobservable,
the observability gap this task closes.

Conclusion: (B) is the user's deterministic trigger; (A) is a real latent defect that the
fix must also close (bounded-wait/late-mount + explicit observable outcome), with a
deterministic unit-level fake-timing regression test (handoff §5.3).
