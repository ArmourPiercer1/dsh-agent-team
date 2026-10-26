# u7-r1f2-domain-exclusion-20261026 — R-G1F-2 Domain-family scope record

**Verdict: RECORDED — scope narrowing, not a delivery. No gate verdict changed.**

The USER ruled R-G1F-2 (`surface:domain_family`) → **overall B** on 2026-10-26: Domain is explicitly
excluded from the Alpha.5 product/release claim, with a documented scope/compatibility boundary. This
directory is the evidence behind the durable record of that exclusion.

## What changed

| path | change |
|---|---|
| `docs/plans/memo/unified-baseline-alpha5-20261025/u7/DOMAIN-EXCLUSION.md` | **new** (119 lines): the ruling + question verbatim, where `surface:domain_family` appears today, the claimed/not-claimed boundary, compatibility consequences, reopen conditions, and the separation from the MCP decision |
| `docs/plans/memo/unified-baseline-alpha5-20261025/gates/GATE-LEDGER.md` | **appended** one dated `**Update 2026-10-26 (…)**` paragraph (no table row added or edited) |
| `dev/agent-workflow/evidence/u7-r1f2-domain-exclusion-20261026/` | **new**: this README, `manifest.json`, `greps.txt` |

## What did NOT change

- **G4** stays **G4-CORE-PASS / BRIDGE-BLOCKED** (§10.6). **G5** stays **BLOCKED**. No G5 row exists in the ledger and none was added.
- **Matrix** `docs/plans/active/alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md:43` (M-13 Domain) keeps **NOT_VERIFIED**; no matrix file was edited.
- **Obligation set** `dev/agent-workflow/evidence/u4-obligations-20261025/expected-tool-obligations.json` (untracked local) untouched; its entry at `:1627` stays `obligation: REQUIRED` as the historical G1-F fact.
- No `packages/**`, no `tests/**`, no `docs/plans/active/**`, no `dev/engineering/current-authority.json` or snapshot, no `SESSION_ROUTER_LOG.md` edit. No host boot.

## Key findings (from `greps.txt`)

1. `surface:domain_family` is a **surface obligation class**, never a tool name: zero hits in any `*.ts`/`*.mjs`/`packages/**` (G-03).
2. In the U4 obligation set the term occurs on **exactly one line** (`:1627`), as `"surface:domain_family (family obligation — no registered names)"`; an exact-quoted search for the bare name `"surface:domain_family"` exits 1 (G-04).
3. No `domain-family` spelling anywhere (G-02); no `equipment`, `hpc_` or `domain_family` in `packages/domain/tool-governance/` (G-13); the only tracked `hpc_` string is the matrix instruction not to invent such names (G-09).
4. What exists in code is a **veto result type** (`DomainVeto`, `interfaces.ts:181,186`), the `domain-ref` effect kind and the `DOMAIN_DENIED` error name — not a Domain provider or family (G-10..G-12).

## Disclosures

- **Cross-branch citations.** The ruling/question/answer files (`dev/agent-workflow/evidence/u7-design-20261026/*`) and `u7/EXTERNAL-TOOL-CONTROL-DESIGN.md` exist only on `task/u7-rulings-decision3-20261026` (PR #384, open, head `37f349074`), not on this branch's base `origin/master @ 496a3980f`. They were read from that branch (worktree `.worktrees/u7-rulings`, `git show`); citations here resolve once #384 merges. This PR does not copy them.
- **Untracked input.** The U4 obligation set is untracked local evidence; it was read from the main worktree absolute path. Its sha256 is recorded in `manifest.json`.
- **Docs-probe cited-path rule** (`scripts/doc-checks.mjs:150`) only scans `packages/runtime/governance-center` and `tests/world-factory`, so the cross-branch citations above do not trip it; that is a limitation of the rule's scope, disclosed rather than relied on.
