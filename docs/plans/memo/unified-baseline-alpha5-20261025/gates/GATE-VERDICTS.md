> **Tracked copy (2026-10-26, FIX-D / external-audit finding D3).** Verbatim copy of `dev/agent-workflow/evidence/u4u5-gates-20261025/GATE-VERDICTS.md`
> (local evidence, untracked at copy time). Content below unchanged; the machine-checkable index of what
> these records say is [./GATE-LEDGER.md](./GATE-LEDGER.md).

# G1-F / G3 gate verdicts (main agent, 2026-10-25T15:1xZ)

User ruling 2026-10-25 (round-1 G1-F 补充内容): Option B — run group PoCs + oracle/H0 fixes, then final review.

## G1-F = PASS (投机通过, round 2 = final; reviewer gpt-6.1-sol, dev/agent-workflow/evidence/u4u5-review-r2/REVIEW.md)
Evidence: u4-h0-20261025 (H0 17/17), u4-g1f-sup-a-20261025 (next()-guard, 42/42 Host-equivalence incl. H0 a–f, PoC-5, PoC-6; manifest 122 verified by main agent),
u4-g1f-sup-b-20261025 (PoC-1/2/3 READY-PUBLIC, PoC-4b CONDITIONAL 32/33; manifest 159 verified), u4-g1f-sup-c-20261025 (21 routes + 1 named blocker), u4-obligations-20261025.
Budget (project, shared with S1): Host starts 12/12 used (S1 4 + U4-H0 4 + SUP-A 2 + SUP-B 2); PoC experiments ≈ 16/20. SUP-B request for a 13th start declined.
Risk ledger (ROUTER_RULES §6):
- R-G1F-1 PoC-4b: MCP dynamic source 'alpha' admitted→served positive control not observed; beta proves same path. U7 MCP delivery must run it positive before claiming closure.
- R-G1F-2 surface:domain_family NAMED-BLOCKER (missing scope/enumeration decision, not a seam gap). Stays uncovered; blocks G5 for that obligation unless user scope ruling.
- R-G1F-3 composition trust: guard requires center-owned approval table, first-precedence/closed composition, no later prepended tools/execute|tools/change listeners → U6 condition set (sup-a §5, 10 items).
- R-G1F-4 SUP-B evidence used self-dispatch guard form: feasibility only; U6 must use sup-a next()-form.
- R-G1F-5 PTC transport not natively mountable in test profile (nested simulated via exec.token); PoC-6 fixture-vs-full Team scoping; plugin_manager native positive degraded to UNKNOWN_TOOL.
- R-G1F-6 Host fact: web-profile sessions share one agent carrier → CI-03 scoping is agent-scoped enrollment.

## G3 = PASS (投机通过; same reviewer)
Evidence: PR #368 merged @ f7fbc0f67 (tests/world-factory), u5-g3-20261025 (core 7/7 ×3, negatives, planted-fault sensitivity, 2-World parallel; 15/15 starts of its own package budget). Main agent re-ran C1 7/7.
Risk ledger:
- R-G3-1 live abnormal-kill crash-reclaim not exercised (SKIP, honest); only offline identical reclaimWorld path PASS.
- R-G3-2 evidence bound to Team 3288567d3 / Host 639ed015 (pre-merge branch base); first U6 C2 run re-validates binding on post-#368 master.
- R-G3-3 Windows process-tree cleanup ENV_BLOCK.
- R-G3-4 fresh DSH_HOME: base-bundle request-extension contributors kill every model request (REQUEST_EXTENSION); worlds disable the two contributors via public config.enabled → backlog item.

## U6 entry = G1-F PASS + G2 PASS (#365) + G3 PASS → OPEN.
Note: the shared S1 project Host-start cap (12) is exhausted by U4; U5/U6+ C2 runs use per-package budgets declared in each brief (plan U5/U6 do not inherit the S1 cap — it is "原 S1 项目级上限" for S1/U4 only).
