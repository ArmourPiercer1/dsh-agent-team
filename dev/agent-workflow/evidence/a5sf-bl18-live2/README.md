# a5sf-bl18-live2 — BL-18 live deny-lane **wiring** datum (P2-04 boot 5 of 5)

**Status: the one remaining start was spent. The Host booted, its own team
bootstrap failed before any test surface existed, and no deny-lane case ran.
The live wiring result is UNPROVEN. There is no retry. Budget: `5 of 5 spent,
0 remain`.**

Read with `dev/agent-workflow/evidence/a5sf-bl18-live/README.md` (host-free
assembly proof) and `dev/agent-workflow/evidence/a5sf-refusal/README.md` (the
fourth case class and the preflight hole that #626 closes).

---

## 1. What was asked

Does the product seam deliver a governed realm to a **legacy (non-strict)
Member** whose preset surfaces `web_fetch`/`web_search`, and does the deny lane
refuse **at that face** — one typed guard fact, **zero** provider entries —
when the **model itself** calls the tool?

This is a **wiring** question. It is **not** a confinement or isolation
question, and this run answers neither.

## 2. Preflight, before the start

- Bundle: `preflight-bundle.json`, bound to `candidate.head` **`3c0f6292d`**
  (the driver commit), authority pointer
  `sha256sum dev/engineering/current-authority.json` =
  `31ac81fb4c4818b4eb09a61723b7c15a963114272bb9095b18b8e21e5fbc7f0a`.
- Command: `node scripts/a5sf-preflight.mjs --bundle … --repo . --host-root
  /home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-test-use`
- Verdict: **PASS 18/18**, exit 0 — full payload in `preflight.log`
  (`"summary":"PASS 18/18 checks"`, no `UNKNOWN`).
- Host-free composition was exercised first (`plan.log`, `plan-patch.yml`,
  `plan-rows.json`): the five rows handed over in order, the patch emitted, and
  **both** blueprints parsed by the host's own `parseBlueprint` from the
  World's own `blueprintDir`. Zero starts spent by the plan.

The preflight PASS is necessary and was satisfied; it is not sufficient. It does
not certify that a Host, once booted, reaches an agent.

## 3. The one start, and what it cost

- Grant `grant-a5sf-bl18-live2-3c0f6292d9b7`: `plannedStarts: 1`,
  `maxStarts: 2` (1 intent row + 1 boot row), `boundCommit` = HEAD
  `3c0f6292d9b73eb75b33048f5851ff7168e20c04`.
- `archive/` holds the pre-start bundle/log/grant/driver copies and their
  hashes (`pre-boot-manifest.json`), written before the start.
- Ledger (`ledger.json`, `run-ledger.jsonl`): 2 rows — the BL-14 intent row and
  the boot row — `boots: 1`, `plannedStarts: 1`, `aborts: 0`, arithmetic
  `boots === plannedStarts - aborts` **holds**.
- The Host **did** start: port **3184** (3180 family; `:3080` untouched),
  `authenticate` returned a session cookie over HTTP 200, `/team-remote`
  mounted, world home under `tests/homes/`.
- The start then **aborted at `health-gate`**: `GET /__p6t6/health` → **404**
  (`health.json`). Teardown recorded in `teardown.json`: host pid killed, port
  3184 closed, mock port 3494 released, world home deleted.
- **This was not a case failure and not a refusal.** No agent turn, no model
  request, no tool call, no guard consult ever happened.

### Why the health route never existed

The Host's own log
(`logs/u5a5sfbl18l2-20261106T05-07-32Z/instance-port3184.log`) records:

```
[dsh-agent-team] remote mount: MOUNTED channel=/team-remote
[dsh-agent-team] bootstrap FAILED: TeamDomainError: store 'session_bindings' operation 'get' was rejected: the TeamDomain is closed
    at normalizeSeamError (…/storage/schema/errors.js:148)
    at SessionBindingsRepository.readRow (…/storage/repositories/base.js:76)
    at … putSessionBinding (…/root-binding/write-port.js:33)
    at bindFreshTeamRoot (…/root-binding/fresh-root.js:137)
    at async createAndStartTeam (…/runtime/src/plugin/root.js:1943)
    at async Object.boot (…/runtime/src/plugin/root.js:3210)
    at async bootstrap (…/runtime/src/plugin/host.js:2325)
```

The production row's **boot-phase fresh-team creation** failed while writing the
team-root session-binding row, because the `TeamDomain` it was handed was
already **closed**. The p6t6 observer's setup awaited the same bootstrap and
persisted the same error to `logs/…/setup-failure.json`; its routes were
therefore never registered, and the driver's health gate — the first gate that
requires a live test surface — failed closed at 404.

The composed profile itself is in
`logs/…/composed-profile-5d72802a….patch.yml` and contains exactly the five
declared rows in declared order (offer row, production row, p6t6, leader
preset, member preset). Nothing in the driver retried, and nothing was
restarted.

**What this start proves:** the bundle, grant, intent row, archive, world
composition, row handoff and Host process bring-up all work; the Host serves
HTTP and accepts auth.

**What it does not prove:** why the production row's boot-phase domain was
closed. One start cannot distinguish a row-composition trigger from a
boot-phase product defect. It is recorded as the concrete blocking observation,
not diagnosed further.

## 4. The four results

| # | Result | Verdict | Concrete observation |
|---|---|---|---|
| 1 | Seam delivers live: legacy Member gets a governed realm whose `web` face is the confined one; model-visible `web_fetch`/`web_search` come from that face | **NOT PROVEN** | No Member was ever created and no model request was ever issued (`marker-routing.json` has zero requests; `surface.json` has no discovery). Nothing can be said about the delivered face or which tools the model saw. |
| 2 | Deny lane refuses at the face, live: exactly one guard fact, typed `NETWORK_UNCONFINED_REALM`, zero provider entries, refusal text names the capability | **NOT PROVEN** | `guard-facts.json`: zero facts (the sink was never created). `counter-rows.json`: zero provider rows and zero host-web rows — but this is **absence of an attempt**, not a measured refusal, so it has no evidential value about the deny lane. No refusal text exists to read. |
| 3 | Marker-routed mock works live: which markers Host sent, in order; whether routing held | **NOT PROVEN** | `marker-routing.json`: the mock recorded **zero** model requests. No marker was sent, so ordering and routing are unobservable. (The host-free plan did verify the marker table and the two-item routing design.) |
| 4 | Any surprise about surface/caller | **NONE OBSERVABLE** | The run stopped before the surface/caller stage; no surprise could be observed, and none is invented. |

Per-item artefacts: `item-web-deny-fetch.json`, `item-web-deny-search.json`
(each `verdict: NOT_PROVEN`, `claimsConfinement: false`,
`osLevelNetworkIsolationClaimed: false`).

## 5. The limit, stated verbatim

> Refusing to spawn is **not** evidence of network isolation: it is a statement
> about our own admission code, made before the OS was asked.

For a web call the same limit holds word for word: a refusal at the confined
`web` face would be a decision of our own admission code, made **before** any
transport is entered. In this run there was not even that decision — no call was
attempted.

Every artefact in this directory carries `osLevelNetworkIsolationClaimed:
false`. **Nothing here claims network confinement or isolation, and nothing
here may be cited for either.** The zero counter values are the absence of an
attempt, not a demonstrated refusal.

## 6. What a further start would need — and why it will not happen

There is **no further start**. P2-04's five-boot allocation is exhausted
(`5 of 5 spent, 0 remain`); the operator's allocation for this lane explicitly
says there is no retry, no sixth start and no reserve. This section is a record
of what would have been required, not a plan of action.

A further start, if one existed, would need to isolate the boot-phase failure
before re-testing the wiring:

1. Reproduce the boot **host-free** with the same five rows and no driver at
   all, to determine whether `TeamDomain is closed` is triggered by our row
   composition (e.g. the offer row's `ctx.provide('teamA5sfRealm')` or the two
   preset rows interacting with the production row's `bootPhase: 'create'`) or
   by the product's own `createAndStartTeam` path.
2. If composition-triggered, separate the anchor create from the member realm:
   boot with `bootPhase` deferred and create the anchor team through
   `/team-remote` once the Host is up, so the p6t6 health route exists first.
3. Only then re-check the four results, with the deny list computed from the
   leader's actual surface and the two Members delegated from a legacy
   template.
4. Re-run the shared preflight and bind a new grant to the new HEAD; the
   current grant is spent and must not be reused.

## 7. Artefact index

| File | Contents |
|---|---|
| `preflight.log` | PASS 18/18 payload from the shared preflight, before the start |
| `preflight-bundle.json` | the bundle the preflight graded (head `3c0f6292d`, pointer sha `31ac81fb…`) |
| `plan.log`, `plan-patch.yml`, `plan-rows.json` | host-free composition, patch, row handoff and blueprint parse |
| `grant.json` | the single-start grant (`maxStarts: 2`, bound to `3c0f6292d`) |
| `archive/` | archive-before-start copies + `pre-boot-manifest.json` (hashes) |
| `pre-boot.json` | world/paths/authority/grant at the moment before the boot |
| `run-record.json` | `overall: FAIL`, `partial: true`, `abortedAt: health-gate`, bindings incl. `authority.pointerSha256` |
| `ledger.json`, `run-ledger.jsonl` | intent row + boot row, `boots: 1`, arithmetic holds |
| `health.json` | the 404 that failed the gate |
| `logs/u5a5sfbl18l2-…/` | Host log, `setup-failure.json`, composed profile patch |
| `teardown.json` | host killed, ports released, home deleted |
| `boot.log` | the driver's own chronological log |
| `verdict.json` | overall FAIL, cases FAIL (fail-closed: no verdict produced) |
| `item-web-deny-fetch.json`, `item-web-deny-search.json` | per-item NOT_PROVEN records |
| `surface.json`, `marker-routing.json`, `guard-facts.json`, `counter-rows.json` | the empty observation sets, with the reason they are empty |
| `a5sf-bl18-web-offer-row.mjs`, `run-boot.mjs`, `make-bundles.mjs` | the driver and the composition row (committed at `3c0f6292d`) |

## 8. Matrix and grading

No pointer is added to `TOOL-ACCEPTANCE-MATRIX.md`. The M-14/M-15 rows stay at
their existing grade and `V@B`, unchanged. A live wiring result was **not**
obtained, so there is nothing to point at; adding a pointer here would grade an
absence.

## 9. The sentence for the final project report

> Live: the one remaining P2-04 boot (5 of 5) started a Host that came up and
> authenticated, but its team bootstrap failed with a typed
> `TeamDomainError: … the TeamDomain is closed` before the p6t6 surface
> existed, so no deny-lane case ran: the BL-18 live wiring remains unproven,
> no guard fact and no provider entry were observed, and no network-isolation
> or confinement claim is made.
