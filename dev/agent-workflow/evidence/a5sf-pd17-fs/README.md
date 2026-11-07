# PD-17 FIX — a governed Member's `read`/`write`/`edit`/`read_image` now run on the confined `fs` face

**Task**: close the FILESYSTEM face of the Alpha.5 confined-Member guarantee (the most severe confirmed Alpha.5 defect: a Member could read a *sibling Member's* lane and the host filesystem with zero guard facts).
**Branch**: `task/pd17-fs-20261113` (worktree `.worktrees/pd17-fs`, base `origin/master = bd952e7d0`).
**Record class**: `DEV-LIVE` · `eligible = false` (not candidate evidence; no matrix grade, no `V@B`, no Q7/Authority/required-CI change).
**Defect source**: recon `a5sf-recon-fs` (PR #657, branch `origin/recon/a-fs-20261113 @ 2ef9cf1ec`) and its independent two-Member review `a5sf-recon-review` (PR #662, branch `origin/review/recon-20261113 @ 37853de8f`), measured on a live Host on a pinned `0.2.0-rc.2` baseline. I re-used their facts, I did not re-measure them.

## 0. The one sentence

> **Before this change a governed Member's `read`/`write`/`edit`/`read_image` were NOT bound by its IO ceiling: the four native tools ran on the inherited base `fs-sandbox` service, so `read` returned a sibling Member's lane bytes and `/etc/hostname` with zero guard facts and `write`/`edit` touched out-of-lane files; after it, all four run on the realm's confined `fs` face — an out-of-lane read is refused with 0 bytes, a typed `IO_READ_DENIED` and exactly one deny fact, an out-of-lane write/edit is refused with `IO_WRITE_DENIED` and creates/rewrites nothing, and the in-lane read/write/edit keep working.**

是否受 ceiling 约束、越界还会不会漏字节：**修复前不受，越界会漏；修复后受，越界不漏字节（0 字节 + 类型化拒绝 + deny 事实）。**

## 1. Route ruling: (A) true enforcement on the shipped preset — chosen; (B) reject the tools — rejected

The task asked for an explicit ruling between

* **(A)** real enforcement by shadowing the four tools onto a governed `fs` face inside the Member-isolated scope, and
* **(B)** failing closed by removing/hiding the four tools on the shipped governed preset.

**Ruling: (A).** Reasons, in the order they bind:

1. **The read axis has no service-level carrier upstream, but it does have an ADMISSION carrier in this repo.** `fs-sandbox` states "Reads pass through untouched: every mode permits reading" (`packages/fs/fs-sandbox/src/index.ts:6-7`), so no upstream config or provider swap can fence a read. The realm's confined provider (`packages/runtime/team-services/src/fs.ts`) is the repo's own admission layer: it refuses a locator **before** `super.<method>` runs, with a typed `TeamIoDenial` and one `a5sf-guard-consult/1` fact. Placing the SAME host tool definitions on that provider therefore turns the read axis from unmeasured to enforced **without inventing a second policy source**: the decision is `evaluateLocatorAccess` over the already-compiled effective lane, and the guard is `createMemberFsGuard` — both pre-existing.
2. **(B) would delete the file capability from every governed Member.** The shipped preset *is* the governed composition; the recon showed the four tools on the Member's surface and used them for real work. Rejecting them would be a capability regression, not a fix, and the user explicitly asked for enforcement rather than removal.
3. **(A) stayed inside the budget.** It required **no** change to the core routing contract (`mount.ts` untouched), no upstream change (`CORE PATCH BUDGET = 0`), and no new policy compilation. The route-C native-module seam (PD-12 `bash`, PD-13 terminal, PD-16 `grep`/`glob`) already re-mounts a module **inside the Member's isolated Cordis scope, after the capability deny lane**, so an injected `fs` resolves the confined instance. PD-17 adds the filesystem family to that same list.
4. **(A) was implemented with a surface-neutral definition replacement**, not a re-implementation: the new module delegates to the pinned host package's public `apply` (`@deepseek-ai/dsh-tool-fs`), so names, descriptions, parameter schemas and prompt sections are the host's own (pinned by arm **S1**).

Two findings shaped the mechanism (both measured, not assumed):

* **The host aggregate `apply` must be narrowed, not wrapped per tool.** The host package exports only `{ Config, apply, inject, name }`; there is no per-tool apply face. The module therefore executes the host `apply` on a **narrowing view** of the Member's scope that (a) forwards only the tool registrations whose names are on the post-deny visible surface and (b) registers only those prompt sections. Registering a name the capability lane denied would both re-enable it and make the attach's own surface gate fail.
* **The deferred `read_image` child must declare `fs`.** The host package registers `read_image` from `ctx.inject(['attachments'], …)`, whose child declares only `attachments`; on the preset scope that body could read `ctx.fs` without a declaration because `fs` was *not isolated*, while the Member realm **isolates** `fs` (`root.isolate('fs', …)`) and Cordis refuses an undeclared access to an isolated service. The narrowing view therefore declares the module's own `fs` dependency for the continuation (and only that).

## 2. The defect pin, and its flip

`tests/world-factory/a5sf-pd17-fs-read-axis.test.mjs` arm **P0** asserts the PRE-FIX behaviour verbatim (env-gated: `A5SF_PD17_PIN=1`; skipped in a normal run because a pin is a one-way marker):

| arm | pre-fix tree (`origin/master`) | this branch |
| --- | --- | --- |
| **P0** (the defect: `read` of a SIBLING Member's lane and of `/etc/hostname` returns the bytes, `write`/`edit` touch an out-of-lane file, and ZERO deny facts exist) | ✔ **PASS** | ✖ **FAIL** (the leak is gone) |
| D1–D5, A1–A5, S1, S2, D6, C1 (the fix) | ✖ FAIL | ✔ PASS |

* [`pin-before.log`](pin-before.log) — the suite on a clean `origin/master` worktree (only the suite copied in): `✔ P0`, the deny arms red.
* [`pin-after.log`](pin-after.log) — the same command on this branch: `✖ P0`, everything else green.

```sh
A5SF_PD17_PIN=1 node --test --test-reporter=spec tests/world-factory/a5sf-pd17-fs-read-axis.test.mjs
```

## 3. The fix (three parts, each independently pinned by a mutation control)

1. **`packages/runtime/src/plugin/live/confined-fs-tool.mjs` (new).** A route-C native module: `inject = ['tools','fs','systemPrompt']`, `apply(ctx, {tools})` runs the pinned host package's `apply` on a narrowing view, so the four definitions register on the Member's isolated scope and their `ctx.fs` resolves the confined provider. No schema, description, prompt text or policy is copied.
2. **`packages/runtime/src/plugin/live/a5sf-realm-row.mjs` (mount wiring).** `confinedFsSpecOf(...)` appends that module to the same attach as the shell/search shadows, under four refusals to guess: the realm must own a `faces.fs === 'confined'` face; at least one FS name must be visible post-deny; the surface must be non-empty; and the composition must not already OWN the face (a spec naming the host package or the shadow, a spec whose `expectedTools` names an FS tool, or **any configured module whose `inject` declares `fs`** — the route-C suite's own composition shape, pinned by arm **S2**). `@deepseek-ai/dsh-tool-fs@0.2.0-rc.2` was added to `packages/runtime`'s dependencies (the same version the baseline preset mounts).
3. **`packages/runtime/team-services/src/fs.ts` (provider policy, found by the live boot).** The confined provider used to DROP the per-call `sandboxPolicy` the host `write`/`edit` tools pass. That also dropped the **session workspace root**, so the base `fs-sandbox` fell back to the deployment default root and the HOST fence refused a write the Member lane had just admitted inside its own ceiling — measured in live boot01 (`write workspace/lane-a/written-by-a.txt` → `FS_SANDBOX_DENIED` under `workspace-write`). The provider now forwards the policy **narrowed**: the workspace root survives, the mode is capped at this deployment's own default (`read-only` < `workspace-write` < `danger-full-access`), and the Member ceiling still decides FIRST (an escalation stamp cannot bypass the lane). Pinned by `packages/runtime/test/a5sf-pd17-fs-policy.test.ts` (5 arms) and mutation control MA/MB.

## 4. Two-way arms (host-free: real pinned host tool package + real confined provider + real guard)

`tests/world-factory/a5sf-pd17-fs-read-axis.test.mjs` — 15 arms. The world is the recon's: two Member lanes under one workspace (`lane-a` = this Member's ceiling, `lane-b` = a sibling Member's lane) plus a `not-in-lane/` directory no lane covers. The base provider counts every call, so "0 provider calls" is measured, not inferred.

| arm | what it proves | result |
| --- | --- | --- |
| **D1** cross-Member read | `read` of the sibling lane: 0 bytes, exactly 1 deny fact (`stat`/`IO_READ_DENIED`, Member identity, that locator), **0 base reads** | PASS |
| **D2** host reach | `read` `/etc/hostname`: 0 bytes, 1 deny fact, 0 base reads | PASS |
| **D3** write out of lane | `write` creates nothing, refused `IO_WRITE_DENIED`, 1 deny fact, 0 base writes | PASS |
| **D4** edit out of lane | `edit` rewrites nothing, refused `IO_WRITE_DENIED`, 1 deny fact, 0 base edits | PASS |
| **D5** read_image out of lane | the image bytes never reach the attachment store (0 saves), refused at the fs face, 1 deny fact | PASS |
| **A1** allow read | in-lane read returns the text, ≥1 allow fact, 0 deny facts, exactly 1 base read | PASS |
| **A2** allow write | in-lane write publishes the file (atomic publication is the base's), ≥1 allow fact | PASS |
| **A3** allow edit | in-lane edit replaces `old_string`; the file text changes | PASS |
| **A4** write⇒read kept | an EXISTING file the write lane covers but the read lane does not: `IO_WRITE_REQUIRES_READ`, file unchanged, 1 deny fact | PASS |
| **A5** allow read_image | in-lane image returned and committed to the attachment store (the deferred registration survives) | PASS |
| **S1** surface neutral | name set unchanged; the four parameter schemas **byte-identical** before/after; prompt sections unchanged; the definitions ARE new objects (the shadow took) | PASS |
| **S2** configured owner | a composition whose module declares `fs` owns the face: the row appends no second registration, the surface is unchanged and the composition's own body serves the call | PASS |
| **D6** deny-lane subset | with `write` denied by the capability lane the shadow places only the VISIBLE subset — `write` stays invisible and non-executable, the attach still succeeds | PASS |
| **C1** control | disposing the native modules restores the ungoverned preset path (the refusal goes red in place) | PASS |
| **P0** pin | the pre-fix behaviour (env-gated) | ✖ after / ✔ before |

## 5. The cross-Member arm, before → after, on a real Host (one driver)

Driver: [`run-boot.mjs`](run-boot.mjs) (derived from the recon-review's two-Member boot; identified by the same `--run-tag`). The SAME driver, the SAME two-Member blueprint, the SAME probe order, twice: on a clean `origin/master` worktree (`runs/boot00-prefix/`) and on this branch (`runs/boot02/`). Host pin `639ed015397290b3745d163aafe02ffee4aa3f84` (porcelain empty before and after), `DSH_HOME` under `tests/homes/`, port 349x family, dev-live slot held, teardown by identity.

| measurement (Member A, its whole ceiling = `workspace/lane-a`) | BEFORE (`origin/master`, boot00) | AFTER (this branch, boot02) |
| --- | --- | --- |
| `read` a SIBLING Member's lane (`workspace/lane-b/b.txt`) | **returns `A5SF_PD17_SIBLING_LANE_B_BYTES`** | `isError=true`, **0 bytes**, `authored locator … outside every allow subtree of the lane`, **1 deny fact** (`stat`/`IO_READ_DENIED`) |
| `read` `/etc/hostname` | **returns the host bytes** | `isError=true`, 0 bytes, 1 deny fact |
| `write` into the sibling lane | **creates the file** | `isError=true`, **no file**, 1 deny fact (`IO_WRITE_DENIED`) |
| `edit` a sibling-lane file | **rewrites it** | pre-read refused (`IO_READ_DENIED`, 1 deny fact); the host `edit` tool then refuses at its own read-before-edit gate; **file byte-identical** |
| `read_image` a sibling-lane image | route gate (see §7) | route gate (see §7) — 0 attachment saves, 0 fs allow facts |
| in-lane `read` | bytes returned, **0 facts** | bytes returned, allow facts (`stat`+`readText`) |
| in-lane `write` | created, **0 facts** | created, `writeText` allow fact (after the §3.3 provider-policy fix; boot01 measured the host-fence refusal) |
| in-lane `edit` | replaced, **0 facts** | replaced, `stat`+`readText`+`editText` allow facts |
| **guard facts, Member A** | **0** — the whole boot produced 4 facts and every one is Member B's shell (`shellRead` 2, `spawn` 1, `spawn:write` 1) | **12** (8 allow / 4 deny, all fs methods, all carrying A's identity) |
| Member B reading A's lane (symmetric arm) | leaks A's bytes | `isError=true`, 0 bytes, 1 deny fact (`IO_READ_DENIED`) |
| Member B's governed `bash` control (own lane) | allow, facts | allow, facts (`shellRead`+`spawn`+`spawn:write`) |
| facts naming the wrong Member | n/a (no facts) | 0 — every fact names the Member that made the call |
| driver verdict | `overall=FAIL` (8 of 12 cases red: every deny arm and every allow arm that requires an allow fact) | **`overall=PASS`, 12/12 cases** |

Evidence copied verbatim: `runs/boot00-prefix/` (before: `run-record.json`, `guard-facts.json`, `member-A-transcript.txt`, `member-B-transcript.txt`, `pd17-fs.json`), `runs/boot02/` (after: same set + `cross-dispatch.json`, `leader-surface.json`, `member-surface.json`, `teardown.json`, `state.json`, the zstd session files), plus the driver logs `boot00-driver.log` / `boot02-driver.log`. `runs/boot01-policy-bug/` is **kept on purpose**: it is the boot that MEASURED the §3.3 regression (in-lane write refused by the host fence) before the policy fix — see §8.

## 6. Mutation controls (each reddens only the arms its mechanism protects)

`node dev/agent-workflow/evidence/a5sf-pd17-fs/mutation-controls.mjs` — a literal single-occurrence edit against the REAL source, sha256-verified restore in `finally`, the suite run with `--test-reporter=spec`. A control that fails to produce its expected RED pattern exits non-zero. Result: **4/4 OK** ([`mutation-controls.json`](mutation-controls.json)).

| control | removed mechanism | observed RED | stays GREEN |
| --- | --- | --- | --- |
| **MA** | the row appends no PD-17 filesystem module (the exact pre-fix composition) | D1 D2 D3 D4 D5 A1 A2 A4 S1 D6 C1 | A3 A5 (the ungoverned path is FUNCTIONAL — that is why the hole was invisible) |
| **MB** | the confined provider's READ branch no longer refuses (the guard still evaluates, records a fact, and still refuses writes) | D1 D2 D5 D6 C1 (D6/C1 also assert a read refusal) | D3 D4 A1 A2 A3 A4 A5 S1 S2 |
| **MC** | the shadow places all four names regardless of the visible surface | D6 | everything else (a Member that denies nothing sees the same four names either way) |
| **MD** | the configured-owner detection is removed (a composition that declares `fs` gets a second registration) | S2 | everything else |

## 7. `read_image` under the governed face — stated explicitly

* **On the fs face it is READABLE in-lane and DENIED out-of-lane**, exactly like `read`: host-free arms **A5** (in-lane image returned and committed to the attachment store) and **D5** (out-of-lane: 0 attachment saves, 0 image bytes, 1 `IO_READ_DENIED` fact). It works because the shadow's narrowing view declares `fs` for the host package's deferred `inject(['attachments'])` child (§1).
* **It remains COMPOSITION-CONDITIONAL, as upstream ships it:** the name only exists on the surface when an `attachments` store is mounted (the same `ctx.inject(['attachments'])` registration), and the tool's own pre-read gate requires an image-capable model route. On the **shipped governed composition** the configured model route does not declare image input, so live `read_image` is refused **before** the fs face with `model "…" does not declare image input` — 0 bytes, 0 attachment saves, 0 fs allow facts, and (in the AFTER boot) 0 deny facts for that locator. The live boot records that behaviour and claims nothing more (arm `pd17:a-read-image-cross-stated`); the fs-face judgement is the host-free D5/A5 pair. This is not "unsupported": it is a route-gate refusal in front of a governed face that is itself pinned.

## 8. DEV-LIVE disclosure

* **What is fixture**: the model is the shared scripted mock (`packages/tools/harness/mock-deepseek.mjs`); the /proc watcher and the mock request log are instrumentation; the world's lane files are fixtures.
* **What is product**: the shipped `cordis.patch.yml` rows (host + `preset-a5sf-governed-member`), the realm, the compiler, the guard, the confined `fs`/`term`/`bash` faces, the pinned host `tool-fs` module and the base `fs-sandbox` service — the boot loads them from this worktree's `packages/` and this worktree's `dist` mirror.
* **boot01 is disclosed, not hidden**: it ran the fix WITHOUT the §3.3 provider-policy change and its 4 reds included `a-write-own-allow` (`FS_SANDBOX_DENIED` on an in-lane write) — that is how the regression was found. Its transcript (`runs/boot01-policy-bug/member-A-transcript.txt`) is the measurement; the fix is the §3.3 change; boot02 is the post-fix result.
* **The `overall=FAIL` of boot00 is reported verbatim** — it is the pre-fix world judging the fixed propositions, not a defect of this branch.
* **Record class**: `DEV-LIVE`, `eligible = false`. No boot here is candidate evidence; the delegating agent re-tests.

## 9. Gates

| gate | result |
| --- | --- |
| `node --test tests/world-factory/a5sf-*.test.mjs` | **572 tests, 566 pass, 0 fail, 6 skipped** (the deliberate pins incl. P0) |
| PD-17 suite (default run) | 15 arms: 14 pass, `P0` skipped |
| `packages/runtime/test/a5sf-pd17-fs-policy.test.ts` | 5/5 |
| `packages/runtime/test` (vitest) | **6009 tests, 6006 pass, 3 fail** — and the 3 are the environment reds below, not this change |
| same 3 on a clean `origin/master` worktree | [`baseline-three-red.log`](baseline-three-red.log) — the SAME 3 failures (`a5-globoff-key` K7 timeout, `a5rbn-runtime-base-narrow` N3 kernel refusal, `a5sf-os-runner` P1-07 Landlock refusal) → not this change |
| `pnpm -r typecheck` | pass (all packages) |
| `eslint` on the two touched product files | clean (tests/evidence are eslint-ignored) |
| `packages/testkit/test/p4t6-session-event-scan.test.ts` | 20/20, two bookings (`a5sfpd17`: 1440→1441, `a5sfpd17b`: 1441→1442), measured `scanner counts 1442, ledger derives 983 + 458 = 1441` before the second booking |
| `node scripts/check-artifacts-committed.mjs` | clean once the rebuild is committed (the check names the 6 generated files) |
| `node scripts/doc-checks.mjs` | pass |
| register anchors (`a5sf-debt-register.test.mjs`, in the family run) | green — no register edits were made by PD-17 |
| `node scripts/ci-pr-gate.mjs --only state-freshness` | `DSH-CI-VERDICT pass` |

## 10. Files in this directory

| file | what it is |
| --- | --- |
| `pin-before.log` / `pin-after.log` | the PD-17 suite with `A5SF_PD17_PIN=1`, on a clean `origin/master` worktree and on this branch |
| `run-boot.mjs` | the ONE two-Member live driver used for both boots below |
| `boot00-driver.log` / `runs/boot00-prefix/` | BEFORE: the driver on a clean `origin/master` worktree (same blueprint, same probes) |
| `boot01-driver.log` / `runs/boot01-policy-bug/` | the intermediate boot that exposed the §3.3 in-lane write refusal (kept on purpose) |
| `boot02-driver.log` / `runs/boot02/` | AFTER: this branch, `overall=PASS` 12/12 |
| `driver/logs/<world>/` | the composed profile patch and the host instance log of each boot world (the product composition that actually ran) |
| `plan-patch.yml` | the composition the boot composed from this worktree's rows |
| `run-ledger.jsonl` | the dev-live slot ledger entries for the boots |
| `mutation-controls.mjs` / `mutation-controls.json` | the four mutation controls and their measured RED patterns |
| `baseline-three-red.log` | the 3 pre-existing runtime reds reproduced on a clean `origin/master` worktree |
| `dev-live-grant.json` | the dev-live grant the boots ran under |

## 11. Non-claims

* No upstream file, host tree or `references/` tree was touched (`CORE PATCH BUDGET = 0`); no `pnpm patch`, no `postinstall` rewrite. The host package is consumed through its **public** `apply`/`Config` exports at the pinned version.
* No matrix grade, `V@B`, Q7/Authority value, required-CI leg or `:3080` instance was changed; no plan-doc/register edits.
* The shadow does not widen any lane, does not add a tool name, does not change any schema or prompt text, and does not implement network confinement.
* The `read` axis is enforced by the realm's admission decision, not by a kernel boundary; `fs-sandbox` is untouched and still has no read fence. A Member with a composition that **owns** the `fs` face (declares `fs`) keeps that composition's own routing — PD-17 does not override a declared owner.
* The live `edit` out-of-lane arm is refused at the host tool's read-before-edit gate (its pre-read is what the lane denies); the write-path denial for an out-of-lane edit is pinned host-free (D4), not claimed live.
