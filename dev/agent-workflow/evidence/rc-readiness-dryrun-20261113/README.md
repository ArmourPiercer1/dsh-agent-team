# RC readiness dry-run — `v0.1.6-rc.1` (all of a release except the release)

**Evidence class: `DEV-LIVE`.** No tag, no GitHub Release, no npm publish, no push, no Authority
move, no candidate ref touched, Required CI untouched. `CORE PATCH BUDGET = 0`: nothing under
`packages/**` was added or edited (census not applicable).

**Tree measured:** branch `task/rc-readiness-dryrun-20261113` off `origin/master`
`22682f33673139f1c411ca7a42826e0f4b7ab2e4` ("FREEZE: cand-v0.1.6-5 at a77503198", #752). The
product tree is the `cand-v0.1.6-5` product tree @ `a77503198990f921ef98cd092e7b0ecd21a90684`
(ancestor of `HEAD`; manifest `dev/engineering/candidates/cand-v0.1.6-5.json`). All measurements
were taken **on this exact tree**, in this worktree, on this machine (Linux, node/pnpm as recorded
in `run-*/gates/identity.json`).

**Docs read first:** `docs/TEST_METHODS.md` (§1–§10), `V016-RC1-GO-NO-GO.md` (incl. the
2026-11-13 append), `RELEASE-NOTES-0.1.6.md`, and the packaging-lane record the kit actually ships
with. **`tests/kits/packaging-v016/README.md` does not exist at `origin/master`** (the kit directory
contains only `run-packaging-acceptance.mjs`); the referenced procedure lives in
`dev/agent-workflow/evidence/packaging-v016-20261112/README.md`. That missing path is a
documentation defect of this task's brief, not a missing measurement.

---

## 1. Version sync

**Policy used (mechanical, not a hand list):** the kit parses `pnpm-workspace.yaml` `packages/*` and
requires every package found there to equal the root version (`VER-2`). This is the same set the
packaging lane enumerated, and it is the only release-scoped version statement in the notes:
`RELEASE-NOTES-0.1.6.md` line 3 — *"Package version: `0.1.6` (no `v`; every manifest listed in the
pull request body)"*.

| manifest | version | `private` |
| --- | --- | --- |
| root `dsh-agent-team` | `0.1.6` | `true` |
| `packages/client` (`@dsh-agent-team/client`) | `0.1.6` | `true` |
| `packages/contracts` (`@dsh-agent-team/contracts`) | `0.1.6` | `true` |
| `packages/domain` (`@dsh-agent-team/domain`) | `0.1.6` | `true` |
| `packages/legacy` (`@dsh-agent-team/legacy`) | `0.1.6` | `true` |
| `packages/remote` (`@dsh-agent-team/remote`) | `0.1.6` | `true` |
| `packages/runtime` (`@dsh-agent-team/runtime`) | `0.1.6` | `true` |
| `packages/storage` (`@dsh-agent-team/storage`) | `0.1.6` | `true` |
| `packages/testkit` (`@dsh-agent-team/testkit`) | `0.1.6` | `true` |
| `packages/tools` (`@dsh-agent-team/tools`) | `0.1.6` | `true` |

**Intentionally different: none.** 10/10 manifests are `0.1.6`; `mismatched=[]`,
`versions=["0.1.6"]` (`run-1/gates/version-census.json`, driver checks `VER-1`, `VER-2`).
Caveat carried from the packaging lane (and still true): **nothing in the product enforces this**;
the kit is the only thing that would notice drift (`packaging-v016` README §12 gap 9). The tarball
also carries `private: true` (§3) — this package is not npm-publishable by design, which matters
for the claim list in §7.

---

## 2. Pack and install — twice, from two separate packs

Each kit run performs its **own** `pnpm pack` into its own destination
(`.artifacts/tmp/packaging-v016-pack-run-<n>/`), then installs into a fresh `DSH_HOME`/profile and
runs the live instrument. `run-1` and `run-2` are therefore two independent packs, not one pack
compared with itself.

| | run-1 | run-2 |
| --- | --- | --- |
| tarball | `dsh-agent-team-0.1.6.tgz` | same name |
| **sha256** | **`0cc7bef3d5ee24cbae0b60039b47738dc044014b262f5546c064fba723031923`** | **`0cc7bef3d5ee24cbae0b60039b47738dc044014b262f5546c064fba723031923`** |
| bytes | `4 407 630` | `4 407 630` |
| tar members | `2 113` | `2 113` |
| internal `package.json` version | `0.1.6` | `0.1.6` |
| packed commit | `22682f336…` (clean product surface at pack time) | same |
| packed tree digest | `sha256:02928d3b678e5362f772b040ab8fef64702169ce80afbaa00c950ba40d015952` | same |
| host entry sha256 | `187bc363dc816703a364ad1288dd575135892fb7ad644273a38bba86e7d612b6` | same |

**Byte-comparison verdict: byte-identical.** `cmp` exits `0`; `tar -tzvf` listings are identical
(members, sizes, modes, owners, mtimes). There is **no differing file to enumerate**. The reason a
second pack is stable at all is that pnpm normalises the archive: uid/gid `0/0`, mode `0644`,
mtimes pinned to `1985-10-26 16:15` — so this is **not** a timestamp artifact, and it is also not a
lucky hash: ordering and headers are canonicalised by the packer (`byte-compare.txt`).

**Cross-tree corroboration (not required, but it strengthens the claim):** packing master commit
`6ea7d8dd4` in a *different, freshly created worktree on a different day* reproduced
`4e146e9529ad215145bebc14ff6c54217f1a5765b1361bbb7664da3430a0730f`, **exactly** the second-tarball
sha256 recorded by the 2026-11-12 packaging lane. Same tree ⇒ same bytes, across worktrees.

**Kit counts (both runs, end to end, exit 0):**

| | run-1 | run-2 |
| --- | --- | --- |
| driver checks | **33/33 PASS** | **33/33 PASS** |
| live instrument checks | **39/39 PASS** | **39/39 PASS** |
| gates `VER/PROV/ART` | 2+3+4 all PASS (rebuild left zero product porcelain; `check-artifacts-committed` `verdict=ok compared=2088 glue=113`) | same |
| `PACK/INST` | 4+6 PASS (installed tree **equals** packed tree) | same |
| `LIVE` | 4 PASS (v5 blueprint froze `memberIoCeilings` + `reviewRouting`; Member turn executed and collected) | same |
| `UPG/RBK/HYG` | 4+4+1 PASS; host checkout byte-clean before and after | same |

Raw: `run-1/driver.log`, `run-1/summary.json`, `run-1/live/summary.json` (and `run-2/…`).

---

## 3. Tarball ↔ commit identity

Tool: `compare-tarball-to-commit.mjs` (in this directory). It extracts the tarball, hashes every
regular member the way git hashes a blob (`sha1("blob <len>\0" + bytes)`) and compares it with
`git ls-tree -r <commit>`. Full output: `run-1/tarball-vs-commit.json`,
`run-2/tarball-vs-commit.json`.

| check | run-1 / run-2 |
| --- | --- |
| internal `package.json` version | **`0.1.6`** |
| internal `package.json` `private` | **`true`** |
| regular members compared | `2 113` |
| content-identical to `HEAD` | `2 112` |
| tarball-only (not in the commit) | **`0`** |
| mismatched | **`1`** — `package.json` (explained below) |

**The one mismatch is the packer's manifest rewrite, not a content drift.** `pnpm pack` rewrites the
published manifest: it drops `packageManager` and re-serialises the key order. After removing
`packageManager`, the packed and committed manifests are semantically equal; the only other
difference is ordering. All 2 112 other shipped files — including the tracked `dist/` build output,
the governed-realm `.mjs`, the landlock launcher, the client composition shim and
`root-binding` — are byte-identical to the commit.

**Method limits, stated:** (a) comparison is **content-only** — tar metadata (mtime/uid/gid/mode) is
not part of git and is not compared (which is exactly why a second pack can be byte-identical
without git modelling tar headers); (b) the tarball ships an allow-list (`files`, plus README and
`package.json`), so `14 633` tracked files of the commit are correctly absent ("commit-only"); (c)
identity is proven against **this commit**, not against an immutable tag — no tag exists (§7).

---

## 4. Re-install ("rollback") on a real world

**First, the published-artifact question.** There is **no previous *published* tarball to find**:
the repository has **no `v0.1.*` tags locally or on `origin`** (`git tag --list`, `git ls-remote
--tags`), **no GitHub releases** (`gh release list` empty), and `npm view dsh-agent-team` returns
**404 Not Found**. So *"install the previous published tarball"* is **NOT_MEASURED — no published
artifact exists**. No artifact was invented in its place.

**What was measured instead, and labelled as such:** the re-install operation itself, using the
previous same-version artifact that does exist — a pack of master commit `6ea7d8dd4`
(`4e146e95…`, reproduced byte-exactly in a separate worktree, §2). This is a *previous build*, not
a *published release*; it tests the mechanism the release notes name, on real durable data.

Sequence (one live world per run, durable data produced by the live arm first):

```
dsh plugin add <candidate 0cc7bef3…>      # baseline install (this run's pack)
dsh plugin add <previous 4e146e95…>       # "upgrade" / previous artifact
boot the same DSH_HOME, read the Team
dsh plugin add <candidate 0cc7bef3…>      # "rollback" = re-install the previous tarball
boot the same DSH_HOME, read the Team
```

Measured transcript (identical in run-1 and run-2; `run-*/upgrade/`, `run-*/rollback/`):

| observation | run-1 | run-2 |
| --- | --- | --- |
| previous-artifact install exit | `0` | `0` |
| installed tree after swap | `sha256:ad889249ad351cf96118adf96f9d92cfa22f379828e67dde5d05c05d8093ecf4` = the previous tarball's tree | same |
| installed version after swap | `0.1.6` (**identical** — the swap is invisible to version reporting) | same |
| durable world files across the swap | `27 → 27`, **byte-identical** | same |
| boot on previous artifact | booted, auth `303`, projection `200`, 2 durable Team rows | same |
| rollback (candidate re-install) exit | `0` | `0` |
| installed tree after rollback | `sha256:02928d3b…` = the candidate's packed tree, **byte-exact** | same |
| durable files across rollback | byte-identical; **every pre-swap file still present** | same |
| boot after rollback | booted, auth `303`, projection `200`, 2 durable Team rows | same |

**What survives:** the entire `DSH_HOME` durable state — `storages/team_domain.json` (TeamSession,
Member rows, ledger), `storages/workspace.json`, project sessions (`session.v4.jsonl.zstd`), the
blueprint registry row (`blueprints/v016-pack-bp-r1.yaml`) and the workspace side-effect files.
Neither install touches it, and both artifacts can read the same Team. The installed package tree
is replaced **wholesale and byte-exactly** in both directions.

**What does not survive / is not promised:**

1. **Nothing durable was migrated — because there is no upgrade protocol at all.** No version
   negotiation, no data migration, no compatibility check, no `rollback` command. The only
   primitive is `dsh plugin add`, a package-manager install. This dry-run measured the *swap*, not
   an upgrade.
2. **No version marker distinguishes the two artifacts** — both are `0.1.6`, so an operator cannot
   tell from the version which build is installed; only the tree digest / tarball hash can.
3. **The profile's install provenance does not survive usefully.** It is rewritten to an
   **absolute `file:` path** of the tarball last installed. Delete or move that tarball and a
   profile repair/reinstall fails: `pnpm install --frozen-lockfile --offline` exits **254 /
   ENOENT** once `node_modules` is removed (`relocate-repair.log`). A boot survives only while
   `node_modules` is intact.
4. **No downgrade guarantee across a version or schema boundary.** `docs/RELEASE.md` §4 states
   durable TeamDomain rows are not guaranteed to downgrade; the measured pair is the *same*
   generation, so nothing here may be cited for `0.1.5 → 0.1.6` (never measured).

---

## 5. Compatibility notes — the exact operator commands

Everything below was executed on this machine, in this order. Full transcript per run in
`run-*/driver.log`, `run-*/install/`, `run-*/live/`.

```bash
# 0. worktree + deps (OFFLINE, from the shared store; no registry fetch)
cd /home/armourpiercer/projects/dsh-agent-team
git worktree add .worktrees/rc-dryrun-20261113 -b task/rc-readiness-dryrun-20261113 origin/master
cd .worktrees/rc-dryrun-20261113
pnpm install --ignore-scripts --frozen-lockfile --offline \
  --store-dir /home/armourpiercer/projects/dsh-agent-team/.artifacts/pnpm-store

# 1. kit, end to end, twice (each run packs its own tarball + fresh DSH_HOME)
node tests/kits/packaging-v016/run-packaging-acceptance.mjs --run 1 \
  --evidence-dir dev/agent-workflow/evidence/rc-readiness-dryrun-20261113 \
  --second-tarball <previous 4e146e95…>.tgz --second-commit 6ea7d8dd4679ed48d1fd6e7d92ba30ee311fabad
node tests/kits/packaging-v016/run-packaging-acceptance.mjs --run 2 \
  --evidence-dir dev/agent-workflow/evidence/rc-readiness-dryrun-20261113 \
  --second-tarball <previous 4e146e95…>.tgz --second-commit 6ea7d8dd4679ed48d1fd6e7d92ba30ee311fabad

# 2. what the kit itself runs underneath (install step, exactly)
DSH_HOME=<world>/home \
  node <repo>/tests/deepseek-harness-test-use/apps/cli/lib/bin.js \
  plugin --profile web add <abs path>/dsh-agent-team-0.1.6.tgz

# 3. boot that installation (kit + live instrument do this on a sanctioned port)
DSH_HOME=<world> node <repo>/tests/deepseek-harness-test-use/apps/cli/lib/bin.js \
  web --port <3181-3199|13000-13049> --no-open

# 4. identity + reproducibility checks (this directory)
node compare-tarball-to-commit.mjs <tarball> HEAD
cmp <pack-1>.tgz <pack-2>.tgz
```

**Local/ambient dependencies an operator must know about:**

| dependency | kind | consequence |
| --- | --- | --- |
| `/home/armourpiercer/projects/dsh-agent-team/.artifacts/pnpm-store` (2.1 GB) | **machine-local pnpm store** | every install was `--offline` from it; a fresh machine must fetch the registry instead. The kit writes `storeDir:` into the throwaway profile's `pnpm-workspace.yaml` — the default store lives outside the write sandbox. |
| `<repo>/tests/deepseek-harness-test-use` | **machine-local, gitignored host checkout** | not in the tarball; the kit falls back from the worktree to the main checkout. Pinned `0.2.0-rc.2 @ 639ed01539`, porcelain empty before/after every run. |
| tarball absolute path | **machine-local** | recorded verbatim as a `file:` dependency in the profile lock; moving it breaks repair (§4.3). |
| network | **not used here** | `pnpm pack` is local; install was offline. A clean-machine run of the same commands **does** need registry access (install) unless the store is pre-seeded. |

**`ERR_SQLITE_ERROR` (the previous lane's sandboxed-store failure): NOT HIT.** Not because it was
avoided by luck — the store was pinned inside the session workspace and passed both as
`--store-dir` and as the profile's `storeDir`, which is the disclosed workaround. If a future run
uses the default store (`~/.local/share/pnpm/store`), expect the sandbox to reject it.

**A measurement defect in the shipped kit, found here and not papered over.**
`INST-4` claims "the profile resolves the plugin by package name **with a tarball integrity in the
lock**". The driver's regex takes the **first** `integrity:` line in `pnpm-lock.yaml`, which is
`@deepseek-ai/cosmokit@1.8.6` (`sha512-ZSD/fN52…`), **not** the `dsh-agent-team` entry. The real
entry is
`dsh-agent-team@file:…: resolution: {integrity: sha512-o6dl6KIWznHUhPvJerjhbaIfF280tvlZA+Q5kiucAZbGimFahhEmqTK2lP6K4ZaTfGrrVmyTkQ2bTJSALIUHcg==, tarball: file:<abs>}`
(observed in a manual install; `relocate-repair.log` shows the same entry). So the check passes for
the wrong reason. The previous lane's README §6 quotes the same `sha512-ZSD/fN52…` value under the
label "tarball integrity", so this misattribution is inherited, not new. The *fact* the check
intended (the tarball is pinned by its own content hash) **is** true — it just is not what
`INST-4` reads. `INST-5` similarly cannot see the absolute `file:` tarball spec because it excludes
lines that contain the tarball path.

---

## 6. Gates run here

| gate | result |
| --- | --- |
| `node scripts/lint-identities.mjs` | **clean**, exit 0 (162 identity lines, 76 distinct; 1 649 files linted) |
| `git diff --check` | **clean**, exit 0 (see the note below) |
| p4t6 census | **not applicable** — no file added under `packages/**` (only `dev/agent-workflow/evidence/**`) |

**Disclosure for the `git diff --check` row:** the instrument's text writers append `"\n"` to text
that already ends in `"\n"`, so 30 committed log/manifest files end with one blank line at EOF.
Rather than rewriting measured bytes, a scoped `.gitattributes` in this evidence directory sets
`whitespace=-blank-at-eof` (only that rule; every other whitespace rule stays on). The prior
packaging lane committed the same trailing blank lines without the attribute. No evidence content
was changed.

---

## 7. What a release would still be unable to claim

Blunt list. None of these is fixed by this dry-run; several are owner decisions.

1. **That a release exists.** No tag, no GitHub Release, no npm publish, no push — correctly, per
   the hard limits. The dry-run proves the *steps* are executable, not that they were taken.
2. **That the release is GO.** `V016-RC1-GO-NO-GO.md` recommends **NO-GO** and both C2 records
   return `candidateClaimEligibility.eligible: false`; the blocker is eligibility, not this surface.
   Re-freezing to `cand-v0.1.6-5` and re-running C2 are not done here.
3. **Any upgrade protocol.** None exists. Rollback is literally re-installing a tarball; the
   `0.1.5 → 0.1.6` path is **NOT_MEASURED**, and `docs/RELEASE.md` §4 promises no unconditional
   downgrade.
4. **That the previous *published* artifact can be restored.** **NOT_MEASURED** — no published
   tarball exists (no tags, no releases, npm 404). What was measured is a previous *build*
   (`6ea7d8dd4`), same version, same generation.
5. **Portability.** One machine class, one OS (Linux/landlock), one host pin `0.2.0-rc.2`. No
   second-machine install was attempted.
6. **npm distribution or provenance.** The package is `private: true`; the registry path was never
   exercised (a `pnpm publish --dry-run` / provenance leg is still missing).
7. **Relocatable installs.** The profile pins the tarball by absolute path; losing the artifact
   makes repair fail (`254`). An operator must retain the exact tarball alongside the profile.
8. **Machine-independent reproducibility as a policy.** Two packs here are byte-identical and one
   cross-worktree pack reproduces a recorded digest, but the packer normalises metadata and no CI
   leg enforces "same tree ⇒ same sha256"; there is still no `check-pack-reproducible` gate.
9. **Enforced version sync.** Ten manifests agree by hand; only the kit checks, and the kit is not
   Required CI.
10. **Signed/attested artifact.** The tarball has no signature, SBOM or attestation; identity is
    sha256 + commit, verified by re-reading git.
11. **A release built from an immutable tag.** This pack describes branch-tree commit `22682f336`;
    the tarball↔commit edge is measured, but no tag exists to anchor it.
12. **That the shipped kit's install assertions mean what they say.** `INST-4` reads the wrong lock
    integrity (§5). The underlying fact holds, the check does not prove it.

---

## 8. Evidence index

| path | contents |
| --- | --- |
| `run-1/`, `run-2/` | full kit evidence: `driver.log`, `summary.json`, `gates/` (identity, version census, build logs, artifact verdict), `pack/` (log, members, internal manifest, provenance), `install/`, `live/`, `upgrade/`, `rollback/` |
| `run-*/tarball-vs-commit.json` | content comparison of every tarball member against `HEAD` |
| `run-*/live/summary.json` | the 39 live instrument checks |
| `byte-compare.txt` | `sha256sum`, sizes, `cmp` and `tar -tzvf` diff of the two independent packs |
| `relocate-repair.log` | absolute `file:` dependency + repair failure (`254`) after the artifact is removed |
| `compare-tarball-to-commit.mjs` | the comparison tool (reproducible method) |
| `.artifacts/tmp/packaging-v016-pack-run-{1,2}/` | the two tarballs (gitignored scratch, identity only, never committed) |

**Class statement.** This record is `DEV-LIVE`. It is **not `CANDIDATE-C2`**, makes **no `V@B`
claim**, and must not be cited as an upgrade or rollback guarantee. `:3080`, the shared baseline,
the Authority pointer, candidate refs and Required CI were never touched.
