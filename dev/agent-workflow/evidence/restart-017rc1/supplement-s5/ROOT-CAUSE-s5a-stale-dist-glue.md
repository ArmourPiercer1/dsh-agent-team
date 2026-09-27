# S5a — S5 hard blocker ROOT CAUSE: the committed dist mirror of the plain-JS glue is pre-S1 (stale placement)

Supplement round, PR #31 (`task/team-restart-017rc1`). Evidence for the S5a fix commit.
Status: CONFIRMED in source + artifacts; fix implemented (this commit); S5 re-run armed.

## 1. The observed failure (subagent report, independently re-verified)

S5 kit run `node kit-s5.mjs A B C D E F` (preflight ALL GREEN: test-use @
`46a7f68b09` pristine, worktree @ `833c6999`, CLI 0.1.7-rc.1, artifacts 1196,
ports free): **every world FATAL at boot 1** — World A evidence retained
(`world-A/setup-failure.json`, `world-A/boot-1/instance.log`,
`world-A/boot-1/probe-events/fence-probe-events.jsonl`):

```
[dsh-agent-team] bootstrap FAILED: TeamSessionActivationInterceptedError:
  dsh-agent-team: intercepted foreign Agent activation for Team-managed
  session "session-rst017s5-boot-2026-09-26T17-25-50"
    at Object.beforeAgentCreated (.../node_modules/dsh-agent-team/packages/runtime/
      dist/packages/runtime/src/plugin/team-session-activation.js:439:19)
    at ctx.on.global (.../dist/.../host.js:468:36)
    at Proxy.serial (vendor/cordis/lib/index.js:291:25)
    at async Proxy.announce (packages/core/agent/lib/index.js:579:4)
    at async Object.publish (packages/core/agent-loop/lib/index.js:1711:7)
    ... initializeAgent (packages/core/agent-loop/lib/index.js:1861:11)
```

Probe: `17:25:57.212 agent/created source=startup veto=false permitted=false`
→ `17:25:57.233 agent/disposed`. Regression vs Commit-4 (run at `f3d5a71b`,
pre-S1 fence): identical world config booted fine there.

## 2. Main-agent independent verification — the fence + claim design is CORRECT in source

Full object-identity chain, all links read in source (worktree @ `833c6999` +
test-use @ `46a7f68b09`, read-only):

1. **One fence instance.** `host.ts:752` `apply()` creates
   `createTeamSessionActivationFence()` at the very front (before the first
   await), registers its `agent/created` / `agent/disposed` listeners
   `{ global: true }` (`host.ts:785-804`), and passes THE SAME instance to the
   glue (`host.ts:1457-1491`, `activationFence` at `:1490`).
2. **The glue claims the exact announced object.** Every Team create/resume
   goes through `runOwnedActivation` (per-SID single-flight + `runOwned`
   guard, `agent-bindings.mjs:979-987`) with the setup wrapped in
   `teamOwnedSetup` (`:940-960`): it calls
   `fence.claimOwnedGeneration(sid, setupAgent)` with the EXACT `setupAgent`
   the lifecycle passes, before delegating. `resumeTeamAgent` /
   `createTeamAgent` (`:998-1023`) are the ONLY `agents.resume` /
   `agents.create` call sites (static-pinned). The boot root create is
   `createTeamAgent` (`live.boot()`, `agent-bindings.mjs:2781-2791`;
   `root.ts:2228` `await live.boot()`).
3. **Upstream 0.1.7 passes the same object to setup and to announce.**
   `agent-loop/src/index.ts:754-780` `setupAndPublish`:
   `setup?.(prepared.agent.ctx, prepared.agent)` (`:775`) then
   `prepared.publish(source)` (`:778`); the `publish` closure
   (`:608-633`) does `loopCtx.agents.enter(agent, parentAgent)` (`:621`) +
   `await loopCtx.agents.announce(agent, source, abort.signal)` (`:624`) with
   the SAME `agent` object. `AgentRegistry.announce`
   (`packages/core/agent/src/index.ts:537-558`) asserts `entry.agent === agent`
   (`:539`) and emits `ctx.serial(carrier, 'agent/created', {agent: entry.agent,
   source, signal})` (`:550-554`). So the fence's `input.agent` IS the claimed
   `setupAgent`; `claimMatches` (exact `===`) must hold for the glue's own
   activation, and it does so BEFORE the announce (setup precedes publish —
   the Commit-4 in-host ordering fact the S1 design is built on).
4. **The claim-acceptance gate is held.** `claimOwnedGeneration`
   (`team-session-activation.ts:583-594`) accepts only while the `runOwned`
   guard (ref-counted, `:551-581`, `return await operation()` — the Commit-4
   defect fix) spans the awaited create/resume; the setup runs inside that
   span. `beforeAgentCreated` (`:606-683`) decision order: closed→pass;
   resolver-unbound && !claimMatches→await ownershipReady; unmanaged→pass;
   **exact claim→consume+pass**; permit→consume+pass; else foreign→epoch
   record + throw.

Conclusion: **with the S1 src in place, the boot-1 bootstrap activation is
causally claimed and passes. The design did not break.**

## 3. The actual root cause — the installed dist glue is the PRE-S1 byte sequence

Artifact forensics (md5-verified):

| artifact | md5 | contains S1 glue symbols |
| --- | --- | --- |
| `git show 449e1fc:…/dist/…/live/agent-bindings.mjs` (PR head, pre-S1) | `ddd17d74161b5cb7882d11a1a91aaabf` | no (0) |
| `git show 833c6999:…/dist/…/live/agent-bindings.mjs` (worktree tip) | `ddd17d74161b5cb7882d11a1a91aaabf` | no (0) |
| installed `tests/homes/rst017-s5-2026-09-26T17-25-50-A/profiles/web/node_modules/dsh-agent-team/packages/runtime/dist/…/live/agent-bindings.mjs` | `ddd17d74161b5cb7882d11a1a91aaabf` | no (0) |
| src `packages/runtime/src/plugin/live/agent-bindings.mjs` @ `833c6999` | `e944e742301fa660fa5d7d464da36dac` | yes (6: `teamOwnedSetup` ×3, `singleFlightTeamActivation` ×3 — plus `ensureLiveAgentInFlight`) |

The dist mirror of the glue has been **byte-identical to the pre-S1 state
since before S1** — S1 (`58d30de`) and S2 (`673bb7c`) updated the COMPILED TS
dist files (S1 stat: `team-session-activation.{js,d.ts,*.map}`, `host.js.map`;
S2: `host.js`, `root.js` + maps) but NEVER the `.mjs` mirror. The S5 kit
installed exactly the committed tip (bare clone `--branch
task/team-restart-017rc1` with tip pin verified == `833c6999`,
`kit-s5.mjs:1329-1346`), so the real host ran:

- **fence = S1** (exact-claim authority) — from the rebuilt TS dist;
- **glue = pre-S1** (no `teamOwnedSetup`, no claim, no single-flight) — from
  the stale .mjs mirror.

Failure mode: the boot-1 bootstrap activation (`createTeamAgent` →
`agents.create` → setup **without** the claim wrapper → announce) reaches the
S1 fence with `claimMatches=false`, resolver bound, owner
Team-managed (the freshly minted domain row), no permit → **branch (6)
foreign → epoch record + `TeamSessionActivationInterceptedError`** →
AgentLoop rollback (`agent/disposed`) → row bootstrap FAILED. Under the
pre-S1 fence the same unclaimed activation passed via the ownedDepth window
(the glue DID call `runOwned` — the stale glue predates only the claim
wrapper and the single-flight maps) — which is exactly why Commit-4 (run at
`f3d5a71b`) booted and this is a regression in S1's INSTALLED surface, not
in its design.

### Why every verification layer missed it

- **Factory/unit suites** (A1–A15, G1–G10, all runtime tests): vitest loads
  the package from **src** (the fresh S1 glue) — green.
- **`check-artifacts-committed.mjs` (A/B/C)**: compares the on-disk dist tree
  against the **git index** — the stale glue is stale on BOTH sides (clean
  index, clean disk) → no drift reported (the 1196-artifact preflight passed).
  The gate's own contract ("committed artifacts are exactly what a fresh
  build produces") was violated, because a fresh build PLACES the glue and
  the check had no way to see that placement was skipped.
- **Real host (git-install)**: the only consumer that executes the DIST glue
  (`glueUrl` → `dist/…/live/agent-bindings.mjs`) — the first surface to hit
  the stale bytes.

## 4. The S5a fix (this commit)

1. `scripts/place-dist-glue.mjs` — module-ized: `export const PLACEMENTS`
   (the single home for "src files tsc never emits that the installed dist
   must carry") + a direct-invocation guard (placement runs only as
   `node scripts/place-dist-glue.mjs [root]`; importers get the list only).
2. `scripts/check-artifacts-committed.mjs` — **check D (glue placement
   drift)**: imports `PLACEMENTS`, asserts each dist mirror is
   byte-identical to its src; any miss → exit 1 with the exact pair. A new
   placement added to `PLACEMENTS` is gated automatically.
   - RED proof (pre-fix tree): `node scripts/check-artifacts-committed.mjs`
     → exit 1, `D glue placement drift: …/dist/…/agent-bindings.mjs !=
     …/src/…/agent-bindings.mjs`.
3. `pnpm build && pnpm build:composition` in the worktree — `place-dist-glue`
   copies the fresh glue; dist now md5 `e944e742…` == src (byte-identical);
   the committed delta is +196 lines — exactly the S1 src change
   (`singleFlightTeamActivation` maps, `teamOwnedSetup` claim wrapper,
   `ensureLiveAgent`/`ensureLiveAgentOnce` split, `recoverWriterConflict`
   `{afterEpoch, deadlineMs}` recovery surface). No other dist artifact
   drifted (tsc output was already in sync; client composition shim rebuilt
   byte-identical).

Red lines: zero upstream modification (test-use untouched @ `46a7f68b09`);
**zero src behavior change** — only the committed dist artifact + the two
repo tooling scripts; no v6 bump (remote contract untouched);
`:3080`/`:3180`/`:3491` untouched; no reload repair / no DOM hack / no
`ownedDepth`-as-pass-authority (the fence design is unchanged — the fix
restores the glue the design already ships in src).

## 5. Next

S5 re-run (subagent ca8bdd24): the kit's `EXPECTED_BRANCH_SHA` pin must move
from `833c69997a2d1893e69753b9ab697488e82efe8a` to the S5a commit SHA; fresh
worlds (new homes) — the retained blocked home
`rst017-s5-2026-09-26T17-25-50-A` stays as evidence; expect World A to now
boot (the exact-claim fence passes its own bootstrap) and proceed to the
strict §5 browser gate (step 10 still expected FAIL per S3 NO-GO-C1 — the
same-page closure remains the documented decision point; B/C/D/E/F legs run
to completion).

## 6. Addendum — S5a tip confirmed on the real host (2026-09-26T17:47–17:49Z)

Before the subagent's full A–F re-run settled, the main agent ran a surgical
boot probe (scratch home `rst017-s5verify-2026-09-26T17-47-40` — copied
profile/node_modules from the retained blocked home, the S5a dist glue
byte-installed into its node_modules, fresh rootSessionId, wiped runtime
state; ports 3493/3498; home deleted after the probe per TEST_METHODS §7):

- **Boot 1 SETTLED without `bootstrap FAILED`** (instance log ends at
  `remote mount: MOUNTED channel=/team-remote`; the blocked run logged the
  fence FATAL on the next line in the identical position) — the
  exact-claim fence passed the plugin's own bootstrap with the S5a glue.
- Corroborating real-host evidence from the subagent's re-run itself
  (passive fence-probe row, `world-A/boot-1/probe-events/
  fence-probe-events.jsonl`): World A boot root
  `session-rst017s5-boot-2026-09-26T17-48-44` —
  `17:48:50.108 agent/created source=startup veto=false` with **NO**
  `agent/disposed` (the blocked run's created→disposed pair was 21 ms
  apart); the dynamic root
  `session-rst017s5-dyn-2026-09-26T17-48-44` likewise `veto=false`
  (created→pass, Team-mode leg activation also claimed correctly).

The S5a fix is confirmed effective on the real host; the full A–F verdict
await the kit run's completion (this directory, fresh evidence).
