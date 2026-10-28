# PR #406 Security Review (U7-F agent-control)

- **Branch / head:** `task/u7-406-review-20261026` @ `c0f1e6c90`
- **Verdict:** **PASS-WITH-FINDINGS**
- **Reviewer:** independent adversarial review; no Host boot performed by this review.

## Hosted checks

`gh pr view 406 --json headRefOid,statusCheckRollup` returned head `c0f1e6c90a999483cea175298f68b834bab10009`; all reported checks were `SUCCESS` (candidate-protection, census-runtime, pr-gate, ci-fast, ci-integration, ci-security, ci-full, ci-required, synthesize-merge-tree).

## Security attempts

| Attempt | Row / path | Expected | Observed | Result |
|---|---|---|---|---|
| caller lacks provider | `subagent` | typed amplification refusal, zero spawn | C1 AC-24: `agent-control-amplification-refused`; fake `spawnChild` 0; PA audit 0 | VERIFIED |
| caller not continuable | `subagent` | refusal, zero spawn | C1 AC-25: amplification refusal; fake calls 0 | VERIFIED |
| missing caller authority | `subagent` | fail closed, zero spawn | C1 AC-26 and C2 `ac:spawn-failclosed`: refusal; zero Control rows/spawn | VERIFIED |
| caller lacks tool / wider tool scope | `subagent` and workflow delegate | refusal, zero spawn | **NOT TESTABLE through the public `subagent` grammar**: it has no `tools` field; workflow only has an in-memory fake-driver test. Production resolver also strips any provider/model/run-in-background fields before host dispatch (see finding F-1). | FALSE / finding |
| native/plane alias (`bash` vs `team_bash`) | spawn authority | refusal, zero spawn | No adversarial test or runtime canonicalization found; `authorityBounded` compares literal strings only. | COULD-NOT-VERIFY / finding candidate |
| omitted tool list | spawn | narrowed caller must not inherit wider surface | No production positive path; omitted is not represented in `subagent` grammar and host resolver does not forward authority/tool fields. | COULD-NOT-VERIFY |
| forbidden model/provider | `subagent` | refusal, zero spawn | C1 AC-24 provider and AC-26 missing snapshot pass; literal model case not separately tested. | PARTIAL |
| workflow back door | `workflow` delegate | every spawn rechecks caller authority | C1 AC-27: forbidden provider delegate refusal, zero `spawnChild`; implementation has `authorityBounded` + `workflowEffectWorld` on delegate | VERIFIED (fake only; production leg unwired at pin) |
| fork inherits grants | `subagent_fork` | context is data, no grants | C1 AC-13 positive context marker; AC-28 tainted context refuses, zero fork | VERIFIED |
| foreign scope | `send_message`, `interrupt_agent` | typed refusal, zero reach/Control | C1 AC-20/21 and C2 `ac:interrupt-foreign-zero` pass | VERIFIED |
| off-roster bare target | steering rows | typed refusal, zero reach | C1 AC-22 pass | VERIFIED |
| no roster | steering rows | fail closed | C1 AC-23 pass | VERIFIED |
| case/whitespace target | steering rows | no accidental membership/reach | No dedicated test. `scopeMembership` uses exact `includes`; `classifyTargetScope` does not normalize, so ordinary variants reject unless an identically variant id exists in trusted roster. | COULD-NOT-VERIFY |
| reparented/archived id | steering rows | foreign/refused, zero reach | No durable reparent/archive state is modeled in this family; only injected static roster is checked. | COULD-NOT-VERIFY / finding candidate |
| sibling same-team id | steering rows | subtree owner fence (if that is claim) | No sibling/subtree model; static `scopeFence.members` defines scope. Same-team membership is accepted if present. | COULD-NOT-VERIFY |
| consumed grant replay | `subagent` | second call refuses, one spawn | C1 AC-32/43 pass; mutation-control MUT-4 goes RED when ledger removed | VERIFIED |

## Per-check verdicts and command tails

### Zero plane / center
**VERIFIED.** Command:

```text
git diff --quiet origin/master...HEAD -- packages/runtime/src/plugin/live/team-tool-plane.mjs packages/runtime/src/plugin/live/family-assembly.mjs packages/runtime/src/plugin/live/approval-entry-binder.mjs; echo zero-plane:$?
```

Verbatim tail: `zero-plane:0`. `git diff --numstat ... arc-a-protected-center.json` produced no output.

### Read vs mutation effect split
**VERIFIED (C1; mutation controls).** Command:

```text
pnpm exec vitest run packages/runtime/test/u7-f-agent-control-c1.test.ts --reporter=dot
```

Verbatim tail:

```text
Test Files  1 passed (1)
Tests  33 passed (33)
```

The direct-arm tests AC-40/41 assert enumeration sets are exactly `meta + tool-invoke` and no `domain-ref`; AC-42 asserts mutation rows carry `domain-ref(dsh-agent-runtime)`. `mutation-control.log` shows MUT-5 (adding domain-ref to enumeration) RED: `AC-40 ... failed`.

### Declared == requested
**PARTIAL / NOT SUFFICIENTLY PINNED.** Contribution declares broad kinds `['tool-invoke','meta','domain-ref']`; C1 pins row shapes, but no mutation control removes one requested arm from each mutation row and proves the corresponding security test fails. The existing mutation log only records MUT-5 for enumeration and does not demonstrate the requested-arm drop control for all five mutation rows. This is the PR #404 failure class risk.

### No amplification
**PARTIAL; production gap is a finding.** C1 fake tests cover provider, continuability, absent authority and workflow provider. However, `agent-control-executor.mjs` accepts provider/model in its `subagent` grammar, while `agent-runtime-port.mjs` production `spawnChild` forwards only `name`, `description`, `prompt`, `context`, and `signal` (lines 166-172); it silently drops `provider`, `model`, `reasoning_effort`, and `run_in_background`. A caller narrowed to an allowed provider/model can therefore reach the host's default route rather than the caller-bounded route. Since the host default may be wider, this is an unproven privilege-amplification boundary and potentially an actual amplification. The injected fake path does not reproduce the production resolver.

### Owner fence
**VERIFIED for foreign/off-roster/no-roster static roster cases; NOT VERIFIED for lifecycle boundaries.** C1 and C2 prove zero port/Control reach for foreign and off-roster targets. No reparent/archive/sibling-subtree semantics are implemented or tested; the effective scope is the injected `scopeFence.members` list.

### One-shot grant
**VERIFIED.** AC-32/43 and MUT-4 prove replay is red when the ledger is removed; a consumed correlation is not reused.

### Booking controls / lane edges
**VERIFIED.** `booking-controls.txt` records both negative controls: unbooked consumer finding and booked-but-missing consumer finding, then restored clean run. The lane edge is exact and limited to `node:*`, `packages/contracts/src/*`, and `packages/domain/tool-governance/src/*`; no wildcard into another family.

### C2 honesty
**VERIFIED as honest disclosure, not product completeness.** `c2/budget-ledger.jsonl` contains five boots while `boot-budget.md` declares 3 and records boot 4 as an over-budget fix round and boot 5 as the absolute cap. The records include `overall` and `finishedAt`; `run-u7fa5.json` includes `bindings.authority`. C2 teamSha is `0ea0848acd22b5c2a78f1219781c844b89164531`, ten commits behind reviewed head; therefore C2 is not a same-head verdict. The production positive enumeration path is **not delivered** at this pin: `C2-VERDICTS.md` and run record say `list_agents` is `agent-runtime-leg-unwired`; spawn is a designed fail-closed refusal because no caller authority snapshot is wired. The PR correctly records these as REFUSED, but its positive matrix cells must remain NOT_VERIFIED/DISCLOSED rather than PASS.

### Hosted
**VERIFIED.** All current-head checks were SUCCESS as listed above.

## Findings

### F-1 — HIGH — production spawn silently drops caller-bounded route/lifetime fields

**File:** `packages/tools/agent-control-family/src/agent-runtime-port.mjs:160-172`.

The family checks provider/model/continuability in `authorityBounded`, but the production `spawnChild` adapter does not forward `provider`, `model`, `reasoning_effort`, or `run_in_background` to `agentTeams.spawnTeammate`. Thus a request that is allowed only for a specific provider/model/lifetime is dispatched without those bounds and can inherit the host's broader defaults. The fake C1 port forwards the full spec, so current tests cannot detect this production-only widening. Fix by forwarding the bounded fields (or refusing when the public host face cannot express them), and add a resolver-level test with a narrowed caller authority and a recording `agentTeams` service.

### F-2 — MEDIUM — declared-vs-requested arm control is incomplete

**Files:** `packages/tools/agent-control-family/src/agent-control-contribution.mjs:181-190`; `packages/runtime/test/u7-f-agent-control-c1.test.ts:513-571`.

The contribution declares all three effect kinds globally, while tests only prove the enumeration negative and a positive shape. There is no mutation-control that removes one requested arm for each mutation row and requires RED. A regression can therefore make a mutation row request fewer than its declared effect set without the same per-row declared==requested invariant being pinned.

### F-3 — MEDIUM — owner-fence lifecycle semantics are not implemented/proven

**Files:** `packages/tools/agent-control-family/src/agent-control-mechanics.mjs:202-224`; `packages/tools/families/agent-control.mjs:77-88`.

The fence is only a static `scopeFence.members` snapshot. There is no reparent/archive/lease-generation check, and no sibling-versus-subtree policy is encoded. The requested boundary cases therefore cannot be judged from this implementation; a stale member id could remain steerable after ownership changes unless the injected roster is refreshed and trusted at every call.

## COULD-NOT-VERIFY

- Production positive `list_agents`, positive spawn, and production workflow/fork paths are not available at the pinned host; the C2 records explicitly say `agent-runtime-leg-unwired` and no caller-authority snapshot is wired.
- Tool-surface resource/scope narrowing and alias canonicalization are not expressible/covered by the `subagent` row grammar or production resolver.
- Reparented/archived and sibling-subtree ownership semantics are absent from the test/port contract.
- C2 is bound to a team SHA ten commits behind reviewed head.

## Review conclusion

Do not merge as-is because F-1 is a real production-only authority-boundary defect. After route/lifetime forwarding-or-explicit-refusal, same-head C2, and mutation-arm controls are added, re-review the lifecycle fence semantics. Current recommendation: **PASS-WITH-FINDINGS** (hosted checks green, but security-sensitive production amplification is not proven and likely widenable).
