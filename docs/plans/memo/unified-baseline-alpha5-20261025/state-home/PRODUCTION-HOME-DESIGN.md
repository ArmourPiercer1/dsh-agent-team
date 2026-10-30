# PRODUCTION-HOME-DESIGN — R-STATE-HOME-1 narrowed fix note (design-only, v2)

> **Dated banner (2026-10-31 late, lane `u7r3-shomedesign`, seat: delegated subagent on the
> harness-reported model qwen3.8-flash-next; ROUTER_RULES §0.2 — independence = independent sessions).**
> **Supersedes this lane's v1 grand-design draft (never committed).** Authority: USER ruling 2026-10-31
> (late, relayed via the coordinator brief; external-reviewer re-verification against upstream
> `639ed01539`) — the fix route is NARROW: reuse the upstream trusted home, remove the plugin's extra
> production-conflicting restriction, **no independent STATE_HOME system**. The earlier
> USER-RULING-20261031 §2 stays the surrounding frame (six-scenario C2 close-gate; cold migration; lock
> separation; centre interface gated by independent security review). Host = pristine
> `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84`; our paths = repo.
> **DESIGN-ONLY: zero `packages/**` changes, no boots, no PR.** This file is the whole lane change.

## (a) The contract conflict, three rows

Upstream contract: `resolveDshHome()` = configured ?? `$DSH_HOME` ?? `~/.dsh`, and `~/.dsh` is the
*documented* default (`home-paths/src/index.ts:12-15`: `DSH_HOME_DIR_NAME` + `DEFAULT_DSH_HOME_DISPLAY = '~/.dsh'`;
resolution `packages/util/home-paths/src/index.ts:87-95`).
Our store law (`packages/tools/agent-state-family/src/fs-state-store.mjs:253-282`):

| DSH_HOME shape | Upstream answer (legal?) | Our store today | Target (this note) |
| --- | --- | --- | --- |
| **unset** | YES — answers `homedir()/.dsh` (`:87-95`, `defaultDshHome() :61-63`) | REFUSED `AGENT_STATE_STORE_HOME_MISSING` (`fs-state-store.mjs:254-257`) — production default install can never mount | **production: ACCEPT** (host's own sanctioned home, plugin-owned namespace under it); **test: keep refusing** (unchanged) |
| **explicit = operator `~/.dsh`** | YES — accepted as-is | REFUSED `AGENT_STATE_STORE_HOME_INVALID` (positive `sameOrUnder` guard, `:268-276`) | **production: ACCEPT** (it IS the host's home); **test: keep refusing** (unchanged — this guard's whole purpose is the TEST_METHODS red line protecting the live stable instance's home) |
| **explicit other** (absolute, existing dir) | YES | WORKS (20/20 PoC; u7-astore C2 rode exactly this: `tests/world-factory/lib/u7astore-assembly.mjs:106-110,373`) | UNCHANGED both modes |

The middle row's refusal was a **deliberate test-safety rule** (`fs-state-store.mjs:219-223` comment:
it exists because the harness home of the dev/stable instance is `~/.dsh`, TEST_METHODS red line). The
re-verification identifies it, applied to *production*, as a contract conflict: upstream defines the
default home as legal, and a plugin that refuses the host's own home can never serve a normal install.

## (b) Route — reuse the upstream trusted home; options ranked

**R1 (RECOMMENDED) — direct reuse of the upstream public home API.**
Is it importable under our red lines? YES, on verified facts:
- `@deepseek-ai/dsh-home-paths` is a **published public package** with a clean root export:
  `publishConfig.access: "public"`, `exports["."] → lib/index.js`
  (`tests/deepseek-harness-test-use/packages/util/home-paths/package.json`); the API we need
  (`resolveDshHome`, `defaultDshHome`, `DSH_HOME_ENV`) is root-exported public surface
  (`src/index.ts:61-100`) — not a private/internal API (red line targets those).
- **Existing precedent, same layer**: our tools families already import an upstream public package
  directly — `packages/tools/search-family/src/search-backend.mjs:205` and
  `glob-backend.mjs:198` import `@deepseek-ai/dsh-tool-fs-search`; further precedent
  `agent-bindings.mjs:339-470`, `team-spill-local.ts:46-49`, `client/plugin/team-mount-core.ts:49-56`.
  Upstream deps are declared at the workspace root pinned to the baseline
  (`package.json:52-60`, `@deepseek-ai/* @ 0.2.0-rc.2`); resolution in production worlds is covered by
  the `upstream-resolver.mjs` hook (`host.ts` registers it at load; normal-first, drift-loud).
  Impl PR must ADD `@deepseek-ai/dsh-home-paths` to the root deps set (same pin) — config, not code.
- **Family-lifecycle reachability: YES.** The home law runs synchronously inside `build(cap)`
  (`packages/tools/families/agent-state.mjs:56-58` → `resolveAgentStateHome()` at
  `fs-state-store.mjs:253`); `resolveDshHome`/`defaultDshHome` are pure synchronous — a drop-in arm,
  no timing problem, no new plumbing.

**R2 (reachable, but only at the ENTRY, and buys nothing over R1) — `profileContext.home` through the
Host context seam.** Upstream mints the trusted value: `apps/cli/src/profile-boot.ts:293`
(`home: resolveDshHome()`), provided before any config-tree entry mounts at `:298`
(`hostCtx.provide('profileContext', profileContext)`); typed public
(`packages/boot/app-boot/src/profile-context.ts:23,33-37`). Reachable from our production row entry
(`packages/runtime/src/plugin/host.ts:1118 apply(ctx, …)` inherits boot-context services; same boot
also provides `dshHomePath` at `app-boot/src/index.ts:995`). **NOT reachable inside the Family
lifecycle**: our plane binds host services only at `mount(agentCtx)`
(`packages/runtime/src/plugin/live/team-tool-plane.mjs:2048`), while `build(cap)` already ran in the
mount loop (`:1610-1644`) — using it at build would need a new capability key = **centre interface**
(gated by independent security review; avoided). And the value is byte-identical to R1
(profile-boot.ts:293 literally calls `resolveDshHome()`), so R2 = R1 + a centre change. Rejected.

**R3 — minimal `homePath` capability: NOT NEEDED.** Only if R1/R2 were unreachable. Stays dormant with
the standing gate: independent security review MUST precede any centre-interface PR.

**R1 wiring sketch (for the impl PR, not this lane):** in `fs-state-store.mjs`, the home law gains a
mode-aware resolution arm — production: when `DSH_HOME` raw env is absent/blank, the home is
`defaultDshHome()` (upstream answer) instead of `HOME_MISSING`; every other validation (below, (d))
runs over it unchanged. The `~/.dsh` refusal becomes **test-mode-only**. `agent-state.mjs`, the plane,
`family-assembly.mjs`, and every Host interface are UNTOUCHED. Zero centre lines; upstream untouched
(CORE PATCH BUDGET = 0 intact).

## (c) Production-vs-test policy split

Production writes governed state into a **plugin-owned data namespace under the host's own home**:
`<home>/team-state/agent-state/<realmId>/` — the EXISTING layout (`fs-state-store.mjs:180,292`),
zero migration (PoC §4), already the independent-Oracle path of the u7-astore C2 world. No new
STATE_HOME system, no layout rename.

**Discriminator (precise):** the mount mode comes from the TRUSTED ASSEMBLY, not from env or data: an
additive **boolean** key on the plane mount config — `teamToolPlane.testHomeGuard` — read at the same
layer that reads `agentStateEnabled` today (`agent-state.mjs:79`; booleans are the closed-world plane
config type, `family-assembly.mjs:109`, so this fits the existing law with no seam change; the value
rides `cap.planeConfig`, produced by row config `config.teamToolPlane`, precedent
`tests/world-factory/lib/u7fagentb-assembly.mjs:46`). **DEFAULT = production (guard off); every test
WorldFactory kit sets `testHomeGuard: true` at its single row-config choke point** — the same point
that already sets `agentStateEnabled`, so a test kit cannot accidentally forget the flag without also
forgetting to enable the family at all.

- **testHomeGuard = true (all test Worlds, unchanged behavior):** current law byte-for-byte —
  unset/blank env → `HOME_MISSING`; relative → `HOME_INVALID` (never resolved against cwd); resolved
  home equal-or-under the operator's real `homedir()/.dsh` (realpath-compared) → `HOME_INVALID`; no
  env fallback ever invented.
- **production (flag absent):** unset env resolves to `defaultDshHome()`; `~/.dsh` accepted as the
  host's own home; the remaining guards (d) all still run.

**Misclassification safety, both directions:**
- *Production wrongly in test mode* (flag copied into a production composition): the mount fail-closes
  exactly as today (`PLANE_AGENT_STATE_STORE_MISSING`, typed, observable in the launch log) → loss of
  availability, zero data harm, honest diagnosis; deployment fix = remove the key. Safe direction.
- *Test World wrongly in production mode* (kit forgets the key): harm requires ALSO `DSH_HOME` unset AND
  the OS HOME being the real operator home — i.e. a hand-booted host outside WorldFactory. Layered
  mitigations: (1) TEST_METHODS makes WorldFactory-spawned Worlds the only sanctioned boot path, and
  every spawn sets `DSH_HOME=tests/homes/<world>` explicitly (`world-factory.mjs:18`, owned-pid environ
  check `:195`) → the accepted home is the World home, not `~/.dsh`; (2) the kit choke point above;
  (3) V2-style `HOME=<tmp>` isolation is available for any manual production-arm probe (e).
  Residual (recorded honestly, not hidden): a hand-booted enabled plane on a developer box writes under
  `~/.dsh` — which is what production does by definition; if the user wants even that gated, the
  toggle is a one-line composition choice, listed as open question O1.

## (d) Guards preserved UNCHANGED — the impl-PR no-regression list

All in `packages/tools/agent-state-family/src/fs-state-store.mjs` unless noted:
1. Raw-env shape law: blank/relative raw `DSH_HOME` refused, never cwd-resolved (`:254-261`) — kept in
   BOTH modes (production's default arm activates only when the raw env is genuinely absent/blank).
2. realpath-exists + is-directory (`:263-282`); `storeRootFor` closed realm segment law
   (`REALM_SEGMENT :287`, `:288-294`) — unchanged.
3. Anchor containment: root must sit beneath its anchor (`:876-880`, `AGENT_STATE_STORE_PATH_REFUSED`);
   per-op one-component re-walk from the anchor, openat semantics (`openStoreDir :346-358`).
4. **R-AUDIT-HL-1 alias law**: `O_NOFOLLOW` reads (`safeReadRecord :305`), same-FD `nlink === 1`
   refusal (`AGENT_STATE_STORE_ALIAS_REFUSED`), write-leg hard-link law + disclosed post-open window
   (`:442+`); bound ≤ `MAX_SCOPE_BYTES` (`:184`, mid-read growth refusal).
5. Atomic commit: temp + fsync + rename + dir-fsync (`:22,415-438`).
6. Locks: heartbeat + stale classification + generation-checked break, "live pid → NEVER break",
   operator-clear-only (`:50-101`, `acquireLock :616`, `writeLockTemp :561`); #461 lock-ownership law.
7. Idempotence: applied markers consumed via atomic no-replace link, cross-scope-global replay
   (`:50,111-124`); per-home replay domain (PoC C6-C7).
8. Audit rows: `ledger/{attempts,writes}.jsonl` append-only, `ledgerBytes` tri-state, never
   zero-as-clean (`:135-140,491,510`); R-AUDIT-FAIL-1 CONFIRMED/UNCONFIRMED semantics.
9. Mount fail-closure law (`agent-state.mjs` header + `storeMissing`): enabled family with no usable
   store never mounts — unchanged in both modes.
10. The `~/.dsh` refusal itself (`:268-276`) — NOT deleted, RE-SCOPED to `testHomeGuard` mode.
    Consistency note vs USER-RULING-20261031 §2.2 ("不得删除 `~/.dsh` 防护"): the guard survives in the
    mode whose red line motivated it (TEST_METHODS stable-instance protection); the late ruling removes
    only its production application, which the same ruling identifies as the contract defect.

## (e) Acceptance core — the two mandated cheap verifications

**V1 (no boot, deterministic, `packages/runtime/test` lineage):** pure-function equivalence suite over
the home law — production arm answers EXACTLY `resolveDshHome()`/`defaultDshHome()` for default and
explicit-env shapes (import the upstream package in the test, assert value equality); relative/blank
raw-env refusals preserved; test-mode arm byte-equal to today's refusals incl. fake-operator-`~/.dsh`
control (real `~/.dsh` never consulted, PoC practice); discriminator matrix (flag × env × `~/.dsh`
shape) asserts each cell's typed outcome.

**V2 (live; consumes pool C2 starts — coordinator pre-registers per BOOT-BUDGET-20261031C 预登记律
before each spawn):** isolated-temp-OS-HOME pristine boot. Harness shape:
`HOME=<workspace tmp operator home>` env, `DSH_HOME` **unset**, pristine test-use host,
`agentStateEnabled: true`, `testHomeGuard` ABSENT (production arm), production row config otherwise the
u7astore shape. Then: governed `create_goal` → state lands under `<tmp-home>/.dsh/team-state/agent-state/
<realm>/` (plugin namespace); in-boot read-back; **restart** (fresh spawn, same `HOME`) → read-back +
consumed-applyId replay refusal survives; census: real user home untouched (`~/.dsh` read-only,
stat-before/after), `:3080` untouched, worlds torn down per TEST_METHODS §7.
**Start accounting (honest): 2 starts** — write boot + restart boot. The relay said "one boot"; under
the B/C-册 counting (每启动 = 1 记录, e.g. `host-starts.jsonl` 2/2 for the crash pair) the restart leg is
a second start. Both fit pool C2 (8). Coordinator decides at pre-registration.

## (f) C2 six-scenario close-gate mapping (GATE-LEDGER R-STATE-HOME-1)

| Scenario | Satisfied by | Remaining |
| --- | --- | --- |
| default formal Home, env unset | **V2** (live, production arm) | — |
| explicit Home | existing u7-astore C2 coverage (same law unchanged) | re-bind the existing record to the frozen candidate SHA, or re-run +1 start at candidate freeze (coordinator's call) |
| World isolation | PoC-proven C1 legs (per-home replay domain, isolation; C1-promotion per ruling §2.6) | piggyback free in V2: second temp home byte-witness (zero extra starts) |
| restart recovery | **V2 restart boot** | — |
| illegal-path refusal | **V1** (relative/blank/`~/.dsh`-in-test-mode, typed); live-arm refusal already C2-proven by the u7astore-era negative legs | optional +0/-1 live hostile-config boot (coordinator) |
| persistence read-back | **V2** (in-boot + across restart) | — |

**Net boot exposure: V2's 2 starts + at most 1 candidate rebind start.** C1 suite ≠ C2 (ruling §2.6
kept): V1 is determinism insurance, not a substitute.

## (g) #463 goal statement, narrowed

Per this ruling, PR #463's goal is NARROWED to: **reuse the upstream trusted home semantics
(`@deepseek-ai/dsh-home-paths`, public export) and remove the plugin's extra `~/.dsh`/unset refusal
where it conflicts with production, gated by the assembly-set `testHomeGuard`; there is NO independent
STATE_HOME system, no new home concept, and no centre/Host interface change.** The PoC's reusable
assets (relocatable subtree digest, census, C1 legs) transfer to the C1/C2 evidence plan unchanged;
the `homePath` Center Interface (`fs-state-store.mjs:242-248` NAMED FOLLOW-UP) is **retired as
unnecessary** — its premise (no public way to learn the sanctioned home) is falsified by
`home-paths`' public export plus the cited import precedent. If any future variant needs it, the
standing gate (independent security review before any centre-interface PR) revives unchanged.

## Open questions

- **O1** (misclassification residual): accept the recorded residual in §c (hand-booted production-arm
  host on a dev box may write `~/.dsh` by definition of production mode), or require every
  `agentStateEnabled` composition in this repo's own Worlds to carry `testHomeGuard: true` by CI law
  (a cheap `ci-pr-gate` leg could enforce it)?
- **O2** V2 start count: confirm 2 starts (write + restart) against pool C2, vs the relayed "one boot".
- **O3** explicit-Home scenario: re-bind the existing u7-astore C2 record at candidate freeze (0
  starts) or re-run (1 start)?
