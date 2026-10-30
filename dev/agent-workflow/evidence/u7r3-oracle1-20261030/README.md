# R-ORACLE-1 — oracle-coverage measurement + BL-20..23 hash-pin regeneration package

<!-- lane: R-ORACLE-1 · branch task/u7r3-oracle1-20261030 (base origin/master f7d5b3e75 = #490 R-G4R-1a merge tip) · worktree .worktrees/u7r3-oracle1 -->
<!-- seat: qiyuan-self/qwen3.8-flash-next (disclosed) · ZERO boots / ZERO starts this lane (offline static scan + generator + vitest only) · written real UTC 2026-10-30T17:3xZ (`date -u`, ROUTER_RULES §8.5.8) -->
<!-- card: .artifacts/ops/NEXT-LANES-20261030.md §R-ORACLE-1 · digest-surface law honored: tests/world-factory/lib/binding-digests.mjs (incl. the #490 TrustedSources surface) NOT touched by this lane -->

## Deliverables

| artifact | what |
|---|---|
| [GAP-TABLE.md](./GAP-TABLE.md) | MEASURE leg, both layers: tip census of ALL 19 oracle units (13 distinct closures) through the real `captureOracleBinding`, plus the tracked-record census (27 records) and the measured digest drift. Asset-by-asset table with `pin? / verdict-source? / gap class`. |
| [PRECONDITIONS.md](./PRECONDITIONS.md) | oracle `complete=true` preconditions P-1…P-6, each with owner + current state. Headline: **P-1 (G1 edge-law adjudication) blocks most**; P-5 (immutability re-derivation) is measured-TRIGGERED and undischarged. |
| [DECISION-TABLE.md](./DECISION-TABLE.md) | the semantic rows this lane refuses to self-rule (DT-1…DT-5) with exact proposed text/branches, and the mechanical-vs-semantic boundary as executed. |
| [measure-oracle-coverage.mjs](./measure-oracle-coverage.mjs) + [measure-run.json](./measure-run.json) | the reproducible measurement script (offline, writes base64 artifacts only to a scratch dir outside the tree) and its captured rows. Reproduce: `node dev/agent-workflow/evidence/u7r3-oracle1-20261030/measure-oracle-coverage.mjs <scratch>`. |
| `gate-*.log` | EF-05 trio + static-leg transcripts (see Gate record below). |

## Gap count by class (voiding vs disclosed — GAP-TABLE §2.1)

- **G1** host entry-module dynamic import, OUTSIDE repo root — **voids**; 1 asset / 1 site
  (`host-sandbox-assets.mjs:231`, `:223`@candidate, `:228`@#490 tip) → u6-arc-d, u7-4a-jobs.
- **G2** in-repo dynamic import, computed path — **voids**; 1 asset / 3 sites
  (`lockseam:102/384/435` → `fs-state-store.mjs`) → u7r3-b49-lockseam. NEW since the reserved rows.
- **G3** World-state literal reads — non-voiding; 3 assets / 4 sites.
- **G4** tracked runtime inputs WITH their own pinning cells (authority pointer, composed profile)
  — non-voiding; 2 sites.
- **G5** host-kernel `boot_id` unfollowed path — non-voiding; 1 site.

Voiding suites at tip: **3** (u6-arc-d, u7-4a-jobs, u7r3-b49-lockseam); tracked complete=false
records: **4**. Feeds the `world-oracle` TrustedSources entry as designed — the entry stays
honest-but-over-incomplete-closures until P-2 lands (GAP-TABLE §4).

## BL-20..23 regeneration package — shipped MECHANICAL-ONLY

Rows landed = the G4-R2 **reviewed literal texts**, byte-identical to
`git show 90cd044ca^:docs/plans/active/alpha5-tool-io-governance/ALPHA5-EFFECTIVE-BACKLOG.md`
(`diff` → `VERBATIM-IDENTICAL`), placed in §B's BL table after BL-19. Every post-10-29 semantic
question (BL-20 closed-by-#448 currency, BL-22 expanded coverage, BL-21 #490 note) is QUEUED as
DT-1/DT-2/DT-5 — no row closed, re-titled, or re-counted here.

EF-05 three-step ritual, as run (all logs in this dir):

1. `node dev/engineering/tool-obligations/build-expected-tool-obligations.mjs` (no args) →
   `expected-tool-obligations.v1.json` `b0a1f765…` → **`e02d4aba…`** (inputs carry the new
   `backlog_sha256 a0ef2278…`; sources census `abc825…` unchanged; counts unchanged — the u7-0
   counts assertion stayed green untouched).
2. `pnpm exec vitest run packages/testkit/test/u7-0-census-reconcile.test.ts` failed exactly the
   two predicted PINNED legs; `PINNED.expected_digest` + `PINNED.clean_verdict_digest` bumped from
   the `Received:` actuals (`e02d4aba…`, `6039b174…`) **with python** (closed quotes; the 10-30
   sed double-quote incident avoided), rerun → **26/26 passed** (`gate-u7-0-vitest-26green.log`).
3. `node scripts/docs-sync.mjs --check` → **findings=0** (`gate-docs-sync.log`).

Trio+PINNED commit-squat law honored: backlog rows + regenerated artifacts + manifest + PINNED
land in ONE commit (the tree at that commit is the `--check`/u7-0-green tree; evidence is a second
commit and touches no pinned input).

## Gate record

| leg | result |
|---|---|
| generator `--check` (post-package, twice incl. inside this dir's regen log) | `CHECK OK — committed artifacts are the byte-exact replay` |
| vitest `u7-0-census-reconcile.test.ts` | **26/26 passed** |
| `node scripts/docs-sync.mjs --check` | docs=99 findings=0 blocking=0 |
| `node scripts/docs-probe.mjs --worktree-only` (script direct, no `--`) | **blocking=0** non_blocking=0 advisories=2 (the standing DOC_IMPACT_OWNED informational pair), contracts=20 |
| `node scripts/eb3-trusted-sources.mjs` | pass files=2021 findings=0 |
| `node scripts/eb3-family-boundaries.mjs` | pass files=82 findings=0 (engine=regex — `acorn` unresolvable in an unprovisioned worktree; disclosed provisioning fact, g4r1a ran acorn 8.18.0 at the same findings=0) |
| `node scripts/eb3-evidence-guard.mjs` | pass findings=0 (bound 1 MiB; this dir's files are static-analysis outputs and logs, no raw capture) |
| `pnpm --filter @dsh-agent-team/testkit run typecheck` | exit 0 (the only cross-package change is two string literals in a testkit test) |
| full `pnpm -r run typecheck` | NOT run to completion: `packages/runtime` fails on `@deepseek-ai/dsh-types` missing — pre-provisioning gap of this worktree (no `pnpm install`/build here), not this diff; merge-candidate CI covers it |

## Honest residuals (NOT claimed closed)

P-1…P-5 of PRECONDITIONS.md stay open/queued/triggered exactly as written there; R-ORACLE-1,
R-G4R-1a, R-BL-QUEUE ledger rows are untouched (their live homes are
`dev/agent-workflow/evidence/review-routing-20261028/REVIEW-REMEDIATION-20261028.md` and
GATE-LEDGER). #490's digest surface untouched (design doc §2 "this lane does not touch that file"
applies to R-ORACLE-1 as written). Zero boots; no record rewritten; no push beyond this branch.
