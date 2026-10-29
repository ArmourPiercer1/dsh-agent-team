# U3-C — evidence relocation to the local content-addressed store (2026-10-25)

Branch `task/u3-evidence-relocation-20261025`, base origin/master @ `95fbe95cf094d8368faf1e356ba6b56fc5a70f15`.
Commits: `4ce4b9e1a` (tool + test + keep-set + .gitignore), `53c2f8414` (ingest + manifest + git rm).
Writer ran in `.worktrees/u3-evidence-reloc` (full checkout; the root checkout at 6259cf4b untouched).

## Numbers
- evidence tracked @ 95fbe95cf: **21,141 files / 534,944,430 B**
- KEPT tracked after relocation: **993 files / 13,081,944 B**
  = 92 inventory keep-set (runtime readers, incl. 7 Q5 README witnesses)
  + 57 doc-citations targets (30 distinct doc-link targets; 1 dir target -> its 28 files)
  + 843 evidence `*.md` (wording-lint census floor; see keepset-back-move.md)
  + 1 `EB-E0-E1/probe-run-1.log` (note verified-by pointer; see keepset-back-move.md)
- RELOCATED: **20,148 files / 521,862,486 B (~497.6 MiB)**, git rm in commit 2, no history rewrite
- store: `.artifacts/evidence/blobs/<sha256[0:2]>/<sha256>` (gitignored, local, temporary),
  **16,718 distinct blobs / 501,713,768 B**, every blob produced by `git cat-file blob <oid>`,
  written exclusive-create + read-back hash verified
- manifest `dev/agent-workflow/evidence/RELOCATED-MANIFEST.tsv` (tracked, sorted, 20,148 entries)
  sha256 = `4f49b36bbaefb9d4ca37342920aac78246678fa77554f48efc550a3f72ec7ecd`

## Verification (this dir)
| check | result | log |
|---|---|---|
| evidence-store tests (node:test, temp git repos) | 10/10 pass | evidence-store-test.log |
| verify (worktree 1 & fresh worktree 2, shared store) | pass entries=20148 findings=0 exit 0 both | worktree-du.txt, nc4-d-verify-green.log |
| verify RED while manifest paths still tracked | 20,992x GENERATION_CONFLICT exit 1 | verify-conflict.log |
| docs:sync --check | exit 0 findings=0 (was RED once: see keepset-back-move.md) | docs-sync-green.log (red: docs-sync.log) |
| docs:probe --base origin/master | exit 0 blocking=0 | docs-probe.log |
| ci-pr-gate required legs | pass=7 fail=0 skip=census (named) VERDICT pass | ci-pr-gate.log, transcripts/ |
| root vitest run2 | 19 reds = 9 tolerated census + 10 ENV classes, 0 NEW | vitest-run2.log, vitest-reds-classification.txt |
| vitest run1 (pre keep-set fix) | 2 relocation-caused reds, both moved back to keep | vitest-run1-pre-keepfix.log |
| negative: delete blob | MISSING exit 1 | negctl-1-delete.log |
| negative: corrupt blob | DIGEST_MISMATCH exit 1 | nc4-a-verify-corrupt.log |
| negative: ingest on corrupt store | STORE_CONFLICT refused exit 1 | nc4-b-ingest-conflict.log |
| recovery: rm corrupt blob + ingest | blobs_written=1 from git, verify green, blob byte-identical | nc4-c/nc4-d |
| restore --from-git with blob missing | byte-exact file restored | negctl-2-corrupt.log (1b), tests |

pnpm: install via hardlink mirror of the repo `.pnpm-store/v11` + private index.db copy
(`--frozen-lockfile --offline --store-dir .artifacts/tmp/pnpm-store-mirror`, exit 0, pnpm-install.log);
mirror deleted afterwards, main store untouched.

## Restore
`node scripts/evidence-store.mjs restore <path>... [--to <dir>]` (store) / `--from-git` (git objects).
Git history stays the durable fallback for every manifest entry (`git cat-file blob <oid>`).
