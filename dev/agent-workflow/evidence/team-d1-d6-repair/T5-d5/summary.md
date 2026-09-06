# T5 D5 instance contract evidence

- Task: T5 / D5 instanceId contract alignment
- Model route: qiyuan-self/qwen3.8-27b
- Branch/worktree: task/team-d5-instance-contract / .worktrees/team-d5-instance-contract
- Contract confirmed: provider-owned deterministic allocation from `(rootSessionId, source, requestToken)`.
- Same token replay: same operation identity and instanceId.
- Different tokens: distinct instanceIds.
- Same-template parallel: three distinct allocations.
- `inst-leader`: reserved and never allocated by member activation.
- Custom `instanceId`: absent from `team_create_member` closed schema (`additionalProperties: false`).

## Tests

`pnpm exec vitest run packages/runtime/test/d5-instance-contract.test.ts` — 5/5 passed.
`git diff --check` — passed.

## Scope

No production implementation was needed: existing activation identity/provider/types already implement the frozen contract. No `team_create_member.instanceId`, identity algorithm, or journal schema changes.
