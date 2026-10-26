# U7-1 / EB2-C — OLD-RED CLOSURE

**Item:** `docs/plans/memo/unified-baseline-alpha5-20261025/execution-plan.md` §U7, bullet **EB2-C** —
“完成九包历史 9 红、Root 22 旧红归属/复现/退出；分离 T0～T4、C1/C2/C3；修复具名测试竞态而非删安全测试”
(complete the nine-package historical 9 reds and the 22 Root old reds: attribute, reproduce, exit; separate
T0–T4 and C1/C2/C3; FIX named test races rather than delete security tests).

**Lane:** `task/u7-1-old-red-closure-20261026`, worktree `.worktrees/u7-1`, base `origin/master`.
**Boots used: 0.** No DSH host was started; `:3080` and `~/.dsh` were never touched.
**Product source changed: none.** No file under `packages/**/src/**` or any other product path differs from
the base commit (`git diff --name-only <base>..HEAD -- 'packages/*/src/**'` is empty).
**Security tests deleted or weakened: none.** Every repaired leg keeps every assertion; three of the repaired
legs gained one (see §4).

---

## 1. The authoritative identity set — the true counts, and where they come from

The brief's “9 package + 22 root” is correct as **two records of one overlapping set**, not two disjoint sets:

| record | source (read at the base commit) | sha256 | identities |
|---|---|---|---|
| nine-package census tolerated set | `dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-2b1099d7.md` — the machine pointer in `scripts/ci-pr-gate.mjs` `BASELINES.census`; machine copy `nine-root-2b1099d7.ids.txt` | `f95ae921c23713e2bb1e236b49cbd61b40cbebebadbccc5861c29a70ea6d9ada` | **9** (all `TEST`, 0 collection) |
| “22 Root Suite old reds” (Alpha.4 collection) | `dev/agent-workflow/evidence/a4-pr0/baseline-closure/failing-identities-pr0-run2.txt` (relocated out of the tree by PR #366; restored from the content-addressed store, sha256 matches `RELOCATED-MANIFEST.tsv` byte-for-byte) | `ed20c7776692104d5a1d9309c65bc81c1b661f17da4c75636f3ecb23049a91e3` | **22** = 19 `TEST` + 3 `FILE …COLLECTION-OR-UNHANDLED`, across 9 files |
| classification ledger for those 22 (verdict + plane + dead-assertion tail) | `dev/agent-workflow/evidence/a4-pr7/baseline-classes/BASELINE-CLASSES.md` | `e95680f73fd98ad4411014610a62b56286df3ddf878617a760c335593cd14468` | 22 rows |
| the lineage document (per-identity retirement history) | `dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-2162f6a7.md` | `228895a06c3440e47dbae8b6418f91e565408a74c9ab07d806640f56ba0fa959` | — |
| EB0-2 audit (the record that keeps the two sets separate) | `dev/agent-workflow/evidence/EB-E0-E1/baseline-inventory.md:75-84` — “Red sets stay separate and are **not** merged anywhere” | tracked | — |
| U1-B reproduction + attribution run | `dev/agent-workflow/evidence/u1-closure-20261025/u1b/{SUMMARY.md,reds.json,vitest-run2.log}` — **untracked in the main checkout** (fresh worktrees do not materialize it; read from `/srv/workspace/dsh-plugins/dsh-agent-team/dev/...`) | `7c355edaa09b57c6c7c682fa00c3e7acd4048628fc31a93a3d87a38d63d4882f` / `9476d7e61a0f0a762fa7eef84ea3d17c27e337f84793155cbf236c0387d7cf7c` / `164710b17a6b6ad83ae525e628fb4ffceaa6f80eac96ee5846b5e48e3dbe6c3e` | 20 red identities in a 604-file run |

**The complete identity set this file accounts for is the 22** (`old-reds.json` carries all 22 rows). The 9 is
exactly the subset of the 22 that was still red when U1-B measured `origin/master` at `4aaaa7b2a`; U1-B's own
summary states it: “Now: 9/22 still failing (the 9 = the census-tolerated set); 13 no longer fail”.
No identity from either record is dropped here, and the 22-row table in §3 and §5 is the proof.

Two identities appear in the Alpha.4 **run1** capture and not in run2
(`…p6t1-parallel.test.ts > P6-T1 P1: N=2 same-template parallel activations both succeed` ×2:
`failing-identities-pr0-run1.txt`, sha256 `dd27f7bef6997dd5dd6b2290df133d0241eb20612e836dfd8ffaf9cfe2e50d3f`).
They are the disclosed **p6t1-parallel load family**, repaired by product fix `de18a7bc` (“the family was not
flaky. The product was racy”) and green on this tree (`✓ packages/runtime/test/p6t1-parallel.test.ts (12 tests)`,
family 0 red in 13 runs per BASELINE-CLASSES §1.1). They are recorded in `old-reds.json` under
`auxiliaryIdentities` so they cannot vanish from the record either.

**Tier and class vocabulary used below** (the separation EB2-C demands, taken from the cited documents, not invented):

- **T0–T4** = the five verification layers of `docs/plans/memo/engineering-baseline/architecture.md` §6.1
  (fetched at PR #361 head `b97ffdaf`): T0 static/contract, T1 package unit, T2 real assembly, T3 real host,
  T4 combined release.
- **C1/C2/C3** = `docs/glossary.md:19` / `docs/terminology.md:17` (C-EB-0009): C1 branch-local build/unit proof,
  C2 real assembly for a candidate, C3 release-section verification on a pinned source set.

Every one of the 22 is a **T1** leg (package unit over the real durable world or the real domain chain, mock only
at non-deterministic outer boundaries), evidenced at **C1** here (branch-local vitest on this candidate) — with
one exception, noted per row: the three collection-error files are T1 files whose *registration* was broken.

---

## 2. Reproduction on current `origin/master` (verbatim, before any repair)

Worktree `.worktrees/u7-1` @ `dbb1967b6` (the tip when the lane opened; fast-forwarded to `97bbc2563` before the
repair commits. The nine were red at **both** commits).

```bash
pnpm install --frozen-lockfile --store-dir .tmp-pnpm-store          # exit 0
pnpm exec vitest run --reporter=default --reporter=json \
  --outputFile.json=.artifacts/logs/root-run1.json                  # exit 1
```

```
 Test Files  6 failed | 620 passed (626)
      Tests  11 failed | 7925 passed (7936)
```

The 11 failures split as **9 historical** (this task's subject) + **2 environment blocks** (disclosed in §6, not
part of the historical set). The 9 historical, verbatim from `.artifacts/logs/root-run1.log`:

```
3049: FAIL  packages/domain/test/t2-blueprint-hash.test.ts > t2 hash: hashable projection > projects absent optional singles as explicit null
3050: AssertionError: expected { templateId: 'leader', …(6) } to deeply equal { templateId: 'leader', …(5) }
      - Expected  + Received
      @@ -1,6 +1,7 @@
       {
      +   "capabilities": null,
         "contextPolicy": null,
3074: FAIL  packages/runtime/test/p6t3-mediation.test.ts > P6-T3 member→member mediation (the documented rule, end to end) > 1. no grant → MEDIATED via the leader: input on the leader session, nothing on the peer session, the coordination fact keeps the intended recipient
3075: AssertionError: expected 'session-root-p6t1' to be 'session-child-p6t3-leader' // Object.is equality
3090: FAIL  … > 3. grants are PER-SENDER: worker2 holds no grant of its own (the grant on the other worker does not apply) → still mediated
3091: TypeError: Cannot read properties of undefined (reading 'sessionId')
3102: FAIL  … > 4. a newer overlay generation without the grant revokes it (latest generation wins, fail closed → mediated again)
3103: TypeError: Cannot read properties of undefined (reading 'sessionId')
3114: FAIL  … > 5. authority beats mediation: the scout envelope denies send-message, so the facade rejects it — zero writes, no coordination fact
3115: AssertionError: expected 4 to be 1 // Object.is equality
3133: FAIL  … > 7. the relay text + attribution carry the correlation and the intended-for identity (mediated and direct)
3134: TypeError: Cannot read properties of undefined (reading 'attribution')
3145: FAIL  packages/runtime/test/p6t3-restart.test.ts > P6-T3 restart durability + pending-delivery recovery > 2. the pending MEDIATED intent is recovered onto the LEADER session (the plan is re-derived from the fresh state)
3146: TypeError: Cannot read properties of undefined (reading 'sessionId')
3157: FAIL  … > 5. recovery aborts on the first hard failure (R5): earlier confirmations stay durable; the clean retry recovers ONLY the remainder
3158: Error: assertMessagingCode: expected MessagingError 'MESSAGING_DELIVERY_FAILED', got undefined
3219: FAIL  packages/tools/test/p6t6-actions.test.ts > P6-T6 tool set — delegated actions (unit level) > messaging: worker -> leader is delivered direct to the leader bound session
3220: AssertionError: expected 'session-root-p6t1' to be 'session-child-p6t2-leader' // Object.is equality
```

**The 13 that no longer reproduce** were verified green on the same run, by file, in
`.artifacts/logs/root-run1.log`:

```
 867: ✓ packages/runtime/test/p8s3b-result-effects.test.ts (17 tests) 35ms
1106: ✓ packages/domain/test/t1-capability-schema.test.ts (46 tests) 332ms
1556: ✓ packages/runtime/test/d3-member-identity-context.test.ts (6 tests) 20ms
2337: ✓ packages/runtime/test/t12a-glue-handoff-ports.test.ts (12 tests) 22ms
2848: ✓ packages/runtime/test/t12a-b2-child-identity.test.ts (4 tests) 12ms
```

Not declared fixed without a run: each of those five files is green in the artifact above, and the nine are red
in it. The two records agree with U1-B's independent measurement at `4aaaa7b2a`.

---

## 3. Attribution table — all 22, with exit

`EXIT`: **FIXED(pre)** = already repaired by an earlier, landed, named commit — green on this tree, reproduced green
here; **FIXED(u7-1)** = repaired by THIS lane, test code only, with a planted-wrong-value mutation control showing
the leg still fails (see §4); **STILL-RED** = none; **ENV_BLOCK** = none in the historical set (see §6 for the two
environment blocks that are *not* historical); **OBSOLETE** = none — no tested behaviour was removed for any of the 22.

| # | identity (`describe > test`, abridged) | file:line | tier / class | exit | owner |
|---|---|---|---|---|---|
| 1 | `T1: Blueprint Capability Schema > 1. Legacy fixture parses without capabilities field` | `packages/domain/test/t1-capability-schema.test.ts:430` | T1 / C1 | **FIXED(pre)** @ `94eeecf19` | Domain Owner |
| 2 | `… > 2. Leader with full capabilities parses and validates` | `…t1-capability-schema.test.ts:442` | T1 / C1 | **FIXED(pre)** @ `94eeecf19` | Domain Owner |
| 3 | `… > 3. Members can have different capabilities` | `…:458` | T1 / C1 | **FIXED(pre)** @ `94eeecf19` | Domain Owner |
| 4 | `… > 7. Changing capability fields changes the hash` | `…:581` | T1 / C1 | **FIXED(pre)** @ `94eeecf19` | Domain Owner |
| 5 | `… > 8. Static source returns selective mode for Leader with capabilities` | `…:652` | T1 / C1 | **FIXED(pre)** @ `94eeecf19` | Domain Owner |
| 6 | `… > 9. Static source returns selective mode for MemberTemplate with capabilities` | `…:670` | T1 / C1 | **FIXED(pre)** @ `94eeecf19` | Domain Owner |
| 7 | `… > 10. Static source returns legacy mode when capabilities absent` | `…:690` | T1 / C1 | **FIXED(pre)** @ `94eeecf19` | Domain Owner |
| 8 | `… > 11. Selective source maps to TemplatePolicy values correctly` | `…:702` | T1 / C1 | **FIXED(pre)** @ `94eeecf19` | Domain Owner |
| 9 | `… > 11b. Selective source maps deny entries to values correctly` | `…:721` | T1 / C1 | **FIXED(pre)** @ `94eeecf19` | Domain Owner |
| 10 | `t2 hash: hashable projection > projects absent optional singles as explicit null` | `packages/domain/test/t2-blueprint-hash.test.ts:108` (failing `:116`) | T1 / C1 | **FIXED(u7-1)** | Domain Owner |
| 11 | `D3 … > D3-4 FAIL CLOSED: wrong/missing rootSessionId stays rejected at the closed tool layer` | `packages/runtime/test/d3-member-identity-context.test.ts:469` | T1 / C1 | **FIXED(pre)** @ `b9cc0a2d0` (split out as `D3-4b`, `:502`, so the assertions run) | Runtime Owner |
| 12 | `P6-T3 member→member mediation … > 1. no grant → MEDIATED via the leader …` | `packages/runtime/test/p6t3-mediation.test.ts:344` | T1 / C1 | **FIXED(u7-1)** | Runtime/Messaging Owner |
| 13 | `… > 3. grants are PER-SENDER: worker2 holds no grant of its own → still mediated` | `…:411` | T1 / C1 | **FIXED(u7-1)** | Runtime/Messaging Owner |
| 14 | `… > 4. a newer overlay generation without the grant revokes it …` | `…:427` | T1 / C1 | **FIXED(u7-1)** | Runtime/Messaging Owner |
| 15 | `… > 5. authority beats mediation: the scout envelope denies send-message … zero writes` | `…:440` | T1 / C1 | **FIXED(u7-1)** | Runtime/Messaging Owner |
| 16 | `… > 7. the relay text + attribution carry the correlation and the intended-for identity` | `…:485` | T1 / C1 | **FIXED(u7-1)** | Runtime/Messaging Owner |
| 17 | `P6-T3 restart … > 2. the pending MEDIATED intent is recovered onto the LEADER session` | `packages/runtime/test/p6t3-restart.test.ts:409` | T1 / C1 | **FIXED(u7-1)** | Runtime/Messaging Owner |
| 18 | `… > 5. recovery aborts on the first hard failure (R5) …` | `…:463` (fault injected at `:196`) | T1 / C1 | **FIXED(u7-1)** | Runtime/Messaging Owner |
| 19 | `P6-T6 tool set — delegated actions (unit level) > messaging: worker -> leader is delivered direct to the leader bound session` | `packages/tools/test/p6t6-actions.test.ts:888` | T1 / C1 | **FIXED(u7-1)** | Tools Owner |
| 20 | `FILE packages/runtime/test/p8s3b-result-effects.test.ts::COLLECTION-OR-UNHANDLED` | file-level; 16 legs unmasked | T1 / C1 | **FIXED(pre)** @ `91087636e` | Runtime Owner |
| 21 | `FILE packages/runtime/test/t12a-b2-child-identity.test.ts::COLLECTION-OR-UNHANDLED` | 4 legs unmasked | T1 / C1 | **FIXED(pre)** @ `91087636e` | Runtime Owner |
| 22 | `FILE packages/runtime/test/t12a-glue-handoff-ports.test.ts::COLLECTION-OR-UNHANDLED` | 12 legs unmasked | T1 / C1 | **FIXED(pre)** @ `91087636e` | Runtime Owner |

**Per-exit counts: FIXED(pre) 13 · FIXED(u7-1) 9 · STILL-RED 0 · OBSOLETE 0 · ENV_BLOCK 0 = 22.**

Rows 1–9 note, carried from `nine-root-2162f6a7.md:99-108` verbatim in substance: five of those nine had been
*green on a fixture YAML syntax error* — retiring them is “9 obligations that had no working assertion becoming
9 obligations with one”, not nine reds repaired. That is stated here so the count is not read as more than it is.

---

## 4. The nine repairs — root cause, before/after, and the non-vacuity control

Both root causes are **named product changes that no test observer was carried along with**, and both changes are
**sanctioned** (condition 1 of the reviewing agent; the sanction is cited, not assumed):

### 4.1 Sanction for the leader-session premise (rows 12–19, eight legs)

| question | answer |
|---|---|
| what changed | commit `3be0de1f0e56f37db85e83334f361d401e1e70c6` “fix messaging relay to root leader”: `packages/runtime/messaging/coordinator.ts` — `const deliveredToSessionId = isLeaderTarget ? rootSessionId : String(target.childSessionId)`. Before it, a leader-directed relay was addressed to the seeded leader's `childSessionId`; after it, to the ROOT session. |
| is it sanctioned | **yes, twice over.** (a) It shipped in the **user-ruled** `0.1.0-rc.1` release — `dev/agent-workflow/SESSION_ROUTER_LOG.md`, “Release 0.1.0-rc.1 (2026-09-08)”, 发布内容 explicitly lists “messaging relay to root leader 修复” among the content the user ruled releaseable. (b) It implements a **frozen architecture invariant**, not a preference: `docs/plans/finished/DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md` §9.1-§9.2 — “LeaderInstance = Root Agent + Root Session”, “**is root Agent/Session**”, “**has no childSessionId**” — restated at §41.1 (“LeaderInstance = Root Agent/Session”) and in the object-model table at §3074 (“LeaderInstance │ Root Agent/Session”). Addressing the leader's delivery at a session the leader *does not have* was the bug. |
| what the nine were red about | the OBSERVER, not the law. Legs 1/3/4/7/17 read `port.inputsFor(leader.childSessionId)` — an inbox nothing writes to after `3be0de1f`; legs 3/4/7/17 then read `undefined` (`TypeError: Cannot read properties of undefined`); leg 5 summed that empty inbox into an input count (`expected 4 to be 1`); leg 18 **fault-injected** into `P6T3_SEEDS.leader.childSessionId`, a session recovery no longer writes to, so the injector silently never fired and 0 of its 12 assertions ran. |

### 4.2 Sanction for the hashable-projection premise (row 10)

| question | answer |
|---|---|
| what changed | commit `5ad6a4fe8ca2cbc97ad08bf28eaab62b3503bf16` (`0.1.1-alpha.1` T1): `toHashableTemplate` gained `capabilities: template.capabilities === undefined ? null : toHashableCapabilities(...)` — an absent optional single projecting as explicit `null`, the rule the function's own docstring states. |
| is it sanctioned | **yes.** `docs/plans/finished/0.1.1-alpha.1-minimal-capability-wiring-plan.md` §5.6 “Blueprint hash / snapshot”: “**新 capability fields 必须进入 Blueprint normalized/hash representation**” (new capability fields MUST enter the Blueprint normalized/hash representation), with the `teamTools`/`builtinToolDeny`/`skills`/`mcp` change-detection cases. The projection's documented contract — “absent optional single fields as explicit `null`” — makes `capabilities: null` the sanctioned shape, not a shape to tolerate. |
| what the leg was red about | a stale literal: the `toEqual` on the leader template was never completed after the field joined the projection, so 6 of its 11 assertions never executed. |

### 4.3 What was changed (test code only)

- `p6t3-mediation.test.ts`, `p6t3-restart.test.ts`: introduce `const LEADER_SESSION = P6T3_ROOT` with the citation,
  and re-pin every observer **and the fault injector** to it. `p6t3-mediation.test.ts` leg 1 **gains** an
  assertion (`expect(md.legacyLeaderChildInputs).toBe(0)`) that the legacy child session stays silent — the same
  premise move can no longer go unwatched.
- `p6t6-actions.test.ts`: `const LEADER_SESSION = String(P6T2_ROOT)` and re-pin the two expectations.
- `t2-blueprint-hash.test.ts`: complete the literal with `capabilities: null`, keeping the exact-key-set `toEqual`
  (which is what makes the assertion about the whole projection rather than one field).

### 4.4 Non-vacuity control — proven, not asserted (condition 2)

`mutation-controls.sh` (committed; logs in `mutation-logs/`) plants ONE wrong value in a **product** file, runs the
affected suites, then restores the file byte-exactly and asserts a clean porcelain.

| control | planted wrong value | result |
|---|---|---|
| M0 unmutated | — | **44 passed (44)**, exit 0 |
| M1 | `coordinator.ts`: revert the leader target to `String(target.childSessionId)` (the pre-`3be0de1f` line) | **8 failed | 18 passed** — exactly rows 12,13,14,15,16,17,18,19 by name |
| M2 | `mediation.ts`: `if (true || peerDirectGranted(...))` — the security rule bypassed (member→member always direct, grant ignored) | **10 failed | 16 passed** |
| M3 | `validate.ts`: drop the `capabilities` key from the hashable projection | **1 failed | 17 passed** — row 10 |
| M4 | `validate.ts`: project absent capabilities as `{}` instead of `null` | **1 failed | 17 passed** — row 10 |
| after all controls | `git status --porcelain` on the three product files | `[]` |

M1 is the condition-2 answer directly: with the leader target reverted to the sanctioned-before value, **all eight
re-pinned legs go red**. M2 shows the mediation legs are not merely "green now" — they still detect a broken
grant rule, so no security assertion was traded for green.

---

## 5. Baseline restatement (condition 3)

The tolerated census set is now **empty**, which the parser could not previously express. Rather than leave the
pointer at `2b1099d7` (which would keep nine repaired identities tolerated and a regression of them invisible as
“not NEW”), the set is retired in the open, following the file's own restatement procedure:

- **new** `dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-u7-1-old-reds.md`
  (sha256 `6dd8e6b017a6b0ac3c8faac123ce9d7ea2f605ecc7f1db3bb485ec4b031deeb6`): 626 files / 7936 legs,
  **0 titled reds**, 0 collection files, a `# RETIRED-TO-EMPTY: 9 titled reds retired against predecessor 2b1099d7`
  machine sentinel, and a `## RETIREMENT` section listing **all nine** identities in the parser's own
  `<file> > <name>` grammar.
- **`2b1099d7.md` and every predecessor stay unedited** as history.
- **`scripts/ci-pr-gate.mjs`**: `BASELINES.census` repointed; `parsePopulationBaseline` accepts a zero set ONLY
  with the sentinel, and then REFUSES unless (i) the count equals the retirement table, (ii) the table's identity
  set **equals the predecessor document's tolerated set** exactly (fewer = silent deletion, more = invented debt),
  (iii) the predecessor is readable and is not itself an emptied document, and (iv) no identity is still tolerated.
  Retired identities are excluded from load-family mining (retiring a red must not hand its file a re-sample excuse).
- **The census leg reports the 9 as resolved, not as silently absent.** `compareCensus` already prints
  `resolved N …` for every baseline identity missing from the capture; the sidecar
  `census-comparison-*.json` carries `comparison.resolved` with all nine.

**Named governance change to CI gate code, and its exact hunks** (condition 3): the change is confined to
`parsePopulationBaseline` (+ `readSiblingBaseline`, `parseLoadFamilies` heading set), the `BASELINES.census`
constant, and the `--self-test` block. No workflow file, no tier logic, no leg order, no `LEG_ORDER` entry, and no
gate verdict path was touched — `git diff --stat` on the commit is the checkable claim.

Self-test grew 77 → 94 assertions. Each new negative control was **mutation-checked itself**:

| parser check disabled | self-test result |
|---|---|
| the predecessor-set binding | `SELFTEST FAIL: 3 of 91` — the smaller / larger / swapped-table controls all “parsed!” |
| the no-sentinel refusal | `SELFTEST FAIL: 4 of 94` — both no-sentinel controls refuse the wrong way and their reason assertions fail |
| restored | `pass 94 assertions` |

---

## 6. The two ENV blocks — disclosed separately, NOT in the tolerated set (condition 4)

Neither is in the historical 22. Neither is tolerated. Both appeared in the first full-suite run of a **fresh
worktree that had not been provisioned or built**, and both clear with the provisioning step named:

**ENV-1 — `a4p7-merge-gate` composition arm: `refused`.**
```
AssertionError: the composition arms have to RUN for this gate to be green; a refusal that explains itself is
still a red here. It read "refused". why: client plugin (packages/client):
packages/client/dist/packages/client/src/plugin/client.js is not on disk and there is no trace of it in
packages/client/dist — packages/client/dist does not exist (0 file(s) in it) …
```
Cause: `packages/client/dist` is a **gitignored build output** (`.gitignore`: `dist/`), so a fresh checkout has no
client composition. Cleared by: `pnpm run build && pnpm build:composition` (measured: `DSH-ARTIFACT-VERDICT
script=check-artifacts-committed … verdict=ok compared=1799 glue=28`, and the suite is then green in the census).
This is the same provisioning step `.github/workflows/census-runtime.yml` runs before its census, with the same
reasoning recorded there. Classified **ENV_BLOCK (provisioning)** for the unbuilt state only; on a provisioned tree
it is green and is in no tolerated set.

**ENV-2 — `rc2-sanitize-evidence` S13: timeout at the default clock.**
```
FAIL  packages/testkit/test/rc2-sanitize-evidence.test.ts > … > S13 file aliases, quoted values, and capture
formats pass the standalone regressions
Error: Test timed out in 5000ms.
```
Cause: S13 runs a nested `node --test` and declares its own `timeout: 60_000`
(`packages/testkit/test/rc2-sanitize-evidence.test.ts:230`); the suite sets no global `testTimeout`, so under
vitest's 5000 ms default the leg is **forfeited, not measured**. Cleared by: run under the clocks CI actually uses.
Measured on this tree: green at `--testTimeout=90000` (two full captures, 7936/7936) and green in the 20000 ms
`pr-gate` census leg. The workflow comments already carry this leg explicitly
(`census-runtime.yml:331-345` names “`rc2-sanitize-evidence` S13 declares `timeout: 60_000`” as one of the two legs
90000 is sized to dominate). Classified **ENV_BLOCK (operator clock)**; not tolerated, and the clock in force is
printed on every census leg line so a pass can never be read as a pass at the default.

**Per condition 1 (measured under the census leg's own conditions):** the empty tolerated set was re-measured with
the **exact command the `pr-gate` census leg runs** —
`node scripts/ci-pr-gate.mjs --full --census-captures 2 --census-test-timeout 20000 --store-dir …` — see
`census/ci-census-leg-20000.*`. Because S13 is green at both CI clocks and is not a census-root failure under
either, it does **not** enter the tolerated set.

---

## 7. The third race this lane found and fixed (named race, not a deletion)

The 20000 ms census leg — the real CI configuration — reported one NEW red that two standalone captures had missed:
`p4t6-session-event-scan` `expected 1279 to be 1277`. It is a genuine **named race**, and EB2-C says to fix named
races rather than delete tests, so it is fixed rather than tolerated:

- **mechanism:** `a4p7-merge-gate.test.ts`'s lint-universe leg planted its two control files
  (`lint-scratch-control-a.mts`, `-b.mts`) under `packages/testkit/test/` — inside the corpus
  `p4t6-session-event-scan.test.ts` walks at module load and pins as an exact `filesScanned` total. The root suite
  runs the two files in parallel workers; when the ~50 s merge-gate window overlapped p4t6's ~20 ms scan, p4t6
  counted two files that belong to no commit.
- **measured, both directions:** p4t6 alone **10/10** (three runs); p4t6 with the two control files on disk
  **1 failed | 9 passed**, `expected 1279 to be 1277` (reproduced twice, deterministically); after relocating the
  controls to `scripts/` **10/10** (three runs).
- **the fix keeps the control's power:** `scripts/` is outside p4t6's `packages/**` walk and inside the lint
  universe the leg actually measures — `lint-identities` reports universe **1385 → 1387** with the two planted, and
  the merge-gate leg passes (129 s). Only the control files' **location** changed; no assertion was relaxed.
- logs: `.artifacts/logs/p4t6-race-repro-{RED,GREEN}.log`, `p4t6-with-scripts-control-{1,2,3}.log`,
  `mergegate-leg-after.log`, `census-leg-before.log`.

---

## 8. Gate state on this candidate (C1)

| check | command | result |
|---|---|---|
| full root suite, nine roots, capture 1 | `vitest run --testTimeout=90000` (+ `fail-set capture`) | **626 files / 7936 legs / 0 red identities** |
| full root suite, capture 2 | same | **626 / 7936 / 0 red identities** — sets IDENTICAL |
| census leg, real `pr-gate` config | `node scripts/ci-pr-gate.mjs --full --only census --census-captures 2 --census-test-timeout 20000` | see `census/ci-census-leg-20000.*` |
| gate self-test | `node scripts/ci-pr-gate.mjs --self-test` | **pass 94 assertions** |
| lint identities | `node scripts/lint-identities.mjs --diff …lint-identities-0237d487.txt` | universe 1385, **new 0, resolved 0** |
| docs sync | `node scripts/docs-sync.mjs --check` | **blocking=0** |
| docs probe | `node scripts/docs-probe.mjs --base origin/master` | **blocking=0**, advisories 2 |
| protected set (:3080, `~/.dsh`) | — | untouched; no host booted (**0 boots**) |
| product source diff | `git diff --name-only <base>..HEAD -- 'packages/*/src/**'` | empty |

Boots: **0 of the 0–2 budgeted** — every leg in this item's scope is T1/C1 and needs no host. The pristine test
checkout was provisioned and BUILT in-worktree (`tests/deepseek-harness-test-use`, detached @ `639ed01539`,
porcelain 0 before and after) solely so the census legs that resolve it could be graded; that is a build, not a host
boot, and `:3080` was only ever read.

---

## 9. Files of record

- `old-reds.json` — machine-readable: all 22 identities + the 2 auxiliary run1-only identities, tier, class, exit,
  owner, evidence pointer, and the 9 retirement rows.
- `mutation-controls.sh` + `mutation-logs/` — the non-vacuity controls (re-runnable).
- `census/` — capture summaries, id files, the real CI-config census leg, and their logs.
- `manifest.json` — every source document this file was built from, with sha256 and provenance.
