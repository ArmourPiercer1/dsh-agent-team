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
