# u7-f PR body — feat(ui): governed ask_user_question/present via the FamilyAssembly seam

## What lands

ONE governed family, ZERO center diff: `dsh.ui-family` carries the two rows
`ask_user_question` (legacy + TIMED variant) and `present` through the
reviewed FamilyAssembly seam (`packages/tools/families/ui.mjs`, manifest-
hashed, generated index). Admission, grant mint, grant consumption stay
entirely the kernel's: the contribution states `kernel` on all three
obligations, the capability object carries NO authority handle, and every
human-facing action lands only through an INJECTED interaction port —
supplied by a trusted mount, or the host's public `userQuestions` service
behind the family's adapter. No port ⇒ typed refusal, zero effect. Never a
bypass, never a fabricated answer.

## Effect classes (per-call PA requested set — the PR #390 law)

- `ask_user_question`: `tool-invoke(ask_user_question)` + `domain-ref(user-interaction)`.
- `present`: `tool-invoke(present)` + `domain-ref(ui-presentation)` + one `read(<anchored file>)` PER presented file — the read arm is not decorative: the post-consume ONE-FD identity probe PAYS for it (byte counts land on the `governed-present PROBED path=… bytes=N` witness, metered on the verified fd; zero file bytes ever enter the result or a log line).
- The canonical set sorts its arms; the C1 E-1/E-2/E-3 legs pin the MULTISET and every identity, and pin contribution-declared ≡ executor-requested identities.

## The timed-variant law

The variant selects at MOUNT (`config.teamToolPlane.uiTimedQuestions`, mirroring the host's `mode: timed` registration law — the timed row only ever exists under that flag). Per call, `timeout` is `-1` (the keyed indefinite `wait: { callId }` arm) or an integer `1..2_147_483` seconds (default 120; the host `validateTimeout` law, verbatim). An expired foreground wait answers the TYPED `{ pending, callId, message }` outcome with the host `pendingNotice` VERBATIM — the pending branch is checked FIRST and a dishonest port's answers riding it are DROPPED (mutation control #2 proves the check bites). A timeout NEVER produces an answer: an expired timed question returns the typed pending outcome, never a fabricated one. Invalid timeouts (`0`, `1.5`, `2147484`, `'30'`, `-2`) refuse typed with ZERO port calls and zero grant consumption.

## Default-deny consequence (disclosed law, not a gap)

The closed rule grammar (`read|read_image|write|edit|lsp|bash|pwsh` +
resources) names no interaction/presentation tool, so a template rule can
NEVER pre-cover the interaction arm: under `default: deny` both rows refuse
typed (ask at the row's own default-deny gate; present answers the file
level law — `no read rule covers this presented file` — when the read
effect is uncovered). Both refusals spend ZERO grants and make ZERO port
calls. The positive arms therefore run under per-call approval
(default-`ask` + control leg), which C1 pins through the REAL kernel.

## Per-arm verdicts — PROVEN vs DISCLOSED

| arm | verdict | where |
| --- | --- | --- |
| ask positive answer lands via port, model→service translation (`multiSelect`) | PROVEN | C1 A-1 (real plane chain, real kernel, policy default-ask + approving control leg) |
| ask port ABSENT → `UI_INTERACTION_PORT_ABSENT`, zero PA consumption | PROVEN | C1 A-2 |
| ask unknown-parameter at 3 depths (top/question/option) | PROVEN | C1 A-3/A-4 — and LIVE on boot f2: `refused-schema ask-unknown-parameter — questions[0].options[0] carries unknown parameter(s) id (accepted: label, description)` |
| ask default-deny template refusal, zero effect | PROVEN offline + LIVE | C1 A-5/A-6; C2 f3 host log: `[dsh-agent-team] u7f-ask: governed-ask default-deny refusal`, zero `governed-ask RAN`, `fabricatedAnswerInToolResult: false` |
| one-shot grant: settled token replay cannot ask twice; in-flight token = `exec-token-replay` refusal; aborted signal = cancelled row | PROVEN | C1 A-7/A-8/A-10, T-8 |
| dishonest (answers on legacy wait-arm), malformed, throwing port | PROVEN | C1 A-9 (verbatim carrier, `sideEffectPossible` honesty) |
| timed: mount-time variant selection, seconds→ms (30→30000, default 120000), `-1` keyed `wait`, expiry → typed pending + verbatim `pendingNotice`, dishonest-pending answers DROPPED, invalid timeouts zero-effect, duplicate ids | PROVEN | C1 T-1..T-7 (T-5 backed by mutation control #2) |
| timed POSITIVE against a live human answerer | DISCLOSED | no trusted production mount injects a UI port (production `backends` are `{jobs?, backgroundJobs?}` only); the answerer rides the member agent-scoped Cordis waterfall and the C2 world drives members over one agent carrier — no HTTP face exists to answer a governed member. Never faked. |
| present positive: anchored probe (`PROBED … bytes=N`), port turn receipt | PROVEN | C1 P-1/P-10 (multi-file, all-or-nothing poisoning) |
| present out-of-root (absolute outside + `../`) PURE-LEXICAL refusal, zero fs touch | PROVEN offline + LIVE | C1 P-2 (mutation control #1 backs the anchor check); C2 f3: `u7f-present: governed-present anchor-refusal code=locator-rejected`, OUTSIDE CANARY in ZERO log lines/tool results, file sha identical |
| present symlink escape: post-consume `resolveAnchoredPath` refuses with the alias sentence, outside bytes untouched | PROVEN | C1 P-3 |
| present host sentences `FILE_NOT_FOUND`/`NOT_A_FILE` (verbatim host text) | PROVEN (offline) | C1 P-4; the LIVE mount refuses earlier (port-absent), disclosed |
| present port/presentation face ABSENT → `UI_PRESENT_PORT_ABSENT`, zero consumption, zero publication | PROVEN offline + LIVE | C1 P-6; C2 f3: `u7f-present: governed-present port-refusal`, presented-target sha `afd51db3…` IDENTICAL, zero `PROBED`/`RAN` |
| CANARY byte-leak: presented-file bytes never ride any line | PROVEN | C1 P-9 + C2 f3 outside-CANARY check |
| per-call PA requested-set identities | PROVEN | C1 E-1/E-2/E-3 |
| present: FINAL component swapped in the open window — substituted inode → `ANCHOR-DRIFT` (fstat-vs-snapshot), final → outside-symlink → `NOT_A_FILE`; zero port calls | PROVEN | C1 R-1/R-2 (deterministic swap-at-open injection; R-1 RED on the check-then-open head — `review-round1-race-RED.log`) |
| present: PARENT DIRECTORY swapped to a symlink onto the outside dir in the open window → `ANCHOR-ESCAPE` via `/proc/self/fd` containment; outside canary never opened, read or presented | PROVEN | C1 R-3 — the F-405-1 arm: RED on head `ef348f7c3` (check-then-open delivered the outside file), GREEN on the one-fd head (`review-round1-race-GREEN.log`) |
| present: size cap enforced ON THE VERIFIED FD (cap+1 metering) → `FILE_TOO_LARGE`; at-cap passes | PROVEN | C1 R-5 |
| present: receipt WITHOUT the host-required integer `turn` → typed `UI_PRESENT_RECEIPT_INVALID` + `sideEffectPossible` honesty, never a silent success | PROVEN | C1 R-4 (F-405-3; host `packages/deliverables/tool-present/src/index.ts:61` `turn: {type:'integer', required:true}`, `:79` `'present requires an open turn'`) |

## Live C2 verdicts (verbatim, boot f3 of ≤3; `dev/agent-workflow/evidence/u7-f-ui-20261026/c2/`)

```
RUN-SUMMARY run=u5-u7-f-ui-f3-… suite=u7-f-ui overall=PASS cases=7 PASS:7
[dsh-agent-team] a5g7: placement-feed rows=[team_grep,team_glob,team_bash,read,write,edit,read_image,ask_user_question,present] realm=u7fui-realm-u5f3-…
[dsh-agent-team] u7f-ask: governed-ask default-deny refusal
[dsh-agent-team] u7f-present: governed-present port-refusal
[dsh-agent-team] u7f-present: governed-present anchor-refusal code=locator-rejected
```

Boot budget: `--max-host-starts 3`, ledger fully used (f1 suite-side blueprint
indent fix, f2 the closed-world option-contract discovery, f3 the law run).
`host-base-pristine-post` PASS: the pristine host checkout is byte-clean
after the runs.

**C2 currency disclosure (fix round):** the three boots predate the
review's one-fd probe rewrite and will not be re-run (budget 3/3 spent).
The live arms C2 pins — default-deny refusal, port-absent refusal,
pure-lexical anchor refusal — all terminate STRICTLY BEFORE the rewritten
post-consume probe, so their witnesses are unaffected; the new fd law only
STRICTENS what happens after those points and is proven offline by the
C1 R-legs (the R-3 parent-swap arm additionally proves the rewrite closes
a real escape that the pre-rewrite head shipped).

## Review round 1 (REVIEW-405, PASS-WITH-FINDINGS → fixed here)

Verdict source: `task/u7-wave1-review-b-20261027` @ `b641cf65e`,
`dev/agent-workflow/evidence/u7-wave1-review-b/REVIEW-405.md`.

- **H-1 (HIGH, blocking) — present checked the path, then opened the path
  again**: a parent directory swapped to a symlink between the anchor check
  and the probe's `openSync` delivered an OUTSIDE file through an
  in-root-looking path (same TOCTOU class as the #404 `skill` escape).
  Fixed the way the fs family does it, reusing the ONE law, no third copy:
  `probeAnchoredFd` snapshots the path, OPENS ONCE with
  `O_RDONLY|O_NOFOLLOW`, and proves the FD with the fs family's public
  face `verifyOpenedHandle` (`/proc/self/fd` containment against the
  governed root first, fstat-vs-snapshot second — the controlled-fs
  `open-at-exec` law `image-read-port.mjs:75` and the read-executor
  already run), re-proves regularity on the fd, and meters the cap on the
  same fd. This PR adds ONE additive re-export to fs-family's public face
  (`packages/tools/fs-family/src/index.mjs` —
  `export { verifyOpenedHandle } from '../../../runtime/controlled-fs/src/index.js'`,
  the same edge `image-read-port.mjs` already crosses; boundaries/audit
  re-run green). Deterministic race tests (arm fires inside the open seam
  via a per-test fs mock, both heads):
  `review-round1-race-RED.log` (head `ef348f7c3`: R-1/R-3/R-4/R-5 fail —
  R-3 shows `received: "ok"`, the outside file WAS delivered) →
  `review-round1-race-GREEN.log` (41/41).
- **M-1 — missing `turn` receipt silently accepted**: now a typed refusal
  `UI_PRESENT_RECEIPT_INVALID` with `sideEffectPossible: true` — pinned
  host law: `packages/deliverables/tool-present/src/index.ts:61` declares
  the RESULT `turn: { type: 'integer', required: true }` and `:79` throws
  `'present requires an open turn'`; a publication without correlation
  identity is treated as failed, not silently downgraded. Pinned by C1
  R-4; the port contract doc (`ui-interaction-port.mjs`) now states the
  REQUIRED receipt turn.
- **L-1 — closed-world parsing kept as a DELIBERATE deviation** (safer
  law; measurement corrected against the pinned tree): the host ASK schema
  ships `additionalProperties: true` at
  `packages/interaction/tool-ask-user/src/index.ts:48` (question item) and
  `:61` (option item) — host-legal callers MAY send extra keys there
  (anything beyond the declared `{id, question, header, options,
  multi_select}` / `{label, description}`, e.g. a `metadata` or `style`
  key the host would simply ignore); the host PRESENT schema instead
  ships `additionalProperties: false` on BOTH faces
  (`packages/deliverables/tool-present/src/index.ts:49` input item, `:59`
  output, `:65` output file item — measured, `:61` cited above), so
  present's closed set is host-faithful, not a deviation. Where the
  governed row IS stricter (ask extras), every refusal NAMES the offending
  field and the accepted set —
  `…carries unknown parameter(s) id (accepted: label, description)…`
  (`ui-mechanics.mjs:110/:128/:164`; present twins `:203/:217`), live-
  proven on boot f2.

## Base + the merged #398 diag/devex surface

Branch base = `origin/master` @ `0ea67bee8` (normal merge, zero conflicts).
#398 makes `diag-call-chain` resolve family refusal codes from the reviewed
descriptors — verified against THIS family on the merged tree:
`gen-family-index --check` → OK (4 reviewed families);
`diag-call-chain --self-test` → OK 49 codes (the ui descriptor's
`refusalCode:` token carries its site); `--code
PLANE_UI_REGISTRATION_REFUSED` → `ATTRIBUTED, face: plane-mount
[packages/tools/families/ui.mjs (refusalCode:)]`; the two CI-gating suites
#398 added pass on this tree: `tests/diag-call-chain` 24/24,
`tests/u7-3-devex` 20/20.

## Boot budget + harness honesty

C1 36/36 offline at the review head, 41/41 with the fix-round R-legs; TWO
mutation controls RED→reverted→GREEN; p4t6 delta
MEASURED (`scanner counts 1332, ledger derives … = 1322` → +10 booked);
world-factory offline machinery green (38/38) with the new suite/kind
registered; `registries` 12/12; family-seam 9/9 (count pin legitimately
moved 3→4 with the manifest — the fitness law is `index == manifest`).

## Files (the zero-plane-edit list)

NEW lane `packages/tools/ui-family/src/` (mechanics, port contract, two
executors, two rows, contribution, barrel) + `README.md`; reviewed
descriptor `packages/tools/families/ui.mjs`; family manifest entry +
generated `packages/tools/families/index.mjs`; dist byte-mirrors +
`scripts/dist-placements/090-ui-family.json` (renumbered 070→090 at the
#406/#404 base-refresh — the placement order law is total and 070/080 were
taken); census booking
(`arc-a-family-census.json`, additive); p4t6 booking
(`packages/testkit/test/p4t6-bookings/u7fui.json`); C1 suite
`packages/runtime/test/u7-f-ui-c1.test.ts`; C2 world kind + suite +
assembly (`tests/world-factory/`); derived-count pins that the manifest
change legitimately moves (`u7-w0b-family-seam.test.ts`,
`registries.test.mjs`); the EB3 family-boundaries booking
(`scripts/eb3-family-boundaries.mjs` — `LANE_EDGES['dsh.ui-family']` +
lane-id map, with the outward-edge law stated in the lane README;
`present` reaches the anchor law ONLY through fs-family's PUBLIC face
`src/index.mjs`, never a sibling internal); evidence
`dev/agent-workflow/evidence/u7-f-ui-20261026/`.
ZERO diff on `team-tool-plane.mjs`, `family-assembly.mjs`, the
approval-entry binder, and every one of the ARC-A 33 protected paths
(machine-checked: zero intersection with the staged set).

## Gates (local, provisioned worktree; hosted is the arbiter)

`ci-pr-gate --full --census`: **7 pass / 1 fail** — every leg green
(graph-parse, state-freshness, install, blueprint-fence, **typecheck**,
**lint-identities** new 0 / resolved 0, **artifacts-at-head** drift 0),
census red on EXACTLY ONE identity, disclosed and root-caused here:

- `rc2-sanitize-evidence.test.ts::…S13 file aliases, quoted values, and
  capture formats pass the standalone regressions` — a **timeout**
  (vitest 5000 ms default) on the leg that SPAWNS `node --test
  scripts/sanitize-evidence.regression.test.mjs`; on this sandbox machine
  that nested run measures **8.6 s wall idle and passes 5/5 standalone**
  — slow process spawn, not a behavioral red. The test file is unchanged
  since `97efc2d62` (this PR touches zero bytes of it), the same single
  red was captured in the local census comparisons of two SINCE-MERGED
  rounds (`ci-gate/scratch/census-comparison-20261026T114234Z-4.json`,
  `…20261026T130037Z-40.json`), and the u7-9a PR body discloses
  rc2-sanitize-evidence in the known env-dependent set. Census counts
  moved 626→635 files / 7936→8130 tests = this PR's +1 suite (+36 tests)
  on top of master-side growth; the identity set (zero other new reds)
  is what the verdict draws from. Hosted ci-required (ci-full + census)
  decides.
- Quick gates green: `eb3-ci-required` pass findings=0; `docs:probe
  --worktree-only` blocking=0; `docs:sync --check` exit 0;
  `gen-family-index --check` OK (4); `diag-call-chain --self-test` OK;
  world-factory offline 38/38; `registries` 12/12.

## Hosted CI — GREEN on head `88e48464a`

Round 1 (head `ce572cf27`): ci-required RED — `EB3-A: family boundaries`
graded this honestly ("an unbooked lane cannot be graded", 8 findings).
Fixed in `88e48464a` (booking + public-face re-route above; C1 36/36
re-run, `eb3-family-boundaries` pass findings=0,
`eb3-ci-negative-controls` 16/16). Round 2 on head `88e48464a`
(merge tree `01d6f6b4d…`, base `0ea67bee8`):

```
run 40462203772  ci-required        success  (synthesize-merge-tree, ci-security,
                                             ci-integration, ci-fast, ci-full, ci-required — all success)
run 40462203813  pr-gate            success
run 40462203775  census-runtime     success
run 40462203682  candidate-protection success
EB3-REQUIRED pass layers=5 green=5 nongreen=none
```

The hosted ci-full census is GREEN — confirming the one local red
(`rc2-sanitize-evidence::S13`) was sandbox process-spawn slowness only.

### Fix-round hosted verdicts (the honest two-step)

Step 1 (head `558f0365d`, the one-fd fix): pr-gate **RED on exactly one
leg** — `lint-identities: error no-undef
packages/tools/ui-family/src/present-executor.mjs` (the fd-metering loop
used the global `Buffer`; tools lanes hold no node-globals entitlement —
`scripts/eslint-node-globals/` is a disclosed runtime-plugin/testkit
family list — and the `fs-mechanics.mjs:25` precedent is an explicit
`import { Buffer } from 'node:buffer'`). candidate-protection was already
green; ci-required/census were superseded. Step 2 (head `287b38c32`, the
explicit import; `lint-identities --diff` → `76 distinct; new 0,
resolved 0`; C1 41/41 re-run; mirror re-placed):

```
run 40475275288  ci-required        success  EB3-REQUIRED pass layers=5 green=5 nongreen=none
run 40475275370  pr-gate            success  (lint-identities new 0; artifacts-at-head drift 0)
run 40475275347  census-runtime     success
run 40475275249  candidate-protection success
```

Census test-count note: the R-legs move the C1 suite 36→41 tests on top
of the capture quoted above. THIS PR NOW FREEZES for review round 2:
no further pushes to `task/u7-f-ui-20261026` pending round-2 verdicts.

### Base-refresh merge (master `e004c25c6` = #402+#406+#404 line), head `d20760d31`

Per the main agent's merge-order ruling (slot 4): normal merge, round-2
review bytes stay `287b38c32`. Shared-booking resolutions, all KEEP-BOTH:

- `PR1_CONSUMERS` (audit script + a5p0 test): master's agent-control /
  inspect×2 / pwsh bookings verbatim + the two ui-family executor
  bookings; a5p0 test 4/4 against the real scanner.
- `eb3-family-boundaries`: LANE_EDGES + lane-id union (inspect-family,
  agent-control-family, ui-family); files=66 findings=0.
- `registries.test.mjs`: TEN kinds (080 enumeration: agent-control, f-ui,
  pwsh), master's generic `090-u7-plantnew` form with length 11; NINE
  suites (+u7-f-ui); 12/0 green.
- `u7-w0b-family-seam.test.ts`: master's DERIVED-count form taken verbatim
  (#406 R2 law); seam 9/9.
- `families/manifest.json` capability+families union; `index.mjs` NOT
  hand-merged — regenerated (`gen-family-index` OK (6), `--check` green);
  census ledger union (7 families, JSON parses).
- `scripts/dist-placements/070-ui-family.json` → `090-ui-family.json`:
  the placement order law is TOTAL (#406 took 070, #404 took 080; the
  loader refused the collision — renumbered per the ruling).
- **fs-family public face DEDUP**: the #404 review landed the IDENTICAL
  `verifyOpenedHandle` additive re-export BEFORE this merge; this PR's
  fix-round copy was removed at the merge and the single master copy
  stands — one law, one face, zero duplicates (present-executor reads the
  same public face unchanged).

Local battery (all green on the merged tree): evidence-guard
added=21 findings=0, ci-required workflows=9 findings=0,
negative-controls 21/21, boundaries 66/0, definitions 25/0,
gen-index --check OK(6), C1 41/41, diag-call-chain OK 51 codes,
lint-identities new 0, typecheck clean, mirrors byte-identical (82
placements).

Hosted on merge head `d20760d31` (ONE code push per the ruling):

```
run 40489688065  ci-required        success  EB3-REQUIRED pass layers=5 green=5 nongreen=none
run 40489687981  pr-gate            success
run 40489688154  census-runtime     success
run 40489688158  candidate-protection success
```

This following evidence append is dev/**-only (touches no linted, hashed
or placement surface; the path-filtered workflows do not re-run on it) —
same pattern as the fix-round's `ad98c7895`. FREEZE stands for round 2.

## Disclosed deviations (from the host mirror)

closed-world parameter schema on `ask` (host question/option items ship
`additionalProperties: true` — tool-ask-user/src/index.ts:48,:61 — so
extras a host caller may legally send, e.g. `metadata`/`style` keys, are
ignored there but refused typed here, naming the field; present's closed
set is host-faithful — tool-present/src/index.ts:49,:59,:65 ship
`additionalProperties: false`); `present` paths are governed-absolute
(host: session-relative allowed); the presentation size cap is the
governed read cap `MAX_READ_BYTES` = 1 MiB metered ON THE VERIFIED FD
(host: no cap — stricter here, `FILE_TOO_LARGE`); the receipt turn is NOT
a deviation since fix round 1 (host-required integer turn enforced,
F-405-3 above); unique question ids enforced on the TIMED variant only
(host-faithful: legacy does not); the default-deny rule-grammar consequence
above; C2 live positive arms DISCLOSED (structural, quoted above, with the
pre-rewrite currency note).
