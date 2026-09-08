# G4 recipe fix — minimal persistent test-recipe/gate-asset correction

**Task branch**: `task/repair-r1-g4-recipe-fix` (worktree `.worktrees/repair-r1-g4`), branched from `int/repair-r1` @ `9555aa0`.
**Scope**: test assets under `tests/mock/scripts/` only. No product code (`packages/*` untouched), no upstream, no `docs/plans/active`, no `graph.yaml`, no `SESSION_ROUTER_LOG.md`, no push.
**Contract**: `live-round-r2/DECISION-AND-REPAIR-PLAN.md` items 2–3 — treat the r2 G4 policy failure as a persistent test-recipe defect; add the V1 T4.7a precedent's explicit `toolName: "write"` to the policy-half request recipe; ensure the gate selects that request rather than an older pending request.

## 1. Defect (why the r2 G4 row failed)

1. **Recipe defect**: the committed `prompts/b6-req.md` request omitted `toolName`. For a model-driven `team_request_control`, the frozen wire schema exposes `toolName` (optional) and no `capabilityDomain` param; `resolveControl` derives `capabilityDomain = payload.capabilityDomain ?? (payload.toolName !== undefined ? 'tools' : undefined)` (`packages/runtime/control/service.ts` L926–928). Without `toolName`, `capabilityDomain` stays undefined and `hardCellAllows` (`MOCK_HARD_TOOLS=1`) never runs → a plain allow, not the §26.4 durable `deny · reason=external-policy`. The V1 T4.7a precedent (`tests/mock/evidence/NOTES.md` L200–204) used exactly `toolName: "write"` and produced the durable external-policy deny (domain seq 114, T4.7b PASS).
2. **Selection defect**: the r2 world already holds residual pending requests, all `leader-approval` / W1 / `actionName=write` and none carrying a `toolName`. `f9-check pending` selects the first by sequence, and the legacy filters (`kind`/`target`/`action`) cannot discriminate — r2's gate run therefore decided the wrong request (ledger seq 15: allow on seq 4, v2-l1) instead of the hard-tools request (seq 14). The G4 row cannot pass on a request that carries no tool pipeline.

## 2. Exact change (2 files, see `diff.patch`)

### `tests/mock/scripts/prompts/b6-req.md` (one line, two insertions)

- `+ toolName=write，` — the V1 T4.7a precedent param (the frozen external-policy discriminator).
- `requestToken` `dtest-v2-hard-req-1` → `dtest-v2-hard-req-2` — a fresh logical request in the same-home world. The `requestControl` idempotency key is `scopeKey(root, targetInstanceId, actionName, toolName, correlation)`; reusing one correlation across two pending requests would muddle the world state. A fresh token keeps token↔request 1:1 (V1 T4.7a used a dedicated correlation too).

### `tests/mock/scripts/f9-check.mjs` (3 hunks)

1. Header doc: new `toolName` option (exact match; selects the request that carries the named DSH tool — the frozen external-policy discriminator; requests without a toolName never match).
2. `phasePending`: destructure `toolName`; append `&& (toolName === undefined || f.payload.toolName === toolName)` to the pending filter. **Exact match** (closed tool identity, unlike the substring `action` filter). **Backward compatible**: an absent `toolName` key makes the term vacuously true → exactly today's behavior (G3 pending calls unaffected).
3. No-match error: echo includes `toolName`; hint now points at `b6-req.md`.

**Explicit non-changes**: `prompts/b4-requests.md` (G3 chain validated; its residuals stay pending), `gates/f9-g4-policy.json` (asserts are frozen-§26.4-correct; it consumes `{{requestId}}` from the vars file — selection lives in the recipe-level `pending` call), the selftest (still 23 checks; the filter sits in the non-exported `phasePending`, exercised live by the re-run), and the G3-consumed asset (kept as the documented F10-class boundary per repair-plan item 4).

## 3. Deterministic validation (this commit; all offline, zero world mutation)

| # | run | result |
|---|---|---|
| 01 | `run-01-selftest.ps1` — `f9-check.mjs selftest` (23 pure checks) | **23 PASS, 0 FAIL, exit 0** — the edit breaks no pure check |
| 02 | `run-02-pending-toolname.ps1` → real `phasePending` on the persistent world with `{"toolName":"write"}` | **0 matches, exit 2** pre-live — the discriminator is empty: no residual pending request carries a toolName, so the filter cannot select a stale one (the new no-match message, naming `toolName` + `b6-req.md`, is verified in the capture) |
| 03 | `run-03-pending-legacy.ps1` → real `phasePending` with the committed legacy filter `{kind,target,action}` | **3 matches (seq 5/6/14), exit 0**, chosen = **seq 5 (v2-l2, `toolName: null`)** — the legacy selection is still ambiguous and would again pick a toolName-less request (the r2 failure class, where it picked seq 4) |
| 04 | `run-04-filter-backcompat.mjs` — verbatim source check + synthetic behavior of the 3-term (pre) vs 4-term (post) filter | **18 PASS, 0 FAIL, exit 0** — backward compat (absent key ⇒ identical match sets for empty and G3-style opts), exact selection (toolName=write ⇒ exactly the new request), exact-match semantics (substring/different tool ⇒ nothing) |

Reproduce: run the four `run-0X` scripts from this directory (each re-captures its numbered `0X-*.txt`). Runs 02/03 point `MOCK_DSH_HOME` at the main checkout's persistent world `tests/mock/.dsh-home-repair-r1` (read-only: only `team_domain.json` is read; the sole write is the local `scratch/` vars file). Runs use a node spawn wrapper with an exact argv array because PowerShell's legacy native-argument passing strips embedded double quotes from `--json` payloads (observed: `{toolName:write,...}` — a JSON parse error).

## 4. Residual world facts (durable, verified — root `session-dtestmts69xkr6b54`)

Members: W1 `inst-0fi1an617bjs` (child `session-team-child-f1898fca80a5114128eec10671624fd2`, SETTLED), W2 `inst-1ds2q2n0nete` (child `session-team-child-a28fa0cc8bfcf80144c3a843c2d729ef`, CREATED). Ledger seq 1–15.

- **Pending (3, none with toolName)**: seq 5 `ctrl-0eenv681ihtx7p002pwg20kt` (v2-l2, corr `dtest-v2-req-la-2`); seq 6 `ctrl-0ppmycw17v2axd0ws2xbi03q` (v2-self, corr `dtest-v2-req-self-1`); seq 14 `ctrl-1eaer590x95ko00wdd0y71jw` (v2-hard, corr `dtest-v2-hard-req-1`).
- **Decided**: seq 3 (v2-ua-1) allow/human (seq 7); seq 4 (v2-l1) **allow/human (seq 15 — consumed by the r2 gate run's mis-selection)**; seq 12 (v2-ua-2) deny/human (seq 13).

> **Correction to the r2 plan text**: the decision text counts "4 pending requests (seq 4/5/6/14)". The durable world shows seq 4 was decided-allow at ledger seq 15 during the r2 run, so the pre-live pending set is **3** (seq 5/6/14). The fix logic is unaffected: the new filter matches 0 pre-live and exactly 1 post-live; the legacy filter remains ambiguous.

## 5. Next steps (main agent — out of this commit's scope)

Per repair-plan items 3, 5, 6: fresh hard-tools boot on the same configured DSH_HOME → deliver the new `b6-req.md` (one model turn) → `f9-check pending` with `{"toolName":"write"}` must match exactly 1 (the new request, corr `dtest-v2-hard-req-2`) → unchanged `gates/f9-g4-policy.json` UI gate → `f9-check policy --request-id <new rid>` (durable `deny · external-policy`, human decider, zero consumption) → complete live V2 matrix → 3 fresh blind gate reviews → no push before the reviews close. Evidence lands in `live-round-r3-g4/` alongside this directory.

**FAIL routing recorded (plan §3)**: if the UI row renders anything other than the §26.4 text → F9-U display gap (product, back to the F9-U leaf), not a recipe retry; if step 8 matches 0 requests → the model turn dropped `toolName` (retry delivery per ROUTER_RULES §2, record the raw tool call).

## 6. Red lines held

- No `packages/*` diff, no upstream write (`references/deepseek-harness-test-use` untouched), no `docs/plans/active`, no `dev/agent-workflow/graph.yaml`, no `SESSION_ROUTER_LOG.md`, no push.
- Zero world mutation: durable scans are read-only (`team_domain.json`); the only writes are this evidence directory (tracked) and the gitignored worktree `tests/mock/state/` dir (empty, created by `phasePending`'s `mkdirSync`).

## 7. Round r3 — focused live G4 acceptance (2026-09-08; the §5 next-step re-run)

Executed by the delegated acceptance subagent; full record in **`live-round-r3-g4/`**
(`REPORT.md` + `NOTES-r3.md` + numbered captures 01–14 + `args/`/`tools/`/`state/`/`screenshots/`).

**Verdict: G4 POLICY ACCEPTANCE — PASS.** Fresh `MOCK_HARD_TOOLS=1` boot (label `repair-r3-g4`,
port 3181, same configured DSH_HOME, keyConfigured=true, blueprint `dtest-bp@1`, rows 4×true);
preflight 8 PASS; version-gate 5 PASS; one model turn delivered the task-branch `b6-req.md`
(turn 5, 20.4 s; raw `team_request_control` calls carried `toolName:"write"`, token
`dtest-v2-hard-req-2`); the fixed `toolName` filter selected **exactly 1** request (seq 16
`ctrl-04ih1151nw6m9m0nagf8z10w`); the unchanged committed `f9-g4-policy.json` gate passed
**4/4** (Allow clicked → `deny` + `data-external-policy="true"` row with the frozen §26.4 text,
no plain Denied/拒绝, chips clean, bar gone); `f9-check policy` PASS — durable decision seq 17
`deny · reason=external-policy · decider=human`, zero consumption; postflight clean (ports
free, `:3080` GET-only 401, test-use pristine @ `a66e470204`, main tracked-clean). Pre/post
pending bracket {5,6,14} → {5,6,14}: no fabricated state.

Notes: two ui-gate infra-only reruns preceded the valid run (relative
`PWTEST_DAEMON_SESSION_DIR` resolved against the spawned cwd → absolute path used; fresh
browser session had the `未分组` sidebar group collapsed → one manual group-expand, no
assertion) — documented in `live-round-r3-g4/NOTES-r3.md` §4; no product/recipe/model
implication. The §26.4 row rendered exactly as frozen → **no F9-U display gap**; the FAIL
routing of plan §3 did not trigger. Remaining per repair-plan items 5–6 (main agent):
complete live V2 matrix re-run + 3 fresh blind gate reviews before any push; `SESSION_ROUTER_LOG.md`
append is the main agent's (ROUTER_RULES §7). Red lines held as in §6, plus: no credential
values in evidence (launch token redacted in all copies; cookie not copied; token-fragment
scan 0 hits).
