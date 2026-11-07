# RECON-CONSOLIDATE — the five face reports and the independent review, landed as one evidence drop

**Date**: 2026-11-13
**Record class**: `DEV-LIVE` engineering evidence · `eligible = false` · no matrix grade, no `V@B`, no Q7/Authority/Required-CI change, no `release` movement, no substitute for an independent `CANDIDATE-C2`.

## Why one drop instead of six merges

Six evidence-only PRs (#657 FS, #655 Search, #660 Shell/PTY, #658 Web, #656 External, #662 Review) were ready at
once on evidence-only branches. Each one merged would move `master` and put the other five `BEHIND`, forcing six
serial "update branch → 10-minute CI → merge" cycles for files that touch nothing but
`dev/agent-workflow/evidence/`. This drop carries **their content verbatim** (taken with
`git checkout <branch> -- <evidence dir>`), and the originals are closed as superseded with a pointer here.

The drivers stay on their branches (they are test infrastructure, not evidence): `tests/world-factory/drivers/a5sf-recon-fs/`,
`.../a5sf-live-member/recon-search.mjs`, `.../a5sf-recon-external/`, and the two-Member driver under
`dev/agent-workflow/evidence/a5sf-pd17-fs/run-boot.mjs` (already merged with PD-17).

## What the drop contains

| face | evidence | the one sentence it establishes |
|---|---|---|
| A FS | `a5sf-recon-fs/` | `read`/`write`/`edit`/`read_image` were served by the base host `ctx.fs` (`fs-sandbox`), 0 facts, ceiling-outside and `/etc/hostname` all succeeded — **fixed by #664 (PD-17)** |
| B Search | `a5sf-recon-search/` | `grep`/`glob` ran the pinned host module on the inherited `subprocess`; a one-workspace Member read `../out-of-lane/secret` with 0 facts — **fixed by #661 (PD-16)** |
| C Shell/PTY | `a5sf-recon-shell/` | transient `bash` **is** on the confined terminal face; persistent PTY and managed Jobs are `NOT_WIRED` on this preset; archive quiesce window 8.56/8.72 s; and the old "payload never in argv" claim is **false** (see ARGV-ERRATA #663) |
| D Web | `a5sf-recon-web/` | `web_fetch`/`web_search` reachable and guard-evaluated; deny refuses at **service admission** (`NETWORK_UNCONFINED_REALM`), **not** OS isolation |
| E External | `a5sf-recon-external/` | **zero** governed execution paths; only `job_list`/`skill`/`workflow` have executable bodies, 0 Alpha.5 facts; `run_code`/`lsp`/MCP not wired |
| Review | `a5sf-recon-review/` | the three numbers: **governed tools = 1 (bash at review time)**, on-surface-but-ungoverned = **42 names** (10 live-proven callable with 0 facts), not-on-surface = **10 names + MCP family**; and a two-Member boot proving governed `bash` does not cross Members while native `read`/`grep` did |

## Reading rule

These are **measurements of a frozen SHA** (`235e1af8b`, host `639ed01539`), not statements about today's `master`.
FS and Search have since been fixed (#664, #661) and the reviewer's number 1 is now stale in the good direction:
`bash`, `grep`, `glob`, `read`, `write`, `edit` are all on confined faces as of `03e2edf87`, while web/workflow and
the fact-attribution gap (`tool`/`callId` null) remain open. Do not quote a report's FAIL as current without
checking what landed after it.
