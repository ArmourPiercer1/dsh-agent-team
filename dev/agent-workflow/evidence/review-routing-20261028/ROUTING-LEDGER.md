# Review routing decision log (2026-10-28 →)

Append-only. 本文件自接管会话的 gitignored scratch `.artifacts/review-routing/LOG.md` 一次性入库（2026-10-28），此后新增一律进本文件；所引审查报告为本目录同级文件。Format = 用户指令 §七 YAML. `actual_cost: null` everywhere: no OpenCode Go quota API is
visible from this shell and `~/.dsh` is a red line, so every `budget_status` below is `unknown` — never
recorded as 0.

## Route verification (not reviews)

> **Dated supersede (2026-10-28, takeover session):** the table below is the first-half-of-day snapshot taken before the
> `dsh-opencode-go` channel was registered. It is kept unedited as history; the live route table is
> `docs/plans/memo/unified-baseline-alpha5-20261025/REVIEW-MODEL-ROUTING.md` §一 (measured same day) and
> entry DEV-3 below: `deepseek-v4-pro` **is** registered (R2 escalation path real), all `qiyuan-inter/*`
> routes are retired from review dispatch.

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

```
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

```
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
```
## R433 + R434 + boot-lane LEG1-ENV — routing round (2026-10-28 evening)

```yaml
review_route:
  target: "PR #433 routing docs (7967b0b72 -> d9b68c571); PR #434 RULING-B-G4R-4 (4f6b9ff35); boot-lane leg-1 ENV failure handled via new ruling"
  risk: R2          # governance docs + boot-budget authorization
  model: dsh-opencode-go/deepseek-v4.1-flash
  provider: dsh-opencode-go
  route_reason: "OpenCode Go is the review lane per user directive; both PRs are >= R2 by REVIEW-MODEL-ROUTING 判定要点"
  independence: independent
  budget_status: unknown
  estimated_cost: null
  actual_cost: null
  result: IN_FLIGHT # R433 round1 PASS-WITH-FINDINGS (2 P2 fences/table + P3s) -> fixed d9b68c571 -> closure check dispatched; R434 review dispatched
  findings:
    - {severity: P2, location: "ROUTING-LEDGER fences", issue: "3 unclosed yaml fences from scratch import (my append via heredoc dropped closers)", evidence: "R433-og.md; fixed: fence count 10, extractor 5/5 (closure pending)"}
    - {severity: P2, location: "route table staleness inside ledger", issue: "first-half-of-day table contradicted DEV-3/spec", evidence: "fixed via dated supersede banner, history rows unedited"}
  next_action: "merge order: #433 then #434 after closures; ARC-A retry only after #434 merged (tracked authorization before boot)"
```

## R435 + parallel worker dispatches (2026-10-28 late)

```yaml
review_route:
  target: "PR #435 RV-406 evidence landing (39666cae2); non-review parallel packages: worktree reclaim audit, G4R3 executor pack"
  risk: R1          # pure evidence docs, verbatim content
  model: dsh-opencode-go/deepseek-v4.1-flash
  provider: dsh-opencode-go
  route_reason: "R1 per routing spec; parallel worker packages are non-review and ran on child defaults"
  independence: independent
  budget_status: unknown
  estimated_cost: null
  actual_cost: null
  result: PASS
  findings: []
  next_action: "merge #435 with #434 once CI CLEAN; then ARC-A retry under B-G4R-4"
```

> Dated note (2026-10-28): the two entries above (R433/R434/LEG1-ENV round, R435 round) are session-scratch entries folded verbatim from `.artifacts/review-routing/LOG.md` into this live ledger (append-only; null costs + `budget_status: unknown` preserved).

## Boot-lane close, thread-round, R2 promotion round, R440 package round (2026-10-28 late → 2026-10-29, takeover session 2)

```yaml
review_route:
  at: "2026-10-28T20:05:00Z"
  session: "takeover-2 main agent"
  target: "PR #436 B-G4R-5 + PR #437 ledger-sync + crash-sequencing RCA (read-only) + PR #438 B-G4R-6"
  risk: "R2 (boot-budget authorizations); RCA = analysis artifact, no authority"
  tier: "R1+R2 (named rulings re-checked by independent reviewer)"
  model: "dsh-opencode-go/deepseek-v4.1-flash"
  independence: "separate session, reviewed detached worktree rr-438 @ f4fba8d35; RCA by separate read-only session (be82626b)"
  rounds_used: 1
  max_rounds: 3
  estimated_cost: null
  actual_cost: null
  budget_status: unknown
  result: "PASS-WITH-FINDINGS (R438-og.md: F1 B-G4R-5 not yet in gated tree — handled by merge order 436-before-438; F2 7/7 wording — adopted b273d4fd4; F3 INFO)"
```

```yaml
review_route:
  at: "2026-10-28T23:55:00Z"
  session: "takeover-2 main agent"
  target: "G4 promotion re-review R2 (full packet @ master 7a789a91d): reviewer-A dsh-opencode-go/glm-5.3 (R3 stage-reviewer per user routing), reviewer-B dsh-opencode-go/deepseek-v4-pro (independent model family); blind pair, no cross-read, brief + packet pointer in .artifacts/briefs/"
  risk: R3
  tier: R3
  model: "dsh-opencode-go/glm-5.3 + dsh-opencode-go/deepseek-v4-pro"
  independence: "two fresh sessions, detached worktrees rr-g4-a/rr-g4-b, prior review outputs + SESSION_ROUTER_LOG + graph.yaml forbidden as evidence; reviewers recompute equivalence diffs personally"
  rounds_used: 1
  max_rounds: 3
  estimated_cost: null
  actual_cost: null
  budget_status: unknown
  result: in-flight
```

```yaml
review_route:
  at: "2026-10-28T23:20:00Z"
  session: "takeover-2 main agent"
  target: "Copilot review threads on PRs #436/#437/#438 (7 threads total, branch protection require-conversation-resolution)"
  risk: "R1 (docs records)"
  tier: R1
  model: "github-copilot (machine reviewer) + main agent adoption"
  independence: "machine findings adjudicated by main agent; two were factual (audit ref #434->#436; boot-label), two semantic-hardening (stop-law correction must be post-stop dated doc; knob=empirical not structural), one evidence-durability (tracked copies)"
  rounds_used: 1
  max_rounds: 3
  estimated_cost: null
  actual_cost: null
  budget_status: unknown
  result: "all adopted verbatim in f04ec943/86107fcc/fa265309, threads replied+resolved; root cause of long BLOCKED mystery was this protection rule, not CI"
```

```yaml
review_route:
  at: "2026-10-29T00:40:00Z"
  session: "takeover-2 main agent"
  target: "G4 promotion re-review R2 — RESULT: reviewer A glm-5.3 投机通过有条件 (3MED/3LOW, conditions=bookkeeping only, executed in PR #440); reviewer B deepseek-v4-pro 投机通过 (2MED/1LOW, gate-may-open-with-risk-ledger); core claim verified-from-bytes by both; promotion package #440 filed (ledger closure rows + BL-20..BL-23 + README addendum); release unlock (G5/S5) explicitly QUEUED for user, not assumed"
  risk: R3
  tier: R3
  model: "dsh-opencode-go/glm-5.3 + dsh-opencode-go/deepseek-v4-pro (families distinct; reports tracked at gates/G4-PROMOTION-REVIEW-R2-{A-glm,B-v4pro}.md via #440)"
  independence: "blind pair confirmed in reports' self-checks (HEAD 7a789a91d, porcelain 0, no cross-read)"
  rounds_used: 1
  max_rounds: 3
  estimated_cost: null
  actual_cost: null
  budget_status: unknown
  result: "投机通过 x2; B-G4R-5 pre-authorization expired at application per its §5(a)"
```

```yaml
review_route:
  at: "2026-10-29T01:10:00Z"
  session: "takeover-2 main agent"
  target: "PR #440 (G4 promotion package: ledger closure rows + BL-20..23 + README addendum) package review"
  risk: R2
  tier: R2
  model: "dsh-opencode-go/deepseek-v4.1-flash"
  independence: "fresh session, detached worktree rr-g4-c @ PR head de49f503, verified closure rows against record JSON bytes"
  rounds_used: 1
  max_rounds: 3
  estimated_cost: null
  actual_cost: null
  budget_status: unknown
  result: "补充内容 — M1 (digest/preflight overclaim vs arc-b c-suite schema) + M2 (BL-23 merge-order forward reference) both fixed in da6b913b with adoption addendum; L1 (historical mixed citation styles) accepted LOW, historical rows immutable; report tracked in #440 itself (review-routing-20261028/R440-og.md)"
```

```yaml
review_route:
  at: "2026-10-29T01:40:00Z"
  session: "takeover-2 main agent"
  target: "correction to the two entries above (R2 round + R440 round): carried residuals are filed as remediation-ledger rows R-G4R-1a / R-ORACLE-1 / R-BL-QUEUE, not as ALPHA5-EFFECTIVE-BACKLOG BL-20..23 rows — the backlog is a hash-pinned input to the u7-0 expected-tool-obligations generator, its edit requires gated artifact+testkit-pin regeneration (census-runtime caught the first attempt; R2 doc addendum 2). BL-20..23 stay RESERVED numbers landing post-freeze with the regeneration package."
  risk: R1
  tier: R1
  model: "n/a (machine-gate-caught bookkeeping correction; census-runtime run 40795312416 root-caused to backlog_sha256 pin)"
  independence: "root cause reproduced locally via generator --check before and after the revert"
  rounds_used: 1
  max_rounds: 3
  estimated_cost: null
  actual_cost: null
  budget_status: unknown
  result: "#440 restructured at 90cd044ca; --check CHECK OK; no residual unnamed"
```

```yaml
review_route:
  at: "2026-10-29T02:10:00Z"
  session: "takeover-2 main agent"
  target: "PR #440 restructure delta (de49f503c -> a0b904b42): backlog-out/remediation-rows-in + M1 scope-narrowing + census addendum; delta review by dsh-opencode-go/deepseek-v4.1-flash"
  risk: R2
  tier: R2
  model: "dsh-opencode-go/deepseek-v4.1-flash"
  independence: "fresh session; verified backlog blob byte-identical to master, generator --check OK, gate substance unchanged, all four residuals homed; found the PR body understated the M1 narrowing (fixed in body) + two cosmetic LOWs (both adopted in a0b904b4)"
  rounds_used: 1
  max_rounds: 3
  estimated_cost: null
  actual_cost: null
  budget_status: unknown
  result: "通过 (delta); report tracked as review-routing-20261028/R440delta-og.md inside #440"
```
