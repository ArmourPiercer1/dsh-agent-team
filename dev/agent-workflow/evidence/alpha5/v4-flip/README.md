# alpha5 v4-flip — 路线阶段②+③ 原子件 (candidate evidence)

Base: master `382e5fb6` · branch `alpha5-v4-flip` · one-shot worktree · no push (candidate-stops-here).

Scope of this stroke (parent contract ②+③): flip 本体 (`SUPPORTED=[3]→[3,4]` single-point +
同笔 M-3 envelope leaf tables + coverage/kernel mirror tests) · D-01 转正 + 正式 Schema ADR
(`docs/plans/memo/alpha5-tool-io-governance/ADR-vnext-blueprint-schema-v4.md`) · 语义三钉 ·
退役防火墙 (zero v3 field deletion / zero RETIRED declaration / zero trim in the diff).

## Runs index (`runs/`)

| File | What | Verdict |
| --- | --- | --- |
| `a5fl1-RED.log` | RED-first capture: flip tests run against the pre-flip tree | RED as designed (SUPPORTED `[3]` vs `[3,4]` etc.) |
| `pre-flip-entry-capture.txt` | production-entry witness before the flip (v4 refusal at the entry) | v4 typed-refusal recorded |
| `root-vitest-PRE1-discarded-hostcheck-midrun.log` | PRE baseline #1 — **discarded**: host-check raced the mid-run build | not used |
| `root-vitest-PRE2-discarded-rsync-race.log` | PRE baseline #2 — **discarded**: dist rsync raced collection | not used |
| `root-vitest-PRE.log` | PRE baseline (pre-flip tree + a5fl1 only) | 571 files / 7134 legs, 20F explained (pre-existing + my new RED files) |
| `root-vitest-POST.log` | POST #1 | 5 failed files: 4 red-identity + `multi-mcp-wiring` collection error (stale scratch left by my killed PRE runs; `rm -rf packages/testkit/test/.tmp-fault/multi-mcp-wiring` → 49P alone — environment flake, disclosed) |
| `root-vitest-POST2.log` | **final baseline** | `4 failed / 569 passed (573)` files · `9 failed / 7187 passed (7196)` legs — red set **byte-identical to the published 9** (glue6 `CENSUS.md` identity: p6t3-mediation ×5, p6t3-restart ×2, p6t6-actions ×1, t2-blueprint-hash ×1) |
| `build-POST.log` | full `pnpm -r build` | OK |
| `check-artifacts-head-1.log` | dist drift check (pre-commit capture) | index ok; superseded by FINAL below |
| `check-artifacts-head-FINAL.log` | `pnpm check:artifacts:head` at the candidate commit | **verdict=ok compared=1744 drift=0** |
| `typecheck-POST-1.log` / `typecheck-POST-2.log` / `typecheck-FINAL.log` | `pnpm -r typecheck` | **FINAL: EXIT=0** (after all evidence edits) |
| `pre-files.txt` / `post-files.txt` | vitest file census PRE vs POST | 570 → 573 files (my 3 new suites), legs 7119 → 7196 |
| `live-*/` | live-host leg attempts (chronological) | see table below |

## 三钉 (semantic pins) — one leg each

1. **v3 behavior byte-unchanged** — root vitest red-set identity: POST2 red set == published
   9-identity (glue6 CENSUS), domain lane `1 failed | 759 passed (760)`; flipped pins are the
   7 disclosed names below, zero net new reds.
2. **v4 documents parse AND run through the production entry** — `a5fl1` 15P + `a5fl2` 8P +
   `a5fl3` 5P mirrors + **live-host leg VERDICT PASS 14/14** (`run-v4-live-leg.mjs`): a v4
   blueprint booted a real team on a real production host over the `team-remote` wire;
   create_member executed (member-activated), `team_delegate` admitted real work
   (work-admitted receipt), the member ask produced a durable leader-approval request that
   the wire allow resolved (decision + consumption durable), and dispatch fail-closed at the
   Tool Binding verification gate with zero side effect (the documented v4-era face below;
   mock-LLM position is the sanctioned one).
3. **never-defined versions keep the typed refusal** — `fixtures.ts` derived
   `SCHEMA_VERSION_NEVER_DEFINED` witness + gate-arm truth table in `a5fl1` (5/9 →
   `SCHEMA_VERSION_UNSUPPORTED`, non-int typed refusal).

## Live-host leg attempts (`live-<stamp>/`, each carries run.log + evidence JSON)

| Attempt | Failure mode → fix (all in-leg, no production change) |
| --- | --- |
| `21-44-36` | import depth (`tests/paths.mjs`) → `../../../../../` fix |
| `21-49-36` | boot-marker race (cold boot > deadline) → full-file pass + 360s; team.create 400 (denyList contained team_* tools — `restrict()` deny only accepts GLOBAL tools; PR4 ROUND 5 added team_grant/revoke_permission) → exclude every `team_*` from builtinToolDeny |
| `22-00-03` | oracle: raw-last-user selector (host injects a runtime-context user part AFTER the input — c1 LIVE-FOUND, ported trigger selector); catalog.get shape (returns the parsed blueprint identity face, no schemaVersion-on-registry-row assumption) |
| `22-07-55` | toolCall reply shape: mock requires `toolCalls:[…]` wrapper (unhandled TypeError killed every tool turn); catalog.get revision must be a NUMBER |
| `22-15-28` | title side-call (embeds the first human message incl. markers) chain-routed → 1739 create_member replies → OOM; title-prompt guard + 60-request circuit-breaker |
| `22-17-08` | wire reality: tool results ride as **user messages with `tool_result` parts** (no `tool` role on the rc.2 wire) → wire-adapted result counting |
| `22-25-01` | same-shape forensics (full-message dump) |
| `22-32-51` | `--keep` capture: durable session events confirm create-member EXECUTED (member-activated/ADMISSION_OPEN) — chain state tracking was the leg's bug, not the product's |
| `22-48-19` | `extractInstanceId` vs JSON-escaped nested payload (delegate rejected for missing delegationInstanceId) → escaped-JSON-tolerant extraction |
| `22-56-33` | delegate arg shape fixed live; discovered `team_delegate` returns an IMMEDIATE `work-admitted` receipt (sync return ≠ member output) and leader-approval arrives as an inbox `[team-control requestId=…]` notification turn |
| `23-04-35` | 9/12: A4.1 (durable leader-approval request) + A4.2 (wire allow accepted, durable decision) both PASSed while the create HTTP response blocked on the live arc (client timeout, server continued; catalog+ledger proved the durable team) → resequence: create issued CONCURRENTLY with the approval arc, awaited for its own criterion; A4.0 retargeted to the honest witnesses (delegate receipt in leader context, member executed-witness, ledger decision durable, marker file on disk) |
| `23-24-17` | 12/14: the arc completed honestly — ask→allow→CONSUMED (ledger 1/1/1) and the member bash dispatch fail-closed at the Tool Binding verification gate (`cannot be verified at dispatch time (no fallback to the native body)`, durable `isError:true` on the member's session events). Criteria corrected to the real v4-era product face (below) |
| `23-27-09` | **VERDICT PASS — 14/14** (final leg) |

### Final leg criteria (`23-27-09`, all PASS)

| # | Criterion | Witness |
| --- | --- | --- |
| A0.0 | test-use pristine @ baseline | `639ed01539…` |
| A1.0/A1.1 | production row boots; live surface captured | 20 tools, deny-set computed |
| A2.0–A2.3 | catalog lists v4 as **4/current (RUNS)**; v3 anchor still 3/current | wire `revisionStates` |
| A3.0 | `team.create` 200 `path=fresh-root`, durable frozen v4 row | contentHash `sha256:f2c005d4…` |
| A2.2 | `catalog.get` identity stamped 4 + contentHash | production view |
| A4.1 | member ask → **durable leader-approval request** | ledger `kind=leader-approval, tool=bash` |
| A4.2 | `team.resolveControl` (v4 wire) allow **accepted** | `decider.kind=human` |
| A4.3 | decision **durable** (control-decision-recorded) | ledger |
| A4.0 | leader ran create_member + team_delegate; executed **work-admitted** receipt in leader context | `A5FL_LEAD_DONE_DELEGATED` |
| A4.4 | allow **consumed**; dispatch reached the **Tool Binding verification gate** | ledger consumption + member result text |
| A5.0 | the unverified binding executed **nothing** — no marker file (closed world, no native fallback) | `markerExists=false` |

**v4-era product face (recorded, by design):** the v4 `toolBindings` family is a
DOCUMENT-face effect-governance family — it parses closed-world and binds into the
content hash (身份绑定), and the closed-world Guard RESPECTS it (a bound member tool is
refused fail-closed at dispatch when its binding identity cannot be verified against the
provider BINDING FEED — a5pbr2 / pb §6 — instead of falling back to the native body).
The flip opens the GRAMMAR and the IDENTITY binding; the verified-effect feed for
document-declared bindings is a later route. The live leg asserts exactly this face:
governance fully live (ask→allow→consume), execution fail-closed (no marker file).

Leg hygiene: ports 3182/3493 (pre/post free-checked), `:3080`/`:3180` probed untouched pre+post
(pre/post-stable-probe.json), world under `tests/homes/a5fl-live-<stamp>` (removed unless
`--keep`), tokens redacted to `REDACTED-<sha8>`, test-use tree pristine `@639ed01539` before and
after every attempt (A0.0).

## Flipped pins — 逐名 disclosure (7 names, all in-stroke, zero net flip-reds)

| Pin | Flip |
| --- | --- |
| `a4p1-blueprint-v3-governance.test.ts` | title clause + `toEqual([3, 4])` + L452 doc-string `toContain('[3, 4]')` |
| `blueprint-v1-frozen-resume` L106 | SUPPORTED run-set expectation |
| `blueprint/testdata/fixtures.ts` | `SCHEMA_VERSION_NEVER_DEFINED` derived (no longer hard-codes 4) |
| `a5sr2` first describe | inverted (dormant-grammar pin → flipped-run-set pin) + production-entry RUNS leg added; clauses 4–5 (grammar pins) unchanged |
| `a4p7-ceiling` R1 | loop set `[1,2,5,9]` (4 removed from never-declared) |
| `a4p7-ceiling` R2 | `'4=defined/declared'` wording aligned |
| `p4t6-session-event-scan.test.ts` | chain re-tie: `SCANNED_PATHS_A5FLIP` (+3 files) → `983 + Σ` at **1183** on the scanner run of this suite (1180 → 1183), 10P |

## p4t6 chain + drift

`filesScanned` tie: 1180 → **1183** (my 3 scannable suites). `check:artifacts:head` drift = 0
(index + HEAD). Fence (`verify-blueprint-version-clean.mjs`) unchanged; the live-leg `.mjs`
lives under `dev/agent-workflow/` (EXCLUDED_PREFIXES) and may carry literal `schemaVersion: 4`;
production `.ts` sites carry no v4 document literals.

## Retirement firewall (④)

Diff contains ZERO v3 field deletions, ZERO `RETIRED` announcements, ZERO trimming. The
README + ADR restate: 窗口时长/退出 = T-1 待裁，本 PR 不预设; 翻档 ≠ 退役; the RETIRED derived
arm (`DEFINED.filter(v => !SUPPORTED.includes(v))` = [1,2]) is untouched.
