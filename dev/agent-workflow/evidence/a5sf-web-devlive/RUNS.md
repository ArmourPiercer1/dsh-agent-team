# RUNS — a5sf-web-devlive

Seven real Host starts in the isolated World line `a5sfwebdv` (ports in the
3180 family only; `:3080` untouched; every home deleted at teardown). All rows
are `recordClass: "DEV-LIVE"`. Starts are **data, not a budget**: there is no
cumulative cap, and the only machine-wide limit is the 2 concurrent dev-Host
slots (`DEV_LIVE_SLOT_LIMIT`), respected throughout.

| run | purpose | failure cause | fix before the next run | result | head | port |
|---|---|---|---|---|---|---|
| 01 | first dev-live start; does the polling gate open the same boot that boot #5 aborted? | both cases REFUTED with 0 facts: the inherited `makeDecide(request)` read the mock's `{seq, req}` envelope as the request body, so every turn fell to the harmless `fallback` branch and **no model tool call was issued**; the second item also reused the first Member instance, so `webdev-search never became live` | `decide({seq, req})` now reads `req`; decisions persisted per request; two legacy Member templates (`webworker-fetch`, `webworker-search`) so each case owns an instance | **FAIL** (aborted at `item2-search-deny`) — but the gate itself opened: probe 1 `404`, probe 2 `200 {ok:true}` at 506 ms | `634f8d595` | 3184 |
| 02 | does the mock contract fix reach the face? | fetch: the Host sent the fetch Member's **first** request as a **title-generation** turn carrying the delegation marker; the driver re-keyed it to `fetch`, spent the one scripted tool call on the title turn, and the real agent turn got `exhausted`. search: **one** typed guard fact was produced, but the driver counted the guard's `capability-probe` row as a **provider entry** and REFUTED the case | title/discovery turns may never be re-keyed by a marker; provider entries counted by `leg: "provider-entry"` only, probes recorded separately; refusal "naming the capability" tested on the capability rather than the literal code in the human text | **FAIL** (2/2 FAIL) — first live guard fact observed (`web:search`, `NETWORK_UNCONFINED_REALM`) | `a6b82ee80` | 3185 |
| 03 | does the ordering/measurement fix produce the full deny datum? | both cases reached the deny lane correctly (1 fact, typed, 0 provider entries, refusal names the capability), but the driver's own check list still required the human refusal text to repeat `NETWORK_UNCONFINED_REALM`; the shipped message does not (the code is the guard fact's `decidedBy`) | `refusalNamesTypedCode` moved from pass conditions to `observations` | **FAIL** (2/2 REFUTED on that one driver check) — every product-side check true | `f0cfd5ca3` | 3185 |
| 04 | first clean run of the fixed driver | — | — | **PASS** (2/2 PROVEN) | `2a250587a` | 3185 |
| 05 | second consecutive run of the same driver | — | — | **PASS** (2/2 PROVEN), agrees with 04 on every case fact | `2a250587a` | 3185 |
| 06 | stable pair #1 with the final driver (every artefact stamped `osLevelNetworkIsolationClaimed:false`) | — | — | **PASS** (2/2 PROVEN) | `77ece3d16` | 3186 |
| 07 | stable pair #2, same driver | — | — | **PASS** (2/2 PROVEN), agrees with 06 on every verdict and decisive fact (`two-run-agreement.json`) | `77ece3d16` | 3183 |

## How many produced a verdict

- 7 starts; **7 Hosts booted, authenticated, created the team and were torn
  down** (port closed, home removed, no slot left).
- **6** produced a verdict on both cases (runs 02–07); **4** of those are PASS
  (runs 04–07); **2** PASS runs are consecutive and agreeing (06/07, the final
  driver).
- **3** were instrument-defect runs (01, 02, 03); each produced a *new
  diagnostic fact*, so none was a blind retry of the same cause. No cause was
  repeated 3 times; the retry/escalation rule was never triggered.
- Every start has its own ledger: `budget-intent` + harness start row +
  `dev-live-outcome` (`run-NN/run-ledger.jsonl`, `run-NN/ledger.json`).

## What each run proves, precisely

| run | what it proves | what it does not |
|---|---|---|
| 01 | the polling gate opens a boot #5-shaped pending window and records both readings | nothing about the face: no model tool call was issued |
| 02 | the fetch marker reaches the Host as a tool-call turn; the search Member's own call reaches the confined face and produces a typed `NETWORK_UNCONFINED_REALM` fact | that the fetch case is wired (its shot was lost to a title turn) |
| 03 | both cases reach the face and the refusal names the capability | a PASS (a driver-only check failed) |
| 04/05 | the seam delivers the confined web pair live and the deny lane refuses at the face, twice | anything about the OS, confinement or isolation |
| 06/07 | the same, with the final driver and full artefact stamping, twice consecutively | the same limits as 04/05 |

## Teardown receipts (all runs)

`run-NN/teardown.json`: `portClosedAfterTeardown: true`,
`homeRemoved: true`, the Host pid killed, mock port released.
`.artifacts/tmp/port-leases/dev-live-hosts/` was empty after the loop.

## The single sentence for the final report

> In an isolated dev-live World the seam delivered the confined `web` face to
> two legacy Members — their own model requests surfaced `web_fetch`/
> `web_search`, and the model's own calls produced exactly one typed
> `NETWORK_UNCONFINED_REALM` guard fact each with zero provider entries and a
> refusal naming the capability — twice consecutively; this is a wiring datum,
> not network confinement or isolation, and no candidate or `V@B` claim is
> made.
