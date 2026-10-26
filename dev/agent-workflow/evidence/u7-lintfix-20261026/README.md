# lint-identities leg: `.artifacts/**` must be outside the ESLint scan

**Task:** U7 test-infra fix (EB2-C / §7.6 lint leg). **Date:** 2026-10-26.
**Class:** test-infrastructure only. No product code, no protected center file, no gate verdict changed.

## Defect

`scripts/lint-identities.mjs` runs `npx eslint . --format json`. ESLint does not read
`.gitignore` (`eslint.config.mjs:21-28` states this — it is why `.pnpm-store/**`,
`.tmp-*/**` and `**/.scratch/**` are enumerated there). `.artifacts/**` — the gitignored local
evidence mirror and the root-checkout disposition holding areas — was NOT enumerated, so the
scan walked it.

That tree is a **mirror of this repository**: it carries its own `eslint.config.mjs`,
`node_modules`, and relative symlinks into `.worktrees/…` trees that later cleanup removes.
Once those targets are gone the symlinks dangle, and ESLint's `readAndVerifyFile` dies on
`open()`.

Observed at root checkout `37f349074` (33 dangling symlinks under `.artifacts/evidence`):

    Error: ENOENT: no such file or directory, open
      '…/.artifacts/evidence/root-untracked/dev/agent-workflow/evidence/alpha5/mcp-live/
         assembly/mirror-base/packages/contracts/src/dto/blueprint-snapshot.d.ts'
        at async open (node:internal/fs/promises:1345:25)
        at async readAndVerifyFile (…/eslint-helpers.js:1306:16)

Exit 2, **zero-byte stdout**. The §7.6 leg then reports
`lint-identities NOT RUN (exit 2) — an ESLint run that produced no parseable JSON has no
opinion about identity diffs`. So a local-only, gitignored scratch artefact makes the merge
gate red for a reason that has nothing to do with any identity.

## Planted control (measured, clean worktree, same command)

| tree state | exit | JSON stdout | verdict |
|---|---|---|---|
| clean `master` worktree | 1 | 3,285,693 B (1385 files) | leg can decide |
| one dangling symlink planted at `.artifacts/evidence/probe/dead/x.d.ts` | **2** | **0 B** | leg reports NOT RUN |

## Fix

`.artifacts/**` added to `eslint.config.mjs` `ignores`, next to the two lines that already
exist for the same mechanism, with the measurement recorded in the comment.

## Proof the fix holds and hides nothing

| check | before | after |
|---|---|---|
| planted dangling symlink present, `npx eslint . --format json` | exit 2, 0 B stdout | **exit 1, 3,285,693 B stdout** (`ENOENT` absent) |
| `lint-identities --diff …0237d487.txt` universe | 1385 files | **1385 files** (unchanged) |
| new / resolved identities | new 0, resolved 0 | **new 0, resolved 0** (unchanged) |
| tracked files under `.artifacts` (must stay 0) | 0 | **0** (`git ls-files .artifacts \| wc -l`) |

§7.6's census (`a4p7-merge-gate.test.ts:1327-1379`) enumerates **tracked** lintable files and
classifies what ESLint refuses to read against `RATIFIED_INVISIBLE_PREFIXES`. `.artifacts`
contributes zero tracked files, so this ignore line cannot hide a tracked file from that
census — the guard's denominator is untouched, which is why the universe count is identical.

## Not claimed

- This does not make the `install` leg pass. That leg writes to the pnpm store; under the
  workspace-write file policy the global store at `/home/user/.local/share/pnpm/store/v11`
  is outside the writable root and pnpm fails with `ERR_SQLITE_ERROR: unable to open database
  file`. The gate ships a documented workaround (`--store-dir` / `DSH_CI_STORE_DIR`,
  `scripts/ci-pr-gate.mjs:1313,1613,1640`); the leg is run with it and that is disclosed, not
  hidden.
