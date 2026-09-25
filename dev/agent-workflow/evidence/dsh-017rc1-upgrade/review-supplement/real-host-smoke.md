# H1–H3 real-host smoke — PR #29 review-supplement round (2026-09-25)

**Purpose**（guide §11.3）: close the real-host items for the three PR #29
review findings on a FRESH pristine DSH 0.1.7-rc.1 world (test-use @
`46a7f68b0922371ce7144b668b90e377d8e799f4`) — a focused smoke (H1–H3),
not a full U8 re-run (U8's V1–V8 evidence already covers the vertical;
this run verifies the SUPPLEMENT delta: F1 peer gate + F2 roster policy
+ F3 retention surface, on the committed branch state).

Kit: `smoke.mjs` (this directory). World: `tests/homes/rs-017rc1-<stamp>`
(TEST_METHODS §7, retained). Mock model: `packages/tools/harness/mock-deepseek.mjs`
@ 3496 (single scripted `done` reply); host port first free in 3491–3500.
:3080/:3180 untouched (no probes needed — the smoke world is fully
isolated; stable-instance discipline = zero interaction).

**Branch state under test**: `task/dsh-017rc1-upgrade` commits
`1a3a3ad` (fix(compat) — F1) + `730f83b` (fix(client) — F2+F3), cloned
bare-into-world and installed via `git+file://` (the S0 check pins
cloned tip == worktree HEAD at run time).

## H1 — git-install compat on the real 0.1.7 host (F1 closure proof)

| # | check | result |
| --- | --- | --- |
| S0 | bare clone of the supplement branch; cloned tip == worktree HEAD | **PASS** |
| S1 | first `dsh plugin add git+file://<world>/repo.git#task/dsh-017rc1-upgrade` exits 0 (the F1 peer DECLARED — the 0.1.7 compat gate now EVALUATES it and it passes at the running runtime) | **PASS** |
| S1 | NO `incompatible` line / `allow-version` exemption prompt in the add output (no exemption needed: the declared range matches the running runtime) | **PASS** |
| S1 | no `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED` (install surface committed prebuilt; zero lifecycle scripts) | **PASS** |
| S1 | no `allowBuilds` entry in the profile pnpm-workspace.yaml | **PASS** |
| S1 | NO `compatibility.json` exemption grant file anywhere in the world (the install needed no exemption) | **PASS** |
| H1-peer | the INSTALLED manifest carries `peerDependencies["@deepseek-ai/dsh"] = "0.1.7-rc.1"` (the F1 declaration survived the git-install path) | **PASS** |
| H1-peer | the host runtime reports `0.1.7-rc.1` (getDshRuntimeVersion, the host's own built lib) | **PASS** |
| H1-peer | the host's OWN built evaluator `evaluatePluginCompatibility(installedManifest, {}, '0.1.7-rc.1')` → **undefined** (accepted, no issue, no exemption) | **PASS** |
| H1-peer | COUNTERFACTUAL: the SAME manifest at a `0.1.5-rc.2` runtime RAISES an issue naming `@deepseek-ai/dsh` (**the gate now CONSTRAINS the plugin**) | **PASS** |
| H1-peer | counterfactual (no peer declared — the PRE-supplement shape, key-absent) at `0.1.5-rc.2` → undefined (unconstrained) = exactly the hole F1 closes | **PASS** |

Evidence: `h1-install/add.log` (full add output), `h1-install/add-warnings.json`,
`h1-peer/installed-package.json`, `h1-peer/evaluation.json`.

**Note on the evaluator call shape** (discovered in round 2 of this smoke):
`evaluatePluginCompatibility` gates on `Object.hasOwn(manifest,
'peerDependencies')` — a TRULY peerless manifest (key absent) returns
undefined (unconstrained), while a key present with an undefined value
throws. The pre-supplement package.json is the key-absent shape; the
counterfactual uses `delete manifest.peerDependencies`.

## H2 — boot + roster read + Team creation (F2 real-host proof)

| # | check | result |
| --- | --- | --- |
| H2 | host boot marker present (`dsh web: http://127.0.0.1:<port>/?token=…`) | **PASS** |
| H2 | unauthenticated GET / → 401 (launch-token gate active) | **PASS** |
| H2 | launch-token cookie obtained | **PASS** |
| H2-roster | `POST /api/agentPresets/list` responds ok on the fresh world | **PASS** |
| H2-roster | the wire carries `modeSelectionEnabled` as a **boolean** — the F2 field is LIVE on 0.1.7 (the guide §11 deprecation note is answered by source + wire: `agent-preset-registry` types + wire schema `z.boolean().default(true).volatile()` + the actual fresh-world value below) | **PASS** |
| H2-roster | ACTUAL fresh-world wire value: **`modeSelectionEnabled: true`**, presets = 4 (the F2 client policy `visible = modeSelectionEnabled ? usable : usable∩{isDefault}` yields a NON-EMPTY visible roster → the creation UI would not fail-visible) | **PASS** |
| H2-team | team.create (v2, strict blueprint `team.rs-main`, minimal initial work) resolved ok (product-path Team creation PASS; readiness gate below) | **PASS** (readiness retries: 1) |
| H2-team | the created team leader turn started at the mock (model = row staticModel `rs-model-<stamp>`) | **PASS** |
| H2-team | the leader system prompt carries the bound blueprint persona (strict blueprint bound, not the anchor) | **PASS** |
| H2-team | the leader surface carries the 13 `team_*` tools of the blueprint allow list | **PASS** |

**Readiness gate (kit round-2 discovery)**: the 0.1.7 remote mount is
**mount-before-boot** — the route registers while the live boot is still
settling (`RemoteReadiness: starting | ready | failed`, s6-remote.ts;
`failed` is terminal: no automatic retry). Non-catalog methods are
refused pre-admission with `internal-error` /
`runtime-not-ready` (`team.create` round-2 hit exactly this at ~T+90s).
The rejection is BEFORE the handler (nothing durable) → the kit polls
team.create with 5s backoff (24-attempt budget); the successful attempt
resolves at initial-work settle. `h2-team/readiness-retries.json` records
the attempt history.

Evidence: `v0-boot/boot-marker.txt`, `v0-boot/instance-1.log`,
`h2-roster/agentpresets-list.json` (full wire body), `h2-roster/roster-summary.json`,
`h2-team/readiness-retries.json`, `h2-team/leader-first-request.json`,
`h2-team/create-response.json`.

## H3 — session coexistence + catalog wire shape + fresh connection (F3 real-host proof)

Wire facts fixed by the session-controller source (test-use, cited in
`client-main-retention.md`): `session/list` → `SessionListValue = { items:
SessionSummary[] }`; **`SessionSummary` (types.ts:177) carries NO
`retainedBy` field** — `retainedBy` is a client-LOCAL merge of
per-connection retain counts into the local list snapshot
(`publishRetention`, client service.ts:559-571; `retainInfo`/`retain`/
`release` are client-context services with NO wire RPC endpoint).
Therefore the wire-level observables for F3 are: the row shape, the
catalog contents (all three session kinds coexist, no row loss), and
reconnect stability — plus the client R1–R3 tests pin the open-mode
invariant on the client retention surface itself.

| # | check | result |
| --- | --- | --- |
| H3 | a freshly created ordinary session succeeds (`POST /api/session/create`, ordinary path intact alongside the team root) | **PASS** |
| H3 | connection-1 catalog (`POST /api/session/list`, args `{_request: {}}`) carries the boot main root (`session-rs-root-<stamp>`) + the created team root (`session-rs-team-<stamp>`) + the new ordinary session (`session-rs-ord-<stamp>`) — NO row loss | **PASS** |
| H3 | wire row shape: every row is `SessionSummary` (sessionId + agentAvailable + running present); `retainedBy` recorded as client-side (not wire) | **PASS** |
| H3 | a SECOND launch-token cookie (fresh client identity = a true new connection, not a reused one) obtained | **PASS** |
| H3 | the FRESH connection sees the SAME catalog (reconnect stability — no spurious row loss / generation-replacement window on a new client) | **PASS** |

Evidence: `h3-sessions/create-ordinary.json`, `h3-sessions/list-connection1.json`,
`h3-sessions/row-shape.json` (per-row sessionId/agentAvailable/running/blank/
parentSessionId), `h3-sessions/list-connection2.json`.

**VERDICT: 26/26 checks PASS (definitive run 5, world
`rs-017rc1-2026-09-25T14-07-04`, KIT-EXIT=0)** — H1 11/11, H2 10/10,
H3 5/5. Full transcript: `smoke-run.log` (definitive) +
`smoke-run4.log` (round history).

## Round history (kit iterations on this evidence)

- **run 1**: kit syntax error (nested template literal) — no world effect.
- **run 2** (world `rs-017rc1-2026-09-25T13-54-16`): H1 8/11 — the F1
  peer was ABSENT from the installed manifest because the bare clone
  carries only COMMITTED state (the F1 change was uncommitted at run
  time) → the S1 install trivially passed on the pre-supplement shape and
  the peer-read checks failed; the run also exposed the
  `evaluatePluginCompatibility` key-absent vs key-undefined distinction
  (fixed in the kit). **Action**: commits `1a3a3ad` + `730f83b` created,
  then re-run.
- **run 3** (world `rs-017rc1-2026-09-25T13-55-09`): H1 **11/11 PASS**
  (the committed state carries the peer; both counterfactuals prove the
  gate constrains); H2 boot+roster PASS (wire `modeSelectionEnabled=true`
  recorded) but team.create hit `runtime-not-ready (state: starting)` —
  the kit had skipped the readiness gate (U8 used the p6t6 health row) —
  and `session/list` sent empty args (the typert descriptor requires
  `{_request: {}}`); additionally the profile-patch rows were hand-written
  as a MAPPING under `insert:` (the parser silently ignored that shape —
  the boot root came up as the bundle default `team-root` +
  `my-team-bp-1` instead of the configured row), which run 3's team_domain
  dump exposed. All three kit bugs fixed for run 4.
- **run 4** (world `rs-017rc1-2026-09-25T14-01-31`): the patch shape fix
  took effect (boot root = `session-rs-root-…` + `team.rs-anchor`); the
  readiness retry gate worked (1 `runtime-not-ready` rejection, attempt 2
  admitted — ledger facts `team-work-admitted` @ 22:01:41 →
  `team-root-work-delivered` @ 22:02:10 in `storages/team_domain.json`);
  the mock processed the boot-root turn + the created-leader initial-work
  turn (both `done`); team.create resolved ok at settle. BUT the kit's
  `userTextOf`/`systemPromptOf`/`toolsOf` accessed the mock RECORD without
  the U8 `bodyOf` record→body normalization (records carry the parsed body
  under `.body`) → the leader-request predicate could never match → the
  H2-team mock-witness checks false-failed (23/24; the host behavior was
  correct — mock received both turns, ledger shows admitted+delivered).
  `bodyOf` added.
- **run 5 (DEFINITIVE)** (world `rs-017rc1-2026-09-25T14-07-04`):
  **26/26 PASS, KIT-EXIT=0** — H1 11/11 (repeat of the run-3 peer
  evidence on a fresh world), H2 10/10 (boot, 401/cookie, roster wire
  `modeSelectionEnabled=true`/4 presets, readiness retry ×1, team.create
  ok, leader request + persona + 13 team_ tools all witnessed at the
  mock), H3 5/5 (ordinary create, 3-row coexistence, SessionSummary
  shape, fresh connection, reconnect identity).

## Closing discipline

- test-use pristine @ `46a7f68b09` before and after (kit asserts the S0
  clone; the checkout itself is byte-checked at the round level).
- All smoke ports released at teardown (host SIGTERM + mock close);
  world retained for inspection (TEST_METHODS §7).
- CORE PATCH BUDGET = 0: the smoke exercised the host read-only (install
  into the world profile only); zero upstream changes.
