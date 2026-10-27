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
- `present`: `tool-invoke(present)` + `domain-ref(ui-presentation)` + one `read(<anchored file>)` PER presented file — the read arm is not decorative: the post-consume O_NOFOLLOW probe PAYS for it (byte counts land on the `governed-present PROBED path=… bytes=N` witness; zero file bytes ever enter memory, the result, or a log line).
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

C1 36/36 offline; TWO mutation controls RED→reverted→GREEN; p4t6 delta
MEASURED (`scanner counts 1332, ledger derives … = 1322` → +10 booked);
world-factory offline machinery green (38/38) with the new suite/kind
registered; `registries` 12/12; family-seam 9/9 (count pin legitimately
moved 3→4 with the manifest — the fitness law is `index == manifest`).

## Files (the zero-plane-edit list)

NEW lane `packages/tools/ui-family/src/` (mechanics, port contract, two
executors, two rows, contribution, barrel) + `README.md`; reviewed
descriptor `packages/tools/families/ui.mjs`; family manifest entry +
generated `packages/tools/families/index.mjs`; dist byte-mirrors +
`scripts/dist-placements/070-ui-family.json`; census booking
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

## Disclosed deviations (from the host mirror)

closed-world parameter schema (host ships `additionalProperties: true`);
`present`'s `turn` is optional on the governed face (the host requires it —
the receipt turn rides only when the port reports one) and paths are
governed-absolute; unique question ids enforced on the TIMED variant only
(host-faithful: legacy does not); the default-deny rule-grammar consequence
above; C2 live positive arms DISCLOSED (structural, quoted above).
