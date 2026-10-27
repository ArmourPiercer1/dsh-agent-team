# feat(web): governed web_fetch/web_search network family via the FamilyAssembly seam

The FIRST network-effect family: `dsh.web-family` (web_fetch + web_search),
mounted **only** through the u7-w0b FamilyAssembly seam — descriptor
`packages/tools/families/web.mjs` + its sha256-pinned entry in the reviewed
`packages/tools/families/manifest.json`. **Zero lines** in
`team-tool-plane.mjs`, `family-assembly.mjs`, the binder, or any of the 33
protected center paths (full changed-file list below). CORE PATCH BUDGET = 0.

## Network-confinement limits — stated verbatim (DECISION-3)

The host sandbox claims **FILE effects only**: bwrap runs **without**
`--unshare-net`, and Landlock coverage is **partial** (see
`DECISION-3-ANSWER.md`). Network confinement is therefore **NOT claimable at
the sandbox axis**. What this family enforces is the **admission plane**:
provider-enforced upstream (the search provider is an operator-supplied
destination, never invented) + Team-enforced admission (kernel plan/PA,
declared == requested per call, PR #390) + family law (the ONE bounded
transport port: https-only scheme allowlist by default, no userinfo,
redirects must stay inside the approved origin, bounded hops/bytes/timeout,
refusals are typed and stable, and a refused call performs **zero**
network effect — proven by stub request counts, not prose). This limit is
restated verbatim in every web-family source header.

## Why the family is OPT-IN (`planeCfg.webEnabled`, default FALSE)

A network family must not be on by default: enabling it widens the
model-reachable effect surface from file/process effects (which the host
sandbox can at least partially bound) to a destination effect the sandbox
cannot bound at all. The default is therefore FALSE and the key is a
**closed boolean** — absent = FALSE = every existing mount stays
byte-for-byte identical (the zero-flip law, proven by arms W-2/W-3), and a
non-boolean value refuses the whole plane mount (W-4). The same reasoning
is in the descriptor header comment. `webAllowHttpLoopback` (trusted,
mount-time, default FALSE) exists only so this test world's stub is
reachable over plain http — production never sets it; https-only is the
shipped default.

## What is governed

- `web_fetch`: closed args `{url}`; scheme allowlist default `https` only;
  opaque origins and userinfo rejected pre-PA; ONE `connect` effect at the
  URL origin — the approved identity is per-origin, **path drift inside a
  grant is disclosed** in the descriptor; bounded redirects (≤5) that must
  resolve inside the approved destination (off-origin = typed refusal,
  victim host provably untouched); bounded bytes (refused whole); typed
  timeout (wall clock, works pre-wire); one-shot execution tokens
  (settled replay = cancelled, zero consume).
- `web_search`: pluggable provider **port** (closed shape, destinations
  declared at mount); **no provider ships with the product** — with no
  provider the row answers typed `WEB_SEARCH_NO_PROVIDER` with zero PA and
  zero wire, and the capability matrix keeps the provider cell NOT_VERIFIED
  (we never invent a provider). Invalid provider candidates refuse the
  mount (`PLANE_WEB_PROVIDER_REFUSED`), never degrade.
- Rule grammar names no network tool ⇒ a governed connect effect can NEVER
  be blanket-allowed: default-deny templates refuse typed pre-wire; ask
  templates reach the durable Control approval (proven live in C2).

## Review round 1 (independent review, `REVIEW-403`) — three HIGH findings fixed, RED-first

The external review (branch `task/u7-wave1-review-b-20261027` @ `b641cf65e`,
PASS-WITH-FINDINGS, findings treated as blocking) was right on all three
counts; each fix went in test-first (RED logs in the evidence dir):

- **H-1 — non-public-destination law.** The old gate only restricted
  LOOPBACK for the plain-http opt; `https://` admitted ANY address
  (RFC1918, CGNAT, link-local incl. `169.254.169.254`, ULA, IPv4-mapped /
  v4-compatible / NAT64 `64:ff9b::/96` spellings, `0.0.0.0`, decimal/octal/
  hex IPv4). Now a second law runs on the ADDRESS, for EVERY scheme,
  BEFORE connect, on the RESOLVED bytes and on the literal spelling:
  `WEB_DESTINATION_NON_PUBLIC`, zero wire. A trusted mount opt re-admits
  LOOPBACK ONLY — private ranges are never re-admittable — and the
  plain-http leg dials loopback ADDRESSES only (a `localhost` that
  re-resolves away from loopback is refused, not dialled). A provider
  MOUNT declaring a literal non-public destination refuses the mount.
- **H-2+M-1 — DNS rebinding (TOCTOU).** The check used to look at the URL
  hostname while the connect re-resolved later. Now: resolve EXACTLY ONCE
  per hop → check EVERY answer (one private answer poisons the whole set)
  → CONNECT TO THE PINNED ADDRESS via an injected `lookup`, so
  re-resolution between check and connect is structurally impossible.
  TLS still validates the ORIGINAL hostname (servername from the request
  host). Every redirect hop resolves, checks, and pins AGAIN. Arms: mixed
  public+private answer → refused zero-wire; hostile second answer never
  consulted (`resolver.calls === 1`); per-hop re-pin (`calls === 2`).
- **H-3 — provider endpoint.** The search port no longer accepts
  arbitrary URLs from provider code: it POSTs ONLY to origins the trusted
  mount declared for that provider — the same frozen set the contribution
  declares and the PA requested set carries (declared == requested, now
  enforced at the socket). Empty declared set reaches nothing. Code
  `WEB_SEARCH_DESTINATION_DENIED`, victim server provably never contacted.
- **Consent scope.** Grants are PER-ORIGIN, so the text now says so: both
  row descriptions state an approval permits ANY path on the origin, and
  the ledger control-detail renders a derived consent-scope line per
  `connect` effect (`deriveControlScopeNotes`, client-side over the
  reviewPayload — the protected bridge summary is untouched, which keeps
  the center budget at ZERO; the origin was always inside the payload).

Mutation controls with RED logs: removing the endpoint pin → S-11 RED;
disabling the destination law → D-1/D-1b/D-3 RED; both byte-reverted.
Environment disclosure (measured): this test host's sandbox answers dead
non-`:80` loopback dials with a proxy-layer 502 and drops TEST-NET dials;
the rebinding arms therefore pin the LAW shape via resolver call counts
and stub request counters — the zero-wire proofs never lean on the
interceptor. C2 live evidence PREDATES the law fixes (boot budget 3/3
consumed); its stub-provider shapes (declared loopback destination over
the port) are exactly what the new S-10 arm proves remains allowed — no
C2 behavior this round contradicts the laws, and C1 carries their offline
proof.

## Proof table (per arm, honest)

C1 (offline, real plane+kernel assembly, MOCK-band stub only) — 30/30 (19 round-1 arms + 11 review-round arms D-1…D-7, S-10…S-12):
**PROVEN**: positive + declared==requested fingerprint pin; zero-flip
absent/false; mount-refusal on bad config; default-deny pre-wire zero-wire;
deny-leg zero-wire; scheme/userinfo/closed-args pre-wire zero-stub-contact;
over-cap refused whole; redirect-loop hop bound; off-origin redirect —
victim server never contacted; typed timeout; one-shot replay cancelled
zero-consume; native shape parity; search no-provider pre-everything;
provider positive + deny zero-wire; invalid-provider mount refusal; leak
law on every leg (header secret never surfaces).
Note stated honestly: post-wire arms (over-cap / loop / timeout) prove
zero-DELIVERY and the page endpoint unchanged from baseline; pre-wire arms
prove zero stub contact at all.

Mutation control: planted off-redirect-OK bug → W-11 RED (victim reached);
byte-reverted → 19/19 GREEN. (`mutation-control-RED.log`)

C2 (live pinned Host 0.2.0-rc.2 @ 639ed01539, 3 boots declared, 3 used,
final round **overall=PASS 7/7**):
**PROVEN**: family mounts on the real host with ZERO center diff
(`placement-feed rows=[… web_fetch,web_search]`); governed member
(default:ask template — the ONLY lane the grammar allows for connect)
reaches durable Control asks; approvals settle through the PUBLIC
`team.resolveControl` v4 seam (Human resolver = boot-root operator; the
leader carries NO control tools, so decisions provably come from the
human seam); ALLOW → grant consumed → **real node:http transport**
(`governed-web-fetch RAN seq=1 status=200 bytes=62 hops=0`, stub ledger
claimHits=1) and the body reads back through the model transcript; DENY →
typed `pa-refused code=APPROVAL_DENIED` with the stub proving **zero
wire**; web_search live → typed `WEB_SEARCH_NO_PROVIDER`, zero wire;
teardown leak-check green. **DISCLOSED** (run1, measured, never flipped):
ask-row creation is a `request-control` mutation — without the envelope
entry both fetches answered `APPROVAL_DENIED` with no row (u7-4a
precedent law, learned live, fixed in blueprints). Sandbox-axis
confinement: NOT-CLAIMABLE per DECISION-3 above (DISCLOSED, not FAIL:
this lane ships no sandbox claim).

## Boot budget

Declared `--max-host-starts 3`; **consumed 3 of 3** — run1 (measured-law
round), run2 (mid round: ask rows confirmed durable, first approver face
found nothing live → fetches `cancelled-at-pa-edge` with zero wire, honest
FAIL/ENV_BLOCK, never flipped), run3 final (7/7 PASS). Ledger
`dev/agent-workflow/evidence/u7-f-web-20261026/c2-budget.jsonl` + each
run-summary. `:3080` / `~/.dsh` untouched; all stubs on the MOCK band.

## Zero-plane-edit changed-file list

New: `packages/tools/web-family/src/*.mjs` (9), `packages/tools/families/web.mjs`,
`scripts/dist-placements/080-web.json`, `packages/runtime/test/u7f-web-c1.test.ts`,
`packages/testkit/test/p4t6-bookings/u7fweb.json`,
`scripts/eslint-node-globals/030-web-family-node-modules.json` (the u7-w0
collection law: a node-side lane ships exactly one JSON here;
`eslint.config.mjs` NOT edited), C2 drop-ins
(`tests/world-factory/{world-kinds/080-u7-f-web.mjs,suites/070-u7-f-web.mjs,lib/u7f-web-assembly.mjs,canary/u7fweb-ctl-probe-host.mjs}`),
evidence `dev/agent-workflow/evidence/u7-f-web-20261026/**`.
Edited (all non-center): `packages/tools/families/manifest.json` (+web
module sha256, +kernel capability `network-egress:{backsExecution:
'family-body'}` — the reviewed manifest IS the kernel-capability
declaration), `packages/tools/families/index.mjs` (regenerated),
dist mirror (place-dist-glue), `arc-a-family-census.json` (+13 lines,
family booking), `u7-w0b-family-seam.test.ts` (reviewed-count pin 3→4 —
a visibility pin, joined exactly as the search join moved 2→3),
`registries.test.mjs` (collected-set pins updated per join — the drop-in
law covers runtime dispatch lists, which are NOT touched; these two test
enumerations are fail-closed visibility pins whose whole purpose is to
light up when the reviewed set changes), evidence logs.

## Gates

Branch carries `origin/master @ 9e542c0f3` (post-review merge of #402
pwsh, #406 agent-control, #408 evidence-guard; shared bookings resolved as
unions — manifest 5 families via `gen-family-index` regeneration, census
ledger, LANE_EDGES, PR1_CONSUMERS, registries — and the seam test now
uses master's DERIVED family-count form; the lane's dist-placement file
moved `070-web.json` -> `080-web.json` for the glue's total-order law;
review-round 1 checks on the merged tree: eb3-ci-required 9/0, negative
controls 21/21, evidence-guard added=20 findings=0, C1 30/30,
client 35/35). Branch previously carried `origin/master @ 0ea67bee8` (normal merge, zero conflicts;
`gen-family-index` regenerated — still 4 reviewed families — and
`--check` green). `ci-pr-gate --full --census` (per-worktree pristine
test-use provisioned per TEST_METHODS §2 — the shared baseline dir in this
environment carries no source tree, disclosed in the evidence README),
`pnpm typecheck`, lint-identities (new 0 — via the node-globals file
above), check:artifacts:head, `diag-call-chain --self-test` (49 codes —
this family's manifest refusalCodes resolve at their cited sites),
eb3-ci-required pass (workflows=9 findings=0), docs:sync --check /
docs:probe blocking=0, p4t6 20/20, arc-A fitness 12/12, family-seam 9/9,
world-factory offline 50/50, registries 12/12 — full captures under
`dev/agent-workflow/evidence/u7-f-web-20261026/`. Local census honesty:
round 1 named two REAL reds of this lane (a5p0 consumer audit — booked
file-by-file; hosted ci-integration round 1 then named the unbooked
family-boundaries lane — booked via the law-home README + `LANE_EDGES`),
and a local-only client-build provisioning gap root-caused honestly;
final local round: **8/8 PASS incl. the nine-root census**. Hosted
(authoritative): ci-required **pass layers=5 green=5 nongreen=none**
(census-runtime, pr-gate, candidate-protection all success) — run ids in
the evidence README.

## Law choices disclosed (deliberate, not gaps)

- **Zero-flip law**: `disabledOwned: () => []` — turning `webEnabled`
  false never *disables* anything; the family simply never mounts, so the
  disabled-set stays byte-identical to every pre-web plane (arms W-2/W-3
  prove the byte equality). This follows the jobs-lane precedent.
- **Fixed native claims**: the names `web_fetch`/`web_search` are claimed
  by the family descriptor and therefore bypass Gate 0b (name-collision
  with natives) — pinned instead by the manifest sha256 + the arc-A
  census entry. Path drift INSIDE an approved origin grant is the same
  class of disclosure: approved identity is per-ORIGIN.
- **Provenance of approvals in C2**: the leader blueprint carries NO
  control tools, so the allow/deny decisions provably came from the
  public `team.resolveControl` v4 seam (Human resolver), not the model.
