# A6-LEG-VALIDITY — the pending approval leg is the subject, not the owner lifecycle

Lane: `task/a6-leg-validity-20261112`, worktree `.worktrees/a6-leg-validity`, base `origin/master`
`0d74121ae` (2026-11-12, real UTC clock). Owner-approved fix. `CORE PATCH BUDGET = 0`: no upstream
DSH source and no `:3080` instance was touched.

## 1. Defect (measured twice on real Hosts)

`packages/runtime/alpha6/assigned-officer-facts.ts:444` (pre-fix):

```ts
if (owner.lifecycle !== 'RUNNING') return null
```

1. **JOINT_J10_RELAY=1**: a member whose FIRST turn is a human `member.send` relay asks for review;
   the durable member row reads `lifecycle: CREATED`; the facts port returns `null`; the assigned
   Officer's resolve is refused `CONTROL_RESOLVER_NOT_AUTHORIZED` ("the trusted review-facts port
   produced no facts for this leg"). Evidence:
   `dev/agent-workflow/evidence/joint-acceptance/joint-v2-final-relay/`.
2. **F-5 two-ask lane** (PR #723, `task/f5-two-asks-20261111`, `tests/kits/f5-two-asks/`): the same
   member, after finishing one work unit, asks a SECOND time; its row reads `SETTLED`; the Officer
   is refused again. The F-5 gate trace shows `owner-running` as the ONLY failing gate of 13.

The gate asked the wrong question: a member's transient lifecycle is not what makes an approval leg
valid.

## 2. The new law (implemented, with the comment block at the gate)

**The durable PENDING APPROVAL LEG is the subject of validity.** A leg is valid when the persisted
control row is still `pending`, belongs to this root/case/ordinal/kind/rung, was frozen under
exactly this parsed Blueprint (content hash + revision), has no current-leg transfer, routes to
exactly one Officer, and names a complete frozen operation identity (owner instance + template,
tool definition identity/owner/name, authority generation). The owner row then only has to
**identify** the member the leg was opened for.

- `CREATED` — member exists, has not taken its first turn yet (the relayed-first-turn ask). **Valid.**
- `RUNNING` — member is mid-turn. **Valid.**
- `SETTLED` — member finished a work unit and is idle (the second ask). **Valid.**

Still refused, all-or-nothing, `null` (typed refusal downstream): no pending leg; decided/abandoned
leg; root/case/ordinal/kind/rung mismatch; Blueprint hash/revision mismatch; transferred leg; zero or
multiple Officers; missing/changed authority generation; foreign root, different instance or
different template on the owner row; incomplete frozen tool triple; unknown or ABSENT lifecycle;
`ARCHIVED` (revoked) and `DISPOSED` (terminal). No widening.

Implementation:

| what | where |
| --- | --- |
| law comment block | `packages/runtime/alpha6/assigned-officer-facts.ts:301` |
| `LEG_OWNER_LIVE_LIFECYCLES = ['CREATED','RUNNING','SETTLED']` | `packages/runtime/alpha6/assigned-officer-facts.ts:341` |
| **the gate** | `packages/runtime/alpha6/assigned-officer-facts.ts:495` |
| module-header bullet updated | `packages/runtime/alpha6/assigned-officer-facts.ts:45-49` |
| new host-free test block (6 tests) | `packages/runtime/test/a6-assigned-officer-facts.test.ts:1099` |

The set is the same work-accepting set the control plane already uses at execution time
(`GUARD_LIVE_LIFECYCLES`, `control/service.ts:348`) and at admission
(`LIVE_CALLER_LIFECYCLES`, `admission/resolve.ts:63`): live = not revoked / not terminal, not
"currently executing".

## 3. Tests (host-free, in the existing facts-port suite)

`packages/runtime/test/a6-assigned-officer-facts.test.ts` — 31 tests total (25 pre-existing + 6 new),
all passing.

1. NEGATIVE CONTROL: CREATED / RUNNING / SETTLED each produce facts for a durably pending leg;
   ARCHIVED / DISPOSED / unknown / absent lifecycle each return `null`.
2. CREATED owner, end to end: leg opened while the row is `CREATED`, `resolveControl` by the
   assigned Officer → `allow` with `source: blueprint-officer` (defect 1 shape).
3. SETTLED owner, end to end: leg opened while the row is `SETTLED`, `resolveControl` → `allow`
   (defect 2 / F-5 shape).
4. ARCHIVED owner: port `null` **and** the control service refuses with
   `produced no facts for this leg` (typed, never a guess).
5. Identity mismatch: foreign `rootSessionId`, another `instanceId`, another `templateId` → `null`.
6. Missing leg, decided leg, wrong generation, missing generation → `null`.

### Negative control demonstration (measured)

With the old line temporarily restored (`if (owner.lifecycle !== 'RUNNING') return null`) and the
new law restored immediately after:

```
3 failed | 3 passed | 25 skipped (31)
FAIL ... NEGATIVE CONTROL for the old RUNNING-only gate
AssertionError: CREATED owner must own a valid pending leg: expected null not to be null
FAIL ... lets a CREATED owner own a valid leg end to end — defect 1
FAIL ... lets a SETTLED owner own a valid leg end to end — defect 2
```

Full transcript: `negative-control-old-gate-restored.log`. Post-restore run: 31/31 pass.

## 4. Gates run

| gate | result |
| --- | --- |
| `pnpm --filter @dsh-agent-team/runtime exec tsc -p tsconfig.json --noEmit` | **0** (pass) |
| `pnpm --filter @dsh-agent-team/runtime build` (dist mirror) | **0** (pass), dist re-staged |
| `node scripts/check-artifacts-committed.mjs` | **OK** — 2088 files, equivalence to index, including 113 glue placements |
| `npx vitest run packages/runtime/test/a6-assigned-officer-facts.test.ts` | **31/31 pass** |
| `npx vitest run packages/runtime/test` (full runtime package) | 508/510 files, 6275/6276 tests pass; two **environment** failures, see below |
| same suite excluding the two environment-bound files | **508/508 files, 6267/6267 tests pass, exit 0** |
| `node scripts/ci-pr-gate.mjs --only lint-identities` | **pass** (76 distinct identities, new 0, resolved 0) |
| Census booking | **not applicable**: no NEW file under `packages/**`; only edits to two already-counted files and their committed dist |
| ARC-A override | **not applicable**: `assigned-officer-facts.ts` is not one of the 33 protected-centre files |
| Blueprint fence | **not applicable**: no `v4`/`v5` schema-version site added |

The two full-suite failures are **not** this change:

1. `u7-f-agent-control-native-output-schema-c1.test.ts` — fails at import because the gitignored
   pristine checkout `tests/deepseek-harness-test-use` does not exist in this fresh worktree. It
   passes in the main checkout where that checkout is present.
2. `a5sf-os-runner.test.ts` — the Landlock enforcement expectation (`ENFORCEMENT_UNAVAILABLE`)
   observes `ok: true` on this host. Reproduced identically in the main checkout on the unmodified
   tree, so it is a host/environment state, not a regression.

`runtime-suite-excluding-two-env-dependent.log.gz` is the same full runtime suite with only those two
environment-bound files excluded.

## 5. Deliberately not done

- **The F-5 two-ask kit was not driven.** `tests/kits/f5-two-asks/run-f5-two-asks.mjs` boots a real
  Host (pinned 0.2.0-rc.2, fresh `DSH_HOME`, mock model + boot preflight) and does not exist on
  `origin/master` — it lives on the unmerged `task/f5-two-asks-20261111` (PR #723). Driving it means
  a full Host boot, a model endpoint, and merging that kit lane into this one; that belongs to the
  acceptance lane. The host-free end-to-end tests here reproduce the exact second-ask shape
  (`SETTLED` owner, pending leg, Officer allow) at the same seam the live refusal was measured on.
- **No durable approval semantics changed** beyond the described lifecycle→leg validity rule: no new
  row fields, no new state, no decision/consumption change.
