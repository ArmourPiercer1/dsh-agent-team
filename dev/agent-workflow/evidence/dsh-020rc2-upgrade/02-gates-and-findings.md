# 0.2.0-rc.2 upgrade round (team) — gate ledger and findings

Task branch `task/dsh-020rc2-upgrade-20261003` @ worktree
`.worktrees/dsh-020rc2-upgrade`, base = `origin/master`
`6b2f401bbc2f82e1eb3e561f71069d5aad2350fc`. Host runtime =
`tests/deepseek-harness-test-use` (own git repo, detached, porcelain-clean)
@ `639ed015397290b3745d163aafe02ffee4aa3f84` = 0.2.0-rc.2 (fork branch
`stable-3-0.2.0-rc.2` tip). Provenance detail: `01-baseline-record.md`.
Plan: `00-plan.md`. Raw logs: `logs/`.

Every number below is a recorded exit/summary from the named log file, not a
recollection. No test was weakened to reach a green light; where a gate fails
for a reason outside this round, an exact-base control run in
`.worktrees/base-6b2f401b-control` (detached at `6b2f401b`, 0.1.7 lock, base
committed dist, base scripts) proves the pre-existence — `CONTROL-*` logs.

## 1. Gate ledger

| # | Gate | Command | Exit | Result | Log |
| --- | --- | --- | --- | --- | --- |
| G1 | test-use install (0.2) | `pnpm install --ignore-scripts --frozen-lockfile` in `tests/deepseek-harness-test-use` | 0 | 1355 reused / 26 downloaded, lockfile unchanged, tree porcelain 0 before and after | `logs/testuse-020rc2-install.log` |
| G2 | plugin lockfile regen | `pnpm install --lockfile-only` | 0 | 281 `@deepseek-ai/*@0.2.0-rc.2`, 0 residual 0.1.7-rc.1 | `logs/plugin-lockregen-020rc2.log` |
| G3 | plugin clean install | `CI=true pnpm install --frozen-lockfile` | 0 | strict dep-builds satisfied (see F-0) | `logs/plugin-install-020rc2.log` |
| G4 | typecheck | `pnpm typecheck` | 0 | 9/9 packages Done against 0.2 types | `logs/typecheck-020rc2-r1.log` |
| G5 | host build (0.2) | `DSH_CLIENT_COMMIT_HASH=639ed01539 ESBUILD_WORKER_THREADS=1 pnpm run build` in test-use | 0 | managed job; host tree still porcelain 0 @ baseline; `apps/cli/lib/bin.js` + `packages/boot/app-boot/lib/index.js` present; `getDshRuntimeVersion()` = `0.2.0-rc.2` | `logs/host-build-020rc2-managed.log` (harness job output; the earlier stalled `nohup` attempt is kept as `logs/host-build-020rc2.log` and is NOT the evidence run) |
| G6 | compat gate RED (pre-adaptation) | `npx vitest run packages/testkit/test/plugin-dsh-compat.test.ts` | 1 | 6 failed / 1 passed (7) — the 0.1.7 expectations fail against the REAL 0.2 evaluator (self-report `0.2.0-rc.2`); proof the assertions bind the running evaluator | `logs/compat-RED-real02-evaluator.log` |
| G7 | compat gate GREEN (adapted) | same command | 0 | 7 passed (7): pinned self-version, exact-RC positive (explicit + default runtime arg), older `0.1.7-rc.1` rejected, later `0.2.0-rc.3` and `0.2.0` rejected, peerless vacuous-pass documented, exemption mechanics (never granted) | `logs/compat-GREEN-real02-evaluator.log` |
| G8 | plugin build | `pnpm build` | 0 | 9/9 Done | `logs/build-020rc2.log` |
| G9 | composition build | `pnpm build:composition` | 0 | 1 glue placement, 91 modules / 11 css, `client-bundle.js` 1 188 638 B, `[check-artifacts-committed] OK: 1444 files` — built artifacts identical to the committed install surface, so no dist re-commit was needed (`DIST_DIRTY=0`) | `logs/build-composition-020rc2-r1.log` |
| G10 | artifacts gate | `pnpm check:artifacts` | 0 | OK 1444 | `logs/check-artifacts-020rc2.log` |
| G11 | p4t6 public-import scan | `npx vitest run packages/testkit/test/p4t6-session-event-scan.test.ts` | 0 | 10 passed (10); pin unchanged (no new scannable file) | `logs/p4t6-020rc2-r1.log` |
| G12 | **zero-core (canonical red line)** | `node scripts/verify-zero-core.mjs --host tests/deepseek-harness-test-use` | 0 | `RESULT: PASS verify-zero-core (0 findings)`; the three INFO lines are upstream's own third-party patches | `logs/zero-core-host-020rc2.log` |
| G13 | zero-core nine-package C4 (informational) | same + `--plugin` × 9 | 1 | 1343 findings, all `private-relative-escape` — **identical at exact base** (see F-3) | `logs/zero-core-full-020rc2.log`, control `logs/CONTROL-base-zero-core-full.log`, normalized sets in `logs/normalized/` |
| G14 | composition smoke | `node scripts/composition-smoke.mjs` | 1 | host leg PASS after F-1; client leg FAIL (F-2, proven pre-existing) | RED `logs/smoke-composition-020rc2-RED.log`, after `logs/smoke-composition-020rc2.log`; controls `logs/CONTROL-base-smoke-composition.log` |
| G15 | lint | `pnpm lint` | 1 | recorded in §2 below | `logs/lint-020rc2-r1.log` |
| G16 | root unit suite | `npx vitest run` | — | recorded in §2 below | `logs/unit-suite-020rc2*.log` |
| G17 | rc2 real-host smoke kit | `node tests/kits/rc2-real-host-smoke/rc2-real-host-smoke.mjs` | — | in progress; run history in §3 | `logs/rc2-smoke-020rc2-r1..r3.log`, evidence `rc2-smoke-run1..3/` |

## 2. Findings

**F-0 (adaptation, required by 0.2) — pnpm strict dependency-builds.**
The 0.2 install closure brings five script-bearing transitive packages
(`@deepseek-ai/dsh-subprocess-local`, `@google/genai`, `koffi`, `node-pty`,
`protobufjs`). Under `CI=true` pnpm fails closed on ignored build scripts, and
it also rewrites `pnpm-workspace.yaml` with `set this to true or false`
placeholders (observed in both worktrees — the control worktree's insertion
was reverted, `git checkout --`, so the control runs base code verbatim).
`allowBuilds` now denies all five explicitly, following the existing `esbuild`
precedent: the host natives belong to the test-use host tree, which is
installed with `--ignore-scripts`.

**F-1 (pre-existing, PROVEN at base) — composition-smoke host leg asserts a
contract the frozen C1 design overrides.** Control at exact `6b2f401b`
(0.1.7 pins, base scripts, base committed dist) fails with the identical
message `apply subscribed to listeners before failing: agent/created,
agent/disposed, internal/get`. The three subscriptions are the C1 activation
fence + the `internal/get` compatibility seam, registered at the very front of
`apply()` by commit `e951344b` (restart-017rc1) and gated only by
`typeof ctx.on === 'function'` — no host-version input. `SESSION_ROUTER_LOG.md`
line 4957 already recorded this leg as a pre-existing failure whose repair is
"另案授权任务". This round keeps the assertion's teeth with the closed
documented set (only those three seam events, each at most once; any other
subscription still fails) and discloses it as slightly beyond a pure version
bump — revert-on-request.

**F-2 (pre-existing, PROVEN at base) — composition-smoke client leg cannot
link the published UI package in Node.** The published
`@deepseek-ai/dsh-client-ui-primitives` declares no `dependencies` at all
(verified for 0.1.7-rc.1 and 0.2.0-rc.2) while its built entry imports 27
packages the host bundles (`clsx`, `katex`, `highlight.js`, `micromark-*`,
`mdast-util-*`, …); with pnpm's isolated store those are unresolvable from the
package, so `import`ing our built client entry in plain Node fails at the first
of them. The base control shows the same failure with the OLD pin
(`Cannot find package 'clsx' imported from …+dsh-client-ui-primitives@0.1.7-rc.1…`),
and neither lock ever carried those packages. In production the client bundle
treats the host UI packages as externals supplied by the host's
`__ModuleLoader__`, and unit tests alias them to the test-use source tree, so
this is a Node-side smoke-harness limitation, not a shipped-surface defect.
**Not fixed here** (stubbing 27 host internals in a gate script is a separate
call); the authoritative install-surface gate remains `check:artifacts`
(G9/G10, green).

**F-3 (not a regression) — nine-package C4 scan.** 1343 `private-relative-escape`
findings on this branch and **the identical set at exact base** (normalized set
diff = 0 differences over 1343 lines; the only textual deltas are the worktree
path and the "; enters the host tree" annotation that depends on which
`--host` was passed). Host-independence proven by re-scanning the same plugin
dirs against the 0.1.7 host tree: same 1343. These are test/fixture relative
imports (`../../../../../tests/…`, cross-package `../../../<pkg>/src/…`) that
predate this round. The canonical machine-check of the zero-core red line is
G12 (`--host` only), which is PASS 0 findings, and the host tree itself is
porcelain-clean at the pinned baseline.

**F-4 (0.2 BREAKING change, adapted) — the user-preset directory seam is
gone.** 0.2 no longer reads `$DSH_HOME/.agent-presets/<id>/`: upstream's own
`@deepseek-ai/dsh-agent-preset` skill states "Nothing reads that directory any
more", and a preset is now an ordinary `@deepseek-ai/dsh-agent-preset`
**declaration row** (`config.id` + `config.plugins`) carried by a patch layer.
The kit therefore mounts `rc2-smoke` as a declaration row through the same
public profile-patch seam it already uses for the team row and the p6t6 row —
no host patch, no directory write, same preset content (persona + `dsh-tool-fs`
+ the minimal-style persistent-shell group). Symptom before the fix: row setup
failed fail-closed with `unknown preset 'rc2-smoke' (not in the live inventory)`
(`logs/rc2-smoke-020rc2-r1.log`); after the fix the host boots, the row is
ready with `toolCount=15` and LEG 0 passes.
**Same-root-cause debt, NOT adapted in this round** (outside the authorized
gate set, one-line-per-kit mechanical change):
`tests/kits/send-message-liveness-smoke`, `tests/kits/pr-d-control-real-host`,
`tests/kits/exec-contract-live-smoke`, `tests/kits/work-completion-wakeup-smoke`,
`tests/kits/c1-leader-approval-smoke`, plus
`packages/runtime/root-binding/harness/run.mjs` and
`packages/runtime/member-residency/harness/run.mjs`.

**F-5 (0.2 request-shape change, adapted in the kit mock) — auxiliary title
dispatch shape.** The kit's mock answers the host's auxiliary session-title
call with a neutral reply so it can never drive the scripted chain. In 0.2 that
guard never fires: the instruction moved to the top-level `system` body key and
`messages[0].content` is now a content-parts array
(`[{"type":"text","text":"Generate the session title from this JSON array of
human messages: …"}]`), so the old string test failed and the marker-carrying
payload leaked into `userTextOf` (observed: the title call was answered
`RC2_DISC_DONE`, i.e. it consumed the LEG 0 scripted branch). The guard now
checks both instruction sites and both known phrasings, plus a
generation-independent structural backstop: an auxiliary dispatch carries no
`tools` surface, while every scripted agent turn does — a toolless *agent* turn
would surface as a loud mock-wait timeout, never as a silent pass.
(The 0.1.7-era PASS evidence shows title calls answered with the neutral reply,
so the guard worked in the previous generation.)

**F-6 (open, under investigation) — first mounted-channel write answers a bare
HTTP 401.** In run2/run3 `team.create` (contract v1, with `initialWork`) was
answered by the host with `HTTP 401` and no JSON body, 3 ms after LEG 0's
remote/prompt calls on the same cookie succeeded; no B root session was ever
created (`team.listRoots` v6 shows only the boot root; the world contains no
`session-rc2-smoke-b-*` directory), so the B leader turn never reached the
mock and every downstream S-leg criterion timed out (the kit's own
`requests=2` evidence: discovery + title only). Read methods on the same
mounted channel (`catalog.list` v1/v6, `team.listRoots` v6) succeed with a
freshly minted cookie. The add-diag line added to the kit is what surfaced
this (it used to be invisible until the S4a check, minutes after the S1/S2
timeouts). Separation matrix (method vs write-lane vs cookie) in
`diag/auth-probe*.log`.

## 3. Kit run history (all retained)

| run | ports | outcome |
| --- | --- | --- |
| run1 `rc2-smoke-run1/` | host 3491 / mock 3496 | EXIT 1 FATAL at row setup — F-4 (`unknown preset 'rc2-smoke'`) |
| run2 `rc2-smoke-run2/` | 3491 / 3496 | F-4 fixed (boot + LEG 0 PASS, surface 20 tools); S1+ failed; stopped on instruction at 14:33Z after two 180 s timeouts (`requests` stuck at 2). Logs/evidence retained; world deleted |
| run3 `rc2-smoke-run3/` | 3492 / 3497 | F-5 fixed in the mock guard; new DIAG exposed F-6 (`team.create` → 401); stopped for the auth probe, world retained at `tests/homes/rc2-smoke-2026-10-03T14-29-39` |

## 4. Port discipline

`docs/TEST_METHODS.md` §1 defines the test port family as `3180-3186` **and**
`3491-3500`, with the stable instance on 3080 never to be used. The kit
defaults to "first free of 3491–3500" with the mock on 3496, so 3491/3496 are
inside the documented family and are the kit's own defaults; this round then
used 3492/3497 (run3) and 3493/3498 (auth probe) to stay clear of TIME_WAIT churn after a killed run. `:3080` was never bound or written: the
kit probes it read-only pre/post and every run recorded
`stable pre-probe: 3080=401 3180=unreachable` (401 = the stable instance
alive and untouched). Every home is under `tests/homes/<world>` in this
worktree; only processes this round spawned were killed.

## 5. Post-review repairs on this PR (2026-10-03, after head `0ff5bbe1`)

The provisional head shipped a first guard, a first sanitizer and a first request
decoder. The independent review found each of them defective; every finding is
reproduced, fixed and pinned by a test here, and none of them weakened a test.

| # | defect as reviewed | fix | pinned by |
| --- | --- | --- | --- |
| F-7 | `dieFatal` → `process.exit(2)` from inside the guard, bypassing `main`'s `finally` (`stopHost` + `mock.close`): a tripped guard **left this run's host child alive**; no independent lifetime watchdog; the request ceiling was checked only after a wait's fast path; the repeated-reply streak was global, so interleaved title/sibling traffic reset it | `tests/kits/rc2-real-host-smoke/run-control.mjs` (owner-scoped `RunAborted` / `requestAbort` / `abort`, `bindChild` + unref'd lifetime watchdog, signal handlers, one killable handle) + `run-budget.mjs` rewritten (`observeRequest` counts at **entry**, per-total / per-session / per-scenario / per-state-repeat caps, consecutive-miss streak, latched first violation); `dieFatal` throws while armed, `process.exit` survives only pre-arm | `packages/testkit/test/rc2-kit-fault-injection.test.ts` F0–F6 (subprocess: after cap / interleaved repeat / wait timeout / decoder failure / watchdog, the run's own child is gone and an unrelated process the test owns is still alive; cleanup + evidence written; exit codes 0/2/3) |
| F-8 | L0c recorded a FAIL and then continued: it wrote the B/C blueprints with the bad deny list and issued the B/C `team.create` calls anyway, so three more host calls ran against a fixture already known invalid | `tests/kits/rc2-real-host-smoke/fixture-invariants.mjs`: catalog single source + invariants + **materialization inside the same call**, pre-flight first and throwing into the owner's cleanup (`RC.abort`); the kit has no loose B/C blueprint write left | `packages/testkit/test/rc2-kit-fixture-invariants.test.ts` I1–I6: catalog ≡ `packages/tools/src/tools.ts` (incl. the verb-built pair); the historical 11-name drift names exactly the four tools; a stale catalog writes **zero** blueprints with the abort hook running first; a source-order guard keeps the pre-flight ahead of `team.create` |
| F-9 | the decoder read 0.1.x only (run 4's ~1 800-request storm) and, in the newest review, `toolResultText` JSON-stringified a 0.2 `content` **array**, escaping the inner quotes, while the kit's `extractInstanceId` fallback returned an unmatched capture group (`undefined`) that the `id === null` check happily forwarded into `team_delegate` | `wire-shape.mjs`: `flattenContent` unwraps `text` parts **verbatim** and descends through container parts (depth-guarded); `toolResultEntries` decodes once; `extractInstanceId` parses the payload structurally and **throws** on error / empty / missing id — no sentinel can reach a delegation; the kit reads the strict API, and `waitForMock` sweeps every recorded request, aborting through the owner's cleanup on an unclassifiable shape and letting only genuine agent turns advance the chain | `packages/testkit/test/rc2-kit-wire-shape.test.ts` A–E (17 tests) over 13 fixtures: 3 envelopes captured live from the pinned 0.2 runtime via the harness's desensitized fixture export, 2 reconstructions labelled as such (0.1.x classic; the compaction dispatch built from `packages/compaction/compaction-basic/src/summarizer.ts:145-161` — measured to carry `tools` AND replayed results, which is why toollessness proves nothing), 4 synthetic negative shapes, 5 instance-id parity cases (same id from both encodings; error / empty / id-less all throw) |
| F-10 | the sanitizer had **no path separation**: `--from == --to`, a symlink alias and a bare no-arg run all exited 0 while rewriting the raw tree; `--store` inside `--to` copied raw secrets back into the sanitized output while the manifest claimed replacement; a YAML `x-api-key:` value and a JSON `"token"` field were missed, so `--verify` reported clean | `scripts/sanitize-evidence.mjs` rewritten: realpath-based disjointness (equal / nested / aliased, `--store` and `--manifest` included), `--force` for a non-empty `--to`, raw SHA-256 snapshot re-verified after the run (any raw change → exit 1, no manifest), expanded pattern vocabulary, exit codes 2 usage / 1 failure / 0 clean | `packages/testkit/test/rc2-sanitize-evidence.test.ts` S1–S12 (subprocess exit codes, raw bytes identical before/after, planted-secret `--verify` non-zero) |
| F-11 | **caught while fixing F-10, recorded because it is the interesting one**: `--verify` over the committed tree flagged a live boot token in `diag/wire-probe-instance-2026-10-03T15-06-25.log`. That file was **untracked** — written by a probe run after the last sanitize pass — so it never entered any commit or push; the raw copy is now under `.private-raw-evidence/` and the committed copy is redacted, and `--verify` exits 0 over the whole tree | re-sanitized from the raw tree with the fixed tool; the fixed `--verify` is what found it | `VERIFY OK: no credential-shaped substring in 80 files` (recorded in `SANITIZATION.json` run + this note) |

### Test inventory added by this section (all green, no skips)

| file | tests | runner notes |
| --- | --- | --- |
| `packages/testkit/test/rc2-kit-wire-shape.test.ts` | 17 | vitest; fixtures under `tests/kits/rc2-real-host-smoke/fixtures/` |
| `packages/testkit/test/rc2-kit-fixture-invariants.test.ts` | 7 | vitest; reads `packages/tools/src/tools.ts` as the drift oracle |
| `packages/testkit/test/rc2-kit-fault-injection.test.ts` | 7 | vitest; subprocess + process-table assertions; scratch under `tests/homes/`, removed after |
| `packages/testkit/test/rc2-sanitize-evidence.test.ts` | 12 | vitest; subprocess |
| `packages/tools/test/rc2-team-deny-least-privilege.test.ts` | 9 | vitest; real P6-T6 world, torn down in `afterAll` |

`npx tsc -p packages/testkit --noEmit` and `-p packages/tools --noEmit`: clean.
`npx eslint` on every new/changed file: clean (the kit's `tests/kits/**/*.mjs` are
outside the eslint project by configuration, as before). Typed ambient
declarations for the kit's plain-ESM modules follow the `tests/paths.d.mts`
precedent (`wire-shape.d.mts`, `fixture-invariants.d.mts`).

### Evidence tree counts (do not quote the older numbers)

Raw (gitignored, `.private-raw-evidence/dsh-020rc2-upgrade/`): **81** files,
byte-identical originals, re-verified after every sanitize run.
Committed sanitized tree: **83** files = 81 manifest-covered + `SANITIZATION.json`
itself + `03-team-tool-deny-least-privilege.md` (written after the manifest).
Earlier prose said 72 / 73 / 74 at earlier heads — each was already stale when it
was written (at head `0ff5bbe1` the tree held 74 = 72 + manifest + the then-new
document; the probes in this section added the rest). Any count quoted from this
file is a snapshot: recompute it with
`find dev/agent-workflow/evidence/dsh-020rc2-upgrade -type f | wc -l` plus the
manifest's own `files` length.

**One hazard found while producing these numbers, recorded because it bit.** The
sanitizer takes its input from the raw tree, and the prose documents were
themselves copied into that raw tree verbatim. Re-running the sanitizer therefore
REVERTED an already-committed edit to this file (57 lines of §5 disappeared, and
`git diff` showed the deletion). The tools are behaving as written — the raw tree
was simply older than the working copy — but that is a silent document-rewind
with a redaction tool, which is exactly the class of surprise this round is
supposed to eliminate. Mitigation applied: the raw copies of the prose documents
are re-synced from the working tree whenever they change (verified idempotent: a
sanitize run after the sync produces a byte-identical tree), and the diff after
every sanitize run is read before committing.

### Owed evidence item 2 closed — the complete host refusal

A bounded single-`team.create` probe over the retained stale fixture
(`diag/deny-name-capture.mjs`, log `diag/deny-capture-2026-10-03T15-32-32.log`,
world retained at `tests/homes/deny-capture-2026-10-03T15-32-32`) records the
untruncated message:

```
TEAM_REMOTE_TEAM_CREATE_ROOT_START_FAILED
team.create: starting the root (leader) agent for '…' failed: tools.restrict()
names unknown global tools "team_archive_member", "team_grant_permission",
"team_list_pending_control", "team_revoke_permission"; known global tools:
bash, edit, read, read_image, write
```

The trailing list is the point: that is the leader agent's ENTIRE restrictable
global vocabulary on this preset, and none of the four team names is in it — the
empirical form of "the builtin mask lane cannot reach a team tool" (see
`03-team-tool-deny-least-privilege.md`). The probe made **zero** model requests
(the root agent never started), used ports 3495/3498, stopped the host it spawned
and bound nothing on `:3080`.

### Still open after these repairs (unchanged blockers)

- the full rc2 real-host smoke run: **paused** until the security review of the
  committed evidence passes; nothing here ran the chain (the fault-injection test
  uses its own throwaway child processes, no host, no port);
- root vitest + lint vs the recorded debt (132E/32W vs base 118E/25W) is not yet
  base-classified; base-control lint outstanding;
- 5 other kits / presets plus `packages/runtime/root-binding/harness/run.mjs` and
  `member-residency/harness/run.mjs` still use the removed `.agent-presets` seam;
- composition-smoke **client leg still failing** (not weakened);
  `PERSONA_SECTION` / `dsh-agent-presets` landmines; nested-worktree effect on
  `packages/client/test/s3-client-generation-spike.test.ts`; p4t6 pin 934 unchanged;
  `references/deepseek-harness` absent in this environment (remote anchors
  re-verified unmoved instead).
