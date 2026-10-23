# Kit overlay vs the base kit `aa242e37451d2e58944ff26af7a1069fbb1786392dfc80ad114a84f9b1069fd2`

Base = the hardened r17 kit in this branch (full successor of the lost uncommitted `5b039e9b…` incident asset). Result: `8b631deff969627190c9699ba482ede1e579374d4293bf5eb9e165e119717b49`, 1925 → 2205 lines, `git diff --stat` = **319 insertions / 35 deletions**. No criterion was added, renamed away, or removed; no leg logic was rewritten; the deny-list, blueprint, profile-patch rows, oracle, and evidence artifacts are byte-untouched except where a stale identity string would have lied.

Patches are minimal and each is named in the file. `additive` = cannot make a passing run fail that would otherwise pass; `law gate` = turns a stated root law into an assertion (can only stop a run that violates the law).

| patch | what it does | class |
| --- | --- | --- |
| header r18 block + USAGE | states the r18 identity, the seven legs, the root laws, the real flags | doc |
| OVERLAY-1 pins block | `SOURCE_PIN_SHA`/`PIN_SHA` = `2188f15ce…`, `INSTALL_DIR` = `install-2188f15ce`, `EXPECT_TGZ_SHA`/`EXPECT_TREE_SHA`/`EXPECT_SURFACE_SHA` regenerated from the delivered bytes; `EXPECT_ENTRIES` 1813 and the C-digest `5263586e…` **unchanged** (path-set byte-identical to the r17 pin); pin dir + helper now resolve inside THIS branch (`REPO/packages-pins/<SHA>/`) instead of the interface worktree — labels/paths only, both hash gates kept verbatim | label |
| OVERLAY-2 port candidates | host `3183/3184/3185`, mock `3498` (drops the r11–r17 pair `3182/3497` and the frozen `3186`) | label |
| OVERLAY-3 naming + port LAW | world basename must start with `a5m2-img-r18-`; `FORBIDDEN_PORTS = [3080,3180,3181,3182,3186,3497,3500]` becomes an assertion instead of a comment (r11–r17 lanes had it as prose only) | law gate |
| OVERLAY-4 interface-tree default | `--worktree` defaults to the SIBLING `../a5-m2-int` (this kit is authored in a worktree, so the old default resolved to a non-existent nested path) | fix |
| OVERLAY-5 run tag | `RUN_TAG=a5m2-img-r18` drives run dir, session ids, realm, markers; `--run-stamp` is validated to the same prefix (no cross-round collision) | label |
| OVERLAY-6 bind-probe ports | ACTIVE bind test on 127.0.0.1 replaces the connect-guess; winning socket HELD until the mock/Host binds it; explicit `--host-port/--mock-port` are forbidden-checked + bind-probed too; every attempt recorded in `<run>/port-probe.json` (also dumped on any fatal) | law gate |
| OVERLAY-7 pin holdout | if the pin dir carries `STATUS-PROVISIONAL.txt` the run REFUSES to start, before anything is created | law gate |
| OVERLAY-8a | after the ONE-consumption check: if false, write `c3-first-failure-stop.json` and stop — the 120 s append wait and the 180 s model-visible wait are NOT run | law gate |
| OVERLAY-8b | image mode waits on the ATTACHMENT-STORE census, not on session `todo/write` rows (which cannot exist in image mode → that poll was a guaranteed 120 s stall); if the store gained nothing, the leg fails and the 180 s envelope wait is skipped | fix + law gate |
| OVERLAY-9 zero-todo law | `todoFootprint()` + `assertNoTodoInImageMode()` called at the C1/C2/C3/C4/C5 boundaries: zero `plane-todo` lane facts, zero `todo/write` session entries, zero `todo_write` wire calls; boundary receipts `zero-todo-law-<phase>.json`. r17's incident was RESIDUE surfacing as a mystery extra PA row — now it fails loudly at the leg where it appears | law gate |
| OVERLAY-10 criterion names | C1–C5 names follow `--fixture`, so an image run's summary never reads like a todo round (legs unchanged; write keeps its r16 wording) | doc |
| OVERLAY-11 homes root | the world lives in the SUPERPROJECT `tests/homes` (the entry-safety guard refuses any world under a `.worktrees` segment — this is what the guard self-check caught when the kit moved into a worktree); `--homes-root` still guard-validated | fix (blocker) |
| OVERLAY-12 `--validate-only` | read-only bundle validation (pin hashes, helper blob at the pinned SHA, Host identity, port plan) that creates nothing, binds nothing, boots nothing | additive |
| identity log rewrite | the `RUN IDENTITY` line is rebuilt from the constants and states the measured pin law, the mount delta vs r17, the scope law (957 INSPECT/CONTROL + B-MCP unwired, not enabled), and the root laws — it can no longer assert a stale hash | doc |
| patch-layer comment | the generated profile-patch header names the real pin + tgz + helper hashes | doc |
| stale comments | four `install-495`/usage strings that named superseded surfaces | doc |

## What was deliberately NOT done
* no re-derivation of kit logic; no new criterion; no deleted leg; the closed `teamTools` deny list, blueprint v3, profile-patch rows, PA row bindings, oracle and every evidence artifact are untouched;
* no product rebuild, no byte change to the delivered package (root: hash decided);
* no world, no port bind for serving, no boot, no launcher, no run phase executed by this lane;
* no writes outside `.worktrees/a5m2-imgverify` (the run-time writes listed in `README-READY.md` §3 are the executor's: the world under superproject `tests/homes/`, the gitignored fixture PNG inside the Host639 tree it boots, and the run evidence dir inside this worktree).
