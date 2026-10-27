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
  `chore(audit)`), plus two load-sensitive suites. Raw capture JSONs are
  kept ON DISK only, untracked, per `scratch/UNTRACKED-SCRATCH.md`
  (never committed; the cited `census-comparison-*.json` sidecars are
  tracked — 4–8 KB each).
- Round 2 (local, booked tree): FAIL 7/8 — population counts STABLE
  (635f/8113l, identical to round 1) but the red SET MOVED
  (`a5lsp2-streaming` spawn tests; standalone re-runs flip WHICH test is
  red under vitest's 5000 ms default on this shared, spawn-sensitive
  host). `rc2-sanitize-evidence` passes 13/13 with
  `--testTimeout=30000`; the `a4p7-merge-gate` arm's cause was then
  root-caused in round 3 (missing local client build, below) — the
  round-2 attribution to load alone was incomplete, corrected here.
- Round 3 (local): 7/8, the single red was the a4p7 composition-smoke
  arm — root-caused honestly: NOT load, NOT lane code — this worktree had
  never built the gitignored client artifact
  (`packages/client/dist/.../plugin/client.js` absent, "Run pnpm build
  and re-run this leg"). Hosted CI builds it (which is why hosted
  ci-full was green from round 1). After a local
  `DSH_CLIENT_COMMIT_HASH=639ed01539 pnpm run build`, the suite is
  35/35 GREEN — recorded at round 4 below.
- Round 4 (local, client built): **DSH-CI-VERDICT pass pass=8 fail=0
  skip=0 refused=0 legs=8** (`ci-pr-gate-full-census-round4.log`) —
  every leg including the nine-root census green on this checkout.
- Hosted (authoritative, PR #403) round 1 @ `02c64aa0f`: pr-gate SUCCESS
  (40458857327), candidate-protection SUCCESS (40458857234),
  census-runtime SUCCESS (40458857196); ci-required (40458857297) FAIL —
  layers=5 green=4, the ONLY red layer `ci-integration`, whose failing
  step was `eb3-family-boundaries`: this lane was UNBOOKED there
  ("an unbooked lane cannot be graded" — findings=9, one per lane file).
  Fixed the way the mechanism prescribes: lane README as the law home
  (`packages/tools/web-family/README.md`: allowed outward edges = node:*
  + contracts + the single governance face, NO plane/sibling/host edges)
  + the `LANE_EDGES`/`LANE_ID_BY_LANE` booking in
  `scripts/eb3-family-boundaries.mjs` (the same booking table every
  family lane rides). Local `eb3-family-boundaries` pass files=42
  findings=0; p4t6 + arc-A fitness + docs re-verified green. Round 2
  below carries the fix.
- Hosted round 2 @ `aa9bdc8e3`: **ALL GREEN** — pr-gate 40462280311
  success, candidate-protection 40462280252 success, census-runtime
  40462280253 success, ci-required 40462280320 success with
  `EB3-REQUIRED pass layers=5 green=5 nongreen=none`; inside it
  ci-full `DSH-CI-VERDICT pass pass=8 fail=0` with
  `leg=census verdict=pass` (SET DID NOT move).

Verdict law followed throughout: a blocked arm is DISCLOSED (ENV_BLOCK /
verbatim refusal text), never flipped to PASS; the DECISION-3 limit (the
host sandbox claims FILE effects only — bwrap without `--unshare-net`,
partial Landlock, see DECISION-3-ANSWER.md) is restated in every
web-family header: network confinement is NOT sandbox-claimable;
confinement here is the admission plane.

## Review round 1 (REVIEW-403, branch `task/u7-wave1-review-b-20261027` @ `b641cf65e`) — the two HIGH findings fixed, RED-first

The independent review (PASS-WITH-FINDINGS, treated as blocking) found:
**H-1** the destination law only restricted LOOPBACK for the plain-http opt —
`https://` admitted ANY address (RFC1918, CGNAT, link-local incl. the
169.254.169.254 metadata home, ULA, IPv4-mapped/compatible/NAT64 spellings,
decimal/octal/hex IPv4); **H-2+M-1** the address law checked the URL's
HOSTNAME while the connect re-resolved later — the DNS-rebinding TOCTOU
window; **H-3** the web_search provider port accepted arbitrary HTTPS URLs
beyond the mount-declared destinations; plus the consent-disclosure
finding (an approval covers the ORIGIN; the text must say so).

Fixes + RED-first evidence (every item written failing BEFORE the fix):

| finding | law now enforced | arms | RED log → GREEN |
| --- | --- | --- | --- |
| H-1 | non-public-destination law on EVERY scheme, BEFORE connect, on the RESOLVED address + the literal spelling; opt re-admits LOOPBACK ONLY (`WEB_DESTINATION_NON_PUBLIC`) | D-1 (20-entry address matrix, pre-PA, zero wire), D-1b (opt never re-admits private/CGNAT/link-local/NAT64), D-2 (opt re-admits 127/8 and the wire TRIES), S-12 (provider declaring a non-public destination refuses the MOUNT) | `u7fweb-review1-c1-RED.log` (11×/19✓) → C1 30/30 |
| H-2/M-1 | resolve EXACTLY ONCE per hop → check EVERY answer (mixed set poisons) → CONNECT TO THE PINNED ADDRESS (injected `lookup`); re-resolution structurally impossible; each redirect hop re-pins | D-3 (mixed public+private refused, resolver.calls=1, zero wire), D-4 (socket lands on the FIRST checked address; hostile second answer NEVER consulted), D-5 (public-first pinned, loopback-rebind second answer never wired), D-6 (per-hop re-resolve+re-pin, calls=2) | same RED log → 30/30 |
| H-3 | the search port POSTs ONLY to the mount-declared provider origins (declared == requested == socket-pinned; empty set reaches nothing) (`WEB_SEARCH_DESTINATION_DENIED`) | S-10 (declared destination positive), S-11 (rogue origin refused AT THE PORT, victim server provably never contacted) | same RED log → 30/30 |
| consent scope | row descriptions + client-rendered consent-scope notes state: an approval permits ANY path on the origin (grants are per-origin) | D-7 (row text), client unit spec (3 arms, shape-tolerant/never-throws) | `u7fweb-review1-client-RED.log` (3×) → 35/35 |

Mutation controls (the tests must be able to fail): **MC-1** removing the
endpoint pin → S-11 RED (`mc1-mutation-allowedOrigins-RED.log`); **MC-2**
disabling the destination law (the pre-review https-passthrough) → D-1,
D-1b, D-3 RED (`mc2-mutation-destination-law-RED.log`). Both reverted;
`grep MUTATION` over the lane: zero.

Consent placement (budget-preserving, disclosed): the protected
`pa-control-bridge.ts` summary template was NOT touched. The origin scope
reaches the human through three lawful faces: (a) the reviewPayload's
effect locators were always on the row; (b) `deriveControlScopeNotes`
(client, `packages/client/src/model/ledger-adapter.ts`) renders one
"ANY path on <origin>" note per connect effect in the control detail
(client tree is not in the 36-path protected ledger); (c) both row
descriptions. The client bundle artifact was rebuilt (1,308,108 B).

Environment disclosure (measured, affects how two arms assert): this test
host's network sandbox transparently intercepts non-`:80` loopback dials
(a dead `127.0.0.2:port` answers 502 from the intercept layer) and drops
TEST-NET dials. D-2/D-5 therefore pin the LAW shape (admitted + PA walked
+ typed bound/never-the-private-answer) via the stub request counters and
resolver call counts — the zero-wire proofs never rely on the interceptor.

C2 note (honest): the C2 live evidence (7/7, 3/3 boots) PREDATES these law
fixes; its stub providers call their declared loopback destinations over
the port — the shapes the new laws continue to allow (S-10 is exactly that
shape). C1 above is the offline proof of the NEW laws; no C2 re-boot was
run this round (boot budget 3/3 consumed; re-boot needs main-agent
authorization).

Fix-round local gates (honest two-round record): **round 5**
(`ci-pr-gate-full-census-round5.log`) = 7/8 — the only red was the
testkit's own merge-gate arm (§7.6, "committed install surface fresh
against the tree"), which red-flagged MY NOT-YET-COMMITTED rebuilt
artifacts (bundle + 8 dist mirrors). That arm is a tripwire working as
designed, not a law break. **Round 6**
(`ci-pr-gate-full-census-round6.log`) runs on the committed fix tree
(f42a92023): the verdict line is recorded there. The census identity set
compares against the booked baseline of OLD REDS (0); counts are
informational — 635f/8127l here vs the baseline document's historical
626/7936, moved by this lane's booked test growth (635/8113 already
passed round 4 with `setIdentical`).
