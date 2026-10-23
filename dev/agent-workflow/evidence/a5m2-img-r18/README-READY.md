# A5M2 r18 — READY bundle for the ONE bounded real-Host IMAGE re-verification of the r17 lexical-seam fix

Authoring lane: `.worktrees/a5m2-imgverify` (branch `feat/a5m2-imgverify`), **kit + pin AUTHOR ONLY — this lane executed ZERO Host-side work**: no world acquisition, no port bind for serving, no boot, no launcher, no run phase. Sole executor: the 307c lane (root order), running **from this worktree** with **this kit** and **this pin dir**.

## 1. Pin identity (root 17:30 FINAL, independently re-measured here)

| field | value |
| --- | --- |
| source-HEAD | `2188f15ce953977c681dedeb079a36ca27ddbbd7` (int tip 2026-10-23T17:30:05Z; ancestors verified: `33717098339b816d3be02a812dc18bb22866f35b` the r17 fix, `d5454cb23…`, `126b12cc…`, `249eb65ec…` the r17 surface) |
| package | `packages-pins/2188f15ce953977c681dedeb079a36ca27ddbbd7/dsh-agent-team-0.1.1-alpha.2.tgz` |
| tgz sha256 | `5a9aa54c372f55e68855198e4b1a9930a399ed52ad670a732a4edd4964613360` · 3 648 470 B · 1813 FILE records · 0 dir records |
| install-surface manifest | `manifest-installsurface-hashes.txt` sha256 `66cd31e8b9ff80bcc1f15b8c8bf70a0836bb0e235f1b03cac2807576f27e91c8` (473 js/mjs/json lines) |
| full per-file manifest | `manifest-tgz-dist-hashes.txt` sha256 `cc8d02643237129975d02f9ab17fe30b15749831a8d4fdb04fb4f0a6ced6ebcb` |
| entries manifest | `manifest-tgz-entries-C.txt` sha256 `5263586e8eee5ea645d3764dd90917c5ec5d500d9ee27649412b7c5f81704569` — **byte-identical to the r17 pin's** (path-set unchanged) |
| helper row | `plugin.mjs` sha256 `471475b96e70f05a178f6006cf7b256765533313092b7c4689553c7c8d0ee784` — cmp-identical to `git show 2188f15ce…:packages/tools/harness/plugin.mjs` and to the `34c6680d…` helper pin |
| install dir in the world | `install-2188f15ce` |

Measured in this lane (no build, read-only; see `pin-audit/`):
* **PACKAGE == COMMITTED TREE**: 1813 blobs compared → `drift = 1` = `package.json` only, which is pnpm pack normalization (`packageManager` key dropped, every other parsed-JSON key equal).
* **glue audit**: 16/16 PLACEMENTS, committed-dist-vs-committed-src drift **0**, package-dist-vs-committed-src drift **0**.
* **the fix is on the mounted face**: `grep -c fsSeam` inside the extracted package → dist `live/agent-bindings.mjs` = 2, dist `live/pa-mount-registry.mjs` = 1 (src 2 / 1); the bridge leg (`operation-permission/pa-control-bridge.js`) is compiled in from the same fix commit.
* **the TS-mirror defect is closed on the face**: src `control/types.ts` `trustedSessionHeaderId` ×4 → package dist `control/types.js` ×4, `B-CONTROL` ×3 (the same file at `d5454cb23` had 0 / 0 — that was center's `check:artifacts:head` RC=1 drift=6, corroborated here read-only in `pin-audit/DRIFT-6-CORROBORATION.txt`).
* center's build-freshness half (this lane cannot build): `check:artifacts:head` at this SHA = RC 0, `DSH-ARTIFACT-VERDICT script=check-artifacts-at-head subject=commit rev=HEAD verdict=ok compared=1788 drift=0`.

Superseded candidates stay in the tree, unfalsified: `packages-pins/126b12cc…/STATUS-HISTORICAL.txt`, `packages-pins/d5454cb23…/STATUS-PROVISIONAL.txt` (+ `MANIFEST-126b12cc.txt`, `MANIFEST-d5454cb23.txt`). The kit has a **holdout gate**: a pin dir carrying `STATUS-PROVISIONAL.txt` cannot be mounted — that is what stopped this lane from running against `d5454cb23`.

## 2. Scope law (root/center, written into the kit's identity line)

Image mode verifies the **already-reviewed r17 image scope only**. The 957 INSPECT/CONTROL rules and the B-MCP gap exist as **unwired candidates** on this surface (no registration reaches the runtime) — NOT enabled by this package. The window is the FULL r17 positive+negative control window; the earlier "one positive + one negative" reduction is void (C5 kept).

Mount delta vs r17 (9 paths, see `MANIFEST-2188f15ce.txt` §C): pack normalization + the r17 seam fix (3 dist files) + the compiled B-CONTROL/B-INSPECT leaf-flatten table (3 dist files). The second functional delta is **discriminated by C1**, which asserts the B-IMAGE row field-by-field before anything downstream is interpreted.

## 3. What the executor runs (this lane never runs it)

```bash
cd /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5m2-imgverify

# 3a. read-only bundle validation. Writes ONLY its own run.log + validate-only.json in a NEW
# evidence run dir; NO world, NO install surface, NO mount, NO port bound, NO Host/mock started.
node tests/kits/a5m2-todo-c2/a5m2-todo-c2.mjs \
  --world a5m2-img-r18-<UTC-stamp> --fixture image --validate-only      # expect RC 0

# 3b. executor-side world layout (the kit VERIFIES, never CREATES, these two):
#     tests/homes/<world>/<install-dir>/package   <- extract the pin tgz, chmod -R a-w
#     tests/homes/<world>/mount-helper-root/package <- full package copy + plugin.mjs at
#        packages/tools/harness/plugin.mjs (bytes = 471475b9…), packages/runtime -> real dist,
#        so the helper's relative leg ../../runtime/dist/packages/runtime/mutation/index.js resolves
mkdir -p /srv/workspace/dsh-plugins/dsh-agent-team/tests/homes/a5m2-img-r18-<UTC-stamp>

# 3c. THE one bounded round
node tests/kits/a5m2-todo-c2/a5m2-todo-c2.mjs \
  --world a5m2-img-r18-$(date -u +%Y-%m-%dT%H-%M-%S) --fixture image
# exit 0 = all criteria pass · 2 = a criterion failed (stopped at that criterion) · 1 = fatal
# CANONICAL COMMAND ONLY (root 17:42): --fixture image is MANDATORY (the flag defaults to `todo`);
# no other flag is passed — homes root is fixed, the run stamp defaults to UTC, and the evidence
# directory defaults to this worktree's dev/agent-workflow/evidence/a5m2-img-r18/run-<stamp>/.
```

Defaults the canonical command relies on: homes root = the ONE verified superproject root `/srv/workspace/dsh-plugins/dsh-agent-team/tests/homes` (OVERLAY-11b — **the `--homes-root` override was DELETED** at root's 17:42 ruling: an arbitrary `resolve()` there would have widened the guard's root set; `tests/kits/lib/world-safety.mjs` stays byte-identical); run stamp = `${RUN_TAG}-<UTC>` with the suffix restricted to ONE safe basename and the resolved run dir asserted strictly inside the evidence dir (OVERLAY-14 — closes a `../../` escape that pointed the teardown `scrubDir()` recursive read-write pass at foreign files); worktree = `../a5-m2-int` (`tests/paths.mjs` Host-baseline pin `639ed015…`; verified `HEAD==baseline`, porcelain 0, `bin.js` present); testuse = `<worktree>/tests/deepseek-harness-test-use`; evidence dir = this worktree's `dev/agent-workflow/evidence/a5m2-img-r18` (pre-existing r17 flag, untouched). Legacy note: `--worktree ../a5-m2-int` (supplies `tests/paths.mjs` Host-baseline pin `639ed015…` + the harness scripts; verified `HEAD==baseline`, porcelain 0, `bin.js` present), `--testuse <worktree>/tests/deepseek-harness-test-use`, `--homes-root` = superproject `tests/homes` (the guard refuses any world under a `.worktrees` segment — see patch OVERLAY-11), `--evidence-dir dev/agent-workflow/evidence/a5m2-img-r18` (inside this worktree).

**Cleanup law (root 17:4x re-stated)**: the kit performs NO recursive cleanup anywhere — no `rm`/`rmSync`/`rmdirSync`/`unlinkSync`/`renameSync`, no `prune`, no `df`, no shell delete. Every filesystem mutation is `mkdir -p`, a file write, `chmod a-w`, or an extract-if-missing tar of the pinned tgz into `tests/homes/<world>/install-2188f15ce/package`; teardown kills only the two processes it started, and the single rewrite of existing files is `scrubDir(RUN_DIR)` (token scrub of the evidence files the kit itself wrote). The world must be pre-created by its one owner and is retained.

**World naming law**: basename must start with `a5m2-img-r18-` or the kit exits 1 before touching disk.

**Probe holds**: every bind-probe socket this run opens is closed on EVERY exit path (OVERLAY-15) — `dieFatal`, `main`'s `finally`, and the entry catch (which used to set only `exitCode`, leaving held listeners in a lingering process). The Host hold is released inside `bootHost` immediately before `instance.start()` for the port that boot owns (OVERLAY-13 — previously only the mock hold was released, so the Host would have collided with its own held listener on 3182). Proven with an ephemeral-port test copy (39182/39183, never a lane port): forced init exception → exit 1, `ss -ltn` shows 0 listeners, `port-probe.json` stamps `held=false, released="closed on exit path (dieFatal)"`; the entry-catch variant also left 0 listeners. The same test copy caught two missing imports in my own new code (`basename`, `realpathSync`) that crashed module load — a class `node --check` cannot see.

**Ports (root 17:42 correction, OVERLAY-6b)**: the image lane's OWN historical pair — host `3182`, mock `3497` — is reused, and only after a real free + **no-in-flight** check (any TCP socket in any state on the port refuses the candidate; recorded in `port-probe.json`). **Forbidden and asserted**: `3080` (stable dev), `3180/3181` (family defaults), `3183/3498` + `3184/3499` (two prior INFRA worlds, quiescence unproven), `3185` (never released), `3186/3500` (RSJ-frozen). Selection is an ACTIVE bind-probe on 127.0.0.1, the winning socket is HELD until the moment the mock/Host binds it, and every attempt (including rejected and explicitly-passed ports) lands in `<run>/port-probe.json`. Read-only inventory at 17:36Z: only `127.0.0.1:3080` listens in the family; `3183-3185` and `3498` free.

## 4. Root laws, and where each is enforced in code

| law | enforcement |
| --- | --- |
| one round, no auto next round | `main()` is single-pass; no loop, no re-entry; exit codes above |
| stop at first SUBSTANTIVE failure — stated precisely | each `check()` RECORDS; `finishCriterion('<id>')` is what throws `FirstFailureStop`, so the run stops at the END of the failing criterion's own checks — it never silently advances to the NEXT criterion and never blind-waits after a side-effecting dead fact. OVERLAY-8a stops inside C3 right after the ONE-consumption fact (writes `c3-first-failure-stop.json`) and 8b after a zero-store gain, both BEFORE the remaining waits. The earlier terminal deny/consume/store-0 short-circuits are kept. |`finishCriterion()` throws `FirstFailureStop`; OVERLAY-8a stops right after the ONE-consumption fact and writes `c3-first-failure-stop.json`; OVERLAY-8b stops after a zero-store gain and skips the 180 s envelope wait; the 90 s consumption wait is the only wait on that path |
| no 90+300 chained waits | the terminal-decision guard (root 15:27) plus 8a/8b: no wait is chained behind an already-false fact; image mode never polls todo rows (8b removed a guaranteed 120 s stall) |
| image mode NEVER emits todo | OVERLAY-9 `assertNoTodoInImageMode()` at the C1/C2/C3/C4/C5 boundaries: zero `plane-todo` lane facts in the durable ledger, zero `todo/write` entries in the member session storage, zero `todo_write` tool calls on the model wire; each boundary writes `zero-todo-law-<phase>.json` |
| no reuse of prior ctrl requestIds | ids are read live from the ledger rows (`row1/2/3.payload.requestId`); no `ctrl-…` literal exists in the kit |
| world + install surface retained | no `rm`/`rmSync`/`unlink`/`prune`/`df` anywhere in the kit; teardown is process-kill only; summary carries `worldRetained: true` |
| pristine Host | H1: `git -C <testuse> rev-parse HEAD == 639ed01539…` + porcelain EMPTY before AND after; the fixture PNG goes to `examples/*/.sessions/` (gitignored, Host `.gitignore` untouched) |
| :3080 untouched | in `FORBIDDEN_PORTS` (asserted), plus `ss -ltn` snapshots before launch and at teardown |
| CORE PATCH BUDGET = 0 | mount is profile-patch rows only; nothing mounts from `.worktrees/` |

## 5. Deliverables in this tree

* `tests/kits/a5m2-todo-c2/a5m2-todo-c2.mjs` — sha256 `80814253a01ce955543609f1dec6b39baa15ee74ab0c56d741c9d4b58d50d8d5` (OVERLAY-6b/11b/13/14/15: ports, fixed homes root, host-hold release, run-stamp containment, uniform hold close) (base `aa242e37451d2e58944ff26af7a1069fbb1786392dfc80ad114a84f9b1069fd2`; diff = 319 insertions / 35 deletions, every patch named — `KIT-OVERLAY-DIFF.md`)
* `packages-pins/2188f15ce…/` — tgz + plugin.mjs + three manifests + `MANIFEST-2188f15ce.txt` + `artifact0-readonly-2188f15ce.txt`
* `dev/agent-workflow/evidence/a5m2-img-r18/` — this README, `KIT-OVERLAY-DIFF.md`, `LEGS-INVENTORY.md`, `run-2026-10-23T17-36-29/` (the read-only validate-only receipt), `pin-audit/` (the four read-only scripts + drift corroboration + the validate-only receipt)
* Lineage note: the kit base is the **full successor** `aa242e37…` of the lost uncommitted `5b039e9b…` asset (incident asset, unrecoverable locally — recorded in `dev/agent-workflow/evidence/a5-world-safety/README.md`); this is minimal reuse/reconstruction, **not** a recovery.
