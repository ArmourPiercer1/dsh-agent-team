# Round r3 — focused live G4 policy acceptance: REPORT

**Date**: 2026-09-08 (16:48–16:59 local). **Executor**: delegated acceptance subagent (qwen3.8-27b).
**Scope**: the focused G4 policy re-test mandated by `DECISION-AND-REPAIR-PLAN.md` item 3,
against the committed task branch `task/repair-r1-g4-recipe-fix` @ `2285427`
(worktree `.worktrees\repair-r1-g4`), persistent world `tests/mock/.dsh-home-repair-r1`,
port 3181, fresh `MOCK_HARD_TOOLS=1` boot. Full run record: `NOTES-r3.md`; per-asset
captures: numbered files + `args/` + `tools/` + `state/` + `screenshots/` in this directory.

## Verdict

**G4 POLICY ACCEPTANCE: PASS** — the recipe correction is valid and the committed gate
passes end-to-end live on a fresh hard-tools boot:

| Gate step | Evidence | Result |
|---|---|---|
| Pending selection (the fix) | `11-pending-toolname-selected.txt` + `state/f9-policy-pending.json` | **exactly 1 match** — NEW request seq 16 `ctrl-04ih1151nw6m9m0nagf8z10w` (`toolName="write"`, corr `dtest-v2-hard-req-2`, kind leader-approval, target W1); the 3 older toolName-less pendings (seq 5/6/14) neither match nor are disturbed |
| UI assertion | `12b-ui-g4-policy-gate.txt` (valid run) + `state/ui-gate-f9-g4-policy-raw.txt` + `state/teamtab-f9-g4-policy.yml` + `screenshots/f9-g4-policy.png` | **PASS 4/4, exit 0** — Allow clicked on the seq-16 bar → decision row `deny` with `data-external-policy="true"` and the frozen §26.4 text (zh variant rendered: `团队裁决：已允许` / `执行：被托管策略阻止`), **no plain Denied/拒绝**, resolve-error chips clean (`CONTROL_EXTERNAL_POLICY_DENIED`), resolve bar for the rid gone |
| Durable policy fact | `12-f9-policy-check.txt` (`f9-check policy`, exit 0) + `13-ledger-final.txt` | decision seq 17: `decision=deny`, `reason=external-policy`, `decider={kind:human, humanId:session-dtestmts69xkr6b54}`; **zero** `control-allow-consumed` |
| Model-driven creation (no fabricated state) | `09-deliver-b6-req.txt` (status=200 accepted) + `10-w1-turn5-toolcall.txt` + watchdog (turn/end turn=5 in 20.4 s, armed before delivery) | the W1 child issued `team_request_control {kind:leader-approval, actionName:write, toolName:"write", requestToken:"dtest-v2-hard-req-2", …}` — the model kept the fixed `toolName` param; two identical calls collapsed idempotently into one request |
| Cleanup | `14-postflight-ports-stable-testuse.txt` | boot killed (3181/3491/3492 free), `:3080` still 401 (GET-only, zero ops), test-use @ `a66e470204` porcelain empty, main checkout tracked-clean, playwright session closed, stray dir removed |

Pre/post bracket (no fabricated state): pending set {seq 5, 6, 14} before the boot → the
same set after the round; the only new durable facts are seq 16 (model-driven request) and
seq 17 (gate-driven decision).

## What this closes

- The r2 G4 FAIL was, as diagnosed in `22b-g4-fail-diagnosis.md`, a committed-recipe defect
  (request without `toolName` + ambiguous pending selection), not a product defect. Round r3
  proves both corrections live: the `toolName` param makes the §26.4 external-policy branch
  reachable, and the exact `toolName` filter deterministically selects the right request.
- The §26.4 UI row (F9-U acceptance §8.9 text) renders exactly as frozen — **no F9-U display
  gap**: the FAIL routing "UI row renders something other than the §26.4 text → back to the
  F9-U leaf" did NOT trigger.
- The §26.4 durable row is exactly-once, human-decided, zero-consumption — the hard-tools
  managed-policy half of the F9 gate now has live evidence.

## Outcomes recorded but out of this round's scope

1. **G3-consumed expectation** (r2 FAIL, F10-class asset-expectation vs frozen semantics —
   see r2 REPORT §6.1): untouched by this fix; remains the documented boundary per
   repair-plan item 4.
2. **Remaining repair-plan steps (main agent)**: complete live V2 matrix re-run + 3 fresh
   blind gate reviews before any push (repair-plan items 5–6). The focused G4 half is done.
3. **Gate hardening candidate** (record-only, `NOTES-r3.md` §4.3): `ui-gate.mjs`'s
   `v === 'false'` falsy-token test misses playwright's quoted string output
   (`value="false"`), so a clickEval with an unmet precondition can print PASS while the
   gate still fails overall. Not a cause of any r3 outcome; not part of this diff.
4. **Daemon-dir env quirk** (`NOTES-r3.md` §4.2): future ui-gate runs from this host must
   pass `PWTEST_DAEMON_SESSION_DIR` as an absolute path.

## Red lines held

No `packages/*` diff (task branch gained evidence files only); no upstream write (test-use
porcelain empty pre/post, HEAD unchanged); no `docs/plans/active`, no `graph.yaml`, no
`SESSION_ROUTER_LOG.md` (the log append is the main agent's per ROUTER_RULES §7); **no push**;
`:3080` GET-only (→ 401 both probes); `D:\deepseek-harness\` untouched; no credential values
in evidence (token redacted in every copy; cookie file not copied; `.credentials.yaml` never
read/printed; full token-fragment scan = 0 hits); no fabricated state (see `NOTES-r3.md` §5).
