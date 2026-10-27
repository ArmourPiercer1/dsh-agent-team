# u7-f C2 — the UI family at the live Host (u7-f-ui suite)

Suite: `tests/world-factory/suites/080-u7-f-ui.mjs` (kind `u7FsUi`), ONE
World, ONE boot per run, budget `--max-host-starts 3` — LEDGER USED: 3
(`budget-ledger.jsonl`), every entry named below. The final verdict run is
**f3: overall=PASS 7/7**.

## Boot ledger (all 3 starts, honest history)

| run | outcome | what it proved / fixed |
| --- | --- | --- |
| `f1` | FAIL (6 cases) | the planted `main.yaml` carried a two-space shift in the leader `builtinToolDeny` block → the blueprint never entered the catalog (`blueprint not found in catalog: team.u7fui.main`). THE FIX WAS IN THE SUITE, not the product; shape now byte-diffed against the PROVEN u7-fsmut blueprint offline (js-yaml first-document shape equality, zero missing fields). |
| `f2` | PASS 7/7 (arm shifted) | the mock asked with `{id, label}` options; the governed row's CLOSED-WORLD option contract refused live, typed, verbatim: `refused-schema ask-unknown-parameter — questions[0].options[0] carries unknown parameter(s) id (accepted: label, description)`. That is the host-faithful option law witnessed on the real host — but it stops BEFORE the port gate, so the script now sends host-legal `{label}` options to reach the port/policy law. |
| `f3` | **PASS 7/7** | the fail-closed law witnessed through the row's own observe lines (below). |

## Verbatim live witnesses (f3 host log, `logs/u5f3-*/instance-port3183.log`)

- Mount: `a5g7: placement-feed rows=[team_grep,team_glob,team_bash,read,write,edit,read_image,ask_user_question,present] realm=u7fui-realm-u5f3-…`
  — the two native spellings are carried by the FAMILY on the production
  placement feed, ZERO `PLANE_UI_REGISTRATION_REFUSED`, ZERO
  `TOOL_BINDING_UNVERIFIED`.
- ask refused: `[dsh-agent-team] u7f-ask: governed-ask default-deny refusal`
  — the host DOES mount `userQuestions` on the member agent ctx (the port
  gate passed), and the row then refused at its OWN default-deny template
  gate: zero PA consumption, zero port calls, `fabricatedAnswerInToolResult:
  false`, zero `governed-ask RAN`. (C2 never runs the approval lane; the
  per-call-approval positive is PROVEN offline in C1 A-1, the port-absent
  arm in C1 A-2, the timed/pending law in C1 T-1..T-8.)
- present refused (in-root planted file): `[dsh-agent-team] u7f-present:
  governed-present port-refusal` → `UI_PRESENT_PORT_ABSENT` — no host ctx
  service carries a presentation face. Disk ORACLE: presented-target sha
  `afd51db3…` IDENTICAL before/after; zero `PROBED`, zero `RAN`.
- present refused (out-of-root): `[dsh-agent-team] u7f-present:
  governed-present anchor-refusal code=locator-rejected` — PURE-LEXICAL,
  before the port check and before the PA edge. Zero fs touch PROVEN by the
  OUTSIDE CANARY (`U7FUI_OUTSIDE_CANARY_NEVER_READ_…`) appearing in NO host
  log line and NO tool result, plus byte identity of the outside file
  (`b583cebf…` identical).
- positive arms: **DISCLOSED, never faked** — zero `RAN` lines exist, and
  no answer ever arrived without its row witness. Reason verbatim in the
  `ui:positive-arms-honest` detail: no trusted mount injects a UI port
  (production backends are `{jobs?, backgroundJobs?}` only); the answerer
  rides the member agent-scoped Cordis waterfall with no HTTP face the C2
  world could drive; the present publication face exists on no host ctx
  service.
- leak-check: owned pids dead, ports released, home + leases released.

## Verdict commands

```
node tests/world-factory/u5-canary-runner.mjs --suite u7-f-ui --line f1 \
  --evidence dev/agent-workflow/evidence/u7-f-ui-20261026/c2 \
  --budget-ledger dev/agent-workflow/evidence/u7-f-ui-20261026/c2/budget-ledger.jsonl \
  --max-host-starts 3
```

(`--line f2`/`f3` for the other two runs; the budget ledger refuses a 4th
start by construction.)
