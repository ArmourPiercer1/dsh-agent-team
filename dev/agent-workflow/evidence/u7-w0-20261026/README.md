# u7-w0 — per-lane drop-in registries + widened test port bands (2026-10-26)

Branch `task/u7-w0-dehotspot-ports-20261026`, worktree `.worktrees/u7-w0`, base `origin/master`
`88107ad71`. One writer. **Scope: test, build and doc infrastructure only.** This PR makes
zero changes under `packages/**/src/**` and zero changes to protected-center files.
`team-tool-plane.mjs` is untouched. Zero Host boots, and zero real binds beyond the TCP-connect
probes the lease code already runs.

Every number below was measured on this tree. The receipt sits beside this file.

## Why

Across the 7 merged U7 PRs, these files were touched by two or more PRs: p4t6 booking (3×),
world-factory test/runner/lib (3×/2×/2×), `scripts/place-dist-glue.mjs` (2×) and
`eslint.config.mjs` (2×). Every one of those conflicts was a mechanical "keep both". Each one
still cost a master re-merge plus about 18 minutes of census rerun. The fix is the same for all
of them: one per-lane file in a directory, collected by enumeration, so a new family lane **adds
a file and edits no shared list**.

## Task A — registries, before → after

### A1. p4t6 scannable-file ledger

| | before (`88107ad71`) | after |
| --- | --- | --- |
| where | 75 `SCANNED_PATHS_<LANE>` arrays in `packages/testkit/test/p4t6-session-event-scan.test.ts` (3927 lines). Two hand-kept 73-term sum sites, a 70-entry presence loop, 70 tie lines, and the retired pair. | `packages/testkit/test/p4t6-bookings/<lane>.json`: 76 files (75 migrated + `u7w0.json`), plus `load-bookings.mjs` and its `.d.mts`. Test file is now 2039 lines (the lineage prose is kept; the 1709 lines of arrays, sums, presence loop and ties moved into the bookings). |
| a new lane edits | that test file at 4 sites | nothing; it adds one `<lane>.json` |
| law | exact `filesScanned` and `files.length` = 983 + Σ lists; every path present by path; retired pair absent; per-lane ties | **unchanged and still exact.** `checkLedger()` requires both totals to equal 983 + Σ paths. Bookings marked `countedInBase` are A4PR0/A4PR1, which sat inside the 983 before too. It also checks every booked path is present, every `retires` path is absent, no path is booked twice, no lane is booked twice, and every declared tie holds. |
| measured total | 1306 | 1308 (1306 + the two u7-w0 loader files, booked as `u7w0.json` with `expectedDelta 1306→1308`) |

The migration was mechanical and verbatim, done by [migrate-p4t6.mjs](migrate-p4t6.mjs), which has
a `--check` mode. It carries over paths, per-path notes, the comment above each array (→
`reason`), the comment above each tie (→ `tieNote`), and the tie arithmetic (→ `expectedDelta`,
parsed from the source and never retyped). Disclosed quirks of the old file are kept, not fixed:
- A5SRGP's tie was written twice. It is recorded once, with both line numbers.
- Five lists never had a tie (A474FAILCLOSED, A4P76PIN, A4W6, A5PR1R, A4PR0). They get
  `expectedDelta: null`, and the loader allows `null` only on migrated bookings.
- Two prose-only ties are returned to their lanes.
- Five lists were in the sums but not in the presence loop (A5JOBSISO/2, A5P4PROV, A5PR1R, FDREC).
  They are now presence-checked too. All their paths were present when measured.

Three suites that read the old in-file lists by text now read the bookings instead, keeping the
same law: `a5p5-dormant-audit`, `a5p7-lane-hygiene` (a booking line naming a lane must still be a
single quoted path entry, and non-vacuous) and `a4p7-merge-gate` (the spec must be an ENTRY of
`a4p76gate.json`'s `paths`, not a mention).

**RED-first controls** (in the p4t6 suite, `ledger sensitivity`; each one mutates only the
ledger's input):
- An unbooked new path causes a `total` failure.
- The same path booked by two lanes causes `double-booked`, even with the sum fixed up.
- A lane in two files causes `duplicate-lane`.
- A booked path that left the tree causes `booked-but-absent` and `total`.
- A dropped entry with its file still on disk causes `total`.
- A resurrected retired path causes `retired-but-present` and `total`.
- A skewed tie causes `tie`.
- The loader refuses malformed, misnamed, tie-less new, extra-key and non-`packages/**` files.

Real-suite RED: with `u7w0.json` moved aside, the coverage leg read
`scanner counts 1308, ledger derives 983 + 323 = 1306`
([p4t6-RED-real-suite.txt](p4t6-RED-real-suite.txt),
[p4t6-RED-unbooked-u7w0.txt](p4t6-RED-unbooked-u7w0.txt)).

### A2. `PLACEMENTS` (`scripts/place-dist-glue.mjs`)

| | before | after |
| --- | --- | --- |
| where | 38-entry in-file array | `scripts/dist-placements/{010-runtime-live-rows,020-runtime-entry-deps,030-fs-family,040-process-family,050-search-family}.json` (8/3/15/5/7) |
| order | array order | **explicit**: file-name prefix, then order within the file; the loader refuses a duplicate prefix |
| export | `PLACEMENTS` | same name and shape (frozen); `loadPlacements(dir)` and `PLACEMENTS_DIR` are also exported |
| guards | none | fail-closed on schema, file name, mirror law `dist === packages/runtime/dist/<src>`, duplicate src/dist, empty dir, and a glue that is not `PLACEMENTS[0]` (composition-smoke reads it as THE glue) |

Before and after are identical in order and content
([placements-before-after.txt](placements-before-after.txt)), and
`check-artifacts-committed` stays OK with `glue=38`. Two consumers moved with it:
`alpha5-search-backend` (M4/M5 used to read the script text with a regex and now read the JSON),
and the fixture copier in `a4p75-composition-smoke-classification` (it now also copies
`dist-placements/`, digest-proven).

**RED-first** ([tests/checks/dist-placements.test.mjs](../../../../tests/checks/dist-placements.test.mjs), 7/7):
- A removed placement shows up as a tracked-but-unplaced mirror file. The tracked dist mirror must
  equal the placement set; previously check D only compared the paths the list named.
- Each of these refuses: misnamed file, duplicate prefix, unknown schema, empty list, mirror-law
  break, duplicate src, glue not first, empty directory.
- Determinism is checked.
- Adding one file appends after the existing 38 without moving them.

### A3. ESLint node-globals file list

| | before | after |
| --- | --- | --- |
| where | 9 hand entries in `eslint.config.mjs` | 5 tree patterns stay inline (they need no per-lane edit). The 4 individual files now come from `scripts/eslint-node-globals/010-runtime-plugin-node-modules.json`, and u7-w0's own loader from `020-testkit-test-node-modules.json`. Collected by `nodeGlobalsPatterns()`, which fails closed on malformed or empty input. |
| lint identity diff vs `lint-identities-0237d487.txt` | 76 distinct, **new 0 / resolved 0**, `universe: 1421` | 76 distinct, **new 0 / resolved 0**, **`universe: 1421 file(s) linted`** (no shrink; printed on every run) |

Without the `020` entry, the lint diff shows `new 1` (`no-undef URL` in `load-bookings.mjs`). That
was measured and is the case the collected list exists for.

**RED-first** ([tests/checks/eslint-node-globals.test.mjs](../../../../tests/checks/eslint-node-globals.test.mjs), 5/5):
- Parity holds: inline + collected entries equal the 9 pre-u7-w0 entries plus the 1 entry u7-w0
  added.
- Every pattern matches at least one tracked file, so a stale pattern fails.
- A removed entry breaks parity.
- A malformed, empty or blank document refuses.

### A4. World-factory World-kind and suite registration

| | before | after |
| --- | --- | --- |
| World kinds | 7 kinds wired by hand in 4 places in `lib/world-factory.mjs`: createWorld destructure/validate/exclusion, constructor paths/readers, the startHost env set/clear blocks, and a 7-branch patch-layer `if/else` | `tests/world-factory/world-kinds/{010-u6-fs … 070-u7-fs-mut}.mjs`, collected by `lib/world-kinds.mjs`. The factory states each law once: `{rows}` shape, mutual exclusion, an owned-path guard over **every** kind path (it covered 3 names before), and env (all kind keys cleared on every boot, only the active kind's keys set). |
| suites | `SUITE_CASES` entries + `totalRequests` ternary + `suite === …` dispatch chain + imports in `u5-canary-runner.mjs` (3053 lines) | 6 lane suites in `tests/world-factory/suites/{010-u6-fs … 060-u7-fs-mut}.mjs`, collected by `lib/suites.mjs`. Runner is now 986 lines. The runner keeps its own suites (core, core-restart, negatives, crash-victim, u6-shadow). `SUITE_CASES` is still the single exported map. |
| unknown option | **silently ignored** by the destructure, so a missing kind module booted a plain canary World | **typed refusal** `unknown world option(s): …` |

Equivalence was proven offline, with zero hosts:
- [world-kinds-equivalence.txt](world-kinds-equivalence.txt) drives `startHost()` on the
  `88107ad71` factory and on the new one for all 9 World shapes (7 kinds, plain, centerShadow).
  The patch-layer bytes, the env and the mounted files are **9/9 identical**.
- [suites-before-after.txt](suites-before-after.txt) shows 11/11 suites with the same case
  lists, and the budgets equal the old ternary.
- [suites-body-diff.txt](suites-body-diff.txt) shows each moved suite body differs only in its
  signature (gains `ctx`) and `SUITE_CASES[x]` → `CASES`: 24 changed lines in total, 4 per suite.
- `world-factory.test.mjs` passes 38/38 (35 pre-existing + 3 port legs) and `u6-arc-d.test.mjs`
  7/7. The u6-arc-d suite pins `U6ARCD_PROBE_SRC/_ROW_ID`; those are now derived from the
  registry.

**RED-first** ([tests/world-factory/registries.test.mjs](../../../../tests/world-factory/registries.test.mjs), 10/10):
- A removed kind makes its option a typed refusal, and the loader drops it.
- A removed suite makes `--suite` refuse.
- Mutual exclusion and the shape check apply to every kind.
- A kind path pointed outside the home refuses the boot.
- Env cleanup is checked.
- Malformed or clashing kinds and suites refuse: bad name, duplicate option or member, core-option
  clash, non-owned path, empty header, bad env key, undeclared env key at apply time, name/file
  mismatch, duplicate or empty cases, missing budget, missing run.
- Adding one file registers a new kind.

### A5. `team-tool-plane.mjs` rule — **withdrawn (stop condition hit; parent-approved)**

Enforcing "an ordinary family PR must not edit `team-tool-plane.mjs`" is impossible without a
product change. The plane has **no generic family mount seam**. Each family is:
- imported by name;
- registered by its own `registry.register(<x>Contribution)` (≈ :2045–2131);
- approved through its own near-copy `ensure<X>ApprovalEntry` (≈ :2255–2371);
- gated by its own `centerKernel.families.<x>` flag (≈ :2528–2610).

U7-9a had to add 230 lines there. ARC-A fitness deliberately classes the plane as not protected
(`isProtectedPath('…/team-tool-plane.mjs') === false`, `packages/runtime/test/u6-arc-a-fitness.test.ts:222`),
and `docs/PARALLEL-INTEGRATION.md:9-12` says families wire "in non-conflicting semantic regions"
of it. A fitness check would turn every governed-family lane red, and none of them could comply.
This is exactly the plan's U6 stop condition, "新普通 Family 仍需硬编码中心表", at the plane layer.

The parent accepted the stop. A separate named Center-Owner PR (w0b) adds the generic plane mount
seam. This PR adds no A5 check. It records the fact in `docs/PARALLEL-INTEGRATION.md` §4a.

## Task B — widened test port bands (user ruling 2026-10-26)

Ruling, verbatim: 「当前机器应该没有太多会占用端口的进程。你可以尝试 3181-3199端口族；如果仍不够用，目前较大的端口区段（如13000甚至更大）应该都还是空置的」

| | before | after (`tests/paths.mjs`, the single source) |
| --- | --- | --- |
| `TEST_PORT_RANGES` | `[3180,3186]`, `[3491,3500]` | `[3180,3199]`, `[3491,3500]`, `[13000,13099]` |
| World host lease | `range(3180, 3186)`, hard-coded at world-factory.mjs:581 | `HOST_PORT_BANDS` = 3181–3199, then 13000–13049 |
| World mock lease | `range(3491, 3500)`, hard-coded at :501 | `MOCK_PORT_BANDS` = 3491–3500, then 13050–13099 |
| `STABLE_INSTANCE_PORT` / `isSanctionedTestPort(3080)` | 3080 / false | **unchanged**: 3080 / false |
| `candidatePorts()` | derived from `TEST_PORT_RANGES` (confirmed) | still derived: 130 ports |

- **Bound chosen: 13000–13099 (100 ports, split 50 host / 50 mock).** It is finite on purpose. It
  is enough for the six planned family lanes at several Worlds each, while a runaway leaser still
  exhausts the band fast and fails closed instead of wandering the port space. The kernel's
  ephemeral range here is 32768–60999, so no band can be handed out as an outgoing source port.
- **3180 exclusion kept**: World hosts never lease 3180. It is the hand-run default of
  TEST_METHODS §2, and several kits pin it ("NEVER 3080 / 3180").
- **Port occupancy, measured before any bind** ([port-probe-pre.txt](port-probe-pre.txt), `ss -ltn`
  at 2026-10-26T17:29Z): the only listener in 3080 ∪ bands was **3080** (the stable instance,
  outside every band). Post-run probe ([port-probe-post.txt](port-probe-post.txt)): identical.
  `EXTERNAL_BIND` fail-closed is unchanged in `port-lease.mjs`, and every acquisition still
  TCP-probes before it returns.
- Tests (`world-factory.test.mjs`, 3 new legs):
  - (a) 3187/3190/3199/13000/13049/13050/13099 are sanctioned;
  - (b) 3080 is refused, by the predicate and at the lease;
  - (c) 3179/3200/3490/3501/12999/13100 are refused, and a refused lease writes no file;
  - (d) with all of 3181–3199 held by live claims of this pid in a temp lease root, the host
    lease falls through into 13000–13049, and with both host bands held it fails closed. This
    binds nothing: held slots are claim files.
- Docs: `docs/TEST_METHODS.md` §1 port row and a §6 ruling entry (quoted verbatim, with the
  measurement), the `tests/paths.mjs` comment, `tests/README.md`, `tests/world-factory/README.md`,
  and the `scripts/devex.mjs` refusal text.

**Legacy kits left as-is.** They hard-code their own candidates, all inside the old 3180–3186 /
3491–3500 ranges, which are still sanctioned:
`a5p1diag` (3185), `a5-pr1-guard-dispatch` (3185), `a5-w7-jobs-wiring` (3184),
`a5-w7m-m13-domain-veto` (3184), `f15-mcp-live-loss-smoke` (3182/3183), `mcp-initial-grant-smoke`
(3181–3186), `model-preference-routing-smoke` (3181–3186, 3496), `pr-a-governance-smoke`
(3181–3186), `pr-b-effective-policy-smoke` (3182–3186, 3497), `pr-c-mcp-isolation-smoke`
(3181–3186, 3491), `pr-d-control-real-host` (3182–3186, 3497/3498),
`pr-e-requirement-recovery-smoke` (3181–3186, 3496/3497), `pr-f-closure-smoke` (3181–3186,
3496/3497), `rc2-real-host-smoke` (3496), `send-message-liveness-smoke` (3496),
`team-view-sync-complete-e2e` (3181–3186), `work-completion-wakeup-smoke` (3496), plus
`packages/runtime/root-binding/harness/{bounded-run,run}.mjs`, which validate through
`isSanctionedTestPort` and stay green (`bounded-run.regression.test.mjs` 6/6).
Two kits default their mock to 3506 (`c1-leader-approval-smoke`) and 3516
(`exec-contract-live-smoke`). Those defaults were already outside policy before this PR and are
still outside it. They are left untouched per scope and flagged here for their owners.

## Gates (this tree)

See the PR body for the final per-leg receipt of `ci-pr-gate`. Local legs:

| check | result |
| --- | --- |
| vitest: p4t6, a5p5-dormant-audit, a5p7-lane-hygiene, alpha5-search-backend, a4-artifacts-nonempty, a4p75-composition-smoke-classification, a5g6-install-face-render, u6-arc-a-fitness, a4p7-merge-gate | 184/185. The one red is `a4p7-merge-gate › composition smoke leg … is green`, which **reproduces identically on the untouched `88107ad71` base** in this fresh worktree. It refuses because the client dist (`packages/client/dist`) is unbuilt there, so the red belongs to the environment, not this diff. |
| `node --test tests/world-factory/world-factory.test.mjs` | 38/38 |
| `node --test tests/world-factory/u6-arc-d.test.mjs` / `registries.test.mjs` | 7/7, 10/10 |
| `node --test tests/checks/dist-placements.test.mjs` / `eslint-node-globals.test.mjs` | 7/7, 5/5 |
| `node --test packages/runtime/root-binding/harness/bounded-run.regression.test.mjs` | 6/6 |
| `lint-identities --diff …0237d487.txt` | new 0, resolved 0, universe 1421 |
| `docs:sync --check` / `docs:probe --base origin/master` | blocking 0 / blocking 0 |
| `tsc -p packages/testkit` / `packages/runtime` | 0 errors |
| `scripts/eb3-*.mjs` | none exist on master, so nothing to run |
| `tests/u7-3-devex/devex-integration.test.mjs` E2 | **pre-existing and topology-dependent**: it asserts `HEAD^`'s lag is 1, and on master merge-commit HEADs it is 2. The same red appears on the untouched base. |
