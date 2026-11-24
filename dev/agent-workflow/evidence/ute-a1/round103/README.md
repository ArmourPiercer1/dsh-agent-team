# Round 103 — the two-assembly-entries authority audit (review `20261124-1341` §3.3)

**Dated**: 2026-11-24 (real UTC) · branch `vnext/a1-cut` · PR #822 (DRAFT, unmerged) · measured at
`f880370d234bfa2f831edfd753e2ee59005770d2`. Worktree `.worktrees/vnext-a1-cut` only; `:3080` and its
DSH_HOME untouched.

## What this round is

An **independent responsibility audit** of the two big assembly entries — asked for by the external
architecture review as the "no hidden second execution authority" check — plus a one-page responsibility map
for each. Delivered as documentation only: **zero product behaviour changed, no test assertion touched, no
upstream patch, no history rewrite.**

Deliverable: `dev/agent-workflow/evidence/ute-a1/ARCHITECTURE-AUTHORITY-AUDIT.md` (390 lines).

**Verdict: SINGLE-AUTHORITY.** 53 enumerated execution-adjacent surfaces across the two files: 17 pass
through / install the one centre, 3 are inputs the centre still judges, 31 are lawful non-execution
(management-plane delivery, leader plane, durable reads, containment/refusal), 1 is the owner-ruled
`centreStatePath`-absent ungoverned row, 1 is a latent unreachable shape in `member-execution.mjs`
(no caller passes `nativeSpecs`). **Zero findings; no fix warranted.**

## Files

| file | what it is |
| --- | --- |
| `../ARCHITECTURE-AUTHORITY-AUDIT.md` | the audit: the centre's address in code, the two surface tables (surface → decider → centre call `file:line` → verdict), the five specific questions, the searches run with results, the observations, the per-file responsibility maps, the method/limits statement |
| `searches.log` | the raw output of searches S1–S9 (process spawn, tool register/execute, native mounts, realm/centre construction, admission gate, ALS/attribution, catch census) at the audited HEAD |
| `dispatch-tests.log` | `dispatch-tests --run --leg ute-vnext-a1` — 248 tests / 245 pass / 0 fail / 3 skipped, digest `sha256:edd4f1c4…` unchanged |
| `test-catalog.log` | `test-catalog --max-uncollected 41 --max-excluded 7` — tests=785 refused=0 findings=0 (uncollected 38 / excluded 14) |
| `ute-cut-closure.log` | `ute-cut-closure --check` — pass, `cut(0/148)`, deleted=148 prodRefs=0 distResiduals=0 |
| `ute-p0-assets.log` | `ute-p0-assets --check` — pass, 37 modules / 180 files / 69512 lines, `cut(148/148)` |
| `docs-sync.log` | `docs-sync --check` — docs=193 findings=0 blocking=0, authority pointer verified |
| `place-dist-glue.log` | `place-dist-glue` — done, **35 placements byte-identical** |
| `eb3-ci-required.log` | `eb3-ci-required` — pass workflows=10 findings=0 |
| `bound-vitest.log` | bound vitest leg `eb3-security-run --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000` — PASS 15 suites / 238 passed / 0 failed |
| `ute-g1-argv.log` | UTE G1 `node --test` nine-file argv — 89 tests / 89 pass / 0 fail |
| `eb3-run-manifest.log` / `eb3-run-manifest-new.log` | `eb3-run-manifest` and `--new-since a19d1df01` — records=520 strict=0/148 incomplete=11 findings=0 |
| `ci-pr-gate.log` | `ci-pr-gate --full --census-captures 2` |
| `ute-a1-window.log` | `ute-a1-window --check` — pass red=0/0 `cut=(148/52)` |
| `devex-diag.log` | `dispatch-tests --run --leg devex-diag` — 44/44 |
| `head-at-start.txt` | the audited HEAD |

## What was actually established

1. **No process/OS surface.** Neither file contains `child_process`, a spawn, a PTY, or a shell — S1 is zero
   hits in both. The only transport that could start a child is MCP, and it is always `streamable-http` to a
   pre-configured `127.0.0.1` port (`agent-bindings.mjs:1513-1525`).
2. **One dispatch path.** The only `tools.execute` in either file is `agent-bindings.mjs:4085`, on
   `handle.agent.ctx` — the same ctx `setup?.(agent.ctx, agent)` handed the centre, therefore the same
   `tools/pre-execute` + `tools.guard` pipeline (`pipeline.ts:201-231`, guard at `admission-port.mjs:1094`).
   `root.ts` cannot execute a tool at all.
3. **One realm, one centre composition.** One `mountMemberA5sfRealm` call (`:1771`) and one
   `installMemberExecution` call (`:1839`), and `installMemberExecution` refuses to compose a compiled realm
   without `centreStatePath` (`member-execution.mjs:109-121`). Two native-mount lanes, both downstream of
   that single composition; two other "mountNativeToolModules" references repo-wide are observe-only probes.
4. **No second allow.** Approval (control service) and the permission overlay are inputs; the centre re-checks,
   spends and receipts. The guard is monotonic: the admission `tools/pre-execute` listener does not override
   another listener's non-allow verdict, so an earlier allow cannot outrun the guard.
5. **The ungoverned row is the owner-ruled default, and it is loud.** Absent `centreStatePath` ⇒
   `uteProtected:false` + one observation + exposed `admissionModeOf`; the converse (realm without the centre,
   or centre claimed without a realm) is a typed refusal.
6. **The attribution-only ALS is never read.** `currentGuardToolCallAttribution` has zero readers; admission's
   authorization data is a passed `Binding` value, not an async-context lookup.

## Two observations recorded (not findings, no code changed)

* `member-execution.mjs:207-224` mounts `nativeSpecs` without checking that a centre was installed — unreachable
  from production (the only caller passes none); a three-line invariant to tighten in a later round.
* `root.ts` and `agent-bindings.mjs` both use the word "admission" for two different objects (the new-work
  compatibility gate vs the governance report); correct today, a navigation hazard, noted in the map.

## Still open (unchanged by this round)

`d4:ask-execute-process` REFUTED (owner decision); P0-2 OPEN target-host acceptance blocker; rc.5 column of
`d:remote-creation` / `d2:remote-delivery` not recorded; wider vitest/node:test population not re-run on rc.5;
CI `ci-required` remains RED on this DRAFT because `ci-census` is skipped by the draft tier. **PR #822 stays
DRAFT and unmerged.**
