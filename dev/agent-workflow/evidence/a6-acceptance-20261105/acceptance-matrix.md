# Alpha.6 isolated integration + real-Host E2E — acceptance matrix

- **Integrated code HEAD under test:** `c26a9a0020d1e705600436a33d4777ba32c99205`
  (review fixes `996427e3f` merged into `48182b783`, plus the acceptance docs;
  no product bytes changed after the review-fix commit)
- **Real Host run:** stamp `2026-11-05T13-22-47`, host `http://127.0.0.1:3602`, mock `:3603`,
  rerun **after** the P1 review fixes. The first run (`2026-11-05T11-43-02`, evidence
  `a6-officer-host/`) remains as history.
- **Evidence:** `dev/agent-workflow/evidence/a6-officer-host-r2/` (run.log, instance.log,
  mock.log, a6-officer.json, control-ledger.json, summary-extract.json, l0-surface.json);
  durable events are extracted verbatim from the retained host home
  `tests/homes/c1-smoke-2026-11-05T13-22-47`.
- **Scope:** isolated integration and real Host E2E only. No master merge, no un-draft, no
  production enablement, no release.

## Criteria reached in this round

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | v5 `team.create` admits a real Officer + review routing | **PASS** | `run.log` A6-1; created root `session-c1-smoke-a6-2026-11-05T13-22-47`, blueprint hash `sha256:fc0963…` |
| 2 | Real Member bash ask produces a model-visible Officer review wake | **PASS** | `a6-officer.json` `.wakes`: 3 Officer turns, wake text carries `requestId: - ctrl-1u2v1ph…`; `mock.log` wake seq 13 |
| 3 | Officer resolves through `team_resolve_control` | **PASS** | `mock.log` seq 14; durable decision sequence 11, `reviewCapability.source = blueprint-officer`, `effectiveReviewAuthority = leader` |
| 4 | The original Member command executes after the Officer allow | **PASS** | `executed=true`; workspace file `tests/homes/c1-smoke-2026-11-05T13-22-47/workspace/c1-a6-allow-2026-11-05T13-22-47.txt` contains the stamp |
| 5 | The Leader is not woken for a leg routed to the Officer | **PASS (scoped)** | `leaderWakeCount=0` means no **Officer review wake** went to the Leader. The separate legacy guard ask (row 1) did use the Leader notification path; see the duplicate report. |
| 6 | No durable request is left pending | **PASS** | 2 requests, 2 decisions, 2 consumptions, `pending=0` |
| 7 | One-shot consumption / no double execution | **PASS** | exactly one `control-allow-consumed` per request (sequences 9 and 12); one file write; no second execution |
| 8 | Two approvals for one bash invocation both settle and are consumed | **PASS** | `parameter-permission` allow+consumed seq 8/9; `team-tool-execute` allow+consumed seq 11/12; identities differ (see duplicate report) |
| 9 | Durable facts, not a unit substitute | **PASS** | `control-ledger.json` carries the full `control-request-recorded` / `control-decision-recorded` / `control-allow-consumed` payloads, including scope, fingerprints and generation |

## Not reached in this round (explicitly not passed)

| # | Required scenario | Result | Why |
|---|---|---|---|
| 10 | Leader exception routing | **NOT_REACHED** | the E2E kit declares `leaderExceptions: []`; no real exception leg was exercised |
| 11 | Officer self-review | **PASS** | real Host `a6-recipients-r6` / `r12`: Officer's own PA leg `ctrl-1lc9fk11mqfnfy168muob00k` decided by Leader seq 19, consumed seq 20, command executed; see `recipients.md` |
| 12 | Handoff successor notification / production `reviewEvents` consumer | **PASS** | clean real Host `a6-handoff-only-r6`: transfer seq 22 → Leader decision seq 23 → execution once. The missing production `reviewEvents` consumer was the defect; fixed in `fd7a5d6c1`; `recipients.md` |
| 13 | Human Escalation recipient | **NOT_REACHED** | both decisions were agent decisions (Leader legacy notification and Officer); no human recipient |
| 14 | Human final approval, original-call validity, Stop/cancel/timeout non-revival | **NOT_REACHED** | no Human ask, no Stop/cancel mid-wait |
| 15 | queued / claim / release under crash, Sticky Stop, four crash windows, native Inbox reconciliation | **BLOCKED / PARTIAL** | deliver/claim/turn-end release observed; but a wake after a direct prompt to the same Officer session (`a6-recipients-r22`) reports `followup` → running yet produces no model turn. No crash-window/Sticky Stop injection yet |
| 16 | Duplicate-approval elimination | **NOT_IMPLEMENTED** | evidence collected; recommendation only (see duplicate report) |

## Gate

Full local gate **9/9 PASS, zero skips** on final HEAD `b4d4d21e`; the evidence
commit that records this result changes docs/evidence only. `gate.md` records the
exact SHA and outputs:
`node scripts/ci-pr-gate.mjs --full`, `CI=true`,
`DSH_CI_STORE_DIR=$PWD/.drill/pnpm-store`, pristine host symlink present.

Census result on the passing final run: **677 files / 8830 legs**, `COUNTS MOVED, SET DID NOT`,
0 new reds / 0 collection errors. The earlier E2E HEAD `8ea3a05` had 8/9 legs green; its
census capture hit two pre-existing 1 ms race tests (`alpha5-glob-backend` X3 and
`alpha5-search-backend` P11), each passing standalone; the final integrated run passed.
See `gate.md` for the exact outputs and the flake disclosure.

## Independent review

Verdict at `8ea3a0517`: **BLOCK** (no P0; P1-1 notification-policy bypass,
P1-2 per-root router policy). Both P1s, P2-1 and the verifier-test gap are fixed
in `996427e3f`; P2-3 is covered by the rerun gate; P3 root/ledger items are
addressed. The real Host E2E was rerun at `c26a9a00` after the fixes and passed
6/6 again. A second independent review of the fix commit returned
**PASS_WITH_P2** (both P1s closed, no new P0/P1); the one non-discriminating
regression test was made leg-bearing in `90937099d`. See `review-response.md`.

## Verdict

**Isolated integration: PASS on the reached path; review P1s cleared.** A real Member call routed to the
assigned Officer, the Officer's durable allow was consumed, and the exact command executed
once. The remaining acceptance rows are **NOT_REACHED**, not silently passed. Production
enablement and master merge remain blocked.
