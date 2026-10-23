# A5M2 sched-C2 — dry-world allocation receipt (caliber + existing receipts)

> WORDING CORRECTION (root 23:3x): "unique" below is the **logical byte
> sum (Σ stat %s) of uniquely-linked (nlink==1) files** — files not
> hardlink-shared with the store. It is NOT allocated-blocks and NOT a
> claim of physical exclusivity. Per-file st_blocks was measured NOWHERE
> (no existing receipt carries st_blocks; explicitly UNVERIFIED); ext4
> block accounting (tails/metadata) is not covered. No re-scan performed.

Root ask: supplement the 141.1MB deduplicated logical / 45.64MB-per-world
figures with exact receipt paths and the measurement caliber. No new scans;
all numbers below were measured once (read-only) at 22:57-23:0x and quoted
since; this file persists them. No install, no Host, no deletion.

## Caliber (algorithm)
- filesystem: ext4 on /srv/workspace (measured `df -T`; no reflink, no
  dedup daemon) => on-disk sharing exists ONLY as hardlinks (nlink >= 2).
- **apparent** = `du -sb <world>` — counts EVERY hardlink path at full
  size (inflates; NOT new disk).
- **unique (deduplicated logical bytes of uniquely-linked files)** = sum of
  `stat -c %s` over `find <world> -type f -links 1` — nlink==1 files are
  not hardlink-shared with the shared warm store (tests/homes/.pnpmm-r18-store) or the fixture and is
  NOT new disk. Scope = the world directory only; the store was never
  scanned.
- kit-side enforcement uses the same unique caliber
  (`duBytes()` in a5m2-schedule-c2.mjs: find -links 1 + stat sum).

## Per-world numbers (measured once, this session, read-only)
tests/homes/ prefixes omitted; each also has a
dev/agent-workflow/evidence/a5m2-schedule-c2/run-dry-<stamp>/ directory.

| world (…-dry-<stamp>ZZ)          | apparent B | unique B   |
|----------------------------------|-----------:|-----------:|
| 2026-10-23T22-48-51-872          |    578,960 |    578,960 |
| 2026-10-23T22-49-57-827          |    578,960 |    578,960 |
| 2026-10-23T22-50-53-751          |    612,498 |    612,498 |
| 2026-10-23T22-51-33-123          |    612,498 |    612,498 |
| 2026-10-23T22-51-58-962          |    612,498 |    612,498 |
| 2026-10-23T22-52-13-761          |    612,498 |    612,498 |
| 2026-10-23T22-52-46-009          |    612,498 |    612,498 |
| 2026-10-23T22-54-13-589          | 449,614,455 | 45,636,917 |
| 2026-10-23T22-55-18-956          | 449,616,358 | 45,638,820 |
| 2026-10-23T22-56-05-203          | 449,617,736 | 45,640,198 |

Totals (10 worlds): apparent 1,353,068,959 B (du inflation from hardlinks);
**unique (uniquely-linked) logical bytes total 141,136,345 B (≈141.1 MB)**
= 7 × ~0.6 MB (pre-install-stage failures) + 3 × ~45.64 MB (installed
surfaces; the frozen --offline link pass copies ~45.6 MB of non-shared
files per world from the pinned store, 0 downloads). st_blocks/physical
block accounting: UNVERIFIED (measured nowhere, per banner).

## Existing machine-written receipts (kit-side)
- …/run-dry-2026-10-23T22-56-05-203Z/dry-receipts.json → budgetInstallBytes
  = 45,640,198 (unique-logical caliber, final GREEN dry world).
- each run-dry-*/results.json → rc + results + transcript (budget CAPS are
  in the kit source; the per-run "world total" line went to console/tool
  output, NOT into results.json — disclosed).
- …/run-dry-2026-10-23T22-56-05-203Z/lock-diff.json + committed
  dev/agent-workflow/evidence/a5m2-schedule-c2/edge-diff-72e.json (the
  accepted 79-pkg/112-edge facts).

## Window budget meaning
A granted window allocates ONE world: ~45.64 MB unique install +
state ≤ 100 MB + evidence ≤ 100 MB, hard total ≤ 250 MB, on top of the
already-accounted 141.1 MB of dry predecessors (deletion authority a356
only; nothing deleted by this lane).
