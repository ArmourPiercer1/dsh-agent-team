# a5sf-web-devlive — the Web face's dev-live loop

**Status: `DEV-LIVE` evidence. The seam delivers the confined `web` face live,
and the deny lane refuses at that face. NOT network confinement, NOT isolation,
NOT a candidate claim, NOT a matrix grade, NOT `V@B=yes`.**
All evidence below is `recordClass: "DEV-LIVE"`; the run-record validator
returns `DEV_LIVE_EVIDENCE_NOT_CANDIDATE` on every run (recorded, not asserted
by this text).

Two consecutive runs of the final driver agree on every verdict and every
decisive observation (`run-06`, `run-07`; `two-run-agreement.json`). Seven real
Hosts were started in the loop (data, not a budget): six runs produced a
verdict on both cases, four of those are PASS, and the last two (06/07) are
consecutive and agreeing.

---

## 1. What was asked

Does the product seam deliver a governed realm to a **legacy (non-strict)**
Member whose preset surfaces `web_fetch`/`web_search`, with those two
model-visible tools coming from the **confined** face — and does the deny lane
refuse **at that face**, with one typed `NETWORK_UNCONFINED_REALM` guard fact,
zero provider entries, and a refusal that names the capability, when the
**model itself** calls the tool?

This is a **wiring** question. It is **not** a confinement or isolation
question, and neither is answered here (§8).

## 2. The driver fix: the health gate polls (PD-11)

Boot #5's recorded failure (`TeamDomain is closed`) was an instrument defect,
not a product lifecycle defect: the driver probed `/__p6t6/health` **once**,
read the legitimately **pending** boot as a fatal 404, and aborted; the world
teardown then disposed the shared storage domain, and the still-running
bootstrap reported that disposal as `TeamDomain is closed`
(`evidence/a5sf-domain-attrib/`, the host-free attribution lane on branch
`task/a5sf-domain-attrib-20261109`; PD-11's register row lives there). A settled failure is different by
construction: the p6t6 row registers the same route and answers
`200 {ok:false, setupError}`.

`run-boot.mjs` now:

- **polls** `/__p6t6/health` up to the declared `BOOT_TIMEOUT_MS = 240_000`,
  every 500 ms;
- treats **404 (or any non-200 / transport error) as PENDING** and keeps
  polling;
- returns immediately on `200 {ok:true}` (ready) and aborts only on
  `200 {ok:false}` (settled failure) or the timeout;
- records **every probe** — timestamp, elapsed, status, full body — in
  `health.json`, so the gate's whole reading is auditable, not just its last
  one.

**PD-11's masking is fixed in practice, and this is directly observed:** in
every one of the seven runs the first probe answered **404** and a later probe
answered **200 `{ok:true}`**. The two stable runs:

| run | probe 1 | probe 2 | gate |
|---|---|---|---|
| `run-06` | `404` at 3 ms | `200 {ok:true}` at 506 ms | ready |
| `run-07` | `404` at 2 ms | `200 {ok:true}` at 506 ms | ready |

That is the same pending window boot #5 aborted in. Under the old gate these
runs would have failed at the first probe; under the polling gate the boot
reaches `ready=true`, creates the team, and runs both cases.

## 3. Result 1 — the seam delivers **live**

**Verdict: PROVEN (wiring).** The single observation that decides it:

> On each Member's **own model request**, the Host's recorded `tools` array
> contains `web_fetch` **and** `web_search`; the model's own tool call for that
> Member then produces exactly one guard fact whose `realm` is `member`, whose
> `memberIdentity` is that Member's instance id, and whose `decidedBy` is
> `NETWORK_UNCONFINED_REALM` — i.e. the model-visible pair is served by the
> confined face, and the call is admitted/refused by that face's guard, not by
> the inherited host web service (`hostWebEntries: 0`).

Supporting facts, both stable runs:

| fact | `run-06` | `run-07` |
|---|---|---|
| Member template (fetch / search) | `webworker-fetch` / `webworker-search` | same |
| legacy / non-strict (no `capabilities` block) | yes | yes |
| Member surface carries `web_fetch`+`web_search` | yes / yes | yes / yes |
| initiation | the **model's** tool call (not a driver route) | same |
| `realm` of the guard fact | `member` | `member` |
| `memberIdentity` | the delegating Member's `instanceId` | same |

The realm mounts only for a Member (`agent-bindings.mjs:2598`), the caller is
legacy/non-strict (`permissionPolicy` absent ⇒ A2C-2 does not run,
`agent-bindings.mjs:2472`), and the preset surfaces the pair from the pinned
`@deepseek-ai/dsh-tool-web` module. All three facts are recorded, not assumed:
the preflight `driver.caller-surface` check cites the lines.

**What this does NOT show:** that the governed realm is the *only* path (a
direct `/__p6t6/tool` call is not used and is not the model's path), nor that
the floating Member identity is cryptographically bound (see §7, PD-1).

## 4. Result 2 — the deny lane refuses **at the face**

**Verdict: PROVEN (admission refusal).** Per case, both stable runs:

| measurement | `web-deny-fetch` | `web-deny-search` |
|---|---|---|
| guard facts | **1** | **1** |
| `decision` | `deny` | `deny` |
| `decidedBy` (typed code) | `NETWORK_UNCONFINED_REALM` | `NETWORK_UNCONFINED_REALM` |
| `method` | `web:fetch` | `web:search` |
| locator | `https://example.test/legal/page` | `<search:malformed-request>` (see §7) |
| provider entries `fetch` / `search` / `transport` / `dns` / `connect` | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 |
| capability probes (separate leg) | 1 | 1 |
| inherited host-web entries | 0 | 0 |
| refusal text names the capability | yes | yes |
| refusal text is the Member turn's own `tool_result` | yes | yes |

The refusal text the model received, verbatim (both cases, both runs):

```
Error: the effective lane requests network=deny, but the web provider's capability probe reports network-destination='unsupported' (a5sf-bl18 composition boundary: network-destination=unsupported (this host's providers report no enforced network capability)); refusing before any provider call instead of fetching under a deny claim this host cannot enforce. A backend that proves 'enforced' is the only configuration that admits this call
```

The typed code is the guard fact's `decidedBy`; the human message names the
**capability** (`network=deny`, the probe's `network-destination`) as the case
class requires (`refusalNaming: "capability"`). The driver records separately
whether the text also repeats the literal code (`observations.
refusalNamesTypedCode: false`) and does not grade on it.

The **provider-entry count is zero** because the fake boundary's
`fetch`/`search` methods were never entered (`leg: "provider-entry"` rows: 0).
The guard's capability question to the backend is recorded, honestly, as a
**separate leg** (`leg: "capability-probe"`, one row per case); it enters no
fetch/search/transport/dns/connect channel. Run-02 counted that probe as an
entry — that was a measurement defect in the inherited driver, fixed and
disclosed in `RUNS.md`.

## 5. Result 3 — the marker-routed mock, live

**Verdict: PROVEN (routing held).** The markers the Host actually sent, in
order, for the two stable runs (effective kind / disposition):

```
run-06: title/harmless, discovery/harmless, create/harmless, title/harmless,
        fetch/tool-call, title/harmless, fetch/exhausted, create/exhausted,
        search/tool-call, title/harmless, search/exhausted, create/exhausted
run-07: title/harmless, discovery/harmless, create/harmless,
        fetch/tool-call, title/harmless, fetch/exhausted, create/exhausted,
        search/tool-call, title/harmless, search/exhausted, create/exhausted
```

- `MK_BL18_DISC` (discovery) was sent once, before `team.create` (create
  marker) in every run.
- `MK_BL18_FETCH` was sent by the fetch Member and served **exactly once**
  with a `web_fetch` tool call; the follow-up turn got `exhausted` (no second
  call).
- `MK_BL18_SEARCH` was sent by the search Member and served **exactly once**
  with a `web_search` tool call.
- No marker landed on the wrong lane. `routingHeld` is true in
  `marker-routing.json` in both runs.

**Ordering surprise (recorded, §7):** the Host's **title-generation** request
may arrive immediately *before* or immediately *after* the agent turn, and it
carries the conversation history (including the delegation marker). Run-06 has
`title` before the fetch `tool-call`; run-07 has the fetch `tool-call` first,
then `title`. The routing is invariant because a title turn may never consume
an item script; the *wire order* is not deterministic. This is why the mock is
marker-keyed, not ordinal.

## 6. Result 4 — surprises (surface, caller, ordering)

1. **Title turns carry the item marker.** A title/compaction request whose
   text contains the delegation prompt must not be re-keyed by its last user
   message. Run-02 lost the whole fetch item this way; the fix is in the driver
   (`title`/`discovery` precedence).
2. **`web_search` locator is `<search:malformed-request>`.** The pinned host
   tool calls `ctx.web.search({ query, maxResults })` (singular `query`), while
   the confined face's `declaredUrlOf` reads `request.queries` (plural, the
   tool's *public* schema). The guard therefore falls back to its stable
   malformed marker. The decision and typed code are unaffected; only the
   locator quality is. This is a product-side locator gap for this wire shape,
   recorded, **not patched** (`CORE PATCH BUDGET = 0`).
3. **`toolBindingIdentity` is `null`** on both guard facts even though the
   offer row names `team/web` as the binding. The fact carries `realm: member`
   and the Member instance; the binding id does not reach the observer at this
   base. Recorded as a wiring observation; the cases do not require it.
4. **Two templates are required for two cases.** A second `team_delegate` on
   the same template returns `work-admitted` on the **same settled instance**
   (run-01: `member webdev-search never became live`). The blueprint now
   declares `webworker-fetch` and `webworker-search`; each case owns its
   Member. Both remain legacy/non-strict.
5. **The Instance id can repeat across boots** (`inst-0khuuyv12140` in runs
   01–07). It is derived deterministically from the blueprint/generation, not
   random. A reviewer must not treat the id alone as a cross-run differentiator;
   the run id, port and home do that.
6. **The discovery surface is the same 22 names** in every run, and the
   discovery-first deny list is `["u5_canary","u6fs_probe"]` every time.

## 7. The limit, stated verbatim

From `dev/agent-workflow/evidence/a5sf-subprocess-face/README.md` §7:

> Refusing to spawn is **not** evidence of network isolation: it is a statement
> about our own admission code, made before the OS was asked.

For a web call the same limit holds word for word: the refusal above is a
decision of our own admission code, made **before any transport is entered**.
The provider is a **fake boundary** — it implements no socket, no DNS, no
proxy; it records an entry and refuses, and its `probe()` answers
`network-destination: "unsupported"`, which is what this host's real
providers answer. Zero provider entries is a **counter**, not an OS fact. The
OS was never asked.

Every driver-written JSON carries `osLevelNetworkIsolationClaimed: false`
(per-case item, health, ledger, verdict, teardown, guard-facts, counter-rows,
surface, marker-routing, mock-requests, pre-boot, the raw-response envelopes,
and the run record). **Nothing here claims network confinement or isolation,
and nothing here may be cited for either.**

Also not proven, and not addressed by this loop:

- **not a candidate claim / not `V@B=yes`** — every run is
  `recordClass: "DEV-LIVE"` and the validator returns
  `DEV_LIVE_EVIDENCE_NOT_CANDIDATE`;
- **not a matrix grade** — no pointer is added to `TOOL-ACCEPTANCE-MATRIX.md`;
- **not the real provider** — the transport is a fixture boundary; a real
  `web_fetch` on the pinned host would attempt egress and is not this face's
  path;
- **not isolation of the test World** — the World has its own `DSH_HOME`,
  workspace, logs and port, but `:3080` and the host checkout were only left
  untouched, not proven unreachable;
- **not the floating-member binding** — PD-1's generation-scoped revocation is
  a separate lane and is not exercised here.

## 8. What would prove confinement (and what this evidence cannot)

A network-confinement claim would need all of the following **observable
facts**, on the tree being claimed, and none of them is produced here:

1. a backend whose own `probe()` answers an explicit **`enforced`** level (not
   `unsupported`), so the guard's only admissible configuration is exercised;
2. a denied call attempted with a **real transport** present, showing the OS
   (not our admission code) refused the egress — e.g. an observed kernel/network
   error or a packet-capture showing no connection;
3. the same result for `fetch` **and** `search`, and for a direct call that
   bypasses the model surface, to exclude "the tool was never wired";
4. the World's own network namespace/firewall rule recorded as an artefact,
   with the stable instance and the host untouched.

Until then the honest statement is: **the wiring is live and the admission
refusal is typed and pre-provider; the OS was never asked.**

## 9. Reproduction (an independent reviewer can re-run this)

**Driver version:** `dev/agent-workflow/evidence/a5sf-web-devlive/run-boot.mjs`
at commit **`77ece3d16ba7`** (the head recorded in `run-06`/`run-07`). The two
stable runs executed that exact commit; the per-run `archive/` holds the
pre-boot copies and their SHA-256s.

**World:** line `a5sfwebdv` (WorldFactory `<line>-<UTC>` under
`tests/homes/`), own workspace, own logs, deleted at teardown.

**Ports:** `3184`, `3185`, `3186`, `3183` across the runs (3180 family). The
stable instance `:3080` was never contacted or touched.

| step | command |
|---|---|
| plan (0 starts) | `node dev/agent-workflow/evidence/a5sf-web-devlive/run-boot.mjs --plan` |
| preflight (0 starts) | `node scripts/a5sf-preflight.mjs --bundle dev/agent-workflow/evidence/a5sf-web-devlive/preflight-bundle.json --repo . --host-root <main-checkout>/tests/deepseek-harness-test-use` |
| one start | `node dev/agent-workflow/evidence/a5sf-web-devlive/run-boot.mjs --evidence dev/agent-workflow/evidence/a5sf-web-devlive/run-NN` |

The boot refuses before any ledger row unless (a) the preflight log carries an
unqualified `PASS 18/18`, (b) the bundle's `candidate.head` equals `HEAD`,
(c) the Authority pointer hash matches, (d) the grant is `scope: "DEV-LIVE"`
and matches the bundle, and (e) the run directory's ledger is fresh. It then
writes, in order: the `budget-intent` row, the harness start row **before the
spawn**, and a `dev-live-outcome` row after teardown.

**Cases:** `web-deny-fetch`, `web-deny-search`, both
`caseClass: "admission-refusal"` (the classes/labels of #626/#627), both
declared in the driver's own `CASES` literal and graded by the same preflight
`bundle.case-coverage` / `driver.caller-surface` checks.

**Raw verdicts:** `run-06/verdict.json` and `run-07/verdict.json` —
`overall: "PASS"`, `cases: [{web-deny-fetch: PASS}, {web-deny-search: PASS}]`,
`candidateClaimEligibility.code: "DEV_LIVE_EVIDENCE_NOT_CANDIDATE"`.

**Teardown:** `run-06/teardown.json` / `run-07/teardown.json` — port closed,
`homeRemoved: true`, no process left, no slot left
(`.artifacts/tmp/port-leases/dev-live-hosts/` empty after the loop).

**Ledger:** one `budget-intent`, one start row and one `dev-live-outcome` per
run in `run-NN/run-ledger.jsonl`; `run-NN/ledger.json` shows
`boots: 1`, `intents: 1`, `devLiveOutcomeRecorded: true`.

## 10. Gates

- `node --check run-boot.mjs` → exit 0 (each driver revision).
- `node scripts/a5sf-preflight.mjs …` → `PASS 18/18`, exit 0, immediately
  before runs 01–07 (the archived `archive/pre-boot-preflight.log` is the
  payload that authorised each start).
- `node run-boot.mjs --plan` → `PLAN OK — zero Host starts spent` before each
  start; the plan parses both blueprints through the host's own
  `parseBlueprint`.
- `git diff --check`, `scripts/doc-checks.mjs` on the evidence commit.
- No `packages/**` change, no `.github/**` change, no Authority-pointer move,
  no product patch (`CORE PATCH BUDGET = 0`).

## 11. Index

| Path | Contents |
|---|---|
| `run-boot.mjs` | the fixed driver (polling health gate, DEV-LIVE lease, per-run evidence dir) |
| `dev-live-grant.json` | the reusable `scope: "DEV-LIVE"` authorisation for face `Web`, world `a5sfwebdv` |
| `a5sf-web-offer-row.mjs` | the `teamA5sfRealm` provider row (compiled ceiling + fake boundary + tripwire) |
| `README.md`, `RUNS.md` | this report and the run-by-run log |
| `two-run-agreement.json` | machine-readable agreement of `run-06`/`run-07` |
| `run-01/` … `run-07/` | per-run raw artefacts, `boot.log`, `logs/`, `archive/`, `ledger.json` |
| `preflight-bundle.json`, `preflight.log`, `plan.log`, `plan-patch.yml`, `plan-rows.json` | the latest zero-boot plan (the per-run archive holds the copy that authorised that run) |

Evidence hygiene: the World's one-time `http://127.0.0.1:<port>/?token=…` line
in each `instance-port*.log` is redacted to `?token=<redacted>`. That token
belonged to a World home deleted at teardown; no other byte of a raw log was
changed. Mock request captures carry `authorization: null` (the mock records
the header as the harness supplied it, and no credential is present).
