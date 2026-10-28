## G4-R phase 1 — offline binding persistence

Adds real pre-spawn profile-patch digests for every World boot (including collected suites and Jobs), per-suite oracle source digest/source inventory with retained exact byte artifact, and explicit null/reason for unavailable plane TrustedSources admission document. Adds hostTreeSha clarity alias; existing hostSha remains.

CORE PATCH BUDGET=0. No packages product edits. No Host boot; no stable GUI/home mutation.

Validation: C1+WorldFactory 44/44; profile and oracle one-byte mutation controls RED; fixture accepted by actual eb3-run-manifest CLI; manifest --new-since origin/master 0 findings; diff --check clean; p4t6 green measured delta 0. Local ci-pr-gate result recorded in README/evidence.

No new authoritative product write path. This does not retroactively repair historical candidate records, assert live C2, or promote G4. README is phase-2 input.

### Review round 2 (2026-10-28) — 补充内容 R-G4R-1 closed

Four review findings fixed in `tests/world-factory/lib/binding-digests.mjs` + its callers, no `packages/**` change and no `scripts/eb3-run-manifest.mjs` change:

* **F1** the oracle closure now follows static/re-export/side-effect imports, `import('<lit>')`, `import(new URL('<lit>', import.meta.url).href)`, `import(pathToFileURL(join(REPO_ROOT|HERE, …)).href)` and literal `readFileSync` reads, resolved per importing file and followed anywhere inside the repo root — suite 120 binds `packages/tools/agent-state-family/src/fs-state-store.mjs`. Bare specifiers are listed in `externalSpecifiers` (never followed); a non-literal `import()` records `unresolvedDynamicImports` and sets the cell `complete: false`.
* **F2** `worldOracle.sources` are repo-relative posix paths in the hashing order, the record carries the exact `hashLaw`, the oracle artifact is cited from `record.evidence` with its sha256 (graded by the unchanged eb3 validator), and `recomputeWorldOracle(record, repoRoot)` reproduces the digest from a different checkout root.
* **F3** the profile digest is the hash of the Buffer written for the launch (evidence copy written from that same Buffer); after the spawn the launched file is re-read and re-hashed, and any difference sets `composedProfileDigestMismatch: true` on the record and fails the boot closed.
* **F4** the blank line at EOF in `p4t6.log` is stripped; `git diff --check origin/master...HEAD` is clean.

Round-2 gates in `round2-gates.log`; C1 RED/GREEN in `c1-round2.log`; per-suite closures and the documented helper exclusions in `README.md` + `closure-round2.log`. Stray scratch `.artifacts-g4r-gate.log` in the worktree root removed (byte-identical duplicate of the committed `ci-pr-gate.log`).
