# keep-set back-moves during verification (ruling: NEW red -> move file back to keep)

## 1. EB-E0-E1/probe-run-1.log (1,235 B)
reader: .agents/notes/implemented/EB-ADR-0003-document-consistency-gates-implemented.md verified-by -> docs:sync NOTE_note-verified-by-missing
evidence: docs-sync.log (RED) -> docs-sync-green.log

## 2. all 843 tracked *.md under dev/agent-workflow/evidence/ (11,249,186 B)
reader: packages/runtime/test/a5p1r-gg-wording-lint.test.ts:74 census floor filesScanned>100 over
  ALL dev/agent-workflow markdown via scripts/lint-g-g-wording.mjs lintRepo(); relocation left 59
evidence: vitest-run1-pre-keepfix.log (FAIL 59 !> 100) -> vitest-run2.log (green)

# paths:
