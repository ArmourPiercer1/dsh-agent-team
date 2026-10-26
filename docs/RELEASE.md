# Release (EB4-C)

**State: the release line is described, not exercised. Alpha.5 release is `BLOCKED`** (whole-tool
approval not reached — see the matrix named by the current authority). This page does not cut, tag,
push or promote anything; every promotion step below is `UNRUN` and approval-gated. The facts in §1
were read from git in the `u7-3` worktree (`origin/master` = `f71159648`).

The branch policy itself is owned by [docs/BRANCHING.md](./BRANCHING.md); this page does not restate
it, it gives the verified facts and the procedure shape. Cold-start for a checkout:
[INSTALL-COLD-START.md](./INSTALL-COLD-START.md). Mounting into a DSH profile:
[docs/INSTALL.md](./INSTALL.md). When something goes wrong: [RECOVERY.md](./RECOVERY.md).

## 1. Current release facts (read, not asserted)

| Fact | Value | Command |
| --- | --- | --- |
| RC baseline tag | `0.1.0-rc.1`, annotated (`git cat-file -t` = `tag`), peels to `b0e5aeb482e27242d523b85129a899dc322d1154` | `git rev-parse '0.1.0-rc.1^{commit}'` |
| `stable` | `b0e5aeb48` = the tag peel (stable has not moved since the RC freeze) | `git rev-parse origin/stable` |
| `stable` vs `master` | `stable` is an ancestor of `master`; master carries 1418 commits not in stable | `git merge-base --is-ancestor origin/stable origin/master` · `git rev-list --count origin/stable..origin/master` |
| master version | `0.1.1-alpha.2` (all 9 packages) | `node -p "require('./package.json').version"` |
| master host pin | exact `@deepseek-ai/dsh@0.2.0-rc.2` (root `peerDependencies`) | `node -p "require('./package.json').peerDependencies"` |
| current phase / matrix | `alpha5-tool-io-governance`; matrix path from the snapshot | `node scripts/current-authority.mjs status` |

## 2. What a release candidate must carry (procedure shape)

The plan's final gate (U8) fixes ONE candidate and runs two independent acceptances on it —
engineering baseline (E5) and product (G5). Neither implies the other, and **E5 PASS never marks
Alpha.5 released**; release also needs an explicit user decision. A candidate is the tuple:

* Team SHA, Host SHA, toolchain / lockfile digest, plugin package sha256;
* Profile / config digest, trusted tool-sources digest;
* World / Oracle / Authority digests; every RUN cites the same snapshot.

Install-surface integrity for that SHA is checkable today:

```bash
pnpm check:artifacts:head        # observed: verdict=ok drift=0 (HEAD rebuilt in scratch, byte-compared)
pnpm check:install-manifest      # observed: OK check-install-manifest: graph=451 visits … lock leg: PASS
node scripts/composition-smoke.mjs   # observed: PASS composition-smoke
node scripts/verify-zero-core.mjs --host <root checkout>/tests/deepseek-harness-test-use
                                 # observed: RESULT: PASS verify-zero-core (0 findings) — C1–C3 on the pristine host
                                 # (run from the task worktree as --host ../../tests/deepseek-harness-test-use:
                                 #  a worktree has no host checkout of its own)
```

`verify-zero-core --plugin <dir>` additionally runs the C4 private-import scan on a plugin directory.
Observed here: `--plugin packages/runtime/dist` → 0 findings; `--plugin packages/client/composition-shim`
→ 2 findings, both on `{@link import('../uniqueness.js')}` **JSDoc text** carried into the bundle
(not executable imports); `--plugin .` (the whole repo, tests included) → 10 findings, all in test
files and characterization negative fixtures that deliberately reach into the host. Those are
recorded as observations; this page does not reclassify them as a PASS, and it does not declare the
shim scan clean.

## 3. Promotion procedure (UNRUN — approval-gated)

Written so nobody improvises it. **None was run here.**

| Step | Command shape | Gate before it |
| --- | --- | --- |
| Fix one candidate | record the §2 tuple in an evidence README | U7-PASS + all REQUIRED rows have C3 input |
| Engineering acceptance (E5) | independent reviewer, fixed SHA | EB-01…15 on that SHA |
| Product acceptance (G5) | formal install package, real Host, same SHA | E5 does not substitute |
| RC tag | `git tag -a <version> <sha> -m …` | user release decision recorded in `SESSION_ROUTER_LOG.md` |
| Move `stable` | normal merge/PR into `stable` from an `int/*` line that passed the RC gate | never a master alpha commit straight into `stable` ([BRANCHING.md](./BRANCHING.md)) |
| Push | `git push origin <tag>` / normal push of `stable` | explicit, logged, one-shot user authorization; `git ls-remote` verification recorded |

Forbidden, always: moving or force-pushing a tag or gated history; promoting from a branch-local C2
(merged-head C2 is required); marking a tool released because its
calls are all refused; re-colouring a `NOT_VERIFIED` / `UNKNOWN` cell to green.

## 4. Rollback and roll-forward

* **Code:** a bad merge on `master` is undone with `git revert -m 1 <merge sha>` through a PR — never
  a force-push. `stable` only moves forward via an RC fix that passed its gate.
* **Authority:** rollback of an authority switch is `git revert` of the switch commit set, never an
  edit of the pointer or a reconstruction from `dev/engineering/current-state.json`
  ([RECOVERY.md §4](./RECOVERY.md)).
* **Data:** durable TeamDomain rows are not guaranteed to downgrade. A release that changes a durable
  shape must ship a roll-forward or migration note; this page promises no unconditional downgrade.
* **User worlds:** a release never touches port 3080, `~/.dsh`, or a human DSH_HOME.
