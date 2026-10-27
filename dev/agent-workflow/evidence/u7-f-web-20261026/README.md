# u7-f evidence — governed web_fetch/web_search network family (C1 + C2 + gates)

Task lane: `task/u7-f-web-20261026` (worktree `.worktrees/u7-f-web`), base
origin/master `42c4d04b5`. The FIRST network-effect family
(`dsh.web-family`), mounted ONLY through the u7-w0b FamilyAssembly seam
(descriptor `packages/tools/families/web.mjs`, reviewed manifest sha256,
opt-in closed boolean `planeCfg.webEnabled` default FALSE). CORE PATCH
BUDGET = 0 — zero lines in `team-tool-plane.mjs`, `family-assembly.mjs`,
the binder, or any of the 33 protected center paths.

## C1 (offline, vitest, real plane + kernel chain) — `c1-GREEN.log`

`packages/runtime/test/u7f-web-c1.test.ts` — 19/19 PASS (~1.6 s). The stub
+ victim HTTP servers bind the MOCK band only (3491–3500 / 13050–13099);
nothing in this suite can reach a non-loopback address; `:3080` and
`~/.dsh` are never touched. Arms (each PASS names its witnesses in the
log):

| arm | proves |
| --- | --- |
| W-1 | positive fetch on the real chain; the recorded approval-leg fingerprint pins declared == requested (PR #390 law); leak law (a header secret never surfaces) |
| W-2 / W-3 | zero-flip: `webEnabled` ABSENT and `webEnabled:false` both mount byte-for-byte the no-web plane (jobs law: new-lane closed boolean ABSENT = FALSE) |
| W-4 | non-boolean declared key → `PLANE_CONFIG_INCOMPLETE` — the MOUNT is refused |
| W-5 | template default-deny → typed `refused-admission template-default-deny` BEFORE any wire, zero PA legs |
| W-6 | denying control leg → `refused-admission` with the gate code, zero wire |
| W-7 | non-https scheme + userinfo URLs → typed refusals pre-PA (zero stub contact, zero legs) |
| W-8 | closed args (extra/missing keys) → `closed-args-violation`, nothing constructed |
| W-9 | over-cap response → `WEB_RESPONSE_TOO_LARGE` refused WHOLE (stream destroyed; body bytes never surface) |
| W-10 | redirect loop → bounded hops (`MAX_REDIRECT_HOPS`), stub counts exactly 6 hits |
| W-11 | redirect OFF the approved origin → typed refusal, the VICTIM server provably never contacted |
| W-12 | deadline → typed `WEB_TIMEOUT` (wall clock), zero further wire |
| W-13 | hop witness `RAN … hops=1` records the hop honestly |
| W-14 | settled one-shot token replay → cancelled with ZERO consume (stub and legs unchanged) |
| W-15 | native field-shape parity of the model-visible result face |
| S-1 | web_search with NO provider → typed `WEB_SEARCH_NO_PROVIDER` refusal pre-everything (zero PA, zero wire) |
| S-2 | search closed args |
| S-3 | provider positive: fingerprint = [tool-invoke + connect@declared-origin]; deny leg → zero wire |
| S-4 | invalid provider mount candidate → mount refused `PLANE_WEB_PROVIDER_REFUSED` (fail closed) |

## Mutation control — `mutation-control-RED.log`

Planted law-bug (off-destination redirect made to RETURN OK in
`web-mechanics.mjs::redirectStaysInDestination`): W-11 goes RED with the
victim server contacted. Reverted (byte-exact), 19/19 GREEN again
(`c1-GREEN.log`). The suite is sensitive to the exact law it claims.

## p4t6 — `p4t6-RED-unbooked.log` + booking `u7fweb.json`

MEASURED delta: scanner counts 1333 vs ledger-derived 1322 with the
eleven scannable lane files present and the booking absent. Booking
`packages/testkit/test/p4t6-bookings/u7fweb.json` carries {from:1322,
to:1333} + the measured tieNote; with it the suite is 20/20 GREEN.

## C2 (live pinned Host 0.2.0-rc.2 @ 639ed01539) — `c2-run1…`, `c2-run2…`

Runner: `node tests/world-factory/u5-canary-runner.mjs --suite u7-f-web`
(drop-in world kind `080-u7-f-web.mjs`, suite `070-u7-f-web.mjs`,
assembly `lib/u7f-web-assembly.mjs`, read-only control probe
`canary/u7fweb-ctl-probe-host.mjs`). Boot budget declared 3, USED: see
`c2-budget.jsonl` + each runner.log RUN-SUMMARY.

- `c2-run1-measured-law-learned.log` — the honest first round: the family
  MOUNTED on the real host (`placement-feed rows=[… web_fetch,web_search]`)
  but BOTH governed fetches answered `pa-refused APPROVAL_DENIED` with NO
  durable ask row. Measured law (u7-4a precedent): durable ask-row CREATION
  is a `request-control` mutation — `teamEnvelope`/`memberEnvelopes` must
  name it. Run1 still PROVED the refusal arms zero-effect (stub: zero
  hits) and the web_search no-provider live refusal. Never flipped.
- `c2-run2/runner.log` — mid-round (boot 2): with the envelope fix the
  durable ask rows APPEARED and the Control notification surfaced
  (`askNoticed=true`), but the runner's first approver face (the probe
  row's `/__u7fweb/controls` exact-route read) returned nothing live, so
  nothing settled and the fetch settled `cancelled-at-pa-edge` — zero
  wire, honest FAIL/ENV_BLOCK, never flipped. The probe row's health face
  mounted cleanly; the u6-jobs LEDGER face is the proven reader.
- `c2-run3/runner.log` — FINAL (boot 3 of 3, budget fully honored):
  **overall=PASS 7/7**.
  - `web:mounted` PASS — placement-feed rows carry web_fetch+web_search
    on the real host, zero center diff.
  - `web:fetch-positive` PASS — durable ALLOW (human seam) -> grant
    consumed -> `governed-web-fetch RAN seq=1 status=200 bytes=62 hops=0`
    -> stub ledger `claimHits=1` -> body read back in the transcript.
  - `web:approval-chain-live` PASS — TWO durable PA ask rows in the p6t6
    ledger (`team.getLedgerPage` control-* facts); the PUBLIC
    `team.resolveControl` v4 seam (boot-root operator = Human resolver)
    answered allow then deny, `resolveStatus=200` both; the leader holds
    NO control tools, so the decisions provably came from the human seam.
  - `web:deny-leg-zero-wire` PASS — `pa-refused code=APPROVAL_DENIED`
    with `victimHits=0`: the denied call never touched the wire.
  - `web:search-no-provider` PASS — live typed `WEB_SEARCH_NO_PROVIDER`,
    no `governed-web-search RAN`, zero stub wire beyond /claim.
  - `web:leak-check` PASS — pids dead, ports released, home released,
    zero held leases.
  Boot accounting (honest): run1 1 boot (pre-ledger, host port 3183 in
  the log), run2 1, run3 1 = **3 of the declared 3**; the first nohup
  attempt never booted (no evidence dir existed — nothing counted).
- Offline-suite note: `world-factory.test.mjs` lease tests flake RED with
  `EXTERNAL_BIND` while sibling lanes hold listeners on 3181/3183/3491
  during their own live runs (observed listeners MOVING between polls —
  shared-machine contention, not lane state); 50/50 GREEN un-contended.

## Census rounds (honest record)

- Round 1 (local, post-merge tree): FAIL 7/8 — census named **4 NEW reds**,
  two of them THIS lane's honest consequence (`a5p0-layer-audit`: the two
  web-family executors were un-listed consumers of the tool-governance
  lane — booked file-by-file, same thin face as fs-family, commit
  `chore(audit)`), plus two load-sensitive suites. Capture JSONs kept in
  `dev/agent-workflow/evidence/a4-pr7/ci-gate/scratch/`.
- Round 2 (local, booked tree): FAIL 7/8 — population counts STABLE
  (635f/8113l, identical to round 1) but the red SET MOVED
  (`a5lsp2-streaming` spawn tests; standalone re-runs flip WHICH test is
  red under vitest's 5000 ms default on this shared, spawn-sensitive
  host). `rc2-sanitize-evidence` passes 13/13 with
  `--testTimeout=30000`; `a4p7-merge-gate` green standalone between red
  rounds. Stated, not hidden: post-booking local census reds are
  host-load artifacts on spawn/timer-sensitive tests, NOT lane findings;
  the AUTHORITATIVE census is the hosted one.
- Hosted (authoritative, PR #403): pr-gate SUCCESS (run 40458857327),
  candidate-protection SUCCESS (40458857234); census-runtime
  (40458857196) and ci-required (40458857297) tracked to completion —
  final verdicts reported in the PR conversation.

Verdict law followed throughout: a blocked arm is DISCLOSED (ENV_BLOCK /
verbatim refusal text), never flipped to PASS; the DECISION-3 limit (the
host sandbox claims FILE effects only — bwrap without `--unshare-net`,
partial Landlock, see DECISION-3-ANSWER.md) is restated in every
web-family header: network confinement is NOT sandbox-claimable;
confinement here is the admission plane.
