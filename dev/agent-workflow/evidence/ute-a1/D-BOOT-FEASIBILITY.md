# D-stage feasibility: can this worktree boot the product host?

- **Slice**: one scoped D-stage feasibility probe, branch `vnext/a1-cut`, worktree `.worktrees/vnext-a1-cut`, HEAD `3fb8882f8739bf4c6a7c93c4d4bf88a32464641c`.
- **Date**: 2026-11-22 (local), host clock 2026-11-21T21:06–21:22Z.
- **Record class**: `DEV-LIVE` (development evidence). **Never candidate evidence**; no row here can yield `V@B=yes`.
- **Verdict**: **PARTIAL — the environment boots the host, the product composition does not reach a governed Member.**
  - The pinned DSH host builds/starts, a real `dsh web` process serves on a leased port (3187), `team.create` returns 200, and the Leader chain closes.
  - The **centre-configured arm cannot bootstrap at all**: `TeamPluginError: the remote handler registration (S6 A31) is not installed ...`.
  - The **no-centre diagnostic arm boots but refuses the governed Member**: `member-execution: Member '...' mounts a compiled realm but this row sets no config.centreStatePath ...`.
  - Therefore **no Member turn ran** and the native-tool-provider question was **not measured** this round. The measurement design is concrete and unblocked once the three defects below are fixed.
- **Not `ENV_BLOCK`**: the host environment is adequate (pinned tree present and built, `node_modules` resolves, ports/leases work, sandbox assets present). The blockers are this branch's committed build artifacts and product wiring, all in-repo and reversible; no upstream patch is needed, so this is **not** a `CORE_SEAM_BLOCKER`.
- **Evidence artifacts**: `dev/agent-workflow/evidence/d-boot-feasibility/` (driver, `driver.log`, `run-ledger.jsonl`, `runs/boot01/*`, per-world host logs). This report is the human-readable summary.

> **STATUS UPDATE — round 59 (2026-11-22, HEAD `2e2d36543` + a rebuilt dist).** The three code blockers
> in §5/§6 are fixed and the fourth (stale dist) is provisioned; the centre-configured composition now
> **boots** (no `TeamPluginError`; remote mount recorded `skipped`), the install graph resolves, and the
> boot Leader carries 43 model-visible tools including the native `read` and the 15 `team_*` tools. It
> then **stops at `team.create` (HTTP 405)**: C-remote refuses the S6 remote plane on a centre-config row,
> and that plane is the driver's only team-creation entrance, so no Member turn runs and all five judges
> are unmeasured. Verdict for round 59: **PARTIAL** (host live, Member blocked). Full record, exact
> commands and gate outputs: `MIGRATED-SUITE-STATUS.md`, "Round 59 (D stage)". This report's §1–§10 remain
> the round-58 record at `3fb8882f8`; see §11 for the round-59 delta.

---

## 1. What was asked

1. Can this worktree boot the **product** host at all (not a mock)?
2. If yes, does an **unmodified native tool** (`read`) on a Member resolve to **that Member's controlled Provider** — with **no shadow definition** — and does the **centre** admit it and record the fact?

The named risk was that the answer only exists on a real host. This round establishes what the real host does at this HEAD *before* any acceptance run is scheduled.

## 2. Environment and toolchain (step 2 of the brief)

Measured facts, not narration:

| Fact | Value |
| --- | --- |
| Node / pnpm | `v24.21.0` / `11.7.0` |
| Worktree `node_modules` | symlink → `../../node_modules` (the main install, not a dangling store) |
| `vitest` resolution | `node -e "require.resolve('vitest/package.json')"` → `/home/armourpiercer/projects/dsh-agent-team/node_modules/.pnpm/vitest@4.1.11_.../vitest/package.json` |
| Pinned host tree from the worktree | `tests/deepseek-harness-test-use` → `../../../tests/deepseek-harness-test-use` (symlink to the shared main-checkout tree, read-only for this slice) |
| Host HEAD | `639ed015397290b3745d163aafe02ffee4aa3f84` (`0.2.0-rc.2`, matches `tests/paths.mjs#TEST_USE_BASELINE_SHA`) |
| Host built | `apps/cli/lib/bin.js` present, `apps/web/dist` present |
| Sandbox assets | `native/system/packages/linux-x64/bin/landlock-run` present |
| Host porcelain | empty before and after every boot (driver records it); this slice wrote nothing into the host tree |

**No `node_modules` repair was needed or made.** The earlier claim in `CAPABILITY-MATRIX-C.md` that this worktree cannot boot because `node_modules` links a nonexistent pnpm store is **not true at this HEAD**: the link resolves and the toolchain loads. That claim should be corrected in the matrix or scoped to the commit where it was observed.

Two environment quirks that are real but do not block a boot:

1. `node tests/world-factory/provision-host-sandbox.mjs --check` → `FAIL-CLOSED LAUNCHER_PATH_OUTSIDE_TREE` (exit 2), because the check `resolve()`s the launcher path without `realpath()` and the worktree's host tree is a symlink. The launcher itself exists at the real path. The driver therefore hands `WorldFactory` the **real shared tree** (`hostTreePath()`), which is also the pristine tree we must not write.
2. `pnpm --filter @dsh-agent-team/runtime run build` fails with a stale virtual-store path: `Cannot find module '.../vnext-a1-cut/.worktrees/tinf-m2/node_modules/.pnpm/typescript@6.0.3/.../bin/tsc'`. That nested path does not exist. The build was therefore run with the main install's compiler directly (see §6). This is a worktree-local pnpm metadata staleness, not a missing dependency.

## 3. Boot harness and the probe

New driver: `tests/world-factory/drivers/d-boot-feasibility/run-boot.mjs`, derived from the proven `drivers/a5sf-live-member/run-boot.mjs` (which boots the shipped `a5sf-governed-member` preset with a two-boot agreement protocol). It:

- boots the **product entry** `packages/runtime/src/plugin/host.js` (dist of `host.ts`, which constructs `createTeamProductionRoot` from `src/plugin/vnext/root.ts`) through the repo's own `WorldFactory` chain (`dsh web`, mock model, p6t6 directive);
- opts into the governed preset (`memberPresetId: a5sf-governed-member`, `a5sfGovernedRealm: true`, v4 `memberIoCeilings`, `a5sfNativeToolModules: []`);
- creates a team and one Member, and asks the Member (via the mock) to call the host's native `read` twice — once for an in-lane file, once for an out-of-lane secret;
- captures: the Member-visible tool schema, the guard-consult facts (`a5sfEvidencePath`), the centre's per-member durable ledger, and the transcript;
- judges: admitted read returns in-lane bytes; out-of-lane read is a typed `IO_READ_DENIED` with zero secret bytes; the `read` schema is the host-native one (`file_path`, `limit`, `offset`, host description) with **no** shadow module; guard facts show the member's identity for the in-lane read and **zero** facts for the out-of-lane read (the centre refuses before the tool body); the centre ledger has two read admission facts (allow + `LANE_DENY`) and at least one execution fact.

The driver uses the DEV-LIVE authorisation `devlive-fs-search-1` (FS Provider face, world line `u5a5sfdev1`) and writes a ledger row before every start. It leases ports from the 3180/13000 bands and never touches `:3080`.

## 4. Boot attempts (exact commands and errors)

All runs: `cd .worktrees/vnext-a1-cut && node tests/world-factory/drivers/d-boot-feasibility/run-boot.mjs --boots 1`.

| # | Command variant | Result | Exact error |
| --- | --- | --- | --- |
| 1 | first draft | refused before spawn | `A5sfReadGateError: BUDGET_NOT_GRANTED reason=GRANT_FACE_MISMATCH: grant 'devlive-fs-search-1' authorises face 'FS Provider', but this start declares 'Subprocess'` (driver bug: wrong face; fixed) |
| 2 | corrected face | refused at World creation | `A5SF_PROFILE_GRAPH_UNRESOLVED: dsh-agent-team does not resolve from <world>/profiles/web: ./web-tool (MODULE_NOT_FOUND)` |
| 3 | + drop the dead preset row | refused at World creation (same) | same: `verifyProfileModuleGraph` checks every package export before any driver row |
| 4 | + `A5SF_WF_NO_INSTALL_GRAPH=1` (documented negative control) | host process started, team plugin dead | `dsh-agent-team (.../host.js): failed to import` → `ERR_MODULE_NOT_FOUND: Cannot find module '.../dist/packages/tools/fs-family/src/read-normalizer.js'` (reproduced by importing `host.js` directly) |
| 5 | + locally rebuilt `dist` | host started, centre bootstrap failed | `TeamPluginError: the remote handler registration (S6 A31) is not installed: the Remote contract v1 dispatcher is unavailable on the production root` (host log + `setup-failure.json`) |
| 6 | rebuilt `dist`, `DBOOT_WITHOUT_CENTRE=1` (diagnostic arm) | **host + team boot**, member refused | `TEAM_RUNTIME_DURABLE_WRITE_FAILED` / `member-execution: Member 'inst-0e23ryd1fmn2' mounts a compiled realm but this row sets no config.centreStatePath; ... refused rather than run unrecorded` |

Run 6 is the clean cited run (21:21:06–21:22:28Z): `p6t6 health=true`, `team.create status=200 ok=true`, `leader chain closed (DBOOT_L1_DONE)=true`, `delegate call=true result={"status":"rejected",...}`, `members=[leader only]`, `childSessionId=undefined`, teardown `portFree=true`, world home deleted, host porcelain empty.

Honesty note: an earlier no-centre attempt (21:19:34Z) overlapped the 300 s wait of run 4, so its teardown killed run 4's host and its own health check was invalid. That attempt is in `driver.log` and is **not** cited. Run 6 is a clean, single-process rerun. The driver's `runId`/`suite` fields still read `a5sf-live-member` because the record shape is inherited from the ancestor driver; the artifacts under this evidence directory are this driver's.

## 5. The two-arm contradiction (the core finding)

The centre and the host's remote-mount path cannot both be satisfied at this HEAD:

**Arm A — centre configured** (`centreStatePath` set, shipped `host.js`):

```
[dsh-agent-team] bootstrap FAILED: TeamPluginError: the remote handler registration (S6 A31) is not installed:
the Remote contract v1 dispatcher is unavailable on the production root
  at mountRemoteNow (.../dist/.../src/plugin/host.js:1005:69)
  at bootstrap (.../dist/.../src/plugin/host.js:2480:35)
```

Cause: `packages/runtime/src/plugin/vnext/root.ts` refuses to build/install the S6 remote surfaces on a centre row (`remoteRefused` at ~4324; `seams.remoteHandlerRegistration.install` only when `remoteSurfaces !== undefined` at ~4727). But `packages/runtime/src/plugin/host.ts` (~3330) calls `mountRemoteNow(...)` whenever the public `connection` service is present — which it is on `dsh web` — and `mountRemoteNow` immediately calls `root.seams.remoteHandlerRegistration.current()`, which throws when not installed. A centre row therefore **cannot bootstrap on any web host**.

**Arm B — centre omitted** (diagnostic arm, `DBOOT_WITHOUT_CENTRE=1`):

```
team_delegate → {"status":"rejected","code":"TEAM_RUNTIME_DURABLE_WRITE_FAILED",
 "message":"activation: child-session creation failed for member 'inst-0e23ryd1fmn2':
 Error: member-execution: Member 'inst-0e23ryd1fmn2' mounts a compiled realm but this row sets
 no config.centreStatePath; a governed member whose admission/execution facts and settlements
 cannot be written is refused rather than run unrecorded (set centreStatePath to a directory
 this deployment owns)"}
```

Cause: `packages/runtime/src/plugin/vnext/member-execution.mjs` (~75–170) requires `config.centreStatePath` when a compiled realm mounts; the host has no other configured centre.

So at `3fb8882f8` on a real web host: **set the centre → bootstrap fails; omit the centre → the Member is refused.** No configuration reaches a governed Member, hence no native `read` on a Member.

## 6. Committed build artifacts are stale (defect 2)

`packages/runtime/dist` at HEAD does not match `packages/runtime/src`:

- `dist/packages/runtime/operation-permission/canonical-operation.js` still has `import { normalizeReadProjection } from '../../tools/fs-family/src/read-normalizer.js'`. The source now defines `normalizeReadProjection` locally; the cut `1617d5839` deleted `packages/tools/fs-family/src/read-normalizer.ts` but did not regenerate this dist file. Node fails the whole `host.js` import with `ERR_MODULE_NOT_FOUND`.
- `dist/packages/runtime/src/plugin/vnext/` is **absent** at HEAD (no `root.js`, `admission.js`, `centre-config.js` or their `.d.ts`), while `host.js` imports `./vnext/root.js`. Even after the import above is fixed, the committed `host.js` cannot load.
- `package.json#exports["./web-tool"]` still points at `packages/runtime/dist/.../live/confined-web-tool.mjs`, which the same cut deleted; the shipped `cordis.patch.yml` preset still names `dsh-agent-team/web-tool`. `WorldFactory`'s install-graph verification resolves **every** declared export, so **every World creation in this worktree refuses** (`A5SF_PROFILE_GRAPH_UNRESOLVED`) before any driver row is read. `scripts/ute-cut-closure.mjs` reports `prodRefs=0` because it does not scan this YAML-string export usage; that gap is itself a finding.

Measurement step (reversible, recorded so it can be repeated):

```
node /home/armourpiercer/projects/dsh-agent-team/node_modules/typescript/bin/tsc \
  -p packages/runtime/tsconfig.build.json          # exit 0
# 25 tracked files changed (+164/−55) + 12 new untracked files (vnext/root, admission, centre-config)
node -e "import('./packages/runtime/dist/packages/runtime/src/plugin/host.js')"  # IMPORT OK
```

After the runs the tree was restored: `git checkout -- packages/runtime/dist` + `git clean -f packages/runtime/dist`, then `git status --porcelain packages/runtime/dist` → empty, and the direct import fails again with the committed state. **The committed tree remains exactly as found**; the rebuild is reproducible with the command above. This is a build step, not a product edit.

## 7. What was and was not measured

From the clean run:

| Artifact | Value |
| --- | --- |
| `counters.json` | `mockRequests=5`, **`memberModelRequests=0`**, `confinedTurnLaunchers=0`, `guardFacts={allow:0,deny:0}` |
| `member-surface.json` | `tools=[]`, `read=null`, `shadowModules=[]`, preset plugins = 14 after the dead `tool-web` row was dropped |
| `guard-facts.json` | `[]` |
| `centre-facts.json` | `[]` |
| `leader-delegate.json` | `status:"rejected"`, `code:"TEAM_RUNTIME_DURABLE_WRITE_FAILED"` |
| `teardown.json` | host killed, `portFree=true`, world home deleted |

**No Member request was ever made; no `read` was called; no guard fact and no centre fact exists.** Nothing in this report is a product claim about the native-tool provider. What *is* measured is that the instrument (schema capture, guard sink, centre ledger, transcript) is wired into the driver and would record those facts on a boot that reaches a Member.

## 8. What would make this bootable (concrete provisioning steps)

In order; each is in-repo and no upstream patch is required.

1. **Commit a fresh `packages/runtime/dist`.** Run the compiler from the main install (the worktree's `pnpm run build` is broken by stale virtual-store metadata):
   `node /home/armourpiercer/projects/dsh-agent-team/node_modules/typescript/bin/tsc -p packages/runtime/tsconfig.build.json`
   and commit the 25 changed + 12 new files (or run the repo's canonical build/publish step). Without this, `host.js` cannot be imported at all.
2. **Resolve the dead `./web-tool` export.** Either restore `packages/runtime/src/plugin/live/confined-web-tool.mjs` + its dist mirror (and reconcile it with the cut), or remove `./web-tool` from `package.json#exports` and the `tool-web` row from the `a5sf-governed-member` preset. Until then `verifyProfileModuleGraph` refuses **every** World at creation, for every driver in this worktree. Also widen `ute-cut-closure` to catch package-export/preset-string references so this class of dangling reference cannot come back silently.
3. **Reconcile the centre with the remote mount.** In `packages/runtime/src/plugin/host.ts` (~3330), when `root.seams.remoteHandlerRegistration.installed === false`, record `remoteMountState = { state: 'skipped', reason: <the host-surface refusal fact> }` instead of calling `mountRemoteNow`. The root already writes the `remote` refusal fact (`refuseHostSurfaceBefore`); the host glue should consume it rather than dereference an uninstalled seam. This is product code of this repo, not an upstream change.
4. **Then run the real acceptance arm:** the same driver without `DBOOT_WITHOUT_CENTRE`, without the composition drop (after step 2), with `--boots 2` for the two-run agreement; judge the five cases already encoded (admitted, denied, surface, guard facts, centre facts). A green pair is still `DEV-LIVE`, not `PRODUCT-PROVEN`; promoting it requires the candidate protocol, which this slice does not touch.

## 9. Discipline

- `:3080` untouched: `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3080/` → `401` after the runs.
- Host tree (shared, read-only): `git status --porcelain` empty before and after every boot.
- DSH_HOME: `tests/homes/u5u5a5sfdev1-<stamp>` (workspace-internal, gitignored), deleted by teardown; ports 3187/3497 released; no other worktree touched.
- DEV-LIVE ledger: 10 rows (`budget-intent` + world rows) in `dev/agent-workflow/evidence/d-boot-feasibility/run-ledger.jsonl`, all bound to `headCommit 3fb8882f8…` and `grantId devlive-fs-search-1`.
- No frozen A0 evidence edited; no compatibility layer added; no upstream patch; no history rewrite.

## 10. Bottom line

**Can this worktree boot the product host?** The **host process** yes (with a locally rebuilt `dist`); the **product Team with a governed Member and a centre** no, at this HEAD, for a reason that is now precise: a stale committed dist, a dangling package export, and a centre/remote bootstrap contradiction. **Does the native-tool-provider question have a measurable answer?** The measurement exists and is encoded (native `read` schema + guard facts + centre admission ledger + typed denial), but it produced **no measurement this round** because no Member turn ran. Fix the three items above and the next run answers it directly instead of inferring it.

## 11. Round 59 update (2026-11-22) — boot works, creation does not

HEAD `2e2d36543ab2d34bb6cbaac476cda39582765e50`, host `639ed01539…` (porcelain empty), branch
`vnext/a1-cut`. Record class `DEV-LIVE`. Commands, verbatim:

```
node /home/armourpiercer/projects/dsh-agent-team/node_modules/typescript/bin/tsc \
  -p packages/runtime/tsconfig.build.json          # exit 0 (25 tracked dist files changed, 12 added)
node scripts/place-dist-glue.mjs                    # exit 0, 28 placements byte-identical
env -u DBOOT_WITHOUT_CENTRE -u A5SF_WF_NO_INSTALL_GRAPH \
  node tests/world-factory/drivers/d-boot-feasibility/run-boot.mjs --boots 2
```

What §4–§6's blockers now do:

1. **remote seam** — a centre row boots. `host.ts` records `skipped` instead of dereferencing the absent
   registration seam; the host log carries
   `remote mount: SKIPPED — the root refused the remote surface (C-remote: a centre-configured row has no remote-command axis)`.
2. **retired `tool-web`** — World creation reaches the host with the install graph **provisioned** and
   `composition drops: []`; `A5SF_PROFILE_GRAPH_UNRESOLVED` no longer occurs, so
   `A5SF_WF_NO_INSTALL_GRAPH=1` was not used.
3. **gate** — green (§ below); the NAME class is covered.
4. **stale dist** — provisioned exactly as §8 step 1 proposed. `import(host.js)` succeeds and the host
   boots. All 37 changed/added files are artifact classes the repo already tracks
   (`dist/**/*.js`, `*.js.map`, `*.d.ts`, `*.d.ts.map`); the 28 byte-copied `.mjs`/`.py` placements ride
   `place-dist-glue` and were already tracked.

New blocker (round 59), with the exact line:

- the driver creates its acceptance team through `remoteCall(...)` →
  `POST /team-remote/team.create` (`tests/world-factory/lib/u6-fs-assembly.mjs:505-510`); that route belongs
  to the S6 remote plane, which a centre row refuses at `root.ts:4324-4331` (the seam is installed only when
  the surfaces are built, `root.ts:4722-4730`). `host.ts:1631-1641` therefore skips the mount, no route is
  registered, and `team.create` returns **405**; the driver aborts at
  `run-boot.mjs:991` (`team.create failed: status=405 body=null`).
- Round 58's no-centre arm got `team.create status=200` on the same driver, which isolates the cause to the
  remote refusal. A centre-configured row has no runtime team-creation entrance; the only Team it can have
  is the boot-created one (`root.ts:4888-4925`).

Consequence: `mockRequests` never reached a Member request, `member-surface.json` / `guard-facts.json` /
`centre-facts.json` do not exist, and the driver's five judges are recorded fail-closed `FAIL`
(`selected case produced no verdict`), `agreement.json` `boots=1, agreeing=false`. **No Member turn, no
native tool call, no admission/execution fact.** The round-59 artifact set is `runs/boot01`; round 58's is
preserved at `archive/2026-11-21T21-31-24-221Z/` (archive-before-start), and the first attempt of this round
(the driver's `record.bindings` crash, fixed in two receiver names with no assertion change) at
`archive/2026-11-21T21-32-33-226Z/`.

What is needed is a ruling, not a patch: (1) make creation a centre-adjudicated command (contract change —
there is no remote-command axis in the compiled ceiling), (2) add a non-remote product creation entrance, or
(3) redesign the driver to bind the v4 blueprint at boot and use the boot-created Team. Each is a product
decision; none is a small non-weakening fix. §7's "no measurement" remains true for the Member, while the
host/centre/Leader half is now measured live.

## 12. Round 60 update (2026-11-22) — path 3: the boot-bound Team reaches a Member; the native read is NOT served by the controlled Provider

HEAD at run start `f9c7f4f72658b308fd168297eddfe376ff702a94` (the driver edit of this round is the only
tracked change; `packages/runtime/dist` was already current and `place-dist-glue` reports 28 byte-identical
placements), host pin `639ed015397290b3745d163aafe02ffee4aa3f84` (porcelain empty), branch `vnext/a1-cut`,
record class `DEV-LIVE` (never candidate evidence). **Verdict: PARTIAL — the Member runs, the centre
adjudicates, the controlled-Provider clause is REFUTED.** Two judges PASS, three REFUTE, identically on both
boots (`agreeing=true`).

### What changed (one file, driver only)

`tests/world-factory/drivers/d-boot-feasibility/run-boot.mjs`, no product code:

1. The row's `blueprintSource` is the **v4 `main` blueprint** (the identical document `team.create` used to
   receive by `blueprintId`), written and validated **before** boot. The boot create
   (`root.ts:4888-4925`) therefore mints the Team on that bound snapshot.
2. `POST /team-remote/team.create` is **gone** from the driver. The Leader's first turn — the same `MK_L1`
   prompt the remote `initialWork` carried — is sent with `apiPrompt(origin, cookie, BOOT_ROOT, MK_L1)` on
   the boot-created Team. The delegate's `rootSessionId`, the p6t6 directive root and the child-session
   derivation use `BOOT_ROOT`; the former second root (`session-dboot-read-team`) existed only to receive
   the remote team and is removed.
3. **No judge clause, assertion, timeout, retry, composition row or fixture value changed.** The anchor
   document is no longer part of the boot composition because it was only the remote entrance's anchor;
   `anchorBlueprintYaml()` is still validated by `--plan`.

Commands, verbatim:

```
node tests/world-factory/drivers/d-boot-feasibility/run-boot.mjs --plan   # exit 0, both blueprints accepted, drops []
env -u DBOOT_WITHOUT_CENTRE -u A5SF_WF_NO_INSTALL_GRAPH \
  node tests/world-factory/drivers/d-boot-feasibility/run-boot.mjs --boots 2
```

The driver exits `1` because its own judges refute (below). `agreement.json`: `boots=2, agreeing=true,
differing=[]`.

### What the two boots measured (identical)

| Fact | boot01 / boot02 |
| --- | --- |
| World / install graph | created, `composition drops: []`, preset 14 plugins |
| remote mount | `SKIPPED` — `the root refused the remote surface (C-remote: a centre-configured row has no remote-command axis)` |
| boot-created Team | root `session-dboot-read-root`, blueprint `team.dboot.read.main` (schemaVersion 4) |
| Leader turn | `session/prompt` 200, delegate `status:"executed"`, `admissionCode:"ADMISSION_OPEN"`, `member-activated` |
| Member instance / child session | `inst-0pe2z220bhfb` / `session-team-child-958e43cfa98d7ec99ae2b757f53d2c7a` |
| Member model requests | 3 (`counters.memberModelRequests`) |
| centre admissions / executions | 2 / 2 (`allow` + `LANE_DENY`, each with an execution fact) |
| guard-consult facts (`a5sfEvidencePath`) | **0** — the sink file does not exist (`guard-facts.json` = `[]`) |
| secret bytes in transcript | 0 (`SECRET_TEXT` absent) |

### The five judges, exact results

| judge | verdict | evidence |
| --- | --- | --- |
| `d:member-read-admitted` | **PASS** | native `read(file_path=<workspace>/in-lane.txt)`, `isError=false`, result carries `1: DBOOT_IN_LANE_BYTES` in the native `<path>/<type>/<content>` envelope. **This judge does not witness WHICH provider served the bytes** — see `d:guard-facts`. |
| `d:member-read-denied` | **REFUTED** | one failing clause `typed-denial`: the tool result is `Error: LANE_DENY: fs.read "…/out-of-lane/secret-out-of-lane.txt" is outside the binding's fs.read lane (policy generation a5sf1:791dfda962caa7ed43197b1b55a2ad90)`. The refusal is typed, is a policy denial (not ENOENT) and leaks no secret bytes, but the code is **`LANE_DENY`** (the centre's admission refusal, recorded in the ledger) — **not `IO_READ_DENIED`**, which this judge requires. |
| `d:native-read-surface` | **REFUTED** | one failing clause `native-description`: it requires the schema's top-level `description` to contain `resolved by the filesystem backend`, but the pinned host's native `read` top-level description is `Read a UTF-8 text file and return line-numbered content.` and that phrase is the **`file_path` parameter** description (`tests/deepseek-harness-test-use/packages/fs/tool-fs/src/read.ts:79-81`). The other four clauses pass: `read` present once, `properties=file_path,limit,offset`, `a5sfNativeToolModules=[]`, `tool-fs` is the shipped row. **Instrument defect (wrong field), not a product deviation; left unmodified.** |
| `d:guard-facts` | **REFUTED** | `allow-facts-present`: 0 allow facts for the in-lane locator; `allow-identity`: no member identity. **Zero `a5sf-guard-consult/1` facts for the admitted read.** |
| `d:centre-facts` | **PASS** | durable per-member ledger `<centreStatePath>/inst-0pe2z220bhfb.facts.jsonl`: 2 `invocation-authority` facts on `fs.read` (`allow` for the in-lane locator; `deny` with `refusalCode:"LANE_DENY"` for the out-of-lane one), member identity in both, 2 execution facts, ledger read fresh from disk. |

### Why `d:guard-facts` refutes the central proposition (not a driver artifact)

The member row carries `a5sfNativeToolModules: []`, i.e. the product's default composition: the preset's
`tool-fs` row stays mounted at the **preset's standing scope**, which is an ancestor of the member scope and
therefore resolves that scope's **base** `fs`. The confined `fs` is mounted by the realm inside the member's
isolated scope; the only product mechanism that moves the model-visible native `read` onto it is re-mounting
the native module *inside* the member scope (`packages/runtime/team-services/src/mount.ts:70-96`, the
"route C" native-tool mount; `a5sfNativeToolModules` is that mount's input). This row declares none, so the
admitted read's body is served by the base Provider — the product's own source states the mechanism plainly
("the definition a preset registers therefore resolves the preset scope's `fs` (the base Provider)").

What still holds is the **call** layer: the centre decides `allow`/`deny` from the compiled `fs.read` lane
BEFORE the body, so the out-of-lane read is refused without the base Provider being asked (the denied result
is the centre's `LANE_DENY`, and `out-lane-never-reached-provider` passes vacuously with zero facts).

So the D proposition "in-lane bytes arrive through the Member's CONTROLLED Provider" is **not proven and is
contradicted by the measurement**: no guard consultation occurred. The judge set also contains the tension
in one place — `no-shadow-modules` demands `a5sfNativeToolModules: []`, while the only current product route
to the confined Provider for a native tool is that same re-mount.

### LIMIT retained (not hidden)

A centre-configured row **still cannot create a team at runtime**: `POST /team-remote/team.create` remains a
405 by design. The Team measured here is **boot-created**; this round proves the boot entrance reaches a
Member, not that runtime creation works on such a row. Escalation shapes 1 (a centre-governed creation
command, contract change) and 2 (a non-remote creation entrance, product feature) remain open.

### Gates (all run at this tree, all green)

```
node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1
  → DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0
    tests 163 / pass 161 / fail 0 / skipped 2 / set=sha256:edd4f1c494a7…
node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7
  → tests=889 DISCOVERED_AND_COLLECTED 834 EXCLUDED_WITH_REASON 14 UNCOLLECTED 41 refused=0 findings=0
node scripts/ute-cut-closure.mjs --check
  → pass deleted=148 references=163 prodRefs=0 distResiduals=0 dupNames=0 findings=0
node scripts/ute-p0-assets.mjs --check
  → pass modules=37 files=180 lines=69512 cut=cut(148/148) findings=0
node scripts/docs-sync.mjs --check
  → docs=193 plans=152 pairs compared=20 findings=0 blocking=0 (authority pointer as20261109r1 verified)
node scripts/place-dist-glue.mjs
  → done (28 placement(s)), all byte-identical
node scripts/eb3-ci-required.mjs
  → pass workflows=10 findings=0
node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000
  → EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 passed=238 failed=0
```

### Discipline

`:3080` untouched (`curl → 401`); host tree porcelain empty before and after; both DSH_HOMEs inside
`tests/homes/` and deleted by teardown; ports 3187/3497 released per boot; dev-live slots
`released=true held=false`; no product change, no upstream patch, no fixture or judge change; the two
`run-ledger.jsonl` starts bind `head f9c7f4f72…` and `grantId devlive-fs-search-1`.

### What this round does NOT prove

1. Provider-level confinement of the native `read` — refuted above (zero guard facts).
2. `IO_READ_DENIED` on the admission path — the product emits `LANE_DENY` here.
3. Runtime team creation on a centre row — still 405, still the escalation.
4. That the native-read surface judge measures the intended field — its failing clause reads the top-level
   description, not the `file_path` parameter description.
5. Candidate/product-proven status: every record is `DEV-LIVE`; no `CAPABILITY-MATRIX-C.md` row is upgraded.

## 13. Round 61 update (2026-11-22) — shape A: the native read is served by the Member's CONTROLLED provider (guard consulted)

HEAD at run start `e739ddbbb774d4b921ec0264a08881419df88b49` + the round-61 working-tree changes below;
host pin `639ed015397290b3745d163aafe02ffee4aa3f84` (porcelain empty before and after), branch
`vnext/a1-cut`, record class `DEV-LIVE` (never candidate evidence). **Verdict: IMPROVED — 3/5 judges PASS,
and the judge that falsifies the finding (`d:guard-facts`) is now PROVEN.** The driver is UNMODIFIED this
round; the only changes are product code and the tests below.

### What changed (product code)

| file | change |
| --- | --- |
| `packages/runtime/src/plugin/vnext/realm-lane.mjs` | new `mountGovernedNativeToolModules`: derive the candidate host modules from the preset's own rows, forward each row's own `config`, observe ownership, skip faces the realm does not own, refuse typed when a module cannot be mounted, mount through `mountHostModules` (host body, definition identity) |
| `packages/runtime/src/plugin/vnext/agent-bindings.mjs` | wire the default mount for a governed member (`compiledAnswerOfRealm !== undefined`) after `applyBuiltInToolDeny`, unless the row configures `a5sfNativeToolModules`; derive rows/configs from `compositionInventory()` + `readDocument()` |
| `packages/runtime/src/plugin/host.ts` | the lazy `agentPresets` accessor exposes `compositionInventory()` and `readDocument()` (public seam, same as the persona observer) |
| `packages/runtime/test/vnext-admission.test.mjs` | `ADM-100` (governed default mount + guard consult + provider denial), `ADM-101` (ungoverned row unchanged), `ADM-102` (unresolvable module → typed fail-closed) |

No `a5sfNativeToolModules` entry was added to any fixture, no shadow definition was created, and no
upstream file was touched.

### The two boots (identical; `agreeing=true`, `differing=[]`)

| fact | boot1 | boot2 |
| --- | --- | --- |
| overall | FAIL (2 judges refute) | FAIL |
| `d:member-read-admitted` | PROVEN | PROVEN |
| `d:guard-facts` | PROVEN | PROVEN |
| `d:centre-facts` | PROVEN | PROVEN |
| `d:member-read-denied` | REFUTED | REFUTED |
| `d:native-read-surface` | REFUTED | REFUTED |
| allowFacts / denyFacts | 2 / 0 | 2 / 0 |
| centreAdmissions / centreExecutions | 2 / 2 | 2 / 2 |
| admittedBytes / deniedSecretAbsent | true / false | true / false |

`d:guard-facts` detail: `allow-facts-present 2 (methods: stat, readText)`, `allow-identity
["inst-0pe2z220bhfb"]`, `allow-decidedBy ["ALLOW"]`, `out-lane-never-reached-provider 0` — i.e. the
confined provider's guard was entered for the admitted read and never entered for the refused one (the
centre's `LANE_DENY` precedes the tool body).

`d:member-read-denied` still fails its `typed-denial` clause: the result text is `Error: LANE_DENY: fs.read
"…/out-of-lane/secret-out-of-lane.txt" is outside the binding's fs.read lane`, not `IO_READ_DENIED`;
`zero-secret-bytes` and `not-enoent` pass. `d:native-read-surface` still fails only `native-description`
(`description=Read a UTF-8 text file and return line-numbered content.`), while
`no-shadow-modules` and `tool-fs-is-shipped-row` pass. Both are the residuals recorded in
`FINDING-native-tool-provider.md`; neither was relaxed and neither judge was skipped.

### Commands

```
node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1
node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7
node scripts/ute-cut-closure.mjs --check
node scripts/ute-p0-assets.mjs --check
node scripts/docs-sync.mjs --check
node scripts/place-dist-glue.mjs
node scripts/eb3-ci-required.mjs
node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000
env -u DBOOT_WITHOUT_CENTRE -u A5SF_WF_NO_INSTALL_GRAPH \
  node tests/world-factory/drivers/d-boot-feasibility/run-boot.mjs --boots 2
```

The driver still exits `1` (two refuting judges). What this round does NOT prove: the refused live call
reaching the provider (`IO_READ_DENIED`); the `native-description` clause's intended field; runtime team
creation (still 405); any candidate/product-proven status (all `DEV-LIVE`); a realm face the composition
does not own (skipped, recorded in the lane's result).

## 14. Round 62 update (2026-11-22) — D2 live driver: concurrency and Stop PROVEN, revocation REFUTED; the round-61 surface clause re-anchored and PROVEN

HEAD at run start `b583de6315cae08f34e09e43c1aa281cd771e6f5`; host pin
`639ed015397290b3745d163aafe02ffee4aa3f84` (porcelain empty before and after every boot); branch
`vnext/a1-cut`; record class `DEV-LIVE` (never candidate evidence). Evidence:
`dev/agent-workflow/evidence/d-boot-feasibility/d2/` (new driver + its own runs; round-61 artefacts are
untouched) and `dev/agent-workflow/evidence/d-boot-feasibility/round62-native-read-surface/` (the
round-62 re-run of the round-61 driver, kept out of the round-61 `runs/`).

### The new driver and its two boots

`tests/world-factory/drivers/d-boot-feasibility/run-boot-d2.mjs` is a COPY of the round-61 driver with the
probes replaced; the round-61 driver keeps its five judges and received only the `d:native-read-surface`
repair described below. The D2 team declares TWO templates (`worker-a`, `worker-b`), each with its own
`memberIoCeilings` read lane (A also declares an exact `ask` locator and `request-control` in its
envelope, which the centre's ask path requires), so "in lane for A" and "in lane for B" are different
compiled ceilings and the cross-member negative is real.

```
node tests/world-factory/drivers/d-boot-feasibility/run-boot-d2.mjs --boots 2
```

Two boots, identical (`agreeing=true`, `differing=[]`):

| fact | boot1 | boot2 |
| --- | --- | --- |
| overall | FAIL (1 judge refutes) | FAIL |
| `d2:multi-member-concurrency` | **PROVEN** | **PROVEN** |
| `d2:revocation` | **REFUTED** | **REFUTED** |
| `d2:stop` | **PROVEN** | **PROVEN** |
| aAdmissions / bAdmissions | 9 / 5 | 9 / 5 |
| aGuardFacts / bGuardFacts | 14 / 8 | 14 / 8 |
| windowsOverlap / crossRefused | true / true | true / true |
| stop settlement state | REFUSED | REFUSED |
| revocation post-refused (REQUIRED) | false | false |
| B after-stop completed | true | true |

### `d2:multi-member-concurrency` — PROVEN

Two governed Members ran with overlapping provider-request windows (A `09.118–09.740Z`, B
`09.352–09.478Z`), both own-lane reads admitted, every guard `allow` fact naming its own
`memberIdentity`, separate `<instanceId>.facts.jsonl` ledgers whose admission facts carry only their own
`instanceId`/`agentId`. The negative holds: A's read of B's in-lane file is `LANE_DENY`, B's bytes never
reach A, and no guard fact exists for B's locator under A's identity (refusal precedes the Provider).
The 7 in-lane reads in A's first turn are real reads; a one-read turn finished before B was admitted
(measured), so the window needed a real work unit rather than a sleep.

### `d2:revocation` — REFUTED (the REQUIRED direction), opposite direction measured live

Through the ONE durable `permissionOverlay` lane: pre-read admitted → `team_grant_permission` of an exact
`read` **deny** (`changed:true`) → same read refused `ADMISSION_OVERLAY_DENY` → `team_revoke_permission`
(`changed:true`) → same read **admitted again**, and the untouched in-lane read still succeeds. The
REQUIRED direction ("revoke refuses the previously-succeeded call with a NEW policy generation") cannot
hold at this HEAD:

- `overlay-decision.mjs:9` — the overlay can REMOVE authority, never grant it;
- `admission-port.mjs:498-521` — consulted only when the compiled lane allows; its only verdict is
  `ADMISSION_OVERLAY_DENY`;
- `centre-install.mjs:94` — the fact's `policyGeneration` is the COMPILED revision fixed at bind; all
  pre/mid/post facts carried the same `a5sf1:<hash>` across both boots;
- `permission-mutation.ts:435-436` — removing a standing rule "never needs expansion authority".

**Two lawful shapes**: (A) let `overlayDecision` return `allow` too, so a durable ALLOW stands in for a
lane deny and its revoke restores the deny; (B) derive the compiled lane + centre binding from the
overlay snapshot and re-bind on generation change, so a revoked ALLOW recompiles to deny and the fact
carries the new generation. Neither is wiring-only, so the judge is REFUTED, never skipped and never
reported as a pass.

### `d2:stop` — PROVEN

A's follow-up read on the authored exact `ask` locator parked at a durable Control request
(`actionName=admission-ask`, `status=pending`, target = A's instance). `POST /api/session/cancel` for A's
child session (the public RPC the Team view's member-stop button issues) returned 200. A's tool result is
`Error: ADMISSION_STOPPED: the execution "call-d2-a-ask" was aborted before its body…`; A's centre fact is
`refusalCode=ADMISSION_STOPPED`; the settlement is `REFUSED`/`dispatch=not-started`/`bodyOutcome=not-started`
with no execution fact; never a completion and never `UNKNOWN`. Member B completed its after-stop read
(`COMPLETED`, zero stops). The Stop leg is a timing race by nature, but it reproduced in BOTH boots, so
no single-boot concession was used.

### Round-61 instrument repair — `d:native-read-surface` re-anchored, now PROVEN

Round 61 asserted the `file_path` PARAMETER phrase (`resolved by the filesystem backend`) against the
`read` TOOL description, so it could only pass if the host text changed. The clause is now split and each
part names its field, per the pinned host
(`tests/deepseek-harness-test-use/packages/fs/tool-fs/src/read.ts:79-81`):

- `native-description` (top-level): exactly `Read a UTF-8 text file and return line-numbered content.`
- `native-file-path-description` (`parameters.properties.file_path.description`): contains
  `resolved by the filesystem backend`

`read-present-once`, `native-params`, `no-shadow-modules` and `tool-fs-is-shipped-row` are unchanged. The
round-61 driver was re-run once (`run-boot.mjs --boots 1`) to validate the repair; the run is preserved in
`dev/agent-workflow/evidence/d-boot-feasibility/round62-native-read-surface/`, and the round-61 `runs/`
were restored from git so the round-61 record is not rewritten. Result: `d:native-read-surface: PASS`, all
six clauses true. The driver's other verdicts are unchanged (`d:member-read-denied` still fails its
`typed-denial` residual; overall still FAIL), and nothing was relaxed.

### Commands

```
node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1
node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7
node scripts/ute-cut-closure.mjs --check
node scripts/ute-p0-assets.mjs --check
node scripts/docs-sync.mjs --check
node scripts/place-dist-glue.mjs
node scripts/eb3-ci-required.mjs
node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000
```

### What this round does NOT prove

Any candidate/product-proven status (all `DEV-LIVE`); the REQUIRED revocation direction; a Team-UI click
(the Stop used the same public `session/cancel` RPC the button issues); runtime team creation over the
remote plane (still 405 on a centre-configured row); that a scripted model's interleaving equals a real
model's timing.

## 15. Round 63 update (2026-11-22) — D3 live driver: crash-cold-recovery, work delivery and the Alpha.6 refusal PROVEN; a persistent subprocess REFUTED (no process lane exists)

HEAD at run start `b779d9fab86be64154b8d9a2de81ea1a8c2baa4e`; host pin
`639ed015397290b3745d163aafe02ffee4aa3f84` (porcelain empty before and after every boot); branch
`vnext/a1-cut`; record class `DEV-LIVE` (never candidate evidence). Evidence:
`dev/agent-workflow/evidence/d-boot-feasibility/d3/` (new driver + its own two boots; the round-61/62
artefacts are untouched).

### The new driver and its two boots

`tests/world-factory/drivers/d-boot-feasibility/run-boot-d3.mjs` is a COPY of the D2 skeleton with four new
judges; the D2/round-61 drivers keep their judges and were not modified. The team declares TWO governed
members with disjoint `memberIoCeilings` (A also owns the persistent-shell probe, B the in-flight call),
and the crash leg SIGKILLs the real host pid and restarts on the SAME `DSH_HOME` and port lease.

```
node tests/world-factory/drivers/d-boot-feasibility/run-boot-d3.mjs --boots 2
```

Two boots, identical (`agreeing=true`, `differing=[]`):

| fact | boot1 | boot2 |
| --- | --- | --- |
| overall | FAIL (1 of 4 judges refutes) | FAIL |
| `d3:persistent-subprocess` | **REFUTED** | **REFUTED** |
| `d3:crash-cold-recovery` | **PROVEN** | **PROVEN** |
| `d3:work-delivery` | **PROVEN** | **PROVEN** |
| `d3:alpha6` | **PROVEN** | **PROVEN** |
| aAdmissions / bAdmissions | 4 / 3 | 4 / 3 |
| in-flight at SIGKILL / after recovery | RUNNING / UNKNOWN | RUNNING / UNKNOWN |
| collect status | succeeded | succeeded |
| bash turn-1 / turn-2 settlement | REFUSED / REFUSED | REFUSED / REFUSED |

**All four judges ran in BOTH boots — none is single-boot by nature.** The Alpha.6 arm boots its own
separate World inside the same budgeted lease thunk, but its proposition is a CONFIG EVALUATION, so its two
runs are two independent evaluations of the same row (identical in both boots). `overall=FAIL` is the
honest aggregate: the runner maps a REFUTED judge to case FAIL by design, so a completed evidence
collection still exits non-zero when any proposition is refuted (`RESULT evidence-complete=true
allProven=false`).

### `d3:persistent-subprocess` — REFUTED (the required direction is absent)

A governed Member's model-visible surface DOES carry `bash`, and the Member calls it in TWO different turns
of the SAME Member session. Both calls are refused at the ONE admission point with
`ADMISSION_AXIS_UNSUPPORTED: tool "bash" needs a subprocess lane, which this binding does not compile`.
Facts on disk (fresh readers): `axis=process.exec`, `decision=deny`,
`refusalCode=ADMISSION_AXIS_UNSUPPORTED`, one per turn; settlements `ADMITTED → REFUSED` (a terminal
refusal at birth — never `RUNNING`, no body). The probe's state file is never written, and the second
turn's tool result carries the same typed refusal. The shipped governed preset mounts exactly one shell
row, `tool-bash` (ONE-SHOT confined terminal), never `dsh-tool-bash-persistent`; the host tree ships
`packages/shell/tool-bash-persistent/package.json` but the profile does not mount it (`--plan`:
`present=true mounted=false`).

**What the process lane would need** — unchanged from the CCR: there is no declaration source for it, and
the v4 member ceiling is a CLOSED io shape (`packages/domain/blueprint/src/blueprint-v4.ts:187-197`). The
driver feeds `io.process` to the shipped parser live:

```
MALFORMED_DTO  $.memberIoCeilings[0].io.process  unknown-field
"field 'process' is outside the closed io shape (read | write | network)"
```

Two lawful shapes: (A) add `process` to the v4 ceiling family (contract change) so the centre compiles a
subprocess lane and the preset can mount the persistent shell behind it; (B) a v5 schema that declares the
lane. (C, a ruling that subprocess/PTY/PTC stay unsupported, keeps the typed refusal as the shipped
behaviour.) No driver can pass this judge by faking a shell.

### `d3:crash-cold-recovery` — PROVEN

Leader discovery → `team_delegate` A → A's turn (admitted `read`, refused `bash`, unit delivered) →
`team_collect` A → `team_follow_up` A (second `bash` turn) → `team_delegate` B → B's turn (admitted
`read`, a `grep` probe — see the extra finding — then an ADMITTED `edit` of a 256 MiB in-lane file whose
unique needle is its last line, so the body stays open for a measurable window) → the driver polls the
settlement FILE every 10 ms and **SIGKILLs the real host pid** → cold restart on the SAME home and lease
with row `bootPhase: create-or-open`.

Measured with fresh disk readers on both sides of the kill, in BOTH boots: `pid=89`,
`signal=SIGKILL`, `exit={code:null,signal:"SIGKILL"}`, pid gone, port free; in-flight settlement
`RUNNING` at the kill and `UNKNOWN` after recovery (`ADMITTED,UNKNOWN`), with NO execution fact and
exactly ONE admission fact (never replayed); A's completed `read` fact is byte-identical before/after and
its settlement stays `COMPLETED`; a NEW call after recovery (`call-d3-a-after-recovery`) is admitted on
`fs.read` with a NEW fact and reaches `COMPLETED`; the restart home equals the pre-crash home. The
`UNKNOWN` transition is the product's own `recoverUnsettled` at member bind
(`packages/runtime/settlement/execution-settlement.ts:1846`;
`packages/runtime/src/plugin/vnext/member-execution.mjs:171`) — the driver only reads the file.

### `d3:work-delivery` — PROVEN

`team_delegate` returns `status=executed`, `effect.kind=member-activated` with a real `instanceId` and
`childSessionId`; the delegated prompt arrives VERBATIM as the Member's first user message and the Member's
turn-1 final text is exactly `DBOOT_D3_DELIVERED_UNIT_ALPHA`; `team_collect` returns a terminal
`succeeded` entry (`admittedSequence=2`, `settledSequence=5`, `memberResult.body` the exact unit) and the
SAME entry is returned when collected again AFTER the cold restart; the unit is on disk in the team domain
store; every admission fact for the Member's calls names ITS `instanceId`/`childSessionId` and no member
call fact appears in any other centre ledger (the only other file is the Leader-side REMOTE-PLANE
host-surface refusal, a different subject).

### `d3:alpha6` — PROVEN (the typed-refusal shape)

The arm boots a separate World whose row sets `alpha6ReviewRouting: true`. MEASURED: the host PROCESS
boots, and the ROW is refused inside the plugin bootstrap with
`ADMISSION_ALPHA6_UNAVAILABLE … no review-routing axis exists` (full text in the host log), and NOTHING is
live — `/__p6t6/state` answers 404 (no team root), `teamSession present=false`, `liveMembers=0`, no
Alpha.6 decision, no wake-intent file, no fact file. The refusal is a product rule, not a driver string:
`centreConfigViolation` at row validation (`packages/runtime/src/plugin/vnext/centre-config.ts:62-70`,
`host.ts:723`) over the closed table (`host-surface-refusal.mjs:50`).

**The recorded-fact half is UNREACHABLE at this entry**, and the driver reports that instead of faking it:
the config gate runs BEFORE root construction, so `createHostSurfaceRefusalPoint` is never built. The
in-process ADM-85/ADM-98/ADM-99 shapes stand; a host-boot path that also writes the fact would need the
gate moved below root construction (a product change).

### EXTRA measured finding (not a judge): a governed Member's `grep` is REFUSED by the durable overlay

B's in-lane `grep` (search root inside B's own lane) is denied although the LANE allows it:
`laneDecision=allow`, `refusalCode=ADMISSION_OVERLAY_FAULT`, `reason="the durable overlay could not be
consulted (canonicalization failed for tool \"grep\": tool-unsupported)"`. The closed permission
vocabulary is `read/read_image/write/edit` + `bash/pwsh`
(`packages/runtime/operation-permission/types.ts:59-64`, `:90-93`) and
`classifyPermissionTool` (`canonical-operation.ts:260-267`) returns `unsupported` for everything else, so
the overlay cannot canonicalize a search tool and the adapter maps that fault to a deny. That is why the
crash judge's in-flight call is an `edit`: an in-flight record must be a call the product actually admits.
Two lawful shapes: (A) add the search face (`grep`, `glob`) to the closed vocabulary with a subtree
resource; or (B) rule that the overlay judges only the six canonicalizable tools and the lane alone judges
the search face (then "unsupported" must not become a fault for a lane-allowed call).

### Commands

```
node tests/world-factory/drivers/d-boot-feasibility/run-boot-d3.mjs --boots 2
node tests/world-factory/drivers/d-boot-feasibility/run-boot-d3.mjs --plan
node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1
node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7
node scripts/ute-cut-closure.mjs --check
node scripts/ute-p0-assets.mjs --check
node scripts/docs-sync.mjs --check
node scripts/place-dist-glue.mjs
node scripts/eb3-ci-required.mjs
node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000
```

### What this round does NOT prove

Any candidate/product-proven status (all `DEV-LIVE`). A persistent subprocess session (refused) or a
process-lane declaration (no declaration source in v4; CCR unchanged). The Alpha.6 recorded-fact/wake path
at a host entry (unreachable before root construction; in-process only). A search-capable governed Member
(`grep`/`glob` refused by the overlay). A real-model interleaving (the model is the product's scripted mock
provider). The 256 MiB `edit` is a timing aid, not a claim about long-running tools: the settlement is
open at the kill in both boots, but the driver kills as soon as it observes the open state.
