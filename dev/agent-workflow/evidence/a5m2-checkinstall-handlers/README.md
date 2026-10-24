# a5m2-checkinstall-handlers — audited computed-URL data-parse handlers (S7/S8)

Task: `scripts/check-install-manifest.mjs` audited-site handler extension per ROOT 20:46 ruling —
exactly TWO computed `new URL()` sites approved as pure DATA parsing; everything else still rejects.
Branch `feat/a5m2-checkinstall-handlers`, base (integration tip) `53ee0f28c4831b001b1b45380e0844f5290b8d0d`.
Sole writer: this session. No pack directories, evidence scenes, or other sessions' worktrees touched
(`.worktrees/a5-m2-int` was only ever READ by the checker runs recorded here). No installs; no Host;
nothing deleted (scratch dirs are this dir's own re-runnable fixtures).

## 1. The two approved audit points (spec table)

| # | dist-relative path | line | enclosing fn | verbatim site | expr (arg) |
|---|---|---|---|---|---|
| S7 | `packages/runtime/dist/packages/runtime/src/plugin/live/governed-families/g1-surface-adapters.mjs` | 397 | `parseRegistry(href)` (L10 registry parsing) | `const url = new URL(href)` | `href` |
| S8 | `packages/runtime/dist/packages/runtime/web-gateway/src/destination-envelope.js` | 2 | `parseHttpUrl(input)` | `return new URL(input);` | `input` |

Full sha256 of each audited file — **byte-identical at `bf4e89e108620479d1a43344a8ea74d82cfde229`
and at base `53ee0f28c4831b001b1b45380e0844f5290b8d0d`** (verified: `git show <sha>:<path> | sha256sum`
agree at both commits, and equal `sha256sum` of the working-tree file):

| path | sha256 @ bf4e89e10 | sha256 @ 53ee0f28c |
|---|---|---|
| g1-surface-adapters.mjs | `43f7fbd2cf8cb6d02207a66c4df6f3c09f19ec8f4951067b4e1390b5173c8d69` | same |
| destination-envelope.js | `ce2387c3193d057531b1d679125e26a9931a4efecd3aeb22d5bb78630e34681e` | same |

Each file contains **exactly one** `new URL(` occurrence and **exactly one** function of the named
enclosing function (grep-verified and re-enforced at check time, see §2).

## 2. Mechanism reused (NOT a new architecture)

The script already had ROOT-approved structure-matched audited-site handlers — `applyHandlers()`
(pre-change `scripts/check-install-manifest.mjs:215-287`) fed by `pending` sites collected in `scan()`
and unmatched pendings rejected at pre-change `:327-329` (`p.kind === 'url'` → `computed new URL()
target rejected`); shape helpers `enclosingFnName` / `fnNamed` / `walkNodes`; constant table style
`HOST_REL`/`BUNDLE_REL`/`SKILLS_REL`; S1–S6 consumption notes. Both audited files are scanned in the
**host** graph.

Added (this branch only):

- `scripts/check-install-manifest.mjs:44` — `createHash` import from `node:crypto`.
- `:5-19` — header SCOPE comment updated to state the two data-parse sites pin the full file sha256
  and enqueue nothing (the existing handler sentence otherwise stands unchanged).
- `:150-160` — `AUDITED_URL_PARSE_SITES` table: the exact two entries {id, rel, sha256, fn, expr}.
- `:172-174` — `sha256File()` helper (raw bytes; equals `sha256sum`/`git show | sha256sum`).
- `:295-309` — the handler block inside `applyHandlers` (mirrors S5/S6 shape): matches only when ALL
  gates hold — exact `relFile` + `graph === 'host'` + exactly-one pending `kind === 'url'` site in
  the file + file sha256 equals the table hash + `fnNamed` finds exactly one function named
  `parseRegistry`/`parseHttpUrl` + `enclosingFnName(site) === fn` + site node text is verbatim
  `new URL(href)` / `new URL(input)` (single argument by construction) + exactly one `new URL`
  new-expression inside that function. Any gate failing → site stays unconsumed → `rejected`
  (RED), byte-for-byte the pre-existing refusal path. No literal targets are enqueued (data parse —
  nothing to scan), which the generic path already permits.

Zero other behavior change: import/require/register rejections, literal-url handling, lock leg,
guard, browser/host separation untouched (existing v4 control runner: 0 failures, §4).

## 3. Gates (bare RCs)

| gate | RC |
|---|---|
| `node --check scripts/check-install-manifest.mjs` | 0 |
| BEFORE — base script vs int dist surface (`run-before-base-vs-int.log`) — **exactly the 2 URL issues**, lock PASS | 1 |
| BEFORE — base script vs own worktree surface (`run-before-base-vs-own.log`) — same 2 issues | 1 |
| AFTER — new script vs int dist surface (`run-after-new-vs-int.log`) — 0 issues, S1–S8 consumed, lock PASS | 0 |
| AFTER — new script vs own worktree surface (`run-after-new-vs-own.log`) | 0 |
| negative-controls suite (`negative-controls-run.log`) | 0 (all 9 controls PASS) |
| existing `tests/checks/install-manifest-negative-controls.sh` with the NEW script (`existing-v4-runner-with-new-script.log`) | 0 (failures=0) |

**Ledger truth (root: 当前RC1保):** on current integration HEAD the OFFICIAL RC stays **1** — the
checker committed there is still the base script and still rejects both sites. This branch flips the
checker to green **only when landed**; nothing on this branch changes any other session's tree.

## 4. Negative controls (`negative-controls.sh`, re-runnable; fixtures built fresh under `.nc-runs/`)

| ctrl | scenario (card letter) | expected | result |
|---|---|---|---|
| A1 | base surface, new script, full own dist graph (a) | RC=0; no rejection lines; S7+S8 consumed | PASS |
| A2 | same vs int dist surface, READ-ONLY | RC=0; no rejections | PASS |
| F0 | small whitelist fixture (only the two files + 1 stub, no lock) | RC=0; S7+S8 consumed; lock leg honestly SKIPPED | PASS |
| B1 | mutate 1 byte in COPY of destination-envelope.js (b) | that site RED (rejected line present, S8 note absent, S7 intact) | PASS |
| B2 | mutate 1 byte in COPY of g1-surface-adapters.mjs (b) | that site RED, S8 intact | PASS |
| C | `new URL(href)` → `new URL(href, 'http://x')` in COPY (c) | RED at :397 expr="href" (hash gate AND verbatim gate) | PASS |
| D | move destination-envelope.js to another path in COPY (d) | RED at moved path (path-pinned handler) | PASS |
| E1 | THIRD computed `new URL` site in a separate scanned file (e) | still rejected; S7+S8 still consumed | PASS |
| E2 | second computed `new URL` site added inside audited g1 copy (e) | both its sites rejected; S7 note absent | PASS |

Suite prints `PASS/FAIL … RC=` per control; suite RC=0 iff all behave as specified.

## 5. Reproduce

```bash
cd <this-branch-worktree>
node --check scripts/check-install-manifest.mjs; echo RC=$?
bash dev/agent-workflow/evidence/a5m2-checkinstall-handlers/negative-controls.sh; echo RC=$?
bash tests/checks/install-manifest-negative-controls.sh; echo RC=$?
node scripts/check-install-manifest.mjs .worktrees/a5-m2-int; echo RC=$?   # AFTER: 0 (int tip base; see §3 ledger truth)
node dev/agent-workflow/evidence/a5m2-checkinstall-handlers/tools/check-install-manifest.base-53ee0f28c.mjs .worktrees/a5-m2-int; echo RC=$?   # BEFORE: 1, the 2 issues
```

`tools/check-install-manifest.base-53ee0f28c.mjs` is the verbatim base script snapshot used for the
BEFORE runs. `.nc-runs/` (here and under `tests/checks/`) is untracked fixture scratch.
