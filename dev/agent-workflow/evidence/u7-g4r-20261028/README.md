# G4-R phase 1 binding evidence

Offline-only implementation; no Host boot and no writes to `:3080`/`~/.dsh`.

## Gates and delivery

Frozen install succeeded with `.tmp-pnpm-store`. Local `node scripts/ci-pr-gate.mjs --store-dir .tmp-pnpm-store` exited 0: 7 pass / 0 fail / 1 explicit default census skip (not a census PASS), 253 seconds. Manifest: 99 records / 11 incomplete disclosed / 0 findings. `git diff --check` clean. PR #426, no merge; remote CI conclusions are reported separately after checks settle. Round-2 re-runs of every gate are recorded in `round2-gates.log`.

## Cells

* `composedProfileDigest` is recorded per World and per boot by `TestWorldFactory.startHost`. The digest is SHA-256 of the exact Buffer read from the World's materialized `cordis.patch.yml` immediately before the Host spawn — including comments and the final newline — and the retained evidence copy is written **from that same Buffer** (`writeFileSync(path, bytes)`, never a second read, never a re-serialized "equivalent" document), so artifact bytes and recorded digest are identical by construction; the capture throws if they ever disagree. **After** the spawn the factory re-reads the file the child was handed and re-hashes it (`verifyProfileBindingLaunched`): agreement is recorded as `launchedDigest` + `composedProfileDigestMismatch: false`, and a disagreement sets `composedProfileDigestMismatch: true` on the record bindings and fails the boot closed. Capture fails closed above 1 MiB; content-addressed copies preserve distinct restart patches. This is the same profile patch the World launches, not an invented normalized object.
* `worldOracleDigest` and `worldOracle: {suite, digest, complete, entry, sources, order, hashLaw, excludedHelpers, externalSpecifiers, unfollowedPaths, unresolvedDynamicImports, unresolvedLiteralReads, literalReadsComplete, missingSources, artifactPath, artifactSha256, evidence}` bind the PER-SUITE executable oracle sources. Starting at the selected suite module (or the core/Jobs runner module), the closure follows **every literal edge**: `import … from '<lit>'`, bare `import '<lit>'`, `export … from '<lit>'`, `import('<lit>')`, `import(new URL('<lit>', import.meta.url).href)`, `import(pathToFileURL(join(REPO_ROOT|HERE, '<lit>', …)).href)`, and literal `readFileSync(new URL('<lit>', import.meta.url) …)` / `readFileSync(join(<root id>, '<lit>', …))` — so a `.json` answer key read by literal path is bound too. Edges are resolved **relative to the importing file** and followed anywhere inside the repo root: the closure is no longer confined to `tests/world-factory` (u7-astore now binds `packages/tools/agent-state-family/src/fs-state-store.mjs`, dynamically imported at `suites/120-u7-astore.mjs:79` and `:247`). Bare specifiers (`node:*`, `@deepseek-ai/…`) are NOT followed and are disclosed in `externalSpecifiers`; a path resolving outside the repo root is disclosed in `unfollowedPaths`. **Fail-closed:** a dynamic `import()` whose specifier is not a string literal (or whose root identifier is not one of the documented ones) is recorded in `unresolvedDynamicImports` as `file:line` and sets the cell `complete: false`; an unreadable closure file is recorded in `missingSources` and does the same. A literal `readFileSync` whose path is computed at runtime (world state, host log, the version-addressed authority snapshot) is a runtime input, not an answer key: it is disclosed in `unresolvedLiteralReads` with `literalReadsComplete: false` rather than voiding every oracle that touches a World directory.
  `worldOracle.sources` are **repo-relative posix paths only**, in the exact hashing order, and the record states the law it was computed under:
  `hashLaw = sha256(concat(for each source in worldOracle.sources order: utf8(repo-relative posix path) + 0x00 + raw file bytes + 0x00))`, sources ordered by lexically ascending repo-relative posix path. `recomputeWorldOracle(record, repoRoot)` re-derives the digest from that list under any checkout root (C1-F2 does exactly that against a copy of the sources). The base64 byte-copy artifact (`u7-oracle-source-artifact/2`, capped at 1 MiB, measured 88–254 KiB per suite) is written to the run evidence directory and **cited from the RUN record's `evidence` list** as `{path, sha256, kind: 'world-oracle-source-artifact'}` with a repo-relative path, so `scripts/eb3-run-manifest.mjs`'s existing `RUN_EVIDENCE_MISSING` / `RUN_EVIDENCE_DIGEST_MISMATCH` rules grade it — the validator needed no change and stays backward compatible. No generic oracle is substituted for ARC-A; external inputs remain Team/Host SHA-bound.
* `trustedSourcesDigest` remains `null`. The runner public World/HTTP surface exposes no plane TrustedSources/admission-source document or digest. `authoritative-tool-sources.v1.json` is a census/inventory input, not the plane's recorded admission source document, so hashing it would fabricate the requested fact. The record carries `trustedSourcesUnavailableReason` naming this public limitation.
* `hostTreeSha` is an explicit clarity alias for the pristine Host checkout SHA; existing `hostSha` is retained unchanged. No misleading new product/Team SHA is introduced.

## Per-suite oracle closure — what is excluded and why

The walk excludes exactly three helper modules, and the exclusion is never silent: every excluded file the walk actually reaches is listed in that record's `worldOracle.excludedHelpers`. None of the three defines an expected answer — the first launches Worlds, the second discovers suites, the third computes bindings:

| excluded file | why it is excluded from every oracle closure |
| --- | --- |
| `tests/world-factory/lib/world-factory.mjs` | World launcher: port leases, DSH_HOME creation, patch materialization, `DshInstance` spawn, HTTP helpers. No verdict is ever read from it. It also performs directory-scanning dynamic imports with computed specifiers (through `lib/suites.mjs` and `lib/world-kinds.mjs`), which are launcher mechanics; binding them would force every suite's cell to `complete: false` while adding no answer bytes. |
| `tests/world-factory/lib/suites.mjs` | Suite registry: `readdirSync`s `tests/world-factory/suites/` and `import(pathToFileURL(join(dir, file)).href)`s each entry — a non-literal specifier by construction. Every suite it can load is bound by its own per-suite oracle cell, so this module carries no expected answer of its own. |
| `tests/world-factory/lib/binding-digests.mjs` | This binding helper. It computes digests; it is not a verdict source. Binding it would make the oracle digest depend on its own hasher (self-reference) with zero added verdict coverage. It is still covered by the repo's own test/lint gates and by git provenance. |

Measured closures on this tree (measured by `tests/world-factory/lib/binding-digests.mjs` over every collected suite plus both runner entries; the capture of that run is `closure-round2.log`): every cell is `complete: true`, and the only excluded helpers ever encountered are the ones listed above.

| suite entry (oracle `entry`) | sources bound | out-of-`tests/world-factory` files bound | excluded helpers encountered | disclosed non-literal reads |
| --- | --- | --- | --- | --- |
| `suites/010-u6-fs.mjs` | 3 | `tests/kits/_shared/preset-seam.mjs` | `world-factory.mjs` | — |
| `suites/020-u6-proc.mjs` | 4 | `tests/kits/_shared/preset-seam.mjs` | `world-factory.mjs` | — |
| `suites/030-u6-jobs.mjs` | 4 | `tests/kits/_shared/preset-seam.mjs` | `world-factory.mjs` | — |
| `suites/040-u6-arc-a.mjs` | 5 | `tests/kits/_shared/preset-seam.mjs`, `tests/paths.mjs` | `world-factory.mjs` | — |
| `suites/050-u6-arc-d.mjs` | 4 | `tests/kits/_shared/preset-seam.mjs` | `world-factory.mjs` | — |
| `suites/060-u7-fs-mut.mjs` | 4 | `tests/kits/_shared/preset-seam.mjs` | `world-factory.mjs` | — |
| `suites/070-u7-f-web.mjs` | 5 | `tests/kits/_shared/preset-seam.mjs`, `tests/paths.mjs` | `world-factory.mjs` | — |
| `suites/070-u7-pwsh.mjs` | 4 | `tests/kits/_shared/preset-seam.mjs` | `world-factory.mjs` | — |
| `suites/080-u7-agent-control.mjs` | 4 | `tests/kits/_shared/preset-seam.mjs` | `world-factory.mjs` | — |
| `suites/080-u7-f-ui.mjs` | 4 | `tests/kits/_shared/preset-seam.mjs` | `world-factory.mjs` | — |
| `suites/110-u7-fagentb.mjs` | 5 | `tests/kits/_shared/preset-seam.mjs` | `world-factory.mjs` | — |
| `suites/120-u7-astore.mjs` | 5 | `packages/tools/agent-state-family/src/fs-state-store.mjs` (dynamic, lines 79 + 247), `tests/kits/_shared/preset-seam.mjs` | `world-factory.mjs` | `lib/u7astore-assembly.mjs:235` (store ledger files under the World home = world state) |
| `u5-canary-runner.mjs` (`core`) | 10 | `tests/paths.mjs`, `tests/characterization/lib/util.mjs`, `tests/kits/rc2-real-host-smoke/{run-control,run-budget}.mjs` | `world-factory.mjs`, `suites.mjs`, `binding-digests.mjs` | `lib/port-lease.mjs:163` (lease slot), `lib/run-record.mjs:166` (version-addressed authority snapshot), `u5-canary-runner.mjs:364` (a World's patch file) |
| `u7-4a-jobs-suite.mjs` (standalone runner) | 10 | `tests/paths.mjs`, `tests/kits/_shared/preset-seam.mjs`, `tests/kits/rc2-real-host-smoke/{run-control,run-budget}.mjs` | `world-factory.mjs`, `binding-digests.mjs` | `lib/run-record.mjs:166` |

`tests/kits/_shared/preset-seam.mjs` and `tests/paths.mjs` are NOT excluded: they carry preset/plant shapes and the host/port pins the verdicts depend on, so they are oracle bytes. The pre-spawn closure of every suite above is byte-identical to what a cold reader gets from the committed tree, because the closure is a pure function of repo-relative paths.

Lane runs pass `--evidence dev/agent-workflow/evidence/<lane>/c2` (inside the repo — the raw World logs already live there), so the cited `u7-oracle-source-artifact/2` JSON is committed next to the RUN record it belongs to: a cold reader who checks out the PR can open the artifact, verify its sha256 against the record, and rerun the hashing law over the source list. When a runner is pointed at an evidence directory outside the repo root, the citation is simply empty (`worldOracle.evidence: []`, `oracleArtifactPath` still absolute) rather than a dangling evidence entry that `RUN_EVIDENCE_MISSING` would have to refuse.

## C1

`tests/world-factory/binding-digests.test.mjs` (6 tests, all green — `c1-round2.log`):

* **C1-F1a** suite 120's closure contains `packages/tools/agent-state-family/src/fs-state-store.mjs` and is `complete: true`; bare `node:*` specifiers are disclosed not followed; the `world-factory.mjs` exclusion is disclosed in `excludedHelpers`.
* **C1-F1b** a fixture with a computed `import(x)` yields `complete: false` with `unresolvedDynamicImports: ["entry.mjs:3"]`.
* **C1-F1c** the fixture's `import(new URL("./leaf.mjs", import.meta.url).href)` edge IS bound; changing one byte in that dynamically imported file makes `recomputeWorldOracle` mismatch → **mutation RED**.
* **C1-F2** every recorded source is repo-relative posix and in recorded order, the digest recomputes in this checkout AND in a different root holding a copy of the sources, and the cited artifact hashes to the recorded `sha256`.
* **C1-F3** capture hashes the launch Buffer; the evidence copy equals it; after an unmodified spawn the proof passes (`composedProfileDigestMismatch: false`, and `bindWorldProfile` is identity-idempotent so the pre-spawn + post-spawn publishes stay one entry). An injected writer that mutates the launch file between capture and spawn makes `verifyProfileBindingLaunched` throw and sets `composedProfileDigestMismatch: true` on the bindings → **RED, fails closed**.
* **cells** the profile and oracle digests equal their on-disk artifacts, one-byte tamper on either is RED, a fixture `u5-run-record/1` with all new cells plus the cited oracle artifact validates through the exported `validateRunRecord` with 0 findings, tampering the cited artifact yields exactly `RUN_EVIDENCE_DIGEST_MISMATCH`, and the actual `scripts/eb3-run-manifest.mjs --paths` CLI grades the fixture `records=1 findings=0`.

Observed: C1 GREEN (6/6); 43 world-factory tests GREEN. No pre-implementation failing run was recorded, so this is mutation RED/GREEN rather than a claim of captured TDD RED. The C1 fixture artifacts are written under the gitignored `.artifacts/tmp/u7-g4r-c1/` so no test dirties the tracked tree.

Collected suites and standalone Jobs bypass `bootWorld`; the factory-level pre-spawn callback captures their REAL patch bytes too, so none needs a guessed/stale profile digest. A runner that creates no World has an empty digest map, not a launched-profile claim. Restarts retain per-boot entries and content-addressed evidence copies.

Measured p4t6: `pnpm exec vitest run packages/testkit/test/p4t6-session-event-scan.test.ts` exits 0 with the new files on disk and no booking; scannable delta is 0 (`tests/world-factory` is outside the packages scanner). No packages path or booking was changed.

## Review round 2 (2026-10-28) — findings F1–F4 closed

| finding | fix | where |
| --- | --- | --- |
| **F1 (HIGH)** oracle closure missed dynamic imports and files outside `tests/world-factory` | a paren-matched call scanner (`callSites`/`matchParen`/`splitArgs`) plus `readEdges`/`classifyArgument` bind static, re-export, side-effect, dynamic, `new URL`, `pathToFileURL(join(root, …))` and literal-`readFileSync` edges; each is resolved relative to the importing file and followed anywhere inside the repo root; bare specifiers → `externalSpecifiers`, outside-root paths → `unfollowedPaths`, non-literal `import()` → `unresolvedDynamicImports` + `complete: false` | `tests/world-factory/lib/binding-digests.mjs`, C1-F1a/b/c |
| **F2 (HIGH)** `worldOracle.sources` were absolute paths | sources are repo-relative posix paths in the hashing order; `hashLaw` + `order` are recorded and enforced by `recomputeWorldOracle(record, repoRoot)`; the oracle artifact is cited from `record.evidence` (`{path, sha256, kind}`) so the unchanged eb3 validator grades existence + digest | `binding-digests.mjs` (`captureOracleBinding`, `recomputeWorldOracle`), `u5-canary-runner.mjs`, `u7-4a-jobs-suite.mjs`, C1-F2 + cited-artifact assertions |
| **F3 (MED)** capture hashed a copy, then launched the original | the digest is taken over the Buffer that is written for the launch and copied to evidence from that same Buffer; `verifyProfileBindingLaunched` re-reads the launched file after the spawn and throws on mismatch, writing `composedProfileDigestMismatch` into the record bindings before the boot fails closed | `binding-digests.mjs` (`captureProfileBinding`, `verifyProfileBindingLaunched`, `bindWorldProfile`), `lib/world-factory.mjs` `startHost`, C1-F3 |
| **F4 (LOW)** `git diff --check` flagged a blank line at EOF | trailing blank line stripped from `p4t6.log` (single final newline kept) | `dev/agent-workflow/evidence/u7-g4r-20261028/p4t6.log` |

`scripts/eb3-run-manifest.mjs` was deliberately **not** changed: it already grades `record.evidence` entries (`{path, sha256}`), so citing the oracle artifact there buys validator coverage with zero schema churn, and `recomputeWorldOracle` is the C1-level recompute helper the review allowed as the alternative.
