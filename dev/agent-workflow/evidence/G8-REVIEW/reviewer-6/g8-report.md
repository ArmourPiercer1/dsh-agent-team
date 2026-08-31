# G8-REVIEW — Reviewer 6 (N=6), Round R61

**Phase under review:** P8 — Remote / projection (`int/P8-remote-projection`)
**Integration SHA:** `3fa4c1f27ed1e8903c131dadc9aafe536ed9eb86` (detached worktree `.worktrees/G8-R6`)
**Diff base:** `959e36358ee7244ff8c7e1e0b8396e70dfef4562`
**Chain rerun:** 1773/1773 passed, 0 failed (6748 ms) — `chain-rerun.log`
**tsc x6 (separate `-p` args):** contracts=0 domain=0 storage=0 runtime=0 testkit=0 remote=0 (all exit 0)
**e2e:** PASS — browserless remote seam over the public `connection.rpc` channel `/team-remote`, boot web port 3186, scenarios E1–E6, 74/74 checks — `e2e-run.log`, `harness-output/summary.json`
**Boundary checks:** zero-core PASS · private-import PASS · owned-boundary PASS (97/97 files in owned globs) — `boundary-checks.log`
**Verdict:** 通过 (PASS)

---

## 1. Protocol and environment (§0, §2)

- Brief sections 0–7 executed in order. Worktree `.worktrees/G8-R6` created detached at the
  integration SHA; all work performed inside it (plus the designated `references/` test
  areas). No push, no force-push, no modification of tracked files, no writes outside the
  owned paths: this evidence directory, `references/.dsh-test-g8-r6` (fresh DSH_HOME per
  attempt), and the external lockfile `references/.dsh-test-g8.lock` (marker
  `G8-R6 <ISO timestamp>`, acquired and released by the driver, content-verified before
  deletion).
- Stable dev instance untouched: `http://127.0.0.1:3080` returned **200 before and after**
  every driver run (re-verified manually after the final run); `D:\deepseek-harness\` never
  touched; `references/deepseek-harness` (frozen legacy fork) read-only.
- Test-use checkout `references/deepseek-harness-test-use` @
  `cd5ef8148158c3a752a658978873241fdf8e2bbc`: working tree **clean before and after** the
  whole round (porcelain `[]` → `[]`, `dirtyDelta []` in `summary.json`; re-verified
  manually at the end of the round).
- Environment facts: node v24.20.0 (native TS type-stripping, erasable-only — this
  constraint drove the seam resolution choice in §3.4), pnpm 11.7.0, Windows workspace
  sandbox (piped-stdio spawns denied → all child processes use file-FD stdio).

## 2. Six-step method results (§4)

### Step 1 — chain rerun (1773 tests) + tsc x6

`chain-rerun.log` (line 195–211): plain-node vitest-equivalent run over the whole chain at
the integration SHA: **1773 passed, 0 failed, 1773 total, 6748 ms**; then six separate
`tsc -p packages/<pkg>/tsconfig.json` invocations, all exit 0:
contracts, domain, storage, runtime, testkit, remote.

### Step 2 — zero-core

`boundary-checks.log` §1, **PASS** on all three sub-checks:
- **1a node: builtins:** independent enumeration over all 456 `.ts` files under
  `packages/` found exactly one `node:` string — the synthetic positive-control sample
  inside `packages/runtime/test/p7t5-no-creation-scan.test.ts` (a string literal in the
  committed no-creation scanner, not an import). The in-chain scanners themselves pass at
  this SHA (p7t5-no-creation-scan 11 tests, p4t6-session-event-scan 10 tests, inside the
  1773). The reviewer-6 import-face scan (`dependency-scan.log`) reported 7
  `node:`-prefixed specifiers inside `packages/remote`; every one resolves to
  `test/p8t3-negative-scan.mjs` (the scanner's own `startsWith('node:')` logic and its
  positive-control sample) or to "no node: builtins" doc comments — zero real imports in
  product source.
- **1b no patch mutation of upstream:** no install/prepare/postinstall scripts and no
  patch-package usage in any of the 10 package manifests.
- **1c no upstream imports:** full bare-specifier enumeration (2235 specifiers, 456 files):
  every bare specifier is `vitest` / `vitest/config` / `yaml` (declared root deps) or test
  infrastructure; nothing imports from `references/deepseek-harness-test-use`.

### Step 3 — private-import

`boundary-checks.log` §2, **PASS**: no import of upstream private/internal API surface;
the vNext tree touches upstream only through its public seams (see §3:
`connection.rpc.handle`, web-server routing, the storage-domain package root export).

### Step 4 — owned-boundary vs base `959e36358e`

`boundary-checks.log` §3 + `owned-boundary-diff-raw.txt`, **PASS**: the full
`git diff 959e36358e..HEAD --name-only` lists **97 files, 97/97 inside the P8 owned
globs**; both `packages/remote/src/index.ts` and the storage index diffs are purely
additive (no removal or modification of pre-existing export lines). Cross-task invariant
combination review diffs: `remote-index-diff.txt`, `ledger-repo-diff.txt`,
`teamdomain-repo-diff.txt` — no cross-task invariant violation (the P8 remote layer
consumes the P3/P7 storage repos and domain services through their declared exports only).

### Step 5 — dependency / import face scan

`dependency-scan.log` (generator `dep-scan.mjs`) + manual ASSESSMENT section:
- **packages/remote:** 45 files; product import face fully relative + node: builtins
  (the 14 raw "bare" hits are 12× `vitest` + 1× `vitest/config` in `test/` and 2
  template-string false positives in `p8t3-negative-scan.mjs`).
- **packages/client:** only `vitest` + `vitest/config` (test infrastructure); no
  third-party product dependencies.
- **Forbidden tokens:** `SessionController` / `session-log` — **0 hits** in
  `packages/client`; in `packages/remote` **zero hits in `src/**`**, the only 3 hits sit
  in `test/p8t3-negative.test.ts`, the negative-scan test whose documented purpose is to
  detect exactly those tokens (positive control R3/R4). The 93 `mirror`/`Mirror` hits are
  deviation-D-1 documentation vocabulary (value-level wire-shape mirrors), not the
  deprecated browser SessionController Team mirror.
- **12-port surface:** PASS — 12 exported `Remote*Port` interfaces
  (`RemoteCatalogPort, RemoteIntentPort, RemoteTeamCreatePort, RemoteProjectionPort,
  RemoteLedgerPort, RemoteAdmissionPort, RemoteLifecyclePort, RemoteOverridePort,
  RemotePolicyStatePort, RemoteCompatibilityPort, RemoteHandoffPort, RemoteLegacyPort`)
  in `packages/remote/src/handlers/ports.ts`; all synchronous (D-2).

## 3. Browserless remote e2e (§5) — PASS

### 3.1 Mandate and environment

Mandated pristine-host, browser-less remote e2e executed from this session's evidence
directory as a standalone harness (no subagents): real test-use DSH instance booted under
`harness/`, boot web port **3186**, fresh DSH_HOME `references/.dsh-test-g8-r6` per
attempt, external lockfile acquired before and released after (marker verified), all
outputs in `e2e-run.log` + `harness-output/`.

### 3.2 Harness design

- `harness/plugin.mjs` — the dynamic Cordis row (named exports `name`, `inject:
  ['connection','webServer','storageDomain']`, `apply(ctx)`). It registers the real
  `packages/remote` seam — `registerRemoteHandlers` over `connection.rpc.handle(
  '/team-remote', dispatcher)` — with 12 ports bound against REAL durable state from the
  storage domain seam, and seeds one deterministic team (`session-g8r6-team`, blueprint
  `g8r6.team` rev 1, leader + worker members) ending at generation 3 (2 ledger puts,
  deterministic clock `generatedAt = 2026-08-31T09:00:00.000Z`).
  - **Real ports:** catalog (blueprint catalog), intent (`evaluateCompatibility`),
    projection (real fold over real durable rows), ledger (real `LedgerRepository`,
    filtered by root), policyState read, compatibility (real seeded state), legacy
    (`inspectLegacyTeam`), admission/lifecycle error paths (real member reads), override
    read (capability-cell scan over the minted-recordId mutation rows), override reset
    (truthful against the real store).
  - **Fail-closed ports (honest closed codes, zero durable writes from a browserless
    host):** team.create `DURABLE_WRITE_FAILED`, admission success path
    `DURABLE_WRITE_FAILED`, lifecycle commit `LIFECYCLE_COMMIT_UNAVAILABLE`, override.set
    `DURABLE_WRITE_FAILED`, policyState.switchState `DURABLE_WRITE_FAILED`, handoff
    `HANDOFF_SOURCE_SURFACE_UNAVAILABLE`. Rationale in §5 (deferral is a documented later
    P8 host-wiring task, consistent with the 12 ports being synchronous while the real
    runtime services are promise-based).
  - Control routes (harness-private, not part of the product seam):
    `GET /__g8r6/ready` (observation file) and `POST /__g8r6/fact` (real
    `LedgerRepository.put` advancing the generation — used by E3/E4 to create durable
    facts through the same S1-A generation hook production uses).
- `harness/run.mjs` — the driver: preflight (git baseline, :3080 probe, port check,
  lock), boot1 → scenarios E1–E6 → boot2 (process death + reopen) interleaved in E2 →
  stop, post (git delta, :3080 probe, lock release), `summary.json`. One built-in
  transient retry; none was needed in the passing run.
- `harness/seam.mjs` / `harness/ts-loader.mjs` / `harness/smoke.mjs` — storage-domain
  seam (spec → `defineDomain`/`domainTable` translation) and the TS loader chain.

### 3.3 Wire protocol (pinned from upstream source this round)

The host serves shared RPC channels in
`packages/client/connection/src/rpc-host.ts`: `POST /team-remote/<endpoint>` with
`content-type: application/json` (else **415**) and the launch-minted `dsh-auth-<43>`
cookie (else **401**); body must match `clientRequestSchema`
(`{type:'client-request', rpcId: string, method: string, payload}` — else 200
`bad-request`/`invalid client-request message`); `body.method` must equal the URL
endpoint (else 200 `bad-request` "does not match endpoint"); the dispatcher then runs
with `(endpoint, payload, signal)` and its result rides verbatim as the
`server-response` `result`. Seam boundary: the frozen `SeamClientRequest.rpcId`
(`packages/remote/src/push/types.ts`) is a **number** while the host envelope requires a
**string** RpcId — the transport converts in both directions, and a mismatched host
correlation (`invalid-request`) maps to `NaN`, which the client engine's own check
reports as `inconsistent` (no echo-fallback masking).

### 3.4 Seam resolution note

`@deepseek-ai/dsh-storage-domain` resolves to the package **root** export (built
`lib/`, gitignored build artifact present in the test-use tree from an earlier reviewer
round; mtime postdates `src/`). Importing `src/` directly is infeasible: the storage
domain uses TS parameter properties, which node v24.20.0's erasable-only type-stripping
rejects (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`). Zero writes to the test-use tree.

### 3.5 Results — final run 2026-08-31T12:58:24.979Z → 12:58:32.657Z

**74/74 checks, 0 failures, exit 0, `allPass: true`, `concerns: []`**
(`harness-output/summary.json`):

| Scenario | Checks | Outcome | What it proves |
|---|---|---|---|
| E1 initial connect + pull + provenance + bonus RPCs | 23/23 | PASS | cookie mint (302 + `dsh-auth-<43>` regex), fresh client `apply` at generation 3, full provenance block (`origin: team-remote`, method, contractVersion 1, null token), real `catalog.list` / `intent.probe` / `legacy.inspect` round-trips |
| E2 reconnect round-trip | 6/6 | PASS | boot1 stopped (process death) → boot2 reopens the persisted unit (`seeded=false`, generation unchanged 3) → fresh client `apply` (never duplicate) → **full projection deep-equal across the process death** |
| E3 stale response ignored | 11/11 | PASS | baseline captured → durable fact advances to gen 4/seq 3 → real sync `apply`@4 → scripted replay of the gen-3 response → verdict **stale**, `receivedGeneration`=baseline, `stats.framesStale=1`, `onFrameRejected` fired, **applied projection byte-identical (unchanged)** → recovery sync → **duplicate**@4, applied generation held |
| E4 ledger pagination stable | 18/18 | PASS | page(0,2)=seq 1,2/next 2/total 3 + 7 frozen entry fields; growth fact (gen e1Gen+2, seq 4); consumed-anchor re-fetch rejected `anchor-mismatch`, cursor held; RAW same-anchor slice identical under growth (total 3→4, next 2); page(2,2)=seq 3,4/next null/total 4; **tail page (null cursor) never moves the tracker cursor** (frozen rule: cursor advances only on non-null `nextAfterSequence`) + stable tail re-read (same slice, same total) |
| E5 typed errors + envelope discipline + success provenance | 11/11 | PASS | absent team → 200 typed `TEAM_RUNTIME_TEAM_SESSION_NOT_FOUND` (non-empty message, details carry method/endpoint) and the SAME pass-through code visible to the push client; contract version 2 → `contract-version-unsupported`; `member.send` on absent instance → typed `TEAM_RUNTIME_INSTANCE_NOT_FOUND` pass-through with `details.cause.code`; unknown envelope top-level field → `malformed-request`; success carries the full provenance block |
| E6 wire rules | 5/5 | PASS | no cookie → **401**; cookie + `text/plain` → **415**; body method ≠ URL endpoint → 200 `bad-request` naming the mismatch; unknown endpoint → 200 `unknown-method` |

Boot-level: boot1 obs `{phase:'ready', generation:3, seeded:true}`; boot2 obs
`{phase:'ready', generation:3, seeded:false}`; row mounted in ~1 s; both cookie mints
302 + regex; post-run: test-use `dirtyDelta []`, :3080 200, lock released, port 3186
confirmed free (ECONNREFUSED) after the run.

### 3.6 Harness-side defects found and fixed (none product-side)

Three defects were found **in this reviewer's own harness** during the run loop and
fixed in place (evidence files only; the product tree is untouched):
1. **rpcId type conversion** — the transport sent the numeric seam `rpcId` where the
   host envelope requires a string; the host rejected every request as
   `bad-request`/invalid-envelope, and an echo-fallback in the response mapping masked
   the correlation failure. Fixed: `String(rpcId)` on send, `Number(response.rpcId)` on
   receive (mismatched → `NaN` → honest `inconsistent`).
2. **Admission port field name** — the harness read `request.teamSessionId` where the
   frozen `RemoteAdmissionRequest` (packages/remote/src/handlers/member.ts) carries
   `rootSessionId`; the undefined root hit storage record validation
   (`RECORD_INVALID`) before the intended not-found path. Fixed to `request.rootSessionId`.
3. **E4.17 expectation** — the harness asserted the tracker cursor advances to the ledger
   total on a tail page; the frozen rule (packages/remote/src/push/ledger-page.ts,
   lines 136–138) advances the cursor only on a non-null `nextAfterSequence`. The check
   was corrected to assert the frozen semantics (cursor held; end-of-ledger rides the
   null cursor + total) and a stable tail re-read was added (E4.18).

Each fix was re-run end-to-end (fresh DSH_HOME, full E1–E6) until green; the earlier
failed runs remain in `e2e-run.log` as the audit trail.

## 4. G8 criteria mapping (§6) — 6/6 PASS

Verbatim criteria from `docs/plans/active/DSH_Agent_Team_vNext_Detailed_Development_Plan_20260829.md` §21.5:

1. **"browser needs no SessionController Team mirror" — PASS.**
   `dependency-scan.log`: 0 `SessionController`/`session-log` tokens in
   `packages/client` and in `packages/remote/src/**` (the only 3 hits are the
   negative-scan test's positive control); the 12-port structural interface
   (`src/handlers/ports.ts`) is the complete browser-facing surface; e2e E1 proves the
   browser-side client reaches team state exclusively through the
   `connection.rpc` `/team-remote` seam (cookie-minted launch, provenance-stamped
   responses).
2. **"projection round-trip works after reconnect" — PASS.** E2: process death
   (boot1 stopped, port freed) → boot2 reopens the persisted unit (`seeded=false`,
   generation unchanged) → a fresh client's first pull is `apply` (never duplicate) and
   the projection is **deep-equal** to the pre-death snapshot (E2.5).
3. **"stale responses ignored" — PASS.** E3: replaying a lower-generation response
   yields verdict `stale` with the applied projection byte-identical (E3.9), the
   rejection is observable (`stats.framesStale=1`, `onFrameRejected`), and recovery is a
   `duplicate` at the current generation (E3.10–E3.11).
4. **"ledger pagination stable" — PASS.** E4: anchor-guard rejects consumed anchors
   (`anchor-mismatch`, cursor held), same-anchor slices are identical under growth, the
   total only moves up, entry shape is the 7 frozen `REMOTE_LEDGER_ENTRY_FIELDS`, and
   the tail page follows the frozen cursor rule (null cursor never moves the anchor;
   E4.17/E4.18). (Precision note: the brief's "P8-T2 ledger.ts" is the summary fold
   that keeps entries out of the projection; the actual paginated read path is
   `RemoteLedgerPort` over the storage `LedgerRepository` behind the D-5 slicer in
   `team.ts`, with client-side anchoring in `push/ledger-page.ts` — all exercised here.)
5. **"every UI-visible action has typed error/provenance" — PASS.** E5: every probed
   failure returns a closed typed code with a non-empty message and structured details
   (`TEAM_RUNTIME_TEAM_SESSION_NOT_FOUND`, `TEAM_RUNTIME_INSTANCE_NOT_FOUND` with
   `details.cause`, `contract-version-unsupported`, `malformed-request`, host-level
   `bad-request`), all HTTP 200 envelopes (never 500), and successes carry the full
   provenance block (`origin: team-remote`, method, contractVersion, null token) — E1/E5.11.
6. **"Remote contract versioned/tested" — PASS.** `REMOTE_CONTRACT_VERSION = 1` frozen
   in `packages/remote/src/contracts/version.ts`; version gating verified live (E5.7:
   version 2 → `contract-version-unsupported`); the contract/handler/push surfaces are
   covered by the in-chain suites (p8t3-* admission/ids/version/negative/round-trip,
   p8t4-* engine/server/sync/negative) inside the 1773/1773 chain rerun, plus this
   round's independent browserless e2e.

## 5. Observations and deferrals (concerns — none fail a criterion)

1. **Production host wiring is deferred (as planned).** The 12 remote ports are
   synchronous (D-2) while the real runtime services are promise-based; the full
   production adapter (async runtime binding, MutationService-backed override
   set/switchState with kind/origin/recordId disambiguation, real admission success
   path) is a later P8 host-wiring task. This harness binds the error paths to real
   durable reads and fail-closes the mutation paths with the real closed codes — the
   honest browserless stand-in.
2. **Override port** is wired via a capability-cell scan over minted-recordId mutation
   rows (latest by generation → updatedAt → recordId); the production
   disambiguation-aware adapter rides with the item-1 deferral.
3. **Compat probe status** is deterministic per boot but environment-dependent in
   principle (`OPEN` vs `BLOCKED_WARNING` for the seeded `model.g8r6` requirement with
   empty facts); it is recorded in `summary.json`/obs, not asserted.
4. **Fixture id constraint:** `INSTANCE_ID_PATTERN` forbids a hyphen after the `inst-`
   prefix; harness fixtures use `inst-g8r6worker` / `inst-g8r6absent` accordingly
   (the absent id stays syntactically valid so the typed not-found path — not an ID
   validation code — is what E5.8 exercises).
5. **Seam resolution** used the prebuilt gitignored `lib/` of the storage domain
   (built by an earlier reviewer round); see §3.4 for why `src/` is infeasible under
   erasable-only type-stripping.

## 6. Evidence index

| File | Content |
|---|---|
| `install.log` | chain environment / install facts |
| `chain-rerun.log` | 1773/1773 + tsc x6 (all exit 0) |
| `boundary-checks.log` | zero-core / private-import / owned-boundary verdicts |
| `owned-boundary-diff-raw.txt` | 97/97 files in owned globs |
| `remote-index-diff.txt`, `ledger-repo-diff.txt`, `teamdomain-repo-diff.txt` | cross-task invariant combination diffs |
| `dependency-scan.log`, `dep-scan.mjs` | import-face + forbidden-token scan + assessment |
| `harness/plugin.mjs`, `harness/run.mjs`, `harness/seam.mjs`, `harness/ts-loader.mjs`, `harness/smoke.mjs` | the e2e harness (row, driver, seam, loader, smoke) |
| `e2e-run.log` | full driver audit trail (all runs, incl. the failed pre-fix ones) |
| `harness-output/summary.json` | final machine-readable result (`allPass: true`, 74/74) |
| `harness-output/g8r6-obs.json`, `dump-config-boot1.txt`, `dump-config-boot2.txt`, `logs/` | observation + boot config dumps + instance log |

*Report: reviewer-6 (G8-R6), round R61. Verdict: 通过 (PASS).*
