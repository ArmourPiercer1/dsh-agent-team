# PR #405 Security Review (head `ef348f7c3`)

## Verdict

**PASS-WITH-FINDINGS** (do not merge as-is). The core timed-pending and answer-as-data controls are reasonably evidenced, but `present` retains the exact check-then-use race that the review brief calls out: it validates identity with `realpathSync`/`resolveAnchoredPath`, then re-opens the path separately. `O_NOFOLLOW` on the later open prevents a final symlink, but does not prove that the opened fd is the same object checked by the earlier path resolution. This is a path substitution/TOCTOU gap.

## Hosted state

Command: `gh pr view 405 --json headRefOid,statusCheckRollup`

Verbatim tail: `"headRefOid":"ef348f7c3387da96bbd0657cb97875f2263ab58b","statusCheckRollup":[... candidate-protection SUCCESS ... census-runtime SUCCESS ... ci-required SUCCESS ...]`.

## Attacks driven / answers

| Attack | Answer |
|---|---|
| Swap presented file to symlink after anchor/lstat and before read | **FAIL (finding F-405-1)**. There is no same-fd read/open law. `resolveAnchoredPath` and `realpathSync(rootDir)` occur before `probe(entry.path)`, which calls a new path-based `openSync`; a rename/swap can occur between these operations. `O_NOFOLLOW` rejects a symlink at the final path, but cannot bind the open to the earlier resolved object and does not protect ancestor replacement/race. |
| Directory/FIFO/device at presented path | **PASS in implementation shape**. `probe` uses `fstatSync(fd)` and rejects `!st.isFile()`. FIFO/device is not accepted; fd is closed. |
| Oversized file | **PARTIAL / disclosed**. `present` does not read bytes and therefore has no byte-size cap; it only reports `st.size` to an observation line. This may be intentional reference-only semantics, but no explicit maximum/oversize refusal is implemented or tested. |
| Timed expiry | **PASS**. `ask-executor` checks `result.pending === true` first and drops any accompanying answers, returning typed pending with `callId` and verbatim notice. Mutation-2 evidence says merging answers turns the test RED. |
| Answer containing instruction-like text | **PASS in reviewed code**. `toModelAnswers` copies answer fields into data; no grant/policy/tool surface is mutated from answer content. |
| Two concurrent in-flight asks / replay | **PASS in implementation shape**. Per-token ledgers reject in-flight replay and settled replay reaches PA with an aborted signal; C1 evidence claims both. |
| Host `additionalProperties:true` deviation | **SAFETY STRENGTHENING / compatibility finding F-405-2 (LOW)**. Closed parsing rejects host-accepted extra fields; this is not a privilege widening, but it is a functional regression for callers relying on host permissiveness and needs explicit compatibility acceptance. |
| Optional `turn` | **NOT PROVEN / compatibility finding F-405-3 (MEDIUM)**. `present` accepts a receipt without `turn` and returns no `turn`; the PR says host requires it but treats it optional. This changes a host contract field and may break deliverable correlation. Either reject missing turn or document the trusted mount's weaker contract and test callers. |
| Governed-absolute paths | **PARTIAL**. The row intentionally anchors to `rootDir` and rejects escapes, but this is a semantic restriction relative to host callers that may pass governed absolute paths outside the mount root. Compatibility impact is disclosed but not independently justified. |
| Unique timed question IDs | **PASS / host-faithful**. Enforced only when timed variant is selected; legacy path does not invent the timed rule. |
| Positive live UI delivery | **CORRECTLY DISCLOSED**. No trusted mount injects a UI `present`/timed answer port; PR does not claim positive hosted delivery. |
| Declared == requested effect sets | **PASS by code inspection / C1 claim**. `ask` requests tool-invoke + domain-ref; `present` requests tool-invoke + domain-ref + one read per file, matching contribution targets/kinds. Mutation controls cover anchor and pending laws, but not the read/open race. |
| Authority handle reachable from capability object | **PASS by inspection**. Contribution is data-only, obligations are `kernel`, and the injected port is an interaction face, not a grant/control handle. |

## Per-check results

| Check | Result | Command / verbatim tail |
|---|---|---|
| Zero diff protected center files | VERIFIED from PR changed-file list | PR body states zero `team-tool-plane.mjs`, `family-assembly.mjs`, approval binder, and ARC-A protected paths. |
| Declared/requested per row | VERIFIED by source inspection | `ui-family-contribution.mjs` declares `['read','domain-ref']`; executor constructs the corresponding arms; C1 E-1/E-2/E-3 is claimed. |
| Refusal arms typed + zero effect | VERIFIED for tested front/port/pending arms; not complete for race | PR README reports zero port calls/consumption for refusal arms and mutation evidence. |
| No raw census captures tracked | COULD-NOT-VERIFY from frozen head in this environment | No successful `git ls-tree` command was available in the review worktree. |
| C2 records schema (`overall`, `finishedAt`, `bindings.authority`) | COULD-NOT-VERIFY completely | README reports `overall=PASS 7/7`; full record schema audit was not completed. |
| Hosted current head | VERIFIED | `gh pr view 405 ...` → head `ef348f7c3...`; all listed checks SUCCESS. |
| Live positive arms disclosed | VERIFIED | PR-BODY explicitly marks timed positive and live present positive DISCLOSED; no trusted UI port is claimed. |

## Findings

### F-405-1 — HIGH: `present` has check-then-open TOCTOU and does not use one verified fd

**Location:** `packages/tools/ui-family/src/present-executor.mjs:226-260`.

The sequence is: `realpathSync(rootDir)`; `resolveAnchoredPath(rootDir, entry.path)`; then `probe(entry.path)`, where `probe` calls `openSync(path, O_RDONLY|O_NOFOLLOW)` and `fstatSync(fd)`. The earlier identity check is path-based and the later probe re-resolves the path. An attacker can replace/rename the target or an ancestor between the checks. `O_NOFOLLOW` only rejects a symlink at the final component at the instant of open; it does not prove the fd is the object validated by `resolveAnchoredPath`, nor protect an ancestor directory swap. The user explicitly required “open with O_NOFOLLOW and read from the same fd (fs-family image-read-port/verifyOpenedHandle law)”; this implementation does not do that.

**Required fix/evidence:** open the anchored target once with `O_NOFOLLOW`, immediately `fstat` the fd, verify containment/identity from that fd (and ancestor handles where required), and pass/use that same fd for the publication/read verification; or reuse the fs-family verified-open-handle public law. Add a deterministic swap-after-check test that would contact an outside file under the current code and goes RED before the fix.

### F-405-2 — LOW: closed-world argument parser is a host compatibility regression

**Location:** `packages/tools/ui-family/src/ui-mechanics.mjs` parser functions.

The governed rows reject unknown top-level/question/option keys while the pinned host schema allows `additionalProperties: true`. This is safer for the governed surface, but it is a functional regression for legitimate host callers and should not be silently treated as “same meaning”; the PR only discloses it. If intentional, obtain/record a compatibility decision and ensure the mount contract advertises the stricter schema.

### F-405-3 — MEDIUM: `present` silently accepts a missing `turn` receipt despite host requiring it

**Location:** `packages/tools/ui-family/src/present-executor.mjs:259-269`, `packages/tools/ui-family/src/ui-interaction-port.mjs`.

The port contract declares `turn?`; executor adds `turn` only when `Number.isSafeInteger(receipt?.turn)`. The PR itself says host `turn` is required but governed `turn` is optional. A mount can therefore report successful publication without the durable correlation fact expected by the host, causing a caller to lose the deliverable's turn identity. Fail closed on missing/invalid turn for host-backed mounts, or explicitly split the weaker injected-port contract and prove all consumers tolerate no turn.

## COULD-NOT-VERIFY

- I did not boot a Host or touch `:3080` (per review rules); C2 claims were read rather than independently reproduced.
- I did not independently rerun the C1 suites or produce the race with a live concurrent file swap.
- Full C2 record field audits and raw-census tree checks were not completed because the dedicated worktree lacked the PR trees and the sandbox rejected some shell operations.
