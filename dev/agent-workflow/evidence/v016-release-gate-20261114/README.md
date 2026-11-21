# V0.1.6 RELEASE GATE — install-from-git proven, version gate green, release mechanics rehearsed

**Evidence class: `DEV-LIVE`.** Never `CANDIDATE-C2`, never a `V@B`, no matrix cell moved.
**Tree measured:** branch `release-gate/v016-20261114`, off `origin/master` @
`6361185d878ab2617193d51dd419e6dfe521a2ad` ("A6 COLD-WAKE … (#755)"). Every measurement below was
taken **on this exact tree**, in worktree `.worktrees/v016-release-gate`, on this machine (Linux x86_64,
node `v24.21.0`, pnpm `11.7.0`, git `2.53.0`), against the pinned pristine host
`tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84` (`0.2.0-rc.2`), porcelain
empty before **and** after every run.

**Owner ruling this gate serves (2026-11-14, quoted as scope, not as authorisation):** development
stops after the last in-flight PR; further audits skipped; ship **v0.1.6 as an internal trial build** by
**2026-11-14 04:00 UTC**. One hard acceptance: a user can install it with

```bash
pnpm dsh plugin --profile web add github:armourpiercer1/dsh-agent-team
```

Everything else is "no significant capability regression". **Nothing here cuts a tag, creates a
release, publishes, merges or moves a candidate/Authority pointer.** The `:3080` stable instance was
probed read-only (`401` before and after) and never touched; `~/.dsh` is read-only to this process and
was never written.

**Clock disclosure.** Real UTC at measurement start is `2026-11-13T16:4xZ` (≈11 h before the deadline).
The repository's own commit/append dates run **ahead** of real UTC (master carries appends dated
2026-11-16/17). This document uses real UTC timestamps for its own runs and quotes repo dates as the
tree states them; the two calendars are not reconciled here, and the deadline is read as real UTC.

---

## 1. Install-from-git — the one hard acceptance — **PASS**

### 1.1 Verdict

**The acceptance command works against an unmodified install.** Four independent installs were made
into four fresh throwaway `DSH_HOME`s (`tests/homes/v016-install-from-git-*`, gitignored, deleted after
the run by verified path). `private: true`, the absence of a `prepare` script, the committed `dist/`
artifacts and the `files` allow-list are — empirically — exactly what pnpm 11.7.0 / the DSH CLI need.
**No `allowBuilds` entry, no profile pre-seeding, no workaround, no patch was required.** A proposed fix
was therefore neither needed nor written.

| run | command form | install | `plugin list` | boot | verdict |
| --- | --- | --- | --- | --- | --- |
| attempt1 | `node apps/cli/lib/bin.js plugin …` | **exit 1 / 33 ms** — `MODULE_NOT_FOUND` | — | — | **driver defect** (see §1.6) |
| attempt2 | same | **exit 0 / 118.8 s** (cold network) | exit 0, plugin listed | booted, mounted | measurement OK, **driver verdict predicate wrong** (expected `401`, actual `303`; see §1.6) |
| **attempt3** | same | **exit 0 / 8.5 s** (warm store) | exit 0, plugin listed | booted, mounted | **PASS** |
| **attempt4** | **`pnpm dsh plugin --profile web add github:ArmourPiercer1/dsh-agent-team`** (literal) | **exit 0 / 5.7 s** | exit 0, plugin listed | booted, mounted | **PASS** |
| attempt5 (control) | `… add <local tarball>` | exit 0 / 2.5 s | exit 0, plugin listed | booted, mounted | **PASS** |

Attempts 3, 4 and 5 produce the **same installed host entry** (`sha256:187bc363dc81…`) — the same value
the 2026-11-13 packaging/tarball lane recorded — so the git path and the tarball path install the same
product bytes, differing only by the packer's manifest rewrite (see §1.5).

**Note on `pnpm dsh` vs the built entry.** `pnpm dsh` in the pristine host checkout runs
`node --import tsx/esm apps/cli/src/bin.ts`; `apps/cli/lib/bin.js` is the built form of the same CLI.
Attempt4 ran the **literal operator command**; attempt3 ran the built entry (the form the packaging kit
uses). Both succeed; the installed tree digests are identical.

### 1.2 Exact transcript (attempt4, the literal command)

```console
$ cd <repo>/tests/deepseek-harness-test-use
$ DSH_HOME=<world>/home pnpm dsh plugin --profile web add github:ArmourPiercer1/dsh-agent-team
dsh: initialized profile web at <world>/home/profiles/web
Progress: resolved 0, reused 1, downloaded 0, added 0
[WARN] Issues with peer dependencies found. Run "pnpm peers check" to list them.
dependencies:
+ dsh-agent-team github:ArmourPiercer1/dsh-agent-team
Packages: +7
Progress: resolved 7, reused 7, downloaded 0, added 7, done
Done in 4.9s using pnpm v11.7.0
[exit 0]
```

(Full captured stdout/stderr, including the pnpm "update available" banner:
`install-from-git/attempt4-pnpm-dsh/install-stdout.txt`.)

`dsh plugin --profile web list` (i.e. `pnpm list` in the profile):

```console
dsh-profile-web <world>/home/profiles/web (PRIVATE)
│
│   dependencies:
└── dsh-agent-team@0.1.6

1 package
[exit 0]
```

Boot (`DSH_HOME=<world>/home node <host>/apps/cli/lib/bin.js web --port 3191 --no-open`), instance log:

```console
[dsh-agent-team] registered 2 bundled team skill(s) from <world>/home/profiles/web/node_modules/dsh-agent-team/.agents/skills (source "dsh-agent-team", provider "dsh-agent-team", rank 550)
dsh web: http://127.0.0.1:3191/?token=<redacted>
[dsh-agent-team] remote mount: MOUNTED channel=/team-remote
```

Gate reads: getter `…?token=…` → **303**, bare origin → **401**, `/team-remote/…` without a token →
**401**, mounted = **true**, skills = **2**. Process torn down by identity (SIGTERM, exit 0).

### 1.3 What the install actually produced

| fact | value | source |
| --- | --- | --- |
| profile dependency spec | `github:ArmourPiercer1/dsh-agent-team` (**no ref, no sha — a moving spec**) | `profile-package.json.md` |
| installed name / version / private | `dsh-agent-team` / `0.1.6` / `true` | `installed-package.json.md` |
| installed `dsh.bundle` | present (`{patch: ./cordis.patch.yml}`) | same |
| installed `bin` | **absent** (discovery is `dsh.bundle` + `exports`, not a bin) | same |
| installed tree | **2 241** entries (files + directories; the digest walks files only), 2 200 of them under `packages/runtime/dist` | `install-facts.json.md` |
| installed tree digest | `sha256:fc4f2f1a25d0f1cd1a31ff238dae82748f8926250ff570817308dad071b9c067` | same |
| installed host entry | `packages/runtime/dist/packages/runtime/src/plugin/host.js`, `sha256:187bc363dc816703a364ad1288dd575135892fb7ad644273a38bba86e7d612b6` | same |
| profile bundles after apply | `["@deepseek-ai/dsh-base","@deepseek-ai/dsh-web-app","dsh-agent-team"]` — the CLI reconciled the bundle row itself | `profile-package.json.md` |
| lockfile | `dev/agent-workflow/evidence/…` world only (gitignored) | — |

### 1.4 Pinning semantics — what the operator actually gets

The lockfile entry, verbatim (attempt4):

```yaml
  dsh-agent-team@https://codeload.github.com/ArmourPiercer1/dsh-agent-team/tar.gz/6361185d878ab2617193d51dd419e6dfe521a2ad:
    resolution: {gitHosted: true, tarball: https://codeload.github.com/ArmourPiercer1/dsh-agent-team/tar.gz/6361185d878ab2617193d51dd419e6dfe521a2ad}
    version: 0.1.6
```

* **The lock pins a commit.** `github:owner/repo` (no `#ref`) resolved the repository's **default
  branch tip** — `master` HEAD at install time, `6361185d8` here (remote HEAD and lock commit matched).
  The resolved artifact is the **codeload tarball of that exact commit**, so the installed bytes are
  immutable *for that lockfile*.
* **The manifest does not pin.** `package.json` keeps `github:ArmourPiercer1/dsh-agent-team` with no
  `#ref`. Delete `pnpm-lock.yaml` (or run a fresh `pnpm add` / `pnpm update`) and the next install
  resolves **then-current** `master` HEAD. **A git dep that tracks `master` is not immutable.**
* **For a pinned install the operator must name a ref**: `github:ArmourPiercer1/dsh-agent-team#v0.1.6`
  (or `#<40-hex-sha>`). The tag ref does not exist yet; this gate cannot create it (§4).
* **Cold vs warm lock bytes differ; commit identity does not.** A cold download wrote an `integrity:
  sha512-…` line into the git resolution; a store-served install wrote the same commit URL without
  `integrity` (lockfile sha256 `65cf801c…` cold vs `2c69efa0…` warm, same commit). Treat the **commit
  URL** as the pin, not the lockfile's exact bytes.
* **Network is required.** A clean machine must reach GitHub (codeload) and the npm registry; this gate
  used the machine-local store only for the worktree's own deps.

### 1.5 Why it works without `allowBuilds` / without a build

Observed, not assumed: the installed package has **no `prepare`/`preinstall`/`install`/`postinstall`
script** (`installedScripts` lists only ordinary scripts such as `build`/`test`, which pnpm never runs on
install). The install-surface artifacts (`packages/runtime/dist`, `packages/client/composition-shim`) are
**committed in git** — the installed host entry hash equals the tarball install's — so a fresh clone
needs no build step. `private: true` only blocks **publishing**, not git installs. The pnpm warning
`Issues with peer dependencies found` is expected (`auto-install-peers=false`; the 18 exact
`@deepseek-ai/dsh*@0.2.0-rc.2` peers are satisfied by the host at runtime) and did not affect boot.

Git install vs tarball install differ in exactly one file: the installed `package.json`, which
`pnpm pack` rewrites (drops `packageManager`, reorders keys). Tree digests therefore differ
(`fc4f2f1a…` git vs `c03362f6…` tarball) while the host entry hash and the installed entry count (2 241 entries on both sides) are equal.

### 1.6 Two driver defects, kept on disk (they are not product failures)

1. **attempt1 — `MODULE_NOT_FOUND`**: a fresh worktree has no `tests/deepseek-harness-test-use`
   (gitignored), so the driver's absolute host-CLI path did not exist. Fixed by falling back to the main
   checkout's pinned runtime (the packaging kit's own convention). No product code involved.
2. **attempt2 — wrong verdict predicate**: the driver required `status === 401` at the **token** URL; the
   host answers `303` there (401 is the *bare origin*). Fixed to accept `303/200` at the token URL and
   require `401` at the bare origin. The attempt2 measurement itself succeeded; its `summary` says FAIL
   because of the predicate, and it is kept unchanged.

Attempts 1–2 are retained because deleting a failed instrument run is how a gate starts lying. The tool
that produced all five runs is committed: [`install-from-git.mjs`](./install-from-git.mjs).

---

## 2. Version / identity gate — **GREEN**, with one red static check

All commands run in this worktree at `6361185d8`; outputs recorded verbatim.

### 2.1 Manifests

`node -e '…read package.json + packages/*/package.json…'` (census over `packages/*`, the same set
`pnpm-workspace.yaml` globs):

| manifest | name | version | `private` | `bin` | `dsh.bundle` |
| --- | --- | --- | --- | --- | --- |
| `package.json` | `dsh-agent-team` | **0.1.6** | **true** | **absent** | `{patch: ./cordis.patch.yml}` |
| `packages/client` | `@dsh-agent-team/client` | **0.1.6** | true | absent | — |
| `packages/contracts` | `@dsh-agent-team/contracts` | **0.1.6** | true | absent | — |
| `packages/domain` | `@dsh-agent-team/domain` | **0.1.6** | true | absent | — |
| `packages/legacy` | `@dsh-agent-team/legacy` | **0.1.6** | true | absent | — |
| `packages/remote` | `@dsh-agent-team/remote` | **0.1.6** | true | absent | — |
| `packages/runtime` | `@dsh-agent-team/runtime` | **0.1.6** | true | absent | — |
| `packages/storage` | `@dsh-agent-team/storage` | **0.1.6** | true | absent | — |
| `packages/testkit` | `@dsh-agent-team/testkit` | **0.1.6** | true | absent | — |
| `packages/tools` | `@dsh-agent-team/tools` | **0.1.6** | true | absent | — |

**`COUNT=10 MISMATCH=[]`** — root + nine workspace packages, all `0.1.6`, all `private: true`.

**Entry point.** There is **no `bin` field anywhere**. `pnpm dsh plugin add` finds the plugin through
**`dsh.bundle.patch`** (root manifest) plus the `exports` map, and the CLI then writes
`dsh-agent-team` into the profile's `dsh.profile.bundles` (measured in §1.3). A `bin` is neither needed
nor present; the absence is correct for a bundle plugin.

### 2.2 Release-note facts, each as a command

| claim (source) | command | measured output at `6361185d8` |
| --- | --- | --- |
| version `0.1.6` (notes header) | census above | 10/10 `0.1.6`, mismatch `[]` |
| root stays `private: true` (header) | census above | `true` |
| host pin is exact `0.2.0-rc.2` (§1 prerequisite) | `node -p "new Set(Object.values(require('./package.json').peerDependencies))"` | **18 peers, one distinct value: `0.2.0-rc.2`** |
| toolchain pins | `node -p "require('./package.json').packageManager"` / `.engines` | `pnpm@11.7.0` / `node ^22.19.0 \|\| >=24.0.0` |
| distribution = tag + GitHub Release + tarball, no npm (header) | `git tag --list \| grep 0.1.6` · `git ls-remote --tags origin \| grep 0.1.6` · `gh release list` · `npm view dsh-agent-team version` | **no local tag, no remote tag, no release, npm `404`** |
| "prebuilt install-surface artifacts are committed" (§2 of `docs/INSTALL.md`) | `node scripts/check-artifacts-committed.mjs` | **`verdict=ok compared=2088 glue=113`**, exit 0 |
| committed artifact volume | `git ls-files packages/runtime/dist \| wc -l` · `…/packages/client/composition-shim` | **2 085** · **3** |
| tarball identity (this tree) | `pnpm pack --pack-destination …` | see §4.1 |
| install-manifest graph | `node scripts/check-install-manifest.mjs` | **`FAIL … 14 issue(s) over 581 graph visit(s); lock leg: PASS`**, exit 1 — see §2.3 |

### 2.3 The one red static check (disclosed, not hidden)

`node scripts/check-install-manifest.mjs` **fails on this tree** with 14 findings, all of the same
class: `computed new URL()` / `computed import()` targets that the static scanner cannot prove are
install-surface files (`a5sf-web-transport.mjs`, `a5sf-realm-row.mjs`, `web-family/*.mjs`,
`team-services/web.js`). The lock leg passes. **This is not a CI gate** — no workflow runs
`check:install-manifest` (it is only a package script, referenced in `docs/RELEASE.md` §2 as a "healthy"
example), and it is **pre-existing on `master`**, not introduced here. It is recorded because
`docs/RELEASE.md` §2's healthy-output sentence is **not true on this tree**. It does not change the
§1 verdict (the install boots and mounts), but the release must not claim the install-manifest graph is
clean.

---

## 3. Essential capability smoke — one run each, `DEV-LIVE`

No new audits, no second world (two-run agreement is explicitly **not** claimed here — `n=1` each).
Ports from the sanctioned test bands; `:3080` probed read-only (`401` before and after each run).

### 3.1 A1 bash governance, **A6-off** — 7/7 PASS

```bash
node tests/kits/a1-bash-governance-20261112/a1-bash-governance.mjs \
  --worktree "$PWD" --testuse <main>/tests/deepseek-harness-test-use \
  --host-port 3187 --mock-port 3496 \
  --evidence-dir "$PWD/dev/agent-workflow/evidence/v016-release-gate-20261114/a1-a6off-run1" \
  --a6-off
```

`VERDICT PASS` — **A1-1…A1-7 all PASS**, `mode: a6-off (alpha6ReviewRouting: false)`, plane takeover
mounted, host default `danger-full-access`, OS backend **`full`** (`usable=true`), 7/7 clauses read from
the OS and the durable ledger:
`A1-1` write inside allowed; `A1-2` outside refused with `Read-only file system`, 0 bytes, `ENOENT`;
`A1-3` `cd`+`export` persisted; `A1-4` second Member isolated (new PTY fd, own cwd, no export);
`A1-5` 3 typed pre-PTY refusals, PTY fds and model turns unchanged; `A1-6` root write landed while the
Member write stayed absent; `A1-7` deny ⇒ `executions=0 consumptions=0` and no bytes.
Arms table: `a1-a6off-run1/a1-arms.md`.

### 3.2 Joint acceptance (`memberIoCeilings` + `reviewRouting` on one v5 Team) — 11/11 PASS

```bash
node tests/kits/joint-acceptance-20261111/run-joint-acceptance.mjs \
  --worktree "$PWD" --testuse <main>/tests/deepseek-harness-test-use \
  --host-port 3188 --mock-port 3497 \
  --evidence-dir "$PWD/dev/agent-workflow/evidence/v016-release-gate-20261114/joint-run1"
```

**J01–J11 all PASS** on this tree (`J01` v5 both families admitted, `blueprintHash sha256:0785409b…`;
`J02` allow fact, `J03` typed deny/0 bytes; `J04` pinned native bash executed, `realmTerminalFacts=0`
disclosed; `J05` one consumption/one execution; `J06` Officer routing with identity carried; `J07` Goal
2 rounds then Stop → durable `paused`; `J08` relay refused `GOAL_TOOL_AUTHORITY_REQUIRED`; `J09` Sticky
Stop marker + no wake; `J10` SIGKILL/cold-boot, no duplicate/no replay, both legs `unknown`; `J11`
one-shot). Arms table: `joint-run1/joint-arms.md`.

### 3.3 Packaging kit — **not run** (cost, disclosed)

The `packaging-v016` driver (rebuild + two packs + live instrument + upgrade/rollback) is not cheap and
would have to re-run a full `pnpm -r build`. It was **not** re-run on this tree; the 2026-11-12/13 lane's
`33/33 + 39/39` results stand for tree `22682f336`, not for `6361185d8`. What was run instead on this
tree, cheaply: `pnpm pack` twice + install + boot (§1.5, §4.1). That covers the *artifact* half of the
packaging claim; it does not cover the *live Team→Member→Goal→Stop* arm of that kit.

---

## 4. Release mechanics rehearsal — **UNRUN**, commands only

**Nothing in this section was executed.** No tag, no release, no push, no publish. The tarball in §4.1
exists only as a local, gitignored scratch artifact used to record identity; it is **not** uploaded.

### 4.1 Tarball identity for this tree (measured)

```bash
cd <worktree> && mkdir -p .artifacts/tmp/pack-gate
pnpm pack --pack-destination "$PWD/.artifacts/tmp/pack-gate"
```

| field | value |
| --- | --- |
| file | `dsh-agent-team-0.1.6.tgz` |
| **sha256** | **`9109bce8bc8f99673ecea05149eeb9556a32b636db4ebe8f7a6633b094d93114`** |
| bytes | `4 409 310` |
| tar members | `2 113` |
| internal version / `private` | `0.1.6` / **`true`** |
| packed from | `6361185d8` (product surface clean at pack time) |
| reproducibility | a second pack in the same tree is **byte-identical** (`cmp` exit 0, same sha256) |

**Release-time caveat:** if any commit lands on `master` after this gate, **this sha256 is void** — re-pack
on the final commit and re-record it. The release notes must carry the sha256 of the **actually attached**
asset, not this one.

### 4.2 Creating the annotated tag (on the final master commit)

```bash
# 0. preconditions — all must hold, or stop
git -C <repo> fetch origin
git -C <repo> rev-parse origin/master                    # FINAL_SHA (must be clean, required CI green)
git -C <repo> status --porcelain                         # empty
node scripts/lint-identities.mjs                         # exit 0
git -C <repo> diff --check                               # exit 0
pnpm check:artifacts:head                                # verdict=ok (commit carries its own build)
# (optional, disclosed red: node scripts/check-install-manifest.mjs exits 1 — §2.3)

# 1. annotated tag on the final master commit — NEVER moved afterwards
git -C <repo> tag -a v0.1.6 "$FINAL_SHA" \
  -m "v0.1.6 — internal trial build (not productised; no upgrade protocol; Alpha.6 experimental)"
git -C <repo> cat-file -t v0.1.6                         # must print: tag
git -C <repo> rev-parse 'v0.1.6^{commit}'                # must equal $FINAL_SHA

# 2. push the tag only (never force; never rewrite)
git -C <repo> push origin refs/tags/v0.1.6
git -C <repo> ls-remote --tags origin 'refs/tags/v0.1.6*'  # tag + ^{} peel both = $FINAL_SHA
```

**Tag-name uncertainty (must be settled before step 1):** `docs/plans/active/alpha5-sandbox-first/
RELEASE-NOTES-0.1.6.md` says `v0.1.6`; the repository's only version-shaped release tag is **`0.1.0-rc.1`
(unprefixed, annotated — `git cat-file -t` = `tag`)**; the other four tags are lane/history tags. Pick one convention and use the *same* string in the install ref (§4.3). This gate does
not choose it.

### 4.3 Creating the GitHub Release with the tarball attached

```bash
FINAL_SHA=$(git -C <repo> rev-parse origin/master)
pnpm pack --pack-destination <repo>/.artifacts/tmp/release   # on $FINAL_SHA, clean tree
TARBALL=<repo>/.artifacts/tmp/release/dsh-agent-team-0.1.6.tgz
sha256sum "$TARBALL"                                     # record it; paste into the release notes body

gh release create v0.1.6 \
  --title "dsh-agent-team v0.1.6 — INTERNAL TRIAL BUILD (not a product release)" \
  --notes-file docs/plans/active/alpha5-sandbox-first/RELEASE-NOTES-0.1.6.md \
  --verify-tag \
  "$TARBALL#dsh-agent-team-0.1.6.tgz"

gh release view v0.1.6 --json tagName,isDraft,assets \
  # expect: tagName v0.1.6, isDraft false, exactly one asset dsh-agent-team-0.1.6.tgz
```

The attached asset is the **same bytes** whose sha256 is in the notes; verify after upload:

```bash
gh release download v0.1.6 --pattern 'dsh-agent-team-0.1.6.tgz' --dir .artifacts/tmp/verify
sha256sum .artifacts/tmp/verify/dsh-agent-team-0.1.6.tgz   # must equal $TARBALL's sha256
```

### 4.4 Post-release verification (clean profile, real install, real boot)

Run exactly this on a clean machine/profile **after** the release exists. It is the §1 measurement
repeated against the tag, with the tag named so the install is pinned:

```bash
# fresh throwaway DSH_HOME inside a session workspace (never ~/.dsh, never :3080)
export DSH_HOME=<workspace>/tests/homes/v016-release-verify/home

# 1. the acceptance command, PINNED to the tag (no ref = master HEAD, which can move)
pnpm dsh plugin --profile web add github:ArmourPiercer1/dsh-agent-team#v0.1.6

# 2. the plugin is there, at the right version
pnpm dsh plugin --profile web list                       # expect: dsh-agent-team@0.1.6

# 3. the lock pins the tag's commit (not a branch)
grep -n 'dsh-agent-team@' "$DSH_HOME/profiles/web/pnpm-lock.yaml"
# expect: …/tar.gz/<FINAL_SHA> …   and <FINAL_SHA> == git rev-parse 'v0.1.6^{commit}'

# 4. it boots and the plugin mounts
node <host>/apps/cli/lib/bin.js web --port <3181-3199|13000-13049> --no-open
# expect in the log: "[dsh-agent-team] remote mount: MOUNTED channel=/team-remote"
# then: token URL → 303, bare origin → 401
```

### 4.5 What the release notes **must** say (internal trial build)

1. **It is an internal trial build, not a product release.** Not productised; no support commitment
   beyond the Alpha.5 stable rows (S1–S4) as written; the Alpha.6 plane is **opt-in experimental,
   default OFF**.
2. **No upgrade protocol.** No version negotiation, no data migration, no compatibility contract, no
   `rollback` command. "Rollback" = re-installing a previous artifact; `0.1.5 → 0.1.6` was **never
   measured**.
3. **No npm publish.** Distribution is the annotated tag + this GitHub Release + the attached tarball;
   the package is `private: true` and `npm view` is 404.
4. **Alpha.6 is experimental** and PD-40 (Sticky Stop is latch-scoped, not session-scoped), PD-39 Gap 2
   (terminal abandonment + re-issue), PD-43 and **PD-44** (a new governed ask after a cold boot is not
   woken — this tree's HEAD) remain disclosed limits.
5. **The install ref matters.** `github:ArmourPiercer1/dsh-agent-team` without a ref installs the
   **default-branch tip at install time**, which is mutable; the release must tell operators to pin
   `#v0.1.6` (or the sha) when they need immutability, and must state that the tag ref is the immutable
   one.
6. **The asset sha256** of the attached tarball, and that a **re-pack of a different commit yields a
   different sha256**.
7. **What this build does not claim** (§5 below), including "no `CANDIDATE-C2` claim" — both C2 records
   for `cand-v0.1.6-4` return `candidateClaimEligibility.eligible: false` (V016-RC1-GO-NO-GO §3/§5).

### 4.6 If the release is wrong

**Do not move or delete the tag** (repo rule: a tag never moves). Publish a new version (`v0.1.7` or a
new patch) with a corrected artifact and a dated erratum in the notes. Roll back the GitHub Release only
by marking it superseded; the tag stays as history. Code rollback on `master` remains `git revert`
through a PR — never a force-push.

---

## 5. What this release still cannot claim — blunt list

1. **Candidate-level eligibility.** Both C2 records on `cand-v0.1.6-4` return `eligible: false`; C2-B's
   verdict is `NOT PASS`. The owner's "internal trial build" ruling overrides the recommendation, but the
   release must not present itself as a C2-adjudicated RC.
2. **Immutable install by default.** The acceptance command (no ref) installs `master` HEAD at that
   moment. The tag is immutable; the default command is not. (§1.4)
3. **Any upgrade protocol**, and specifically `0.1.5 → 0.1.6` — never measured.
4. **A clean install-manifest graph.** `check-install-manifest` exits 1 with 14 dynamic-target findings
   (§2.3); pre-existing, not CI-gated, still red.
5. **The packaging kit's live arm on this tree.** Only the artifact half (pack → install → boot) was
   re-measured here; `33/33 + 39/39` belongs to `22682f336`, not `6361185d8` (§3.3).
6. **Two-run agreement / stability.** A1 and joint were run **once each** here (`n=1`). Agreement pairs
   exist in the 2026-11-13/16 evidence for other trees; this gate claims existence on this tree only.
7. **Rates, real vendor models, OS-level network isolation.** Mock oracle; `osLevelNetworkIsolationClaimed:
   false`; `n=2` would still not be a rate.
8. **Portability.** One machine class, one OS/arch, one host pin. No second-machine install.
9. **npm distribution / provenance / signatures / SBOM.** None; npm 404 by design.
10. **Package acceptance of the shipped tarball's Team→Member→Goal→Stop path on this exact tree** (see 5).
11. **A release that exists.** This document rehearses; it does not execute. The tag name is also
    undecided (§4.2).
12. **`Goal ∧ plane-takeover ∧ A6-off` and PD-42's approved-`bash`-out-of-lane conjunction** — the
    RC1 document records these as refused/unmeasured; the 2026-11-17 append (NC5/NC7) claims they were
    later measured, but that evidence is dated **after** this gate's tree and is not re-verified here.
13. **Doc/clock coherence.** Master carries appends dated 2026-11-16/17 while real UTC is 2026-11-13;
    any release-note date must use one calendar explicitly.

---

## 6. Gates, disclosures, evidence index

| gate | result |
| --- | --- |
| `node scripts/lint-identities.mjs` | **clean**, exit 0 — 162 identity lines, 76 distinct; 1 649 files linted |
| `git diff --check` | **clean**, exit 0 (scoped `.gitattributes`: `-blank-at-eof` for this directory, `-trailing-space` for `*.log` only; measured bytes not rewritten — same disclosure as the 2026-11-13 dry-run) |
| `node scripts/check-artifacts-committed.mjs` | `verdict=ok compared=2088 glue=113`, exit 0 |
| `node scripts/check-install-manifest.mjs` | **exit 1, 14 findings** — disclosed, pre-existing, not a CI gate (§2.3) |
| committed evidence JSON | **0 new `.json`** — every measurement JSON is committed as `*.json.md` (fenced) so the 5 994/6 000 evidence-`.json` budget is untouched |

**Disclosures.**
1. Two driver defects are retained rather than deleted (attempt1 `MODULE_NOT_FOUND`, attempt2 wrong
   verdict predicate); the product was not at fault in either (§1.6).
2. The committed copies of measurement JSON are `.json.md`, not `.json` (budget). A re-run of
   `install-from-git.mjs` writes `.json`; the conversion is ```` ```json ````-fencing, content unchanged.
3. The A1/joint kits are frozen instruments and were **not** edited. Their raw per-arm JSON is committed
   as `.json.md`; their `.md` arm tables are the readable verdict surface.
4. `:3080` was probed read-only (`401`) before and after every live run and was never started, stopped or
   written. `~/.dsh` was never written (the sandbox denies it; one early `--help` probe attempted a lock
   file and was refused with `EROFS` — no state change).
5. Throwaway worlds (`tests/homes/v016-install-from-git-*`, `pnpm-dsh-probe`) were deleted by verified
   absolute path; no world remains.
6. The pristine host checkout stayed at `639ed01539` with empty `git status --porcelain` before and after.
7. This gate writes no product file; `CORE PATCH BUDGET = 0`; no tag/release/publish/merge.

### Evidence index

| path | contents |
| --- | --- |
| `install-from-git.mjs` | the driver that produced §1 (both entry paths, `--via-pnpm-dsh`, `--keep`) |
| `install-from-git/attempt1…attempt5-*/` | per-run `driver.log`, `install-stdout.txt`, `plugin-list.txt`, `instance.log`, `identity`, `install-facts`, `profile-package`, `installed-package`, `boot`, `summary` |
| `a1-a6off-run1/` | A1 A6-off single run: `a1-arms.md`, `a1-verdicts.json.md`, ledger, blueprint, composition, boot preflight, `driver.log` |
| `joint-run1/` | joint single run: `joint-arms.md`, `joint-verdicts.json.md`, blueprint, guard facts, per-arm facts, `instance.log` |
| `dev/agent-workflow/evidence/…/.gitattributes` | scoped whitespace rules for the committed logs |

**Class statement.** `DEV-LIVE`. Not `CANDIDATE-C2`; no `V@B`; no matrix grade. The install verdict is
about **this tree, this host pin, this machine**. It is the strongest available evidence for the owner's
one hard acceptance, and it is exactly what it says — nothing more.
