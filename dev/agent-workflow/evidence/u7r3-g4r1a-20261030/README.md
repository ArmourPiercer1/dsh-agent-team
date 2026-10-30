# u7r3-g4r1a-20261030 — R-G4R-1a: plane TrustSources digest surface (offline lane)

<!-- real UTC: lane executed 2026-10-30 (date -u at authoring 12:1x Z); ROUTER_RULES §8.5.8 -->
<!-- seat: qwen3.8-flash-next (disclosed per task order) · lane: R-G4R-1a · NO boots, no :3080/~/.dsh contact, CORE edits: 0 -->

## Scope (verbatim from the ledger row)

`dev/agent-workflow/evidence/review-routing-20261028/REVIEW-REMEDIATION-20261028.md` row
**R-G4R-1a**: four canary run-records carry `bindings.trustedSourcesDigest=null`
(ARC-A/ARC-D/Jobs/crash-A) and the arc-b c-suite schema emits **no digest cells at all**
(G4-R2 F1/M1). Resolution options: (a) expose a plane TrustSources digest on the runner
surface → persist into records → rebind later; or (b) an explicit census-inventory
substitute ruling. **This lane implements (a)'s SURFACE + unit only. It does NOT take (b)
— that ruling stays user/lead-owned — and it does NOT rebind: the rebind is a future
boot-lane record (pool C).** Existing records were NOT rewritten.

## What TrustSources turned out to be (finding, cited)

The plane's trusted-source set = the source families a runner's verdicts are computed
against (each named + cited in the design note
`dev/agent-workflow/gates/R-G4R-1a-DIGEST-SURFACE.md`):

1. **reviewed tool-obligations family** (`dev/engineering/tool-obligations/`: manifest +
   authoritative census + expected obligations; the plane ALREADY digests these bytes —
   `packages/testkit/census/expected-obligations.mjs:38` `__digest`),
2. **world-oracle closure** (sha256 = `worldOracleDigest`, `binding-digests.mjs`
   `captureOracleBinding`),
3. **one composed-profile entry per launched World** (sha256 = `composedProfileDigest`,
   captured `binding-digests.mjs` `captureProfileBinding`, fired by
   `world-factory.mjs:704-705/727`).

**No CORE_SEAM_BLOCKER**: all three are computable from tracked repo bytes by plane code.
The RUNNING World's admission-source document remains genuinely absent from the public
World/HTTP surface — that verbatim disclosure now travels INSIDE the cell
(`admissionDocument.available=false`), so the digest is never laundered into a substitution
claim; `substituteAdoption:'none'` pins the open ruling.

## What the surface emits

`trustedSources` cell (schema `u7r3-g4r1a/plane-trusted-sources/1`): entries
`{role,path,sha256}`, union digest
`sha256(concat(role\u0000 path\u0000 sha256hex\u0000))` over the canonically sorted set
(order-independent), hashLaw/order strings, `missingSources`, the admission-document
refusal, `substituteAdoption:'none'`. Null-with-reason is FAIL-CLOSED and legal:
empty set or any missing family file ⇒ digest null + named reason, never a partial
digest, never a backfill. Profile entries join via `bindWorldProfile` (idempotent
re-publish; a relaunch books `#1` AND `#2`, no silent drop).

Runners wired (FUTURE records emit cells; existing records untouched):
`tests/world-factory/u5-canary-runner.mjs`, `tests/world-factory/u7-4a-jobs-suite.mjs`,
and the arc-b c-suite driver `dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/run-c2.mjs`
(live path now persists the oracle cell + cited evidence, profile capture, trusted-sources
cell, sandbox pre-flight; `--dry-run` path unchanged — its records are synthetic, disclosed).

## Files

| file | change |
| --- | --- |
| `dev/agent-workflow/gates/R-G4R-1a-DIGEST-SURFACE.md` | DESIGN note (deliverable 1) |
| `tests/world-factory/lib/binding-digests.mjs` | digest surface: `TRUSTED_SOURCE_FAMILY`, `computeTrustedSourcesDigest`, `captureTrustedSourcesBinding`, `refreshTrustedSourcesDigest`, `recomputeTrustedSources`; `bindWorldProfile` profile-entry refresh; legacy `trustedSourcesUnavailable()` kept |
| `tests/world-factory/u5-canary-runner.mjs` | spread real capture (+world-oracle entry) instead of static null |
| `tests/world-factory/u7-4a-jobs-suite.mjs` | same |
| `dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/run-c2.mjs` | c-suite gains digest cells on the LIVE drive path (F-5, in-place per this driver's established addendum practice; existing records are history) |
| `tests/world-factory/binding-digests.test.mjs` | C1-F4a…F4g unit tests (this lane's tests, existing file per eb3 boundary — no new scannable runtime file) |

## Unit transcripts (this dir)

- `binding-digests-unit.log` — 14 tests, 14 pass 0 fail (6 pre-existing + 8 new F4 legs:
  law hand-reproduction/determinism, order-independence, missing-file null-with-reason,
  empty-set leg, real-family recompute + one-byte RED + forged-entry RED, profile-entry
  idempotence + relaunch, full-RUN-record eb3 validator/CLI clean, arc-b driver closure).
- `world-factory-node-tests.log` — full `tests/world-factory` node suite, 142/142 pass.
- `gates-tail.txt` — gate command tails (vitest FULL / typecheck / eb3 / docs:probe / artifacts).
- `vitest-full-final.log` — root `pnpm test` FULL transcript (tail; EXIT line).

**Worktree provisioning fact (disclosed, not a code fact):** a green root-vitest FULL in this
worktree required (a) `pnpm build && pnpm build:composition` (CI builds before the gate) and
(b) provisioning this worktree's own `tests/deepseek-harness-test-use` per TEST_METHODS §2
(clone from the main-checkout pristine repo — this environment's shared baseline path is not a
git repo — detached @ `639ed01539…`, porcelain 0, `pnpm install --ignore-scripts --frozen-lockfile`,
`DSH_CLIENT_COMMIT_HASH=639ed01539 pnpm run build`). Before provisioning, the R483-fl guard named
the two cross-tree suites `DSH_TEST_USE_NOT_PROVISIONED` — correct refusal, later 17/17 green
in this worktree. Nothing was written to :3080, `~/.dsh`, the shared baseline, or the main checkout.

## Honest residual list (NOT closed here)

- **Live rebind OPEN**: a future boot-lane (pool C) record must carry the non-null digest;
  R-G4R-1a closes per its chosen closure law only when such a record binds a live verdict.
  This lane made no boot and cannot close it.
- **Option-(b) census-inventory substitute ruling**: remains user/lead-owned; the cell
  pins `substituteAdoption:'none'` until such a ruling lands as tracked text.
- **R-ORACLE-1 UNTOUCHED**: the `host-sandbox-assets.mjs` dynamic-import edge
  (`:223` @candidate `5d0c8ff58`; `:228` @master tip) still sets
  `worldOracle.complete=false` on closures that include it — separate row, separate scope,
  kept separate by design (§2 of the design note).
- **Runtime admission document on the World/HTTP surface**: still absent (host surface,
  CORE PATCH BUDGET = 0 forbids minting it); disclosed inside every cell.
- **arc-b c-suite driver dry-run path**: unchanged by design (dry-run records carry no
  live binding cells; the driver header discloses).
