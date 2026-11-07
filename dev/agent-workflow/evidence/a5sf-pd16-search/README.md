# PD-16 FIX — a governed Member's `grep`/`glob` now run on the confined subprocess face

**Task**: close the SEARCH face of the Alpha.5 confined-Member guarantee.
**Branch**: `task/pd16-search-20261113` (worktree `.worktrees/pd16-search`, base `origin/master = 743955e4a`).
**Record class**: `DEV-LIVE` · `eligible = false` (this is not candidate evidence; no matrix grade, no `V@B`, no Q7/Authority/CI change).
**Defect source**: recon `a5sf-recon-search` (PR #655, branch `origin/recon/b-search-20261113 @ 790656764`), measured on a live Host 2026-11-07.

## 0. The one sentence

**Before this change a governed Member's `grep` and `glob` did NOT run on the confined subprocess face — they ran the pinned host module directly on the inherited `subprocess` service, and a one-workspace Member returned the bytes of `../out-of-lane/secret-out-of-lane.txt` with zero guard facts; after it, both tools run on that face, the out-of-lane roots are refused with a `deny` fact and zero bytes, and the in-lane search still answers.**

## 1. The defect pin, and its flip

`tests/world-factory/a5sf-pd16-search-read-axis.test.mjs` arm **P0** asserts the PRE-FIX behaviour verbatim (env-gated: `A5SF_PD16_PIN=1`, skipped in a normal run because a pin is a one-way marker):

| arm | pre-fix tree (`origin/master`) | this branch |
| --- | --- | --- |
| **P0** (the defect: `grep {path:'..'}` and `grep {path:<absolute out-of-lane>}` return the secret, zero guard facts) | ✔ **PASS** | ✖ **FAIL** (the leak is gone) |
| D1/D2/D3, A1, A3–A6, S1 (the fix) | ✖ FAIL | ✔ PASS |
| A2, C1 (exit-code fidelity; the shadow-removal control) | ✔ PASS | ✔ PASS |

* [`pin-before.log`](pin-before.log) — the test file run on a clean `origin/master` tree (only the suite copied in): `✔ P0`, everything else red.
* [`pin-after.log`](pin-after.log) — the same command on this branch: `✖ P0`, everything else green.

Reproduce:

```sh
A5SF_PD16_PIN=1 node --test --test-reporter=spec tests/world-factory/a5sf-pd16-search-read-axis.test.mjs
```

## 2. The fix: a route-C SEARCH shadow (surface-neutral, no second policy source)

`packages/runtime/src/plugin/live/confined-search-tool.mjs` (new native module) +
`packages/runtime/src/plugin/live/a5sf-realm-row.mjs` (mount wiring), following the PD-12 (`bash`) / PD-13 (`terminal`) precedents:

* the realm row already re-mounts a native module **inside the Member's isolated Cordis scope, after the capability deny lane**, so the module's injected `subprocess` resolves the *confined* face. PD-16 adds `grep`/`glob` to that same list;
* the module registers the two tools by delegating to the pinned host package's **public per-tool faces** — `applyGrepTool(ctx, caps)` / `applyGlobTool(ctx, caps)` from `@deepseek-ai/dsh-tool-fs-search@0.2.0-rc.2` — with the package's own exported caps;
* **surface-neutral**: the same two names are replaced, never added or removed, and the parameter schemas are byte-identical (arm **S1**). No tool name, parameter or description change reaches the model;
* **not a second policy source**: the module holds no lane, no ceiling, no argv copy, no result formatter and no denial vocabulary. The read axis is the *already compiled* effective lane consulted by `createMemberSubprocessGuard` (`team-services/src/subprocess.ts`) — the same `evaluateLocatorAccess` and the same `IO_READ_DENIED`/`IO_ASK_REQUIRES_APPROVAL` facts every other confined face uses. The module only decides *which surface the host tool's `subprocess.spawn` lands on*.

`scripts/dist-placements/160-a5sf-pd16-confined-search.json` mirrors the `.mjs` into `packages/runtime/dist/...` (tsc does not emit `.mjs`); the realm row resolves it with `new URL('./confined-search-tool.mjs', import.meta.url)`.

## 3. Bidirectional evidence (host-free, real kernel, real `rg`)

`tests/world-factory/a5sf-pd16-search-read-axis.test.mjs` boots nothing: an in-process Cordis root, the **real** pinned host search module on the standing scope, the **real** confined provider (Landlock launcher + packaged `rg`) as the realm's `subprocess`, and a **real** base `subprocess` service (real `node:child_process.spawn`) as the inherited path — so P0 returns real bytes and the fixed arms prove the base path is *never reached*.

| arm | what it measures | result |
| --- | --- | --- |
| **D1** | `grep {path:'..'}` → typed failure, **0** confined-provider calls, **0** base calls, **0** secret bytes, exactly **1** `deny` fact (`method='spawn'`, `decidedBy='IO_READ_DENIED'`, `locator = <resolved parent>`) | ✔ |
| **D2** | `grep {path:<absolute out-of-lane>}` — same, locator = that directory | ✔ |
| **D3** | `glob {path:<absolute out-of-lane>}` — same face, so the same refusal | ✔ |
| **A1** | in-lane `grep` finds both needles through the confined provider (≥1 provider call, **0** base calls) + exactly 1 `allow` fact | ✔ |
| **A2** | exit-code fidelity: rg exit 1 → `isError=false` "No matches"; rg exit 2 (invalid pattern) → `isError=true`, distinguishable text | ✔ |
| **A3** | lane-safe ignore discovery: an out-of-lane ancestor adds `--no-ignore-parent --no-ignore-vcs`, so the `.gitignore`d file IS searched and the `allow` fact carries both disclosure notes | ✔ |
| **A4** | a **valid** in-lane repository root keeps ordinary `.gitignore` semantics: no flags, no disclosure | ✔ |
| **A5** | in-lane `glob` lists the workspace through the same confined provider | ✔ |
| **A6** | the measured live-boot shape (`.worktrees/` `.git` FILE above the lane) — the in-lane search succeeds AND the flags are disclosed on every `allow` fact | ✔ |
| **S1** | tool-name set unchanged; `grep`/`glob` parameter schemas byte-identical before/after the shadow; the definitions ARE new objects (i.e. the shadow really took) | ✔ |
| **C1** | control: `disposeNativeToolModules()` ⇒ the ungoverned path returns the lane-denied bytes again | ✔ |

The suite also SKIPs (never reports green) its `A` arms when the host cannot enforce the Landlock `content-read` leg; on this host it is enforced (`a5sf-bl16-grep-realm.test.ts` is green, 10/10).

## 4. The BL-16 correction this fix needed (measured, not speculative)

The first PD-16 DEV-LIVE boot (§9) failed its *in-lane* search: `rg: .../.worktrees/pd16-search-boot/.git: Permission denied (os error 13)`, exit 2. Root cause was a latent assumption in the BL-16 lane-safe search helper (`laneSafeSearchArgv` / `ancestorsStayInLane`, `team-services/src/subprocess.ts`): the ancestor walk stopped at *any* in-lane `.git` and declared discovery contained.

Measurement ([`probe-worktree-git.mjs`](probe-worktree-git.mjs), log [`probe-worktree-git.log`](probe-worktree-git.log); real Landlock launcher + packaged rg, one lane, four ancestor marker classes):

| world | shipped argv | lane-safe argv |
| --- | --- | --- |
| valid in-lane repo + a worktree **`.git` FILE** above the lane | **exit 2** (`Permission denied` on that file) | exit 0 |
| valid in-lane repo + a **`.git` DIR** above | exit 0 (only stat'ed) | exit 0 |
| valid in-lane repo + a denied **`.gitignore`** above | exit 0 (tolerated) | exit 0 |
| **incomplete** in-lane `.git` + a `.git` DIR above | exit 0 | exit 0 |

So rg **opens an ancestor `.git` FILE** (the `gitdir:` worktree pointer — the normal `.worktrees/` layout) and treats the kernel's denial as fatal, even after finding the answer; and an in-lane `.git` directory without `HEAD` is not a repository root at all. The fix, pinned by two new pure arms in `packages/runtime/test/a5sf-confined-subprocess.test.ts` (both **red on `origin/master`, green here**, 38/38 in that file):

* a `.git` ends the walk only when it carries `HEAD` (a repository root) or is a worktree pointer FILE;
* above a repository root the walk continues to the first `.git` FILE, which must also be readable.

This is a language-level correction inside the existing BL-16 admission — no new policy source, no widened lane, no new fact vocabulary. It also fixes the same trap for the `search-family` plane, which rides the identical face.

## 5. Mutation controls (each mechanism removed alone ⇒ only its arms redden)

[`mutation-controls.mjs`](mutation-controls.mjs) · report [`mutation-controls.json`](mutation-controls.json). Literal single-occurrence source edits, sha256-verified restore, arms run with `A5SF_PD16_PIN=0`.

| mutant | removed mechanism | expected RED | measured RED |
| --- | --- | --- | --- |
| **MA** | the route-C search shadow (row appends no search module ⇒ pre-fix composition) | D1 D2 D3 A1 A3 A4 A5 A6 S1 | **exact match** — A2 and C1 stay green (the world is intact; only the routing is gone) |
| **MB** | the read-axis decision in the confined face (facts still recorded, lane no longer refuses) | D1 D2 D3 | **exact match** — the deny arms pin the *judgement*, not the shadow or argv |
| **MC** | the BL-16 containment correction (pre-PD-16 early return at any in-lane `.git`) | A6 | **exact match** — only the worktree-pointer shape reddens |

`overall: PASS` in the report. Two controls were required; three are reported because the third is the one that isolates §4.

## 6. Recon C-1 (`v4 toolBindings` not derived into the realm) — disposition: **honestly still `NOT_WIRED`**

Not fixed, for the reason the code itself states (`packages/runtime/team-services/src/product-assembly.ts:756-760`):

> v4 `toolBindings` are Team-scoped and carry no MemberTemplate association, so the derived declaration derives CEILINGS only; `A5SF_PRODUCT_ASSEMBLY_RESIDUALS` names that when the bound blueprint declares such a family.

The missing layer is a **MemberTemplate (or MemberInstance) ↔ ToolBinding association in the v4 grammar**. Deriving one from today's Team-scoped list would mean inventing a per-Member association — a second policy source, which the task forbids. The declared per-Member route (`a5sfMemberPolicies[].toolRestrictions`, compiled by the same compiler) already exists and is green. The residual token stays `blueprint-tool-bindings-not-member-scoped`; the boot measures the consequence (`toolBindingIdentity: null` on every guard fact, §9) — a **coverage** gap, not a leak: after PD-16 the compiled read lane refuses the out-of-lane roots even with no binding.

## 7. `p4t6` booking (by measurement)

New scannable file: `packages/runtime/src/plugin/live/confined-search-tool.mjs` (1 file). Measured on this branch with the module present and no booking: `scanner counts 1440, ledger derives 983 + 456 = 1439`. Booking `packages/testkit/test/p4t6-bookings/a5sfpd16.json`: `1439 → 1440`. `vitest run packages/testkit/test/p4t6-session-event-scan.test.ts` → 20/20 pass (incl. the ledger-sensitivity controls).

## 8. Gates run on this branch (and what was already red before it)

| gate | result |
| --- | --- |
| `node --test tests/world-factory/a5sf-*.test.mjs` | **545 tests, 540 pass, 0 fail, 5 skipped** (the deliberate pins incl. P0) |
| PD-16 suite (default run) | 12 arms: 11 pass, P0 skipped |
| `packages/runtime/test/a5sf-*.test.ts` (7 files, incl. BL-16 + 2 new pins) | 97/97 pass |
| search/glob package tests (13 files) | 246/247 pass; see the note below |
| `pnpm -r typecheck` | pass |
| `eslint .` | 129 errors / 32 warnings, **identical on `origin/master`** (pre-existing; both touched `packages/**` files lint clean) |
| `node scripts/check-artifacts-committed.mjs` | clean at this commit (dist mirror committed) |
| `node scripts/doc-checks.mjs` | pass |
| `node scripts/doc-consistency-controls.mjs` | 96 controls, 8 failed — **identical on `origin/master`** (pre-existing POS-1/3/4/6/8/10/11, NEG-21) |
| `node scripts/ci-pr-gate.mjs --only state-freshness` | `DSH-CI-VERDICT pass` |
| register anchors (`a5sf-debt-register.test.mjs`) | green — three `subprocess.ts` line anchors re-pointed (+49 lines) |

**One pre-existing red, disclosed with its control**: `packages/runtime/test/a5-globoff-key.test.ts` → `K7` times out at the test's own 5 s budget (~7 s of real confined runs on this host). Reproduced identically on a clean `origin/master` worktree (same arm, same `Test timed out in 5000ms`), so it is not this change; it is not silenced here either.

## 9. DEV-LIVE boot on a real Host (before → after)

Driver: `tests/world-factory/drivers/a5sf-live-member/run-boot.mjs --recon-search --boots 1` at commit `790656764` (the recon branch, unchanged), so the before/after share one driver and one script. Host pin `639ed015397290b3745d163aafe02ffee4aa3f84` (porcelain empty before and after), `DSH_HOME = tests/homes/u5u5a5sfsub1-20261107T17-17-05Z`, port 3188, dev-live slot held, one boot, teardown by identity. Evidence copied verbatim to [`runs/boot01/`](runs/boot01/) (`recon-search.json`, `run-record.json`, `guard-facts.json`, `member-transcript.txt`, `process-evidence.txt`, `proc-observations.json`, `counters.json`, `summary.txt`, `teardown.json`).

| measurement | BEFORE (`origin/recon/b-search-20261113`, boot `…16-15-13Z`) | AFTER (this change, boot `…17-17-05Z`) |
| --- | --- | --- |
| out-of-lane `grep` (`path: <absolute>`) | **returns the secret bytes** (`Found 1 match … secret-out-of-lane.txt`) | `isError=true`, **no bytes** |
| out-of-lane `grep` (`path: '..'`) | returns the secret bytes | `isError=true`, **no bytes** |
| out-of-lane `glob` | lists the out-of-lane files | `isError=true`, **no bytes** |
| in-lane `grep` | 2 matches | 2 matches |
| `.gitignore`d file | not searched | searched (disclosed on the fact — the lane-safe flags) |
| no-match / invalid pattern | exit 1 success / exit 2 error | exit 1 success / exit 2 error (preserved) |
| guard facts | **0** (`allow 0 / deny 0`) | **10** (`allow 6 / deny 4`), all `method='spawn'`, Member identity, policy revision |
| real `rg` sightings in `/proc` | **4**, every one a direct child of the Host node process (`ppid = 101`), same namespaces | **0**; **7** confined-launcher processes served the search calls |
| driver verdict | `overall=FAIL` (9 of 13 propositions PASS) | `overall=FAIL` (5 of 13) — the arm's propositions are written about the *pre-fix* world, so most of them now fail because the hole is gone |

The per-clause detail is the honest reading of that verdict (`run-record.json`):

* `rs:grep-out-of-lane` / `rs:grep-parent-dir` / `rs:glob-out-of-lane`: **`no-secret-bytes` ok**, `no-secret-file` ok; the only failing clause is `typed-refusal: a typed refusal, if refused, must be named`.
* `rs:process-host-direct`: `rg-sighted 0`, `host-child` no longer holds, `no-confined-launcher` fails **because 7 confined launchers served the calls** — i.e. the proposition "rg is a direct child of the Host" is now false, which is the fix.
* `rs:guard-facts`: the clause `zero-search-facts` fails because facts now EXIST (`10 guard fact(s); none for grep/glob` — the matcher looks for grep/glob-named facts; the face records `method='spawn'` with `toolBindingIdentity: null`).
* `rs:grep-ignore`, `rs:grep-timeout`: expected consequences — the lane-safe flags disable `.gitignore` inside such a root (disclosed), and the timeout arm points at `/usr`, which is now refused at admission instead of searched.
* `rs:grep-exit-error`: unchanged from before the fix (the wire carries rg's stderr words, not a typed code).

**Two limitations this boot measured and this change does not fix (stated, not hidden):**

1. **The refusal is not legible to the model.** `grep`/`glob` report `grep subprocess failed before reporting an outcome (ripgrep provider failure)`; the typed `IO_READ_DENIED` lives only in the guard sink. Making the tool result name the denial requires changing the pinned host package's error mapping (out of budget, `CORE PATCH BUDGET = 0`) — the security property (zero bytes, one deny fact) holds regardless.
2. **`toolBindingIdentity: null`** on every fact — recon C-1 (§6): the v4 `toolBindings` family still has no Member association.

**This boot is not merge evidence.** It is `DEV-LIVE`, `eligible=false`; the merge decision re-boots from the merged head.

## 10. E-1 — dev-live slot liveness across PID namespaces (test infrastructure)

**Defect** (recon E-1, reproduced 2026-11-07): peer dev Hosts run in different PID namespaces, so `pidAlive(pid)` from another namespace can report a LIVE peer as dead; `acquireDevLiveSlot` swept the peer's slot file and the peer's boot was then refused at the spawn chokepoint with `DEV_LIVE_SLOT_REQUIRED` although it had acquired a slot.

**Fix** (`tests/world-factory/lib/dev-live-slots.mjs`, shared lib — one place, both the counter and the gate read it):

* a slot now records the writer's PID namespace (`pidNs` = `/proc/self/ns/pid` link);
* `scanDevLiveSlots` classifies `liveness` as `alive | dead | foreign-namespace | unparsable`: a `pidAlive` FALSE is only **evidence of death in the owner's own namespace** (`pidNamespaceComparable`). A foreign or unknown namespace (including a legacy slot with no `pidNs`) is never swept on liveness alone — it ages out through the existing 4 h TTL;
* a provably dead pid is swept only once the slot is older than `DEAD_SLOT_GRACE_MS` (5 s), so a writer that has not yet been scheduled cannot lose its own slot;
* `sweepStaleSlot` re-reads the file and refuses to unlink a slot whose token changed (a new owner), and refuses any entry a scan did not classify stale.

**Regression arms** (`tests/world-factory/a5sf-dev-live.test.mjs`, 15/15 pass):

| arm | pins |
| --- | --- |
| `(e1-foreign-namespace)` | a dead pid in a FOREIGN namespace is `liveness: 'foreign-namespace'`, not stale, survives the sweep, is counted as live, its owner passes `assertDevLiveSlotHeld`, and a new boot takes a *different* slot; a legacy slot with no `pidNs` follows the same rule |
| `(e1-same-namespace)` | a dead pid in OUR namespace is not stale inside the grace window, IS stale and IS swept past it, and a slot re-written with a new token is never unlinked |

The pre-existing `(c-negative)` crash-recovery arm was updated to the new law (it now records `pidNs` and an age past the grace window — a legacy slot is no longer swept on liveness alone, which is the fix).

## 11. Non-claims

* No upstream file, no host tree, no `references/` tree was touched (`CORE PATCH BUDGET = 0`); no `pnpm patch`, no `postinstall` rewrite.
* No matrix grade, `V@B`, Q7/Authority value, required-CI leg or `:3080` instance was changed.
* The shadow does not widen any lane, does not add a tool, does not change any schema, and does not implement network confinement (the preset still cannot narrow it).
* The boot's `overall=FAIL` is reported verbatim, not reinterpreted into a pass.
* `.gitignore` semantics inside a search root whose ancestors leave the lane are **disabled** by the lane-safe flags (pre-existing BL-16 behaviour, now reachable through `grep`/`glob`) and disclosed on the allow fact; this change does not narrow that trade-off.
