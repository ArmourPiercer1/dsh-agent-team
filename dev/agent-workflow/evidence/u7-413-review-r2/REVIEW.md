# PR #413 Security Review — Round 2

- Head reviewed: `5ab9142bc7a672686a38aaaff0f7cbac3958bbf2` (frozen `origin/task/u7-agentstate-store-20261027`)
- Fix commit inspected: `e319513fa6a63df5012671de39313f95f19ad25b`
- Reviewer: independent adversarial review, round 2
- **Verdict: BLOCKED**
- **Merge recommendation: NO**

## Executive verdict

The round-1 containment and ordinary CAS findings are fixed in the tested Linux path, but the stale-owner policy introduces a new HIGH security/integrity finding. A live writer can be declared stale solely by age while it is still in the read-to-commit critical section. A second instance then breaks the lock and commits at the same expected revision. My reproduction produced **two successful commits** and two `writes.jsonl` entries for one expected revision. The first writer subsequently overwrote the second writer's record. This violates the stated B-2 invariant and is a merge blocker.

## Round-1 findings

| Finding | Status | Reproduction / evidence |
|---|---|---|
| F-1 CRITICAL: replacing `scopes` allowed an outside write | **FIXED on Linux** | After a first write, renamed `scopes` and replaced it with a symlink to an outside directory. The next `applyGoal` returned typed `AGENT_STATE_STORE_PATH_REFUSED`; outside directory remained empty. `openStoreDir` opens each component with `O_DIRECTORY|O_NOFOLLOW` through `/proc/self/fd/<fd>/<segment>` and all mutation paths use the returned pinned descriptor view. |
| F-2 HIGH: two store instances both passed CAS | **FIXED absent stale takeover** | Two independent instances raced the same scope at expectedRevision=1; normal run returned exactly one `{ok:true}` and one `GOAL_STALE_REVISION`, and `writes.jsonl` gained one line. The stale-owner attack below reopens the invariant. |
| F-3 LOW: unbounded scope files | **FIXED** | Code enforces `maxScopes` (default 1024) while holding `_realm.lock`; `AGENT_STATE_STORE_SCOPE_LIMIT` is typed and occurs before the new record write. C1 evidence claims cap and concurrent creator coverage. |

## New finding

### F-4 HIGH — age-only stale lock breaking permits concurrent live commits

**Location:** [fs-state-store.mjs](../../../../packages/tools/agent-state-family/src/fs-state-store.mjs):433–449, especially the `Date.now() - holder.at > staleMs` branch at line 435.

`acquireLock` treats a lock as stale when either the recorded PID is dead **or the lock age exceeds `staleMs`**. The timestamp is written once at lock creation and is not renewed. A live process can legitimately spend longer than `lockStaleMs` in the read→CAS→commit interval (slow filesystem, fsync, scheduler pause, fault injection, or normal load). A second process then rename-breaks the live lock and commits concurrently.

Reproduction (real production module, two independent stores):

1. Seed `agent:x` at goal revision 1.
2. Store A uses `lockStaleMs=50` and a `recordWriter` that pauses 1000ms while A owns the scope lock, after A has read revision 1 and before its commit completes.
3. Store B uses the same root, also expects revision 1, and starts after 150ms.
4. B sees A's lock older than 50ms, renames it aside, acquires a new lock, reads revision 1, and commits revision 3.
5. A resumes and commits revision 2.

Observed result:

```text
[
  { ok: true, snapshot: { goalId: 'g', revision: 2, phase: 'active' } },
  { ok: true, snapshot: { goalId: 'g', revision: 3, phase: 'active' } }
]
final record: goal revision 2, appliedIds: ["slow"]
writes.jsonl: one line for applyId "fast" and one line for applyId "slow"
```

Thus there were **two successful commits** for the same expected revision and two durable write-audit entries. The second commit was lost from the final record when the first writer completed. This is a direct violation of the claimed serialization/CAS guarantee, not merely a liveness concern. The stale-owner mechanism must not break an age-old lock without a protocol that proves the owner is no longer in its critical section (or without a lease/renewal protocol whose safety is proven).

Severity: **HIGH** (integrity/lost update; same class as F-2, directly exploitable by inducing a slow critical section or filesystem stall).

## Attack table

| Attack | Result | Bytes outside root / duplicate success |
|---|---|---|
| `scopes` → outside symlink after first write | Typed `AGENT_STATE_STORE_PATH_REFUSED` | Outside directory: 0 bytes |
| Realm directory replacement | Not independently rerun as a separate fixture; descriptor-chain implementation predicts typed refusal; see COULD-NOT-VERIFY | No outside write observed |
| Ancestor replacement between home and root | Not independently rerun as a separate fixture; pinned chain should refuse | No outside write observed |
| Swap between directory open and file open | Not independently rerun with a race helper; Linux `/proc/self/fd` paths are descriptor-relative for the opened directory | No outside write observed |
| Temp-directory replacement | Not independently rerun as a separate fixture; temp and target are resolved below the pinned directory fd | No outside write observed |
| Two instances, N=200 normal CAS races | A representative race returned one OK + one STALE; C1/round-1 evidence claims the repeated matrix passes | No duplicate success in normal path |
| Live lock older than `lockStaleMs` | **FAIL: two OK results**; final state lost the later commit; two `writes.jsonl` entries | **Two successful commits** |
| Dead lock holder | Code has PID-dead rename-aside path; not separately killed in this review | No outside write observed |
| Crash after commit before marker | C1 evidence and code order show record carries `applyId` before marker; replay checks record | No duplicate replay expected |
| Crash before commit | Code writes applyId only in atomic record rename; no rename means no witness, so grant is not consumed | No outside write observed |
| Scope cap overflow / creator race | Code holds realm lock while counting; C1 evidence claims typed overflow and race coverage | No extra scope write expected |
| Hardlink and symlink record | `safeReadRecord` opens `O_NOFOLLOW`, fstats same descriptor, rejects `nlink !== 1`; same semantic verdict as master law | No bytes read/written on refusal |
| `$DSH_HOME` absent / relative / missing | Typed `AGENT_STATE_STORE_HOME_MISSING` or `AGENT_STATE_STORE_HOME_INVALID` observed | No write |
| `$DSH_HOME` symlink to fake `~/.dsh` / beneath it | Code realpaths candidate and operator home, rejects equality/subtree; not independently rerun with a symlink fixture | No outside write expected |

## Containment implementation assessment

On Linux, the fixed implementation is genuinely descriptor-relative for directory traversal: `openStoreDir` opens the anchor and every component with `O_DIRECTORY|O_NOFOLLOW`, then opens the next component as `/proc/self/fd/<previous fd>/<segment>`. It returns `/proc/self/fd/<final fd>` and mutation operations construct temp/target/ledger/lock paths under that pinned descriptor view. This is not a check-then-reopen of the original home path on the Linux path. `safeReadRecord` also opens the final record with `O_NOFOLLOW`, fstats the descriptor, and reads that same descriptor.

The non-`/proc/self/fd` fallback (lines 283–300) is explicitly a residual check-to-use window: it performs `lstat`/`realpath`, then opens by path. That platform was not available in this review environment and remains a portability caveat rather than the observed Linux failure.

## Boot 5 / acceptance / protected surface

- `c2/run-ast5.json` parses as `u5-run-record/1`, `overall: PASS`, 10 cases, and `bindings.teamSha` is `e319513fa6a63df5012671de39313f95f19ad25b`; the fixed commit is therefore an ancestor of the binding.
- The acceptance command was run: `node scripts/eb3-tool-acceptance.mjs` passed (`tools=31`, `L4-proven=17`, `L4-disclosed=12`, `L4-unverified=2`).
- The ledger points to run-ast5 for the five-tool rows; run-ast4 is the superseded pre-fix boot and is not treated as evidence here.
- Protected files `team-tool-plane.mjs`, `family-assembly.mjs`, and `agent-bindings.mjs` showed zero diff against `origin/master`; the PR changed no protected center surface.

## COULD-NOT-VERIFY

- The requested dedicated N=200 two-process loop, all five independent containment swap fixtures, and a killed-PID lock-holder test were not completed as separate standalone scripts in this round. The representative normal race, symlink regression, and live stale-lock attack were executed directly against the production module.
- The clean output worktree is based on `origin/master` and lacks the generated package `.js` build artifacts required by the TypeScript test import graph; direct `node --test packages/runtime/test/u7-agentstate-fs-store-c1.test.ts` therefore failed with `ERR_MODULE_NOT_FOUND` before running tests. This does not change the direct production-module attack result or the committed C1/C2 evidence assessment.
- Hosted CI status was not queried from a remote provider in this environment.

## Final decision

**BLOCKED. Do not merge.** Fix F-4 first, then rerun the complete round-2 attack matrix and the 200-iteration CAS race. In particular, stale lock recovery must be safe against a live owner that remains inside read→CAS→commit; age alone is not a safe proof of ownership death.
