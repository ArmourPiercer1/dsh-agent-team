# PR #413 Security Review (r1)

- PR: #413 `feat(agent-state): production durable store port — real positive arms on the Host`
- Reviewed head: `53e292b56523486dc3f6aa8273b46ca452849cd5`
- Base: `origin/master` (`8a3d50a40f970c7615370240f183c30767c4c8ff`)
- Verdict: **BLOCKED**
- Merge recommendation: **NO**

## Summary

The durable store passes the supplied C1 tests and the real-Host C2 evidence is internally consistent, but the implementation has a merge-blocking containment defect: directory realpath containment is cached after the first access. An attacker who swaps the already-validated `scopes` directory for a symlink after initialization can cause a subsequent write to land outside the sanctioned DSH_HOME/store root. This directly violates the production store's primary security invariant and the requested post-build symlink-swap attack.

A second independent integrity defect exists: CAS is not serialized or atomically coupled to the record replacement. Two store instances can both read the same revision and both successfully commit, producing lost updates despite identical `expectedRevision` values.

## Attack table

| Attack | Expected | Observed |
|---|---|---|
| DSH_HOME absent / blank | Typed home refusal; no default | PASS: `AGENT_STATE_STORE_HOME_MISSING`; C1 H1 and direct probe |
| DSH_HOME relative / missing | Typed home refusal | PASS: `AGENT_STATE_STORE_HOME_INVALID`; C1 H1 and direct probe |
| DSH_HOME equal to fake operator `.dsh` | Typed refusal | PASS: C1 H2/H3; `resolveAgentStateHome` realpaths candidate and operator home |
| DSH_HOME symlink into fake operator `.dsh` | Typed refusal | PASS: C1 H2 |
| DSH_HOME under `.dsh` / trailing or dot spelling | Refuse live home | PASS for existing resolved targets in tested lane; resolution uses realpath for candidate and operator home/live `.dsh` |
| Case-only live-home collision on case-insensitive filesystem | Typed refusal | COULD-NOT-VERIFY on this Linux filesystem; no explicit case-fold comparison is present |
| Realm id empty, `.`, `..`, separators, traversal | Typed realm refusal | PASS: C1 H4; closed single-segment regex |
| Root containment before first write; subtree symlink escape | Typed path refusal, zero outside write | PASS initially: C1 H5 rejects `team-state` symlink outside home |
| Swap `scopes` component after first successful access | Next write must re-check and refuse | **FAIL (critical):** `ensureDirs()` returns early once `dirReady` is true (`fs-state-store.mjs:390-401`). Scratch repro replaced `<root>/scopes` with a symlink to an outside directory; the next `seedGoal()` succeeded and created the hashed record in the outside directory. This is an actual outside-store write. |
| Exact scope bytes; whitespace/case-distinct agent ids | Distinct files and records | PASS: C1 S1 and S2; filename is SHA-256 of exact `agent:<id>` bytes and key is rechecked |
| Planted record with foreign embedded key | Typed corruption refusal | PASS: C1 B3 and `readState` key equality check (`fs-state-store.mjs:419-425`) |
| Temp file placement and symlink planting | Same-directory `O_EXCL` temp; planted symlink cannot redirect | PASS by inspection: same directory, `O_CREAT|O_EXCL`, mode 0600 (`fs-state-store.mjs:235-253`); no dedicated planted-temp test found |
| Crash between temp write and rename | Previous record remains intact; apply id reusable | PASS: C1 C1 and mutation control C2; temp + fsync + rename path works |
| Replay marker after restart | Marker consumed before commit; replay refused after restart | PASS by inspection/C1 R3: marker is exclusive-created and fsynced before record write (`fs-state-store.mjs:448-461`); marker survives fresh store instance |
| CAS under concurrent callers | One winner; stale caller refused | **FAIL:** two independent stores both read revision 1 and both returned `{ok:true}` for expectedRevision 1. Final record reflected one winner while both writes were audited. No lock/transaction/compare-at-rename exists. |
| Read symlink / hardlink alias | `O_NOFOLLOW`, same-FD fstat/read, typed refusal | PASS: `safeReadRecord` opens with `O_NOFOLLOW`, fstats same descriptor, requires regular file and `nlink===1`; C1 K1/K2. Local TODO(#409) is behaviorally equivalent for tested hardlink aliases, but not shared helper parity |
| 256 KiB bound on write and read | Typed refusal before rename and on same-FD read | PASS: C1 B1/B2; size checked before atomic rename and by `safeReadRecord` |
| Many scopes / file-count cap | Assess disk-exhaustion exposure | FINDING/LOW: no per-realm file-count or aggregate quota. A model-driven caller can create unbounded scope/marker/ledger files, subject only to filesystem capacity. This is availability risk, not a demonstrated scope escape |
| get_goal requested set | Exactly `['meta','tool-invoke']`, no mutation kind | PASS: contribution and executor both use `['tool-invoke','meta:goal']`; C1 G1/E1/E2 and mutation control |
| Mutation control for dropped get_goal arm | RED | PASS: `mutation-control-get-goal-tool-invoke.txt`; C1 G1/E1/E2 go red when arm removed |
| Closed plane envelope | Every return path `{text}` only | PASS: `refused` and `accepted` return only text; C1 O1 and C2 boot 4 |
| C2 boot 4 schema/authority/team SHA | u5-run-record/1, overall PASS 10/10, authority binding, team SHA includes arm fix | PASS: `c2/run-ast4.json` has schema `u5-run-record/1`, `overall: PASS`, authority pointer/snapshot bindings, teamSha `eee67dafd…`, and all selected cases PASS |
| C2 home isolation | Facts read under `tests/homes/`; no `~/.dsh` touch | PASS by supplied run/evidence: `homeUnderTestsHomes=true`, host log uses port 3183, and no stable `:3080` operation is recorded. No live host was booted during this review |
| Acceptance ledger | Five tools cite PASS run-ast4 cases | PASS: `node scripts/eb3-tool-acceptance.mjs` exits 0; ledger rows cite `c2/run-ast4.json` |
| Protected paths / hosted checks | Zero diff to protected center files; checks green | PASS: no diff to `team-tool-plane.mjs`, `family-assembly.mjs`, or `agent-bindings.mjs`; PR checks reported SUCCESS (candidate-protection, census-runtime, pr-gate, ci-fast/integration/security/full/required) |

## Findings

### F-1 — CRITICAL — Root containment is not revalidated after initialization

**File:** `packages/tools/agent-state-family/src/fs-state-store.mjs:390-401` (PR tree)

`ensureDirs()` creates and realpath-checks `rootDir`, `scopeDir`, `markerDir`, and `ledgerDir` only while `dirReady` is false. It then sets `dirReady = true`; every later read/write skips all realpath checks. The store therefore does not satisfy the requirement that containment be proven before every write.

Reproduction performed under a scratch directory (not `~/.dsh` and not `:3080`):

1. Create a store under `<scratch>/home/team-state/agent-state/r`.
2. Perform an initial successful write, causing `dirReady=true`.
3. Remove `<root>/scopes` and replace it with a symlink to `<scratch>/outside`.
4. Call `seedGoal()` again.
5. The call succeeds and writes `<outside>/<sha256(agent:a)>.json`.

This is a direct write outside the store root and is a merge blocker. Fix must revalidate the directory chain on every operation (and avoid TOCTOU-sensitive path traversal, ideally using directory FDs/openat-style primitives or equivalent component-safe operations).

### F-2 — HIGH — CAS is vulnerable to concurrent lost updates

**File:** `packages/tools/agent-state-family/src/fs-state-store.mjs:428-446`, `499-538`

The operation consumes a distinct apply marker, reads the current record, checks `expectedRevision`, and later replaces the record by rename. There is no per-scope lock, compare-and-swap primitive, or serialized critical section spanning read/check/rename. Two independent store instances can both observe revision N and both commit revision N+1 with different payloads; both return success and both append durable write audit entries, while one update is silently lost.

This breaks the durable state/CAS contract and can produce incorrect goal/todo state under concurrent governed calls. The fix must serialize the scope's read/check/commit sequence or add an atomic generation check that cannot be bypassed by separate processes.

### F-3 — LOW — Unbounded per-realm file count / aggregate disk usage

**File:** `packages/tools/agent-state-family/src/fs-state-store.mjs:448-479`, `495-610`

The 256 KiB bound is per scope, but there is no cap on scope records, replay markers, or ledger growth. A model-driven caller can cause unbounded file creation and disk consumption. This is an availability concern and not the reason for the blocking verdict; a bounded aggregate/per-realm quota or explicit operational mitigation should be considered.

## COULD-NOT-VERIFY

- Case-insensitive path comparison could not be exercised on the Linux review filesystem. The code realpaths both the candidate and operator home, but `sameOrUnder` is byte/case-sensitive and has no explicit case-folding. A case-insensitive filesystem test remains required before claiming that exact attack is covered.
- A live Host was intentionally not booted during this security review, per instruction. C2 boot 4 and hosted check conclusions above are based on committed evidence and check metadata.
- No dedicated temp-name symlink-plant race test was found; the `O_EXCL` same-directory construction is safe against pre-planting the exact generated name, but the timestamp/PID name remains predictable enough that a stress/race test would be useful.
- `hardlinkAliasVerdict` from #409 was not available on this branch. The local `nlink !== 1` check is conservative for the tested alias case, but helper parity and future semantics were not verified.

## Evidence and commands

- Focused tests: `pnpm exec vitest run packages/runtime/test/u7-agentstate-fs-store-c1.test.ts packages/runtime/test/u7-f-agentb-agent-state-c1.test.ts` → **81 passed**.
- Acceptance: `node scripts/eb3-tool-acceptance.mjs` → **pass**.
- PR head: `53e292b56523486dc3f6aa8273b46ca452849cd5`.
- C2 evidence: `dev/agent-workflow/evidence/u7-agentstate-store-20261027/c2/run-ast4.json` → overall PASS.
