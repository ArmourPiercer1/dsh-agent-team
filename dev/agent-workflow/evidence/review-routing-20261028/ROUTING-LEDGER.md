# Review routing decision log (2026-10-28 →)

Append-only. 本文件自接管会话的 gitignored scratch `.artifacts/review-routing/LOG.md` 一次性入库（2026-10-28），此后新增一律进本文件；所引审查报告为本目录同级文件。Format = 用户指令 §七 YAML. `actual_cost: null` everywhere: no OpenCode Go quota API is
visible from this shell and `~/.dsh` is a red line, so every `budget_status` below is `unknown` — never
recorded as 0.

## Route verification (not reviews)

| route | probe | result |
| --- | --- | --- |
| `qiyuan-self/qwen3.8-flash-next` | ≥10 narrow tasks today | available |
| `qiyuan-inter/deepseek-v4.1-flash-1017` | read-only probe, answered `VERDICT_SEVERITY` semantics correctly from `run-record.mjs:29` | **available** |
| `qiyuan-inter/glm-5.3` | read-only probe, named `dev/engineering/current-authority.json` correctly, 0 bash calls | **available** |
| `deepseek-v4-pro` | **not advertised by `list_subagent_models` on this host** | **UNKNOWN / not registered** → no R2 upgrade path via v4-pro; do not fabricate one |
| `qiyuan-inter/gpt-6.1-sol` etc. | 6 reviewer agents died silently earlier today | unavailable (upstream), route retired |

## DEV-1 — independence defect in the reviews already done today

```yaml
review_route:
  target: "PR #427 (89b455f0e), PR #428 (e9d92f963), PR #429 (a23f11a3b) — all merged"
  risk: R2
  risk_reason: "test-infrastructure substance: boot accounting, native-asset supply, and the ENV_BLOCK
    vs FAIL judgement rule — 测试判定规则 changes are >= R2 by this policy"
  model: "qiyuan-self/qwen3.8-flash-next"
  provider: qiyuan-self
  route_reason: "routed before this policy existed: qiyuan-inter/* was down (6 silent agent deaths) and
    the only live route was the local Qwen"
  independence: self_check        # <-- fails 基本原则 4: reviewer was the executor's own model family
  budget_status: unknown
  estimated_cost: null
  actual_cost: null
  result: PASS                    # the reviews themselves stand on evidence
  findings:
    - severity: P2
      location: "process, not code"
      issue: "independence requirement not met: executor and reviewer were both qwen3.8-flash-next, so
        'independent review' was only narrow-scope + evidence-grounded, not cross-model"
      evidence: "SESSION_ROUTER_LOG 2026-10-28 entry records the route outage and the deviation"
  unresolved: ["R2 independent cross-model confirmation for #428 and #429"]
  next_action: "retroactive independent review on deepseek-v4.1-flash-1017 (REVIEW-429-RETRO,
    REVIEW-428-RETRO below); #427 is evidence/docs-only, covered by the promotion review instead"
```

No conclusion is being laundered here: the merges are not being re-opened, because each of those reviews
was execution-based (mutants killed, exit codes measured, porcelain checked) rather than impression-based.
What is missing is the *cross-model* confirmation, and that is scheduled below rather than asserted.

## DEV-2 — OpenCode Go routes: probes pass, tool-turns die (2026-10-28)

```yaml
review_route:
  target: "route health, not code"
  risk: R0
  risk_reason: "infrastructure availability check, no product or gate semantics involved"
  model: "qiyuan-inter/deepseek-v4.1-flash-1017"
  provider: qiyuan-inter
  route_reason: "user directive: route reviews to OpenCode Go models"
  independence: unverified
  budget_status: unknown
  estimated_cost: null
  actual_cost: null
  result: HOLD
  findings:
    - severity: P1
      location: "orchestration, not code"
      issue: "single-shot read-only probes succeed on v4.1-flash-1017 and glm-5.3, but tool-using review
        turns fail: 3 of 4 died before creating their report file, 1 stalled after 8 lines"
      evidence: "agents 287bb584 (probe OK), 7a5f95e5 (probe OK), 99d1e441/bf4bab95/945a35bf (failed,
        no report), 5fa26813 (stalled at 8 lines), 2b8e6106 (interrupted by user)"
  unresolved: ["whether the route works at all in a session started after the channel was configured"]
  next_action: "user diagnosis recorded: the opencode-go channel was configured AFTER this session
    started, so the harness could not actually dispatch to it. Re-verify with a 3-5 tool-call review in
    a fresh session before routing any gate review there."
```

Consequence applied: no gate conclusion in this session rests on an OpenCode Go model, and no
`independence: independent` claim was made for any of them.

## DEV-3 — OpenCode Go routes LIVE in a fresh session (2026-10-28, takeover session)

```yaml
review_route:
  target: "route health, not code — closes DEV-2's unresolved item"
  risk: R0
  risk_reason: "infrastructure availability check"
  model: "dsh-opencode-go/deepseek-v4.1-flash + dsh-opencode-go/glm-5.3"
  provider: dsh-opencode-go
  route_reason: "user directive: route reviews to DSH OpenCode Go models; fresh session after channel config"
  independence: independent        # relative to executor qiyuan-self/qwen3.8-flash-next (different provider)
  budget_status: unknown
  estimated_cost: null
  actual_cost: null
  result: PASS
  findings:
    - severity: INFO
      location: "routing table, not code"
      issue: "model ids on this surface carry NO -1017 suffix (deepseek-v4.1-flash); deepseek-v4-pro is NOW
        REGISTERED (was UNKNOWN last session) => R2 escalation path exists; glm-5.3 efforts low/high/max"
      evidence: "list_subagent_models + two tool-using probes: probe-og-flash.md (VERDICT_SEVERITY answer
        verbatim-correct vs tests/world-factory/lib/run-record.mjs:29), probe-og-glm.md (pointer keys+digest
        verbatim-correct vs scripts/current-authority.mjs output); both TOOL_ROUND_OK, ≤4 tool calls each"
  unresolved: []
  next_action: "reviews for #431 dispatched on dsh-opencode-go/deepseek-v4.1-flash; G4 promotion R2 (R3) → glm-5.3;
  routing-draft §一 table to be updated in the docs PR"

## RR-428 / RR-429 — retroactive cross-model reviews (DEV-1 debt) CLOSED on OpenCode Go (2026-10-28)

```yaml
review_route:
  target: "PR #428 (merged e9d92f963) budget-ledger seam; PR #429 (merged a23f11a3b) ENV_BLOCK judgement fidelity + provisioning"
  risk: R2
  risk_reason: "same objects DEV-1 flagged: boot accounting + ENV_BLOCK judgement rule => >= R2 by policy"
  model: dsh-opencode-go/deepseek-v4.1-flash
  provider: dsh-opencode-go
  route_reason: "DEV-1 cross-model confirmation owed; channel live (DEV-3)"
  independence: independent        # different provider from executor qiyuan-self/qwen3.8-flash-next
  budget_status: unknown
  estimated_cost: null
  actual_cost: null
  result: PASS-WITH-FINDINGS       # both PRs; no P1, no HOLD; conclusions stand, execution-based round-1 reviews confirmed cross-model
  findings:
    - {severity: P2, location: "run-c2.mjs:137-154 (F-1)", issue: "unknown/typo'd CLI flags silently dropped => silent fallback to CLOSED-lane ledger + budget 7 (the fallback the code claims impossible)", evidence: "R428-RETRO-og.md; --bogus reached main()"}
    - {severity: P2, location: "run-c2.mjs:341-357,617-620 (F-2)", issue: "budget-exhaustion throw after world+mock creation, no teardown => leaked world/mock, FATAL exit 1, no record", evidence: "R428-RETRO-og.md check 2"}
    - {severity: P3, location: "run-c2.mjs:98-106 (F-3); seam docs (F-4)", issue: "lexical-only closed-lane guard; seam undocumented in prose", evidence: "R428-RETRO-og.md"}
    - {severity: P2, location: "070-u7-f-web.mjs:309-338 (OG-1)", issue: "ENV_BLOCK assigned on web legs with no probe record / typed refusal => rule text (TEST_METHODS §9) agrees with code only under the narrow native-leg reading; scope the rule text", evidence: "R429-RETRO-og.md; gate conjunction verified real at host-sandbox-assets.mjs:661-676 incl. forgery matrix"}
    - {severity: P3, location: "OG-2/3/4", issue: "NEW-1 mode pin unenforced on present path; persisted pre-flight field conditional on --run-record; SOURCE_IS_DESTINATION ordering", evidence: "R429-RETRO-og.md"}
  unresolved: []
  next_action: "F-1/F-2/F-3/OG-1 => post-phase-3 remediation ledger (touching runners now would disturb the frozen candidate 5d0c8ff58); boot lane passes all seam flags explicitly + verifies argv parse before spawn as mitigation; OG-1 rule-text scoping joins the docs PR"

## R431 — PR #431 gate-ledger + boot-budget ruling, full R2 loop on OpenCode Go (2026-10-28)

```yaml
review_route:
  target: "PR #431 (RULING-B-G4R-3.md + GATE-LEDGER row), heads d5c340cb5 -> 0454b56d4"
  risk: R2          # gate ledger + boot budget => >= R2 by policy
  model: dsh-opencode-go/deepseek-v4.1-flash
  provider: dsh-opencode-go
  route_reason: "user directive (OpenCode Go for reviews); channel live (DEV-3); R3-level escalation to glm-5.3 reserved for the promotion review itself, not this authorization doc"
  independence: independent
  budget_status: unknown
  estimated_cost: null
  actual_cost: null
  result: PASS      # after round-1 fixes + one NOT-CLOSED (false cross-reference) repaired and verified CLOSED
  findings:
    - {severity: P2, location: "RULING ceiling statement", issue: "8+1 reserve ambiguous vs 9 authorized", evidence: "closed: explicit ceiling-reading note (R431-R2-closure-flash.md check 1)"}
    - {severity: P3, location: "RULING overrun rationale; partial-enforcement PASS; ledger typed-refusal gloss; un-pinned origin/master", issue: "4 wording/evidence findings", evidence: "all CLOSED; finding 4 needed two steps: first fix over-claimed the ruling section as conjunction source (NOT-CLOSED, R431-R2-closure-flash.md), second fix cites nativeConfinementEnvBlock code gate (CLOSED, R431-R3-closure2-flash.md)"}
  unresolved: []
  next_action: "merge #431; reviewer note carried: ruling's pre-boot unusable stop and the code's per-run pre-flight record are distinct objects - any future tying needs a ruling, not a gloss"
