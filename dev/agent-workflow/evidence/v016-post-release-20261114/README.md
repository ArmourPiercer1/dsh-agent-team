# v0.1.6 — post-release verification (DEV-LIVE, throwaway world)

**Date (real UTC):** 2026-11-13T18:17Z … 18:24Z (`date -u` on the executing host; the directory name keeps the
session-calendar label `20261114`).
**Class:** `DEV-LIVE`. **Not** `CANDIDATE-C2`, not a `V@B` cell, not a matrix grade, not a release verdict.
**Scope:** verification only. Nothing here tags, re-releases, edits the release, publishes, moves
`origin/master`, moves a candidate ref, touches the Authority pointer, Required CI, `:3080`, or its DSH_HOME.

This record answers five questions about the published `v0.1.6`:

1. does the pinned install in the release notes work, and does it pin the commit?
2. do the tag, the GitHub Release, and the attached artifact name **one** commit/bytes?
3. what does the ref-less (moving) form resolve to, and is that equality a guarantee?
4. does the installed artifact still do the governed-`bash` thing the notes describe, with Alpha.6 off?
5. does the release claim an upgrade protocol, and does anything contradict the rollback sentence?

The short answers: **yes**, **yes**, **same commit today — and not a guarantee**, **yes on the released
tree / not re-exercised end-to-end on the installed profile (stated in §5)**, **no upgrade protocol / no
contradiction found**.

---

## 0. Identity pins (read, not asserted)

| fact | value | how it was read |
| --- | --- | --- |
| annotated tag object | `0a6e2519a8d0e74072acb655f396933359120187` | `git rev-parse v0.1.6`; `git cat-file -t v0.1.6` = `tag` |
| tag peel (commit) | `3a7303ca215d8544eb3f35c2785161a7bce7f85a` | `git rev-parse 'v0.1.6^{commit}'` |
| remote tag | `refs/tags/v0.1.6` → `0a6e2519a8d0…`; `^{}` → `3a7303ca2…` | `git ls-remote origin 'refs/tags/v0.1.6*'` (2026-11-13T18:1xZ) |
| tag message install line | `Install pinned: pnpm dsh plugin --profile web add github:ArmourPiercer1/dsh-agent-team#v0.1.6` | `git cat-file -p v0.1.6` |
| tagger date | `1794593459 +0800` = 2026-11-13T17:59:08Z | same |
| GitHub Release | tag `v0.1.6`, `draft:false`, `prerelease:false`, published `2026-11-13T18:10:22Z` | `gh api repos/…/releases/tags/v0.1.6` |
| asset | `dsh-agent-team-0.1.6.tgz`, **4 412 310 bytes**, created `2026-11-13T18:10:20Z`, state `uploaded` | same |
| asset digest (GitHub's own field) | `sha256:6740c8a27d1eb05699dcce43377bba84fa90b1ec2b5ca6e787a2a1d7e8c7fdb7` | same |
| release body | held verbatim in [`release/github-release-body-2026-11-13.txt`](./release/github-release-body-2026-11-13.txt); **no copy exists in the tag tree** | `gh release view v0.1.6 --json body` |

The measurement worktree is `.worktrees/v016-post-release-20261114` on `task/v016-post-release-20261114`,
created from `origin/master` = `3a7303ca2…` (i.e. the released commit; the branch starts there).

---

## 1. The tag, the release and the artifact are one commit and one byte string

**Expected asset sha256 (given in the brief): `6740c8a2…fdb7`.** Measured, not assumed:

| measurement | sha256 | bytes |
| --- | --- | --- |
| release asset, downloaded with `gh release download v0.1.6` | `6740c8a27d1eb05699dcce43377bba84fa90b1ec2b5ca6e787a2a1d7e8c7fdb7` | 4 412 310 |
| GitHub API `assets[].digest` for the same asset | `sha256:6740c8a27d…fdb7` | 4 412 310 |
| fresh `pnpm pack` in `.worktrees/v016-release-gate` @ `3a7303ca2` (`git status --porcelain` empty, `git describe --tags --exact-match` = `v0.1.6`) | `6740c8a27d1eb05699dcce43377bba84fa90b1ec2b5ca6e787a2a1d7e8c7fdb7` | 4 412 310 |

**Verdict: CONFIRMED.** Download and fresh pack are byte-identical (`cmp`-equal by hash and size), and
GitHub's own recorded digest agrees. The tag object is annotated and peels to exactly the commit the pack
was taken from. The three identities — tag, release asset, packed bytes — are one commit and one artifact.

The tax: `pnpm pack` writes a tarball whose bytes depend on the tree, and the tree is
`3a7303ca215d8544eb3f35c2785161a7bce7f85a` — a release tag that is annotated and must never move. Nothing
in this record writes to the tag or the release.

---

## 2. The pinned install the release notes tell operators to use — works, and pins the commit

### 2.1 The exact command (verbatim)

```bash
pnpm dsh plugin --profile web add github:ArmourPiercer1/dsh-agent-team#v0.1.6
```

Run **verbatim** against a **fresh throwaway `DSH_HOME`** (created for this record, workspace-local and
gitignored, torn down below):

* `DSH_HOME` = `.worktrees/v016-post-release-20261114/tests/homes/v016post-20261114-pinned` (gitignored via
  `tests/homes/`)
* cwd = `/home/armourpiercer/projects/dsh-agent-team` so that `pnpm dsh` resolves the pinned host CLI
  (`dsh --version` = `0.2.0-rc.2`, the pin from `tests/paths.mjs`); the profile and the plugin live entirely
  inside the throwaway home.
* transcript: [`install/pinned-install.log`](./install/pinned-install.log) (**exit 0**, finished
  2026-11-13T18:23:28Z, 14.5 s).

**Disclosed environment deviation (first attempt, exit 1).** Before the recorded run, the same command was
run once with pnpm's default store and failed with
`[ERR_SQLITE_ERROR] unable to open database file` (the pnpm store index lies outside this session's
writable workspace). The recorded run sets `npm_config_store_dir`, `npm_config_cache`, `XDG_DATA_HOME` and
`XDG_CACHE_HOME` **inside the throwaway home**; the plugin command itself is unchanged. This is a
sandbox-store constraint of this host, not a release finding; an operator with a writable store does not
need those variables.

### 2.2 Resolved spec and lockfile entry — the commit is pinned

[`install/lock-entries.txt`](./install/lock-entries.txt) records the profile `package.json` and the
lockfile rows verbatim. The decisive rows:

```yaml
# profiles/web/package.json
"dependencies": { "dsh-agent-team": "github:ArmourPiercer1/dsh-agent-team#v0.1.6" }

# profiles/web/pnpm-lock.yaml
      dsh-agent-team:
        specifier: github:ArmourPiercer1/dsh-agent-team#v0.1.6
        version: https://codeload.github.com/ArmourPiercer1/dsh-agent-team/tar.gz/3a7303ca215d8544eb3f35c2785161a7bce7f85a

  dsh-agent-team@https://codeload.github.com/ArmourPiercer1/dsh-agent-team/tar.gz/3a7303ca215d8544eb3f35c2785161a7bce7f85a:
    resolution: {gitHosted: true, integrity: sha512-CuT1eQZpOZVRwStz5dphHOYSO8EmUiARKCsFmEwE9WYN39+caXX5Q3ziY6Qtl6WDme9QNQrOxd6bmYm7mxE/Qg==, tarball: …/tar.gz/3a7303ca2…}
    version: 0.1.6
```

**Does it pin `3a7303ca2`? Yes, by content address.** The lock's `version` is the codeload tarball URL for
exactly `3a7303ca215d8544eb3f35c2785161a7bce7f85a`, and the `integrity` is recorded beside it. The
specifier stays the tag form (`#v0.1.6`), and the tag peel is that same commit (§0/§1). A later move of
`master` cannot change what this lock resolves to.

### 2.3 `dsh plugin --profile web list`

```text
Legend: production dependency, optional only, dev only

dsh-profile-web …/tests/homes/v016post-20261114-pinned/profiles/web (PRIVATE)
│
│   dependencies:
└── dsh-agent-team@0.1.6

1 package
```

(full output: [`install/pinned-list.log`](./install/pinned-list.log); exit 0.)

### 2.4 Boot: the plugin registers and the `/team-remote` mount exists

Instrument: [`smoke/boot-installed.mjs`](./smoke/boot-installed.mjs) — real `dsh web` (host
`apps/cli/lib/bin.js` @ `639ed01539`, the pin) against the pinned `DSH_HOME`, then the **public** HTTP
surface the GUI uses. Port `3191` (sanctioned test band); loopback only; `:3080` never contacted.

Boot log ([`smoke/boot-instance.log`](./smoke/boot-instance.log)):

```text
[dsh-agent-team] registered 2 bundled team skill(s) from …/profiles/web/node_modules/dsh-agent-team/.agents/skills …
dsh web: http://127.0.0.1:3191/?token=…
[dsh-agent-team] remote mount: MOUNTED channel=/team-remote
```

Over HTTP ([`smoke/boot-summary.json.md`](./smoke/boot-summary.json.md)):

| check | result |
| --- | --- |
| `POST /team-remote/team.getProjection` (route exists) | **HTTP 200**, `type:"server-response"`; during start-up it answers the typed `runtime-not-ready` error — i.e. the channel is **registered**, not a 404/405 static fallback |
| same call after the runtime leaves `starting` | **HTTP 200, `result.ok = true`**; Team projection folded |
| `POST /team-remote/team.listRoots` (v3) | **HTTP 200**, one root: `teamSessionId:"team-root"`, `blueprintId:"my-team-bp-1"`, `createdAt:"2026-11-13T18:22:13.846Z"`, `generation:2` |
| Team projection | `schemaVersion:2`, `generation:2`, root `admission:"OPEN"`, one `leader` template + one `worker` template, one live member `inst-leader` (`lifecycle:"RUNNING"`) |

So the installed bundle registers its two team skills, mounts `/team-remote`, and, on a stock profile
(`bootPhase: create-or-open`, no `blueprintSource` override), mints **one durable Team** from the bundle's
own default design. The blueprint is visible in the projection with its own content hash
(`sha256:9ee498574d6651ab131a87b50fd435993fc7647252466da1608f7d542384152f`).

### 2.5 Installed tree digest

Computed over the installed package directory `profiles/web/node_modules/dsh-agent-team`
(`find . -type f | sort | xargs sha256sum | sha256sum`):

| field | value |
| --- | --- |
| **installed tree digest** | **`46753e13b94a888d672a0a10c9b8717f347d2c7ffbea1eb71060c6c9d894b583`** |
| files | 2 113 |
| bytes | 16 847 896 |

Cross-check against the released checkout: for **all 2 113** files, `sha256sum -c` run from
`.worktrees/v016-release-gate` (tag `v0.1.6` @ `3a7303ca2`) reported **0 mismatches**: every installed
file exists at the same relative path in the tagged tree with the same bytes. The installed tree is the
tag tree's package surface, not a rebuild with different content.

---

## 3. Negative control: the ref-less install, and why today's equality is not a guarantee

One install of the moving form, same host, fresh throwaway home
(`tests/homes/v016post-20261114-refless`), registered before and after the command. Transcript:
[`install/refless-install.log`](./install/refless-install.log).

```bash
pnpm dsh plugin --profile web add github:ArmourPiercer1/dsh-agent-team
```

| fact | value |
| --- | --- |
| install exit | **0** (2026-11-13T18:19:39Z → 18:20:03Z) |
| manifest dependency written | `"dsh-agent-team": "github:ArmourPiercer1/dsh-agent-team"` — **no ref** |
| lock `specifier` | `github:ArmourPiercer1/dsh-agent-team` — still no ref |
| lock `version` | `https://codeload.github.com/…/tar.gz/3a7303ca215d8544eb3f35c2785161a7bce7f85a` |
| `git ls-remote origin HEAD` **before** the install | `3a7303ca215d8544eb3f35c2785161a7bce7f85a` |
| `git ls-remote origin HEAD` **after** the install | `3a7303ca215d8544eb3f35c2785161a7bce7f85a` |

**Finding: the ref-less install resolves to the default-branch tip, and that tip is currently
`3a7303ca2…` — i.e. right now the moving form happens to equal the released commit.** The lock entry is
byte-for-byte the same resolved tarball URL and the same integrity as the pinned install
([`install/lock-entries.txt`](./install/lock-entries.txt) shows both side by side).

**Why that equality is not a guarantee.** The ref-less dependency is a *moving* spec in the manifest:
`github:ArmourPiercer1/dsh-agent-team`. Only the lockfile pins the commit. A fresh resolve (deleted
`pnpm-lock.yaml`, `pnpm update`, a new machine/world) follows whatever `master` then points at; the
manifest still says nothing about a commit. Today `origin/master == tag peel` because `master` had not
advanced past the release commit at measurement time — that is a coincidence of *when* the control ran,
not a property of the command. Any push to `master` breaks it, and nothing in this install would notice.
The tag form is stable because an annotated tag must never move; the ref-less form is stable only until
`master` does.

---

## 4. Rollback / upgrade-protocol statement check

Question: does the release claim an upgrade protocol, and is "rollback = install a new version, never move
the tag" the only supported statement?

**The release makes no upgrade-protocol claim.** In the GitHub Release body
([verbatim copy](./release/github-release-body-2026-11-13.txt)):

> 4. No upgrade protocol; rollback means installing a new version, never moving a tag. No npm publish, no
>    provenance, no signed artifact. Linux only (landlock); no second machine class was measured.

**The repository release notes say the same thing, as a refusal** — NC4 in
`docs/plans/active/alpha5-sandbox-first/RELEASE-NOTES-0.1.6.md` §11.4 (present at the tag):

> | **NC4** | **Any upgrade protocol** | None exists: no version negotiation, no data migration, no
> compatibility contract. Rollback is **re-installing the previous tarball** (byte-exact swap measured);
> the `0.1.5 → 0.1.6` path was **never measured**. |

**`docs/RELEASE.md` does not contradict it.** It is a generic release-line page, not the v0.1.6 operator
page (it still describes the `0.1.0-rc.1` anchor and says the Alpha.5 release is `BLOCKED`). Its §4
"Rollback and roll-forward" is about **repository** objects: code via `git revert` (never force-push),
Authority via `git revert` of the switch commit set, durable data not guaranteed to downgrade, and "a
release never touches port 3080, `~/.dsh`, or a human DSH_HOME". It states no operator upgrade protocol
and repeats the tag law: *"Forbidden, always: moving or force-pushing a tag or gated history"*. So it
agrees with — and adds nothing contrary to — the release's sentence.

**Nuance, recorded rather than smoothed over:** `docs/RELEASE.md` §4 says a future release that changes a
durable shape "must ship a roll-forward or migration note". That is an obligation on a *future* release's
documentation, not a protocol claim for v0.1.6, and it is consistent with "rollback = install a new
version" being the only supported statement *for this release*. The release notes' own stronger statement
(`0.1.5 → 0.1.6` never measured) bounds the claim correctly.

**Verdict: CONFIRMED** — no upgrade protocol is claimed; "install a new version, never move the tag" is the
only supported rollback statement; no contradiction found in the release body, the tag's release notes, or
`docs/RELEASE.md`.

---

## 5. Capability smoke — what was run, and what was *not* run

### 5.1 Installed tree: Team + mount + plugin registration (measured)

§2.4 is the installed-tree boot: plugin registered, `/team-remote` mounted, and **one Team created
durably** (`team-root`, `my-team-bp-1`, `generation:2`, leader member `RUNNING`). The installed profile
carries **no `alpha6ReviewRouting`** (it is absent from the shipped row config and from the profile patch;
the product treats absent as OFF), so this boot is Alpha.6-off by default.

**This boot did not exercise a Member's governed `bash` call**, because that needs an operator config
(`blueprintDir`/`blueprintSource`/`teamToolPlane`/model route) and a scripted model turn — that is the
next section's instrument.

### 5.2 Governed `bash` in A6-off: the frozen A1 kit, on the released commit (measured)

The frozen kit is `tests/kits/a1-bash-governance-20261112/a1-bash-governance.mjs` with `--a6-off` (the
exact instrument and flag the repository's own A6-off record uses). Run:

```bash
node tests/kits/a1-bash-governance-20261112/a1-bash-governance.mjs \
  --worktree .worktrees/v016-release-gate \
  --testuse tests/deepseek-harness-test-use \
  --host-port 3192 --mock-port 13050 \
  --evidence-dir dev/agent-workflow/evidence/v016-post-release-20261114/a6off-a1 \
  --a6-off
```

Result: **exit 0, `VERDICT PASS`, 7/7 clauses PASS**, 2026-11-13T18:19:17Z → 18:19:51Z
([`a6off-a1/run.log`](./a6off-a1/run.log), [`a6off-a1/a1-arms.md`](./a6off-a1/a1-arms.md),
[`a6off-a1/a1-verdicts.json.md`](./a6off-a1/a1-verdicts.json.md)):

| clause | verdict | what it measured |
| --- | --- | --- |
| A1-1 write inside the Member root | PASS | bytes on disk, read back, 40 B, tool saw exit 0 |
| A1-2 write outside the Member ceiling | PASS | **OS-sandbox refusal** (`Read-only file system`), 0 bytes on disk |
| A1-3 same Member across calls | PASS | `cd` + `export` persist; previous pid/PTY |
| A1-4 second Member | PASS | own PTY/shell pid, no inherited cwd/export |
| A1-5 wrong/prefixed session id | PASS | refused **before** a PTY exists (no new PTY fd, no turn) |
| A1-6 Host default = `danger-full-access` | PASS | root writes; the same out-of-ceiling Member write is still refused (narrowed, not inherited) |
| A1-7 approval denied | PASS | 0 executions, 0 consumptions, 0 bytes; tool refusal observed |

Composition facts recorded by the kit: `alpha6ReviewRouting: false`, review-routing blocks inert, approval
path = the legacy Leader notification path, governed realm on, plane takeover on, pinned native `bash` over
the governed PTY, host default `danger-full-access`, sandbox backend `full`. Tree identity in the record:
`productSha = 3a7303ca2…`, `masterTipAtRun = 3a7303ca2…`.

**Does this behave as the release notes say?** For the seven propositions above, yes: under A6-off the
Member's `bash` is bounded by the OS/Member ceiling (A1-2/A1-6), state is per-Member (A1-3/A1-4),
pre-creation refusals happen (A1-5), and a denied approval executes nothing (A1-7). This is a
**negative-control** measurement, not the release's full claim set; it says nothing about Goal ∧ plane
takeover ∧ A6-off (the notes' NC7), rates, or a real vendor model.

### 5.3 The disclosed limit of §5.2

The A1 kit mounts the plugin from **the checkout's committed dist**, not from
`profiles/web/node_modules/dsh-agent-team` (it needs repo-only paths such as
`packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py` and the p6t6 harness plugin). It is
therefore **not** an end-to-end "installed package runs governed bash" boot. What closes most of that gap
is measured, not asserted: all **2 113** installed files are byte-identical to the tagged checkout at the
same paths (§2.5), so the code the kit executed is the code the install materialized. What it does **not**
cover: the installed profile's own wiring of the governed preset, the model route, and the mount path
through `node_modules`. **A full installed-tree A6-off governed-bash boot was not run** — declared, not
overstated. The cheaper installed-tree boot (§5.1) plus the byte-identity check is what this record offers.

### 5.4 Instrument note (disclosed, not a product claim)

A first boot of the same home was torn down while the bootstrap was still writing its binding; the log
recorded `[dsh-agent-team] bootstrap FAILED: TeamDomainError: … 'session_bindings' … the TeamDomain is
closed` ([`smoke/boot-instance-2026-11-13T18-21-run.log`](./smoke/boot-instance-2026-11-13T18-21-run.log)).
That teardown was caused by this instrument (its readiness loop accepted a `malformed-params` answer and
proceeded to SIGTERM). The fresh-world boot afterwards (§2.4) completed with no such line, created the Team
and answered `ok:true`. It is logged here for honesty; it is **not** claimed as a release defect and **not**
claimed as a cold-recovery result either way.

---

## 6. Gates

* `pnpm lint:identities` — see the PR body / commit note for the recorded run.
* `git diff --check` — same.
* Committed evidence `.json` count: **0** — every JSON artifact in this directory is stored as
  `*.json.md` (the budget is 5 995/6 000 committed evidence JSON files).

---

## 7. Uncertainties and limits (complete list)

1. **Store workaround.** The first pinned install failed on pnpm's default SQLite store
   (`[ERR_SQLITE_ERROR] unable to open database file`) because this session may not write outside the
   workspace; the recorded run redirects the store/cache into the throwaway home. The plugin command is
   unchanged, but the exit-0 transcript is from the redirected-store run.
2. **`pnpm dsh` cwd.** The verbatim command was run from the repository root (where `pnpm dsh` resolves the
   pinned `0.2.0-rc.2` host CLI); the installed profile and plugin live entirely in the throwaway
   `DSH_HOME` under `.worktrees/v016-post-release-20261114/tests/homes/`.
3. **No installed-tree governed-bash boot.** §5.2 runs the released code from the checkout; §5.3 states
   exactly what the 2 113-file byte-identity check does and does not close.
4. **The A6-off run is one run (`n=1`).** It is an existence proof on this tree, not a rate or a
   stability claim; the kit's own class is `DEV-LIVE`.
5. **`master == tag` today** is an observation with a timestamp (§3), not a branch invariant.
6. **Instrument-caused bootstrap error** — §5.4, disclosed; no product conclusion drawn.
7. **`docs/RELEASE.md` is stale relative to v0.1.6** (it still anchors on `0.1.0-rc.1` and says Alpha.5
   release is `BLOCKED`). It is checked for contradiction only; it is not the v0.1.6 operator page, and
   this record does not update it.
8. **Release-body evidence pointers.** The GitHub Release body points at
   `dev/agent-workflow/evidence/v016-release-gate-20261114/` and `…/candidate-v0.1.6-5/`; neither path
   exists at the tag (`git cat-file -e v0.1.6:<path>` fails). This is a documentation-pointer gap in the
   release body, outside this task's scope, recorded here rather than hidden.
9. **`:3080` untouched.** The A1 kit's pre-probe made a single read-only HTTP request to `:3080` (401) and
   `:3180` (unreachable) as its standing safety check; no write, no DSH_HOME access, no port collision.
   All boot/install lanes used `3191`/`3192` + `13050`.
10. **Throwaway worlds.** `tests/homes/v016post-20261114-pinned` and
    `tests/homes/v016post-20261114-refless` are gitignored and were created for this record; the A1 kit's
    world (`c1-smoke-2026-11-13T18-19-17-h0-r51dd78`) was torn down by the kit. Teardown by exact path:
    see the PR body's commands; no `tests/homes` path outside this worktree was touched.

---

## 8. Evidence map

| path | contents |
| --- | --- |
| [`install/pinned-install.log`](./install/pinned-install.log) | verbatim pinned install transcript, exit 0 |
| [`install/pinned-list.log`](./install/pinned-list.log) | `dsh plugin --profile web list` |
| [`install/lock-entries.txt`](./install/lock-entries.txt) | pinned and ref-less profile manifests + lock rows |
| [`install/refless-install.log`](./install/refless-install.log) | ref-less install, default-branch tip before/after |
| [`smoke/boot-installed.mjs`](./smoke/boot-installed.mjs) | instrument: boot the installed profile, mount check, Team read-back |
| [`smoke/boot-instance.log`](./smoke/boot-instance.log) | clean boot log: registered + `MOUNTED channel=/team-remote` |
| [`smoke/boot-summary.json.md`](./smoke/boot-summary.json.md) | mount / projection / `listRoots` payloads |
| [`smoke/boot-instance-2026-11-13T18-21-run.log`](./smoke/boot-instance-2026-11-13T18-21-run.log) | the disclosed instrument-teardown boot (§5.4) |
| [`a6off-a1/`](./a6off-a1/) | frozen A1 kit run: `run.log`, `a1-arms.md`, `a1-verdicts.json.md`, composition, ledger, tool transcript, instance log |
| [`release/github-release-body-2026-11-13.txt`](./release/github-release-body-2026-11-13.txt) | verbatim GitHub Release body (external, provenance in header) |
