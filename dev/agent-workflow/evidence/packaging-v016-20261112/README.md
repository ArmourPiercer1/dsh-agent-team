# Packaging lane — `v0.1.6` pack → clean-host install → Team/Member → upgrade/rollback

**Evidence class: `DEV-LIVE`.** This is a packaging-lane measurement, not a candidate acceptance.
It is **not `CANDIDATE-C2`**, makes **no `V@B` claim**, moved no Authority pointer, cut no tag,
published nothing, and pushed nothing. The owner-approved C2 scopes remain unrun on this tree.

**Date:** 2026-11-12 (real UTC). **Lane:** `task/packaging-v016-20261112`.
**Base:** `origin/master` @ `84baf304c4c7d721d41312a4d240092e033fbfd6` (clean worktree
`.worktrees/packaging-v016`; the shared baseline tree and `:3080` were never touched).

Everything below was **measured on this machine in this lane**. Where the product has no
mechanism, this record says so instead of inventing one (§7).

---

## 0. What was asked, and what was actually established

| Objective requirement | Result |
| --- | --- |
| `0.1.6` consistent across root + every shipping workspace package | **PASS** — 9/9 packages + root, `mismatched=[]` (`run-*/gates/version-census.json`) |
| artifacts rebuilt (no stale `dist`) | **PASS** — full `pnpm -r run build` + `build:composition`, then **zero product porcelain** and `check-artifacts-committed` `verdict=ok compared=2088 glue=113` |
| `pnpm pack` → internal `package.json` same version, provenance = packed commit, sha256 recorded | **PASS** — internal `0.1.6`, sha256 `cf781b92…`, 2 113 members, packed commit `f86a259be` |
| install into a clean host: fresh dir + fresh `DSH_HOME` under `tests/homes/`, no repo `node_modules`, pinned host `0.2.0-rc.2 @ 639ed01539` | **PASS** — real `dsh plugin --profile web add`, installed tree byte-identical to the packed tree |
| from that installation: Team from a v5 blueprint with `memberIoCeilings` + `reviewRouting`, one Member execution, typed surfaces | **PASS, observed** — 39/39 instrument checks; both families present in the **durable `blueprint_registry` source**; Member executed, collected, survived a SIGKILL cold boot |
| upgrade and rollback, honest about what survives | **MEASURED** — install-level swap is exact and reversible; **no upgrade protocol exists** (§7) |

**Two runs, field-identical** (`run-1`, `run-2`): 33/33 driver checks each, 39/39 live instrument
checks each, same tarball sha256, same install tree digest, same swap/rollback identities.
`n=2` is an existence-plus-agreement record, not a rate or stability claim.

---

## 1. Frozen identity of what was measured

| field | value |
| --- | --- |
| branch | `task/packaging-v016-20261112` |
| base | `origin/master` = `84baf304c4c7d721d41312a4d240092e033fbfd6` |
| **packed commit** | `f86a259be53f4e172a5b69e74b2791fa11b42990` (clean product surface at pack time) |
| driver | `tests/kits/packaging-v016/run-packaging-acceptance.mjs`, sha256 `41cd87f1ef16de9ccb28913250b26d98b441e52d3217a42c2dff3648e769cc06` |
| live instrument (modified additively, §10) | `tests/kits/v016-packaged-acceptance/run-packaged-acceptance.mjs`, sha256 `2e14ccaf711543bb26bd530f11188e041a3e46036615883d5425914e00245b18` |
| host pin | `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84` (`0.2.0-rc.2`, read from `tests/paths.mjs`; porcelain `""` before **and** after every run) |
| **tarball** | `dsh-agent-team-0.1.6.tgz`, **4 405 498 bytes**, **sha256 `cf781b922b6fcb22a404dd84d3928f23538b5cd6f97ec92303a7a4c6f8cb6b67`**, **2 113** tar members |
| tarball internal `package.json` | name `dsh-agent-team`, version **`0.1.6`** |
| tarball tree digest | `sha256:7e1fdacbb94113cec18b69bee8f857bbe25c6d52724976847beda4aebe7398b2` |
| packed host entry | `packages/runtime/dist/packages/runtime/src/plugin/host.js`, sha256 `187bc363dc816703a364ad1288dd575135892fb7ad644273a38bba86e7d612b6` |
| second (over-installed) tarball | same name/version, packed from **`6ea7d8dd4679ed48d1fd6e7d92ba30ee311fabad`**, **4 403 356 bytes**, sha256 `4e146e9529ad215145bebc14ff6c54217f1a5765b1361bbb7664da3430a0730f`, tree digest `sha256:ad889249ad351cf96118adf96f9d92cfa22f379828e67dde5d05c05d8093ecf4` |
| worlds | `tests/homes/packaging-v016-<run>-<stamp>/` (this driver) and `tests/homes/v016-pack-<run>-<stamp>/` (live instrument); **both removed at exit** (`teardown.kept=false`) |

The tarball and its extraction are **never committed** — only identity. They live in gitignored
`.artifacts/tmp/packaging-v016-*` during a run.

### Why a same-version second tarball is a real second artifact

`76293c79f` (the commit one behind tip) packs to the *identical* sha256 `cf781b92…`, because
neither `packages/**`, `cordis.patch.yml` nor the composition shim changed there — the tarball is a
function of the **shipped surface only**. `6ea7d8dd4` (#736) does change shipped files, so it packs
to different bytes at the **same** `0.1.6` version. That is the honest "second tarball" for the
upgrade measurement: same version, different artifact, no invented version bump.

---

## 2. Exact command sequence (reproducible, no hand steps)

```bash
# 0. base
cd /home/armourpiercer/projects/dsh-agent-team
git worktree add .worktrees/packaging-v016 -b task/packaging-v016-20261112 origin/master
cd .worktrees/packaging-v016
pnpm install --ignore-scripts --frozen-lockfile \
  --store-dir /home/armourpiercer/projects/dsh-agent-team/.artifacts/pnpm-store

# 1. the second (same-version, earlier-commit) tarball: build it in its own worktree
git worktree add --detach .worktrees/packaging-v016-b 6ea7d8dd4679ed48d1fd6e7d92ba30ee311fabad
cd .worktrees/packaging-v016-b
pnpm install --ignore-scripts --frozen-lockfile --store-dir <same store>
pnpm run build && pnpm run build:composition
pnpm pack --pack-destination .artifacts/tmp/pack-b          # -> 4e146e95… 
cd ../packaging-v016

# 2. the lane (does gates → pack → install → live → upgrade/rollback itself)
B=.worktrees/packaging-v016-b/.artifacts/tmp/pack-b/dsh-agent-team-0.1.6.tgz
node tests/kits/packaging-v016/run-packaging-acceptance.mjs \
  --run 1 --second-tarball "$B" --second-commit 6ea7d8dd4679ed48d1fd6e7d92ba30ee311fabad
node tests/kits/packaging-v016/run-packaging-acceptance.mjs \
  --run 2 --second-tarball "$B" --second-commit 6ea7d8dd4679ed48d1fd6e7d92ba30ee311fabad
```

The driver is **safe to re-run**: every run gets a fresh world, picks **free** ports inside the
sanctioned bands (`tests/paths.mjs` `TEST_PORT_RANGES`; `:3080` is never a candidate), writes only
its own `run-<label>/` evidence and deletes its worlds by path. `--skip-rebuild`, `--skip-live`,
`--skip-upgrade`, `--phase …`, `--tarball` and `--keep` exist for partial re-measurement.

Ports observed: host `3182`, mock `3491` (both sanctioned; the existing packaged instrument's
`140xx` defaults are **outside** policy, so this driver always passes explicit sanctioned ports).

---

## 3. Version consistency (root + every shipping workspace package)

Read from `pnpm-workspace.yaml` (`packages/*`), not from a hand list:

| package | version |
| --- | --- |
| root `dsh-agent-team` | `0.1.6` |
| `packages/client` | `0.1.6` |
| `packages/contracts` | `0.1.6` |
| `packages/domain` | `0.1.6` |
| `packages/legacy` | `0.1.6` |
| `packages/remote` | `0.1.6` |
| `packages/runtime` | `0.1.6` |
| `packages/storage` | `0.1.6` |
| `packages/testkit` | `0.1.6` |
| `packages/tools` | `0.1.6` |

`mismatched=[]`, `versions=["0.1.6"]`. **Caveat:** nothing in the product *enforces* this sync
(§11 gap 9); the driver checks it and would fail on drift.

---

## 4. Artifacts rebuilt, no stale `dist`

Per run, in order (`run-*/gates/`):

1. `pnpm -r run build` → exit 0.
2. `pnpm run build:composition` → exit 0 (`place-dist-glue` 113 placements + client bundle
   `1332665 B`).
3. `git status --porcelain -- packages scripts tests/paths.mjs package.json pnpm-lock.yaml
   cordis.patch.yml pnpm-workspace.yaml` → **empty**. This is the stale-dist proof: a fresh build
   produced bytes **identical to the committed index**, so nothing on the install surface is one
   build behind.
4. `node scripts/check-artifacts-committed.mjs` → `DSH-ARTIFACT-VERDICT … verdict=ok
   compared=2088 glue=113`.

The full porcelain is also recorded and contains only the lane's own untracked evidence directory;
the pack's cleanliness predicate is deliberately the **product surface**, so an uncommitted driver
cannot make the artifact look dirty — and cannot hide a dirty product file either.

---

## 5. Pack and provenance

`pnpm pack --pack-destination .artifacts/tmp/packaging-v016-pack-run-<n>` (exit 0).

* internal `package/package.json` version `0.1.6` — **the same** as root and every package;
* 2 113 members; required install surface present: `cordis.patch.yml`, host entry, governed-realm
  `.mjs`, landlock launcher, client `composition-shim/index.js`, `packages/runtime/root-binding`;
* provenance: `packedCommit = f86a259be…`, `cleanAtPack = true`, `branch =
  task/packaging-v016-20261112`, host pin recorded;
* identity: sha256 / bytes / tree digest as in §1 (`run-*/pack/provenance.json`).

The tree digest is `sha256` over sorted `(relative path, file sha256)` of the extracted
`package/`, so "the installed artifact is the packed artifact" is a **whole-tree** claim, not just
the host entry.

---

## 6. Clean-host install (real transcript)

Command (exactly as executed, one per run):

```
DSH_HOME=tests/homes/packaging-v016-<run>-<stamp>/home \
  node /home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-test-use/apps/cli/lib/bin.js \
  plugin --profile web add <abs path>/dsh-agent-team-0.1.6.tgz
```

* exit `0`; the profile is `tests/homes/<world>/home/profiles/web`, the project cwd is
  `tests/homes/<world>/project` — **both created by this run**, and the repo's `node_modules` is
  not referenced by any profile file (`worktreeRefsInProfile=[]`);
* installed `node_modules/dsh-agent-team/package.json` → version **`0.1.6`**;
* **installed tree digest == packed tree digest** (`7e1fdacb…`) — the whole package, not one file;
* profile dependency is the tarball spec with lock integrity
  `sha512-ZSD/fN52L498LBIOYwjIOlaLv5veY6ZEwI2yzvZUKQtctn0QAPqu8tKdJ+OF5+Tv6NBq1U+wJWH+QI6OGy5EvQ==`;
* profile bundles: `["@deepseek-ai/dsh-base","@deepseek-ai/dsh-web-app","dsh-agent-team"]`, and the
  installed `cordis.patch.yml` carries `name: "dsh-agent-team/host"` — resolved **by package name**,
  no worktree `file://` plugin row.

Transcript: `run-*/install/install-stdout.txt`, facts in `run-*/install/install-facts.json`.

---

## 7. The live arm — what was actually observed

Driven by the proven packaged instrument (`--tarball <ours> --member-io-ceilings --keep`), one host,
one fresh `DSH_HOME`, in-tree deterministic **mock** model (scripted oracle, §10). **39/39 checks
PASS in both runs** (`run-*/live/summary.json`).

### 7.1 Team + typed surfaces (the objective's exact ask)

`team.create` on a **`schemaVersion: 5`** blueprint carrying `memberIoCeilings` (worker + officer)
**and** `reviewRouting` (`officerTemplateId: officer`, `ordinaryToolApprovals.default: officer`,
`whenOfficerUnavailable: hold`): HTTP `200`, `path="fresh-root"`, durable TeamSession written.

The typed surface is read from the **durable `blueprint_registry` row**, not from the request:

| observed | run-1 | run-2 |
| --- | --- | --- |
| registry row present | true | true |
| frozen document `schemaVersion` | `5` | `5` |
| frozen `memberIoCeilings` present | true | true |
| frozen `memberIoCeilings` template ids | `["worker","officer"]` | `["worker","officer"]` |
| frozen `reviewRouting` present | true | true |
| registry `contentHash` | `sha256:ba247028…` | `sha256:a68089cd…` (differs only because the ceiling paths embed the per-world workspace path) |
| TeamSession binds the same hash | true | true |

Ceiling **enforcement** was not exercised (no governed-realm row was composed; the only `bash` arm
is the Alpha.6 approval path). This record claims admission + typed travel, **not** compiled-ceiling
behaviour.

### 7.2 One Member execution, durably

| observed | run-1 | run-2 |
| --- | --- | --- |
| durable Members (leader + officer + worker + goal) | 4 rows | 4 rows |
| worker instance / child session | `inst-0mzzhtj0zr0b` / `session-team-child-52b89f19…` | `inst-0kc39c71kemt` / `session-team-child-f567ec10…` |
| governed `bash` ask → durable approval leg | `leader-approval`, human-decidable, visible | same |
| plane leg routed to the Officer, escalated to a **human** leg | `reviewAuthority=human-user`, `escalated=true` | same |
| human `allow` (the `team.resolveControl` RPC the GUI button issues) | decider `{kind:"human"}` | same |
| consumptions / executions | exactly `1` / exactly `1` (`succeeded`) | same |
| attributed side effect | `V016PACK_R1_ARM1_EXECUTED`, `abandonments=0` | `V016PACK_R2_ARM1_EXECUTED` |
| Member result collected by the Leader (`team_collect`) | marker present in durable result | same |
| Goal arm | `phase=paused`, `revision=3`, rounds `3` | same |
| Stop arm | cancel admitted, **0** consumption, **0** execution, no side effect, late allow refused/abandoned | same |
| SIGKILL → cold boot on the same `DSH_HOME` | Team + Member survive, Goal unchanged, collected result retrievable, **no** resurrected turn, per-leg facts `1,1,1,0` | same |

This is the objective's "run one Member execution" plus the surrounding durability the instrument
already proves. It is **not** a stability claim (n=2), and not a real-vendor-model claim.

---

## 8. Upgrade and rollback — measured, with the honest boundary

The product has **no upgrade protocol**: no version negotiation, no data migration, no compatibility
check, no `rollback` command. The only primitive is `dsh plugin add` (a package-manager install).
This lane therefore measures **the swap**, and reports what it does and does not do.

Sequence per run (on the **same live world**, after the live arm produced durable data):

```
dsh plugin add <second tarball 4e146e95…>   # "upgrade"
boot the same DSH_HOME, read the Team
dsh plugin add <first tarball cf781b92…>    # "rollback"
boot the same DSH_HOME, read the Team
```

| observed | run-1 | run-2 |
| --- | --- | --- |
| second install exit | `0` | `0` |
| installed tree digest after swap | `ad889249…` == second tarball tree | same |
| installed version after swap | `0.1.6` (**same** — the swap is not distinguishable by version) | same |
| durable world files before/after the install | `27` / `27`, **identical** | same |
| boot on the second artifact | booted, auth `303`, projection `200`, readable, durable Team rows `2` | same |
| rollback install exit | `0` | `0` |
| installed tree digest after rollback | `7e1fdacb…` == first tarball tree | same |
| durable files across the rollback install | identical; **every pre-swap file still present** | same |
| boot after rollback | booted, auth `303`, projection `200`, readable, durable Team rows `2` | same |

**What survives:** the installed artifact identity is replaced **wholesale and byte-exactly**
(whole-tree digest), and `DSH_HOME` durable data — TeamSession, Member rows, Goal, ledger,
blueprint registry — is **neither migrated nor touched** by either install. A boot of the earlier
artifact reads the same Team (projection `200`, 2 durable team rows) in both runs.

**What does not survive / is not guaranteed:** there is no record of *why* an older artifact should
be able to read newer data; both observed artifacts are the same `0.1.6` generation and the earlier
one is 6 commits back, so this is **one data point**, not a compatibility promise. A version bump, a
schema change, or a rollback across `0.1.5` were **not** measured. Nothing here may be cited as an
upgrade guarantee.

**A defect this lane found and fixed in its own driver (recorded, not hidden):** the first attempt
called `team.getProjection` once immediately after boot; the route answers a typed
`runtime-not-ready (state: starting)` until the team runtime is up, so run-1 of that pair reported
`32/33` ("the Team did not survive") on a slow boot. The driver now polls up to 120 s and records
the attempt count. That was a **measurement defect**, not a product failure; the corrected pair is
the evidence here, and the false negative is disclosed because it changes what the earlier number
meant.

---

## 9. Gates run on this branch

| gate | result |
| --- | --- |
| `node scripts/check-artifacts-committed.mjs` | **ok**, 2088 files, 113 glue placements (per run) |
| ARC-A fitness (`packages/runtime/test/u6-arc-a-fitness.test.ts`) | **12/12 pass** |
| `scripts/ci-pr-gate.mjs --only blueprint-fence` | **pass** (after the baseline re-record in §10) |
| `scripts/ci-pr-gate.mjs --only lint-identities` | **pass**, 0 new / 0 resolved identities |
| `scripts/ci-pr-gate.mjs --only graph-parse,state-freshness,kit-home-guard,install` | **pass** (4/4) |
| p4t6 census | **not applicable** — no file added under `packages/**` |

---

## 10. Disclosures (what a reader must know to trust the numbers)

1. **The live instrument was modified additively.** `v016-packaged-acceptance` gained an opt-in
   `--member-io-ceilings` flag (default **off**, so its historical evidence is unchanged) and two
   checks (`SURF-1`, `SURF-2`) that read the durable registry source. Rationale: the objective asks
   for a v5 blueprint with **both** families, and the instrument's own F-1 finding ("`memberIoCeilings`
   cannot travel through the v5 product path") was fixed by **PD-42**, which widened
   `derivedMembersOf` to `schemaVersion 4 AND 5` (`packages/runtime/team-services/src/product-assembly.ts`).
   The flag proves the document travels; it does not compose the governed realm, so it does **not**
   prove ceiling enforcement.
2. **Blueprint-fence baseline re-recorded as a LINE-SHIFT**, with provenance in
   `dev/agent-workflow/evidence/a4-pr7/ci-gate/blueprint-fence-baseline-606a0be7.txt`:
   `run-packaged-acceptance.mjs` `L862=v5 → L871=v5`, same fixture, same digit, no new offending
   content, nothing resolved.
3. **Oracle:** the model transport is `packages/tools/harness/mock-deepseek.mjs` (in-tree scripted
   mock). It decides *which tool* a member calls; it does not decide whether the product works. Real
   in every run: the tarball, install, profile/lock, host process, durable ledger/member rows,
   session records, HTTP responses, the human `team.resolveControl` / `session/cancel` RPCs, and the
   side-effect files. **No GUI click / no browser** — the RPCs are the buttons' wire calls.
4. **No candidate.** `dev/engineering/candidates/` was not written. The Authority pointer
   (`as20261109r1`) was not moved. No tag, no publish, no push.

---

## 11. Candidate manifest DRAFT for `cand-v0.1.6-3` — procedure, not a freeze

Draft path: `candidate-draft/cand-v0.1.6-3.DRAFT.json`.

| field | draft value |
| --- | --- |
| `candidate_id` | `cand-v0.1.6-3` |
| `candidate_ref` | `candidate/v0.1.6-3` (**does not exist yet**; the real freeze creates it) |
| `candidate_commit` | `f86a259be53f4e172a5b69e74b2791fa11b42990` — the commit that contains the driver and precedes this evidence commit |
| `content_digest` | `sha256:ebf521ee9028b9c13472fdd24aad1c140532fa488de13d889b679e78292e75f2` |
| `authority` | `as20261109r1`, `sha256:d85fdc1a…`, baseline `cb2e41483…` |
| host pin | `0.2.0-rc.2` @ `639ed015397290b3745d163aafe02ffee4aa3f84` |

**This is NOT a freeze.** `freeze-candidate.mjs` can be run against the current tip, and it was, so
the *procedure* is proven and every digest is computed rather than transcribed — but the real freeze
must be **re-run on the final frozen commit** (the one the release step tags), because this tree can
still move. Do not copy the SHA above into `dev/engineering/candidates/`.

Procedure for the real freeze:

```bash
# on the FINAL frozen commit F (clean product surface, host checkout clean)
node scripts/freeze-candidate.mjs \
  --candidate-id cand-v0.1.6-3 \
  --ref candidate/v0.1.6-3 \
  --commit <F> \
  --authority-snapshot <current pointer snapshot> \
  --out dev/engineering/candidates/cand-v0.1.6-3.json
node scripts/freeze-candidate.mjs --check --manifest dev/engineering/candidates/cand-v0.1.6-3.json
node scripts/verify-candidate.mjs --manifest dev/engineering/candidates/cand-v0.1.6-3.json
```

### Every field a C2 auditor recomputes

From the manifest object (`scripts/freeze-candidate.mjs`):

1. `candidate_commit` — `git rev-parse <ref>` must equal it; `candidate_ref` must point at it.
2. `product.sha` — the tree SHA of the candidate commit.
3. `product.trees` — tree SHAs for `packages`, `scripts`, `tests/paths.mjs`, `package.json`,
   `pnpm-lock.yaml` (each recomputed with `git rev-parse <commit>:<path>`).
4. `product.judges` — every `tests/world-factory/lib/*.mjs|json`, `tests/world-factory/a5sf-*.mjs`,
   `tests/world-factory/drivers/a5sf-*/*.mjs`, each blob SHA recomputed.
5. `equality_exit` / the diff command between product and candidate SHAs.
6. `authority.pointer`, `authority.snapshot_version`, `authority.content_digest`,
   `authority.snapshot_baseline` — re-read through `scripts/current-authority.mjs` (one reader).
7. `dependencies.host_baseline_version`, `dependencies.host_sha` — re-read from `tests/paths.mjs`
   **at the candidate commit**.
8. `dependencies.lockfile_tree` / package tree pins.
9. `ancestry.*` — two live `git merge-base --is-ancestor` checks.
10. `content_digest` — F0 canonical digest (sorted keys, minified) over the object minus
    `content_digest`/`content_digest_note`; recompute with `scripts/authority-snapshot.mjs`
    `canonicalDigest` (the manifest embeds the one-liner).
11. `verify-candidate.mjs` edges: every cited evidence record is re-read, and any record claiming
    candidate eligibility must carry `candidateCommit`/`candidateSha` == `candidate_commit` — a
    `DEV-LIVE` record (this file's class) **cannot** satisfy that edge, by design.

---

## 12. Gap list — what is missing before `v0.1.6-rc.1`

Each row names the artifact that would close it. None of these is done here.

| # | Gap | Why it blocks a release step | Closed by |
| --- | --- | --- | --- |
| 1 | **No tag, no GitHub Release** | the objective's "release" is a tag + release record; none exists | release step: `git tag -a v0.1.6-rc.1 <F>` + `gh release create` (owner-gated; `docs/RELEASE.md` §1) |
| 2 | **No frozen candidate for this tree** | C2 needs one immutable SHA/tarball/host; `cand-v0.1.6-1/-2` predate #734/#736/#739 | `scripts/freeze-candidate.mjs` → `dev/engineering/candidates/cand-v0.1.6-3.json` (real freeze on `F`) |
| 3 | **No independent C2-A / C2-B on that candidate** | DEV-LIVE evidence can never back a candidate claim | independent adjudication session per `dev/agent-workflow/evidence/c2-adjudication/` precedent |
| 4 | **Upgrade/rollback has no protocol** — install swaps bytes; no version negotiation, no migration, no compat check | an operator cannot know whether `0.1.5 → 0.1.6` preserves data | `docs/RELEASE-UPGRADE-POLICY.md` (support statement) + a version-compat check at plugin load (product seam; currently absent) |
| 5 | **Install-from-tarball is not on a second machine class** — this lane is Linux-only (landlock launcher, `tests/homes/` layout) | "installable" on one OS is not "installable" | run this driver on a Windows/macOS class (or CI matrix) and commit its `run-*/` |
| 6 | **No release notes for `-rc.1`** that separate the stable surface from the Alpha.6 opt-in and avoid claiming a machine-readable typed refusal in the Host UI | shipping notes that overclaim is a release defect | `docs/plans/active/alpha5-sandbox-first/RELEASE-NOTES-0.1.6.md` (exists as a draft; must be reconciled with this tree) |
| 7 | **No compatibility matrix** (host `0.2.0-rc.2` only; `0.1.x` hosts unsupported) | users will install onto the wrong host | `docs/RELEASE.md` §2 table + `package.json` peer pins (verify) |
| 8 | **npm publish path unexercised** — the tarball install works; `npm publish` / registry install / provenance attestation are untested | "packable" ≠ "publishable" | `pnpm publish --dry-run` gate + CI provenance (`--provenance`) in `.github/workflows/` |
| 9 | **Version sync is unenforced** — 10 manifests agree today by hand | drift is silent until a consumer reads the wrong version | `scripts/check-version-sync.mjs` (new) wired into `scripts/ci-pr-gate.mjs` |
| 10 | **Pack reproducibility across machines is untested** — same tree packs to the same sha here (and across two commits with identical surfaces) | a release needs `sha256` to be a function of the tree, not the machine | `scripts/check-pack-reproducible.mjs` (pack twice in clean checkouts, compare) + a CI leg |
| 11 | **Tarball install is not a Required CI leg** — adding one changes Required-CI, which this lane must not touch | a regression in the install path would not red master | new CI leg (owner/Integration-Owner authority) |

---

## 13. What this record does not prove

* Not a stability or rate claim: `n=2` agreeing is existence-plus-agreement.
* Not `CANDIDATE-C2`, not `V@B`, not a release; the Authority pointer, candidates and CI are untouched.
* Not a real-vendor-model run: the model transport is the scripted mock.
* Not a ceiling-enforcement proof: the v5 document carries `memberIoCeilings` and the durable
  registry freezes it; no governed realm was composed to *enforce* it.
* Not an upgrade guarantee: one same-version, 6-commit-back artifact pair on one machine.
* No GUI was rendered; approvals/Stop are the exact RPCs the buttons issue.

---

## 14. Evidence index

| path | contents |
| --- | --- |
| `run-<n>/summary.json` | every driver check with detail, driver sha256 + git commit |
| `run-<n>/driver.log` | the run transcript (one line per check) |
| `run-<n>/gates/` | identity, version census, build logs, artifact verdict, post-build porcelain |
| `run-<n>/pack/` | pack log, members, internal `package.json`, provenance (sha256/bytes/tree/commit) |
| `run-<n>/install/` | install stdout, install facts, profile + installed manifests |
| `run-<n>/live/` | the live instrument's full evidence (`summary.json`, `flow/`, `ledger/`, `boot/`) |
| `run-<n>/upgrade/`, `run-<n>/rollback/` | install facts, durable-data hashes before/after, boot/projection results |
| `candidate-draft/cand-v0.1.6-3.DRAFT.json` | the DRAFT manifest (§11) |
