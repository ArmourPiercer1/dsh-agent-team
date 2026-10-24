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

## Sanctioned st_blocks pass (root 23:4x, one read-only stat, (dev,ino)-deduped)
Caliber: `find <world> -type f -printf "%D %i %b %n"` piped to awk; unique
inodes counted ONCE; nlink==1 => lane-EXCLUSIVE blocks (×512); nlink>1 =>
store-SHARED blocks (fixed Host co-owned, NOT charged per world); repeated
(dev,ino) paths inside one world = internalDupPaths (3,832/installed world,
first occurrence bucketed by its nlink). The store tree was NOT scanned.
Per-world (blocks):
- 7 pre-install worlds: exclusive 589,824-622,592 B each; shared 0.
- 3 installed worlds: exclusive 46,481,408 / 46,481,408 / 46,489,600 B
  (584-586 files); shared (nlink>1) 464,314,368 B each (22,618 files —
  the same inodes recur across the three listings; a single inode means
  one physical block set, counted once; the remaining links' locations
  were NOT enumerated — store tree not scanned — co-owned, not charged).
Lane-exclusive TOTAL (blocks) = 140,424,960 B (≈140.4 MB) — matches the
nlink==1 logical-size 141,136,345 B within 0.7% tail rounding, CONFIRMING
the earlier figure's substance under proper block accounting.
WINDOW FIT: next window install exclusive ≈ 46.5 MB blocks + state ≤100 MB
+ evidence ≤100 MB = ≤246.5 MB < 250 MB total budget ⇒ headroom confirmed
(margin ~3.5 MB worst-case; typical run far below). Disk free at pass:
10,312,256 KB (~10.3 GB).
Note: one earlier spot-check confused find's %h (path prefix) with link
count; corrected field is %n; the shared/exclusive split above uses %n.

## Real Node resolution of the 15 pins (root 00:0x, one read-only pass)
Lock DECLARATION vs Node ACTUAL resolution are separate columns in
real-resolution-15-ab05f5c2f.json: createRequire anchored at the reuse
install (resolution starts at its node_modules; upward-leak guard = every
realpathSync must stay under the reuse install) + package.json version +
realpath per package. Result 15/15: declared == resolved (12x dsh
0.2.0-rc.2, cordis 4.0.4 [include@1.0.9/loader@1.0.5 peer suffix in the
.pnpm path], yaml 2.9.0, zod 4.4.3), 0 leaks to the main repo.
WORDING: the fresh reuse-world figure 1,591 B is LOGICAL BYTES (stat %s
sum), not allocated blocks; no re-scan performed on account of it.
