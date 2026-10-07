# A4-PR7 §7.6 — can the permanently-skipped client leg be made green? Measured, not guessed.

Task: the merged 7.5 composition gate prints the client plugin leg as a **named SKIP**
(`SKIP client plugin (packages/client): host module closure unavailable — 17 unresolvable: …`)
plus the footer `PASS composition-smoke — 1 step NOT RUN and NOT passed: …`, and §7.6 wants a machine
gate that closes on this stage. A leg that can never pass is a weak thing to stand a close on, so the
question put to this probe was narrow: **can that leg be made green in this environment, with numbers
rather than vibes?**

**Answer, measured: yes — the leg is now green here** (11 `PASS` arms, no `SKIP`, footer unqualified,
exit 0). It is green only with **17 `devDependencies` on `packages/client`, 6 host-parity `overrides` in
`pnpm-workspace.yaml`, and `hoistPattern: ['*']` declared explicitly (§3a)** — the last of those because
the imports are actually served from pnpm's hoist directory, whose default this repo had never written
down. The devDependencies alone — the change the brief expected — **cannot be installed offline at all**
here, and the reason is a specific missing package, not a general shortage of cache:
`micromark-util-edit-map` is in neither the shared store nor the offline metadata cache. Nothing in the
change is invented: every version wired is the version the pinned host generation
(`@deepseek-ai/dsh-client-ui-primitives@0.2.0-rc.2`) already resolves.

* Branch `build/a4-client-smoke-deps`, worktree `.worktrees/a4-clsx`. Round 1 was `57d79282` + evidence
  `074c380c` on `origin/master` `d8b145c1`, after rebasing twice as master moved (PRs #122/#123 docs, then
  PR #124, the a4-surface lane); before each rebase it was verified that the incoming commits touch
  **none** of the files this change edits, and no `package.json` or composition-smoke/check-artifacts
  script either. Round 2 adds the review fixes: byte-canonical override declaration order (§6a), the
  explicit `hoistPattern` (§3a), and this document's three corrections. **Not pushed** — the coordinator
  pushes.
* CORE PATCH BUDGET spent: **0**. No host-tree edit, no `pnpm patch`, no vendored copy, no boot of any
  host on any port.
* CORE PATCH BUDGET spent: **0**. No host-tree edit, no `pnpm patch`, no vendored copy, no boot of any
  host on any port.

---

## 1. The unresolvable set, enumerated from the real build (not from the error message)

`before-enumerate-probe.txt` — `probe-enumerate.mjs`, read-only, run against the **built** entry
`packages/client/dist/packages/client/src/plugin/client.js` after `pnpm run build`. Two independent
instruments, because a single reader of the gate's own scanner would only confirm itself.

**Instrument A — the gate's own scanner** (`scanModuleClosure` from
`scripts/composition-smoke-closure.mjs`, the function the 7.5 arm calls):

```
ran=true reason=null visitedFiles=125 truncated=false
ownUnresolved=0 upstreamUnresolved=20 untraversed=0 subpathBails=0
```

20 unresolved **specifiers** collapse to **17 distinct packages**, every one of them imported by the
same file, `node_modules/.pnpm/@deepseek-ai+dsh-client-ui-primitives@0.2.0-rc.2_…/lib/index.js`.
Five of the 20 are subpath specifiers (`@shikijs/langs/{json,shellscript,typescript}`, `shiki/core`,
`shiki/engine/javascript`), which is why 20 specifiers → 17 packages. `ownUnresolved=0`: our own
artifact graph is clean — this is purely the upstream package's imports.

**Instrument B — an independent `createRequire(...).resolve` sweep** of every bare specifier in every
installed upstream client package:

```
@deepseek-ai/dsh-client-ui-primitives@0.2.0-rc.2: 23 bare package(s) asked for, 17 unresolvable
@deepseek-ai/dsh-client-web@0.2.0-rc.2:            8 bare package(s) asked for,  1 unresolvable
   MISSING @deepseek-ai/dsh-client-ui-dockkit
```

The 17 agree exactly with instrument A. The extra `dsh-client-web` hit is **not** in the client
closure — the built plugin never reaches it — which is why the gate reports 17 and not 18, and why
wiring 18 would have been wrong. This also disposes of the claim carried in
`../gates/7-5-client-closure-scan.txt` that "not even the host can load it": the host tree resolves
23/23 (that same file's own section 5 measured it). The host always could. Our workspace could not,
because we never installed them.

### The set, with the version the host resolves each at

Versions are from `tests/deepseek-harness-test-use/pnpm-lock.yaml`, the `packages/client/ui-primitives`
importer block — i.e. what the pinned host actually loads, not what npm currently serves.

| package | host version | asked for by |
| --- | --- | --- |
| `@shikijs/langs` | 4.3.1 | dsh-client-ui-primitives (`/json`, `/shellscript`, `/typescript`) |
| `anser` | 2.3.5 | dsh-client-ui-primitives |
| `clsx` | 2.1.1 | dsh-client-ui-primitives ← **the package in the original error** |
| `katex` | 0.16.47 | dsh-client-ui-primitives |
| `mdast-util-from-markdown` | 2.0.3 | dsh-client-ui-primitives |
| `mdast-util-gfm` | 3.1.0 | dsh-client-ui-primitives |
| `mdast-util-math` | 3.0.0 | dsh-client-ui-primitives |
| `micromark-core-commonmark` | 2.0.3 | dsh-client-ui-primitives |
| `micromark-extension-gfm` | 3.0.0 | dsh-client-ui-primitives |
| `micromark-extension-math` | 3.1.0 | dsh-client-ui-primitives |
| `micromark-factory-space` | 2.0.1 | dsh-client-ui-primitives |
| `micromark-util-character` | 2.1.1 | dsh-client-ui-primitives |
| `micromark-util-classify-character` | 2.0.1 | dsh-client-ui-primitives |
| `micromark-util-sanitize-uri` | 2.0.1 | dsh-client-ui-primitives |
| `micromark-util-symbol` | 2.0.1 | dsh-client-ui-primitives |
| `shiki` | 4.3.1 | dsh-client-ui-primitives (`/core`, `/engine/javascript`) |
| `simple-icons` | 16.31.0 | dsh-client-ui-primitives |

`clsx` was never the whole story — it is just the first import that threw, so it is the only one the
error message ever showed. Fixing only `clsx` would have produced the same SKIP with 16 names left.

## 2. Offline obtainability — per package, against the real store

`before-store-index.txt`, `obtainability-transitive.txt`. pnpm `--offline` needs **both** a cached
registry packument (`$XDG_CACHE_HOME/pnpm/v11/metadata/registry.npmjs.org/<name>.jsonl`) **and** the
package files recorded in the store index (`$STORE/v11/index.db`, table `package_index`, key
`"<sha512 integrity>\t<name>@<version>"`); a version absent from either can only arrive over the
network. The store was queried with `node:sqlite` (`store-query.mjs`) — there is no `sqlite3` binary
here. Store inventory: 1851 rows, 1510 distinct names; metadata cache: 874 packuments.

**All 17 named packages are obtainable offline**, each at exactly the host's version:

```
PRESENT @shikijs/langs: 2.5.0, 4.3.1, 4.4.3      PRESENT mdast-util-math: 3.0.0
PRESENT anser: 2.3.5                              PRESENT micromark-core-commonmark: 2.0.3
PRESENT clsx: 2.1.1                               PRESENT micromark-extension-gfm: 3.0.0
PRESENT katex: 0.16.47                            PRESENT micromark-extension-math: 3.1.0
PRESENT mdast-util-from-markdown: 2.0.3           PRESENT micromark-factory-space: 2.0.1
PRESENT mdast-util-gfm: 3.1.0                     PRESENT micromark-util-character: 2.1.1
                                                  PRESENT micromark-util-classify-character: 2.0.1
                                                  PRESENT micromark-util-sanitize-uri: 2.0.1
                                                  PRESENT micromark-util-symbol: 2.0.1
PRESENT shiki: 2.5.0, 4.3.1, 4.4.3                PRESENT simple-icons: 16.31.0
```

That is not luck: the plugin workspace and the pristine host tree install from the **same** store
(`storeDir: /home/user/dsh-plugins/dsh-agent-team/.tmp-pnpm-store/v11`), so everything the host
generation resolved is here by construction.

### But the 17 do not close on themselves

Declaring the 17 (real workspace, host-exact versions, `attempt-install-unpinned.txt`) fails:

```
[ERR_PNPM_NO_OFFLINE_META] Failed to resolve micromark-util-edit-map@>=1.0.0 <2.0.0-0 in package
mirror /home/user/dsh-plugins/dsh-agent-team/.tmp-xdg/cache/pnpm/v11/metadata/registry.npmjs.org/
micromark-util-edit-map.jsonl
This error happened while installing the dependencies of mdast-util-from-markdown@2.0.3
at micromark@4.0.3
```

The blocker is **transitive float**, not the 17: `micromark@^4.0.0` resolves against a cached packument
that advertises **4.0.3**, and 4.0.3 depends on `micromark-util-edit-map`, which is **absent from the
metadata cache and absent from the store** — unreachable offline by any route. That is a finding, not an
invitation; no network was used at any point in this probe.

`offline-probe/iterate.mjs` then converged the closure in 7 rounds (`.tmp-faultscratch` scratch, logs
copied here as `iterate-log.txt`, `pins.json`, `verdict.txt` = `CONVERGED`, `pins=6`). Each round reads
the pnpm error, pins the named package to the version the **store** holds, and retries:

| floater | fresh resolution | store holds | failure mode without a pin |
| --- | --- | --- | --- |
| `micromark` | 4.0.3 | **4.0.2** | `ERR_PNPM_NO_OFFLINE_META` (its dep `micromark-util-edit-map` unknown offline) |
| `micromark-util-types` | 2.0.3 | **2.0.2** | `ERR_PNPM_NO_OFFLINE_TARBALL` |
| `mdast-util-find-and-replace` | 3.0.3 | **3.0.2** | `ERR_PNPM_NO_OFFLINE_TARBALL` |
| `mdast-util-gfm-strikethrough` | 2.0.1 | **2.0.0** | `ERR_PNPM_NO_OFFLINE_TARBALL` |
| `mdast-util-to-markdown` | 2.2.0 | **2.1.2** | `ERR_PNPM_NO_OFFLINE_TARBALL` |
| `micromark-extension-gfm-table` | 2.1.2 | **2.1.1** | `ERR_PNPM_NO_OFFLINE_TARBALL` |

**Every pinned version is byte-identical to the host's own resolution** — checked line by line against
`tests/deepseek-harness-test-use/pnpm-lock.yaml` (`obtainability-transitive.txt` §3 prints the host
lines with line numbers). The pins are parity with the pinned generation, not a version policy
invented here.

## 3. What changed, and why that is the narrowest place

Three files, `916 insertions(+), 1 deletion(-)`:

1. **`packages/client/package.json` — +17 `devDependencies`, exact versions.** This is the narrowest
   place that can make the bundle resolvable: `packages/client` is the package that builds the client
   entry whose closure is being scanned. `devDependencies`, never `dependencies` — the upstream package
   declares none of its own imports (they are peer-style, supplied by whoever loads it), and this repo
   must not gain a runtime dependency on host internals. No `dependencies` field was added anywhere;
   `packages/client` has none today and still has none.
2. **`pnpm-workspace.yaml` — +6 `overrides`, host-parity** (documented in place with the error text and
   the evidence path), **+1 `hoistPattern: ['*']`** (§3a), and the `overrides:` block put into
   **byte-canonical declaration order** (§6a). The overrides cannot live in `package.json`: pnpm 11 reads
   `overrides` only from `pnpm-workspace.yaml` and warns that the `pnpm` field in `package.json` is
   ignored — measured, the first probe attempt wrote them there and the pin silently had no effect.
3. **`pnpm-lock.yaml` — regenerated by pnpm, +875 lines, 0 deletions.** See §6.

**Dev, not runtime, and that is the point.** Plan §7.5 describes closing this leg as shipping "the
missing `clsx` *runtime* dependency"; what ships is 17 **dev**Dependencies and no `dependencies` field
anywhere, and the two statements are reconciled by one fact — nothing we publish consumes these packages
at runtime: the tarball `npm pack --dry-run` would produce is byte-for-byte the same set before and after
(1533 entries, `unpackedSize` 11176289, empty diff: §5), and `packages/client` — the only package that
could have consumed them — is `"private": true` and is not in the root `files` list, so its manifest is
not even shipped. The dependency exists to make a *test-time* module graph resolvable, which is exactly
what a devDependency is for; a runtime `dependency` here would have put host internals into the published
install surface, which is the one thing this repo's red line forbids.

**The overrides are load-bearing, not decoration.** A lockfile records the `overrides` it was built
with in its `settings:`; shipping the produced lockfile *without* the corresponding workspace entries
fails every later frozen install:

```
[ERR_PNPM_LOCKFILE_CONFIG_MISMATCH] Cannot proceed with the frozen installation. The current
"overrides" configuration doesn't match the value found in the lockfile   (attempt-lockfile-without-overrides.txt)
```

So the choice was never "devDependencies vs devDependencies+overrides"; it was **this coupled set, or
a leg that stays a SKIP in this environment.**

**Blast radius of the six overrides: exactly the new closure, measured.** None of the six names appears
anywhere in the pre-change lockfile (six greps, all `0` hits — `obtainability-transitive.txt` §4), so
they bind nothing that existed before and cannot move any existing resolution. The `overrides:` block
they join already carried a `vite: "^8.2.2"` entry justified by an environment constraint and explained
the same way, so this is the file's established practice, not a new one.

## 3a. What actually serves the imports: an undeclared pnpm default, now declared

The 17 are load-bearing as **graph membership**, not as the links the entry reads. The imports are asked
by `node_modules/.pnpm/@deepseek-ai+dsh-client-ui-primitives@…/lib/index.js`, and that upstream package
declares `dependencies: null` (one peer, 28 devDependencies of its own) — so pnpm links nothing beside
it, and Node walking the realpath's ancestor chain finds every one of the 17 in
`node_modules/.pnpm/node_modules/`: **pnpm's hoist directory, filled by the default `hoist-pattern:
['*']`, which this repo declared nowhere** (`grep -rniE hoist package.json pnpm-workspace.yaml .npmrc
packages/*/package.json` → 0 matches; `pnpm config get hoist-pattern` → `undefined`). `packages/client/
node_modules/clsx` exists and is *not* on that chain.

Proved by hiding one link at a time (`hoist-pattern-experiment.txt`, each step reverted immediately):

```
hide packages/client/node_modules/clsx        -> PASS client plugin (packages/client): …
hide node_modules/.pnpm/node_modules/clsx     -> SKIP client plugin (packages/client): host module
                                                  closure unavailable — 1 unresolvable: clsx
```

A green that rests on an upstream default breaks for the first person whose pnpm changes that default, so
`hoistPattern: ['*']` is now declared in `pnpm-workspace.yaml` with a comment naming the arm that depends
on it — **after measuring that declaring it is lockfile-neutral**, which it is: two pristine exports
regenerated from scratch (lock *and* `node_modules` deleted, so pnpm must really re-resolve) produce
byte-identical locks with and without the declaration, and the `settings` block never carries the key.
The positive control proves pnpm honours the key rather than ignoring it: declaring
`hoistPattern: ['@types/*']` in a pristine export removes `clsx` from the hoist directory and leaves
`@types/node` in it, recorded in `node_modules/.modules.yaml`. Declaring `['*']` changes no install output
at all (`Already up to date`, no relink) precisely because it states the incumbent default.

## 4. Gate, before → after

Both captures are `node scripts/composition-smoke.mjs` on the same tree, before any edit
(`before-composition-smoke.txt`) and after (`after-composition-smoke-pinned.txt`, re-run at HEAD in
`final-verification.txt` §V4/V5). `before-build.txt` shows the base build; the base state reproduced
`../gates/7-5-round2-gates.txt` exactly, so the worktree was a faithful base.

The step count is **11 both before and after**; what moved is the client leg's **state**, and with it
the footer. In arm terms: **10 PASS + 1 SKIP → 11 PASS + 0 SKIP.**

```
-SKIP client plugin (packages/client): host module closure unavailable — 17 unresolvable:
-  @shikijs/langs, anser, clsx, katex, mdast-util-from-markdown, mdast-util-gfm, mdast-util-math,
-  micromark-core-commonmark, micromark-extension-gfm, micromark-extension-math,
-  micromark-factory-space, micromark-util-character, micromark-util-classify-character,
-  micromark-util-sanitize-uri, micromark-util-symbol, shiki, simple-icons
+PASS client plugin (packages/client): name="dsh-agent-team-client", apply fails loud on degenerate context

-PASS composition-smoke — 1 step NOT RUN and NOT passed: client plugin (packages/client).
-  A skipped step is an unverified claim, not a green one.
+PASS composition-smoke
```

The footer sentence is **gone, not reworded** (`grep "NOT RUN and NOT passed"` over the after captures:
zero hits; the branch that prints it is still in `scripts/composition-smoke.mjs:397`, untouched and
still reachable — it simply no longer has a skip to report). Exit code stays 0 either way, because a
SKIP was always exit-legal; that is precisely why the footer existed and why §7.6 must key on the
absence of `SKIP` rather than on the exit code.

Note for the record: the round-2 receipt counts this as "9 PASS + 1 SKIP"; the base output here has 10
`PASS` arm lines + 1 `SKIP`. The receipt undercounted by one arm — worth knowing before a 7.6 gate
asserts a literal number.

## 5. Everything else, unchanged — measured after the edit (`final-verification.txt`)

| check | result |
| --- | --- |
| V1 clean offline install from the shipped lockfile (`rm -rf node_modules` → `pnpm install --offline --store-dir=$STORE --ignore-scripts --frozen-lockfile`) | exit 0, `Done in 1.3s`, nothing downloaded |
| V2 `pnpm run build` | exit 0 |
| V3 `pnpm run build:composition` → `check:artifacts` | `OK: 1508 files`, install surfaces byte-identical, `client-bundle.js` 1259739 B (unchanged) |
| V4/V5 `node scripts/composition-smoke.mjs`, `pnpm run smoke:composition` | 11 PASS arms, 0 SKIP, exit 0 |
| V6 `pnpm -r run typecheck` | 8 `Done`, 0 `error TS` |
| V7 `pnpm --filter @dsh-agent-team/client run test` | `Tests 3 failed | 877 passed (880)` at the delivered base — **exactly the inherited baseline trio**: `team-creation-panel.client.spec.tsx` ×2, `team-governance.client.spec.tsx` ×1; no new failure, none magically fixed. (At the pre-rebase base the same trio sat in `3 failed | 876 passed (879)`; the +1 test is PR #124's, not this change's.) |
| V8 `scripts/lint-identities.mjs --diff …-0237d487.txt` | `160 identity lines, 76 distinct`, `new 0, resolved 0` |
| V9 7.5 classifier + p4t6 scan + blueprint-version-clean suites | `65 passed` |
| V10 `npx eslint` on touched files | 0 errors |
| V11 mute audit of the branch diff | zero `eslint-disable` / `@ts-ignore` / `@ts-expect-error` / `.skip(` / `.only(` |

### The published surface did not move

`published-surface-npm-pack.txt` (against the base tree) and `published-surface-npm-pack-v2.txt`
(against a pristine `git archive origin/master` export at the delivered base) —
`npm pack --dry-run --json` (local only), compared file-by-file with sizes:

```
base : entry count=1533 unpackedSize=11176289      (origin/master d8b145c1, pristine export)
after: entry count=1533 unpackedSize=11176289      (this branch, 57d79282)
diff: (no differences)
```

Structurally, why it cannot move: root `files` is [`.agents/skills`, `cordis.patch.yml`,
`packages/client/composition-shim`, `packages/runtime/dist`, `packages/runtime/root-binding`,
`packages/runtime/src/plugin/upstream-resolver.mjs`] — `packages/client/package.json` is not shipped and
neither `pnpm-workspace.yaml` nor `pnpm-lock.yaml` is; `packages/client` is `"private": true` and has no
`dependencies` field. `scripts/check-artifacts-committed.mjs` compares only `INSTALL_SURFACES`
(`packages/runtime/dist`, `packages/client/composition-shim`) against the git index — nothing reads a
dependency field, and the count stayed 1508. The 7.5 bundle arms read the root and shim manifests for
`exports`/`files`/`name`/`version`/`dsh.client.platform` only; the classification suite asserts on
**synthetic** fixtures (`@a4p75/*` package names), so it never pinned real dependency values and still
passes. No runtime dependency was added to any published package, and none was added as a `dependency`
anywhere.

## 6. `git diff --stat pnpm-lock.yaml`

```
 pnpm-lock.yaml | 875 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 875 insertions(+)
```

**Why it is that size:** it is purely additive — 875 insertions, 0 deletions, i.e. no existing
resolution moved anywhere in the workspace. Counted against the diff: 51 lines are the 17 new importer
entries under `importers.packages/client` (3 lines each), 6 lines are the `overrides:` settings block,
160 lines are new package/snapshot keys — **94 distinct new `name@version` resolutions, which is
exactly the `Packages: +94` pnpm reported installing** — and the remaining 709 lines are their nested
`resolution:` / `integrity:` / `dependencies:` / peer detail. All of it is the closure of a dependency
set that did not exist in this workspace at all before, which is exactly the addition being justified
and nothing else. It was produced by `pnpm install` and not hand-edited; `git diff` shows no reordered
or reformatted existing entry.

(The `packages/client/package.json` diff is 18 insertions / 1 deletion for the same reason in miniature:
17 added lines plus the `jsdom` line moving to its sorted position.)

## 6a. The lock is byte-canonical from the manifests, and a full re-resolution is not — both measured

pnpm emits the lockfile's `overrides:` block in **declaration order**, so a yaml whose order disagrees
with the committed lock produces a lock that its own generator cannot reproduce. The first commit had
`vite` declared first and recorded last; the cure is two lines — declare it last. `byte-canonical-lock.txt`
has the whole measurement; the parts worth stating here:

* The command `pnpm install --lockfile-only --offline --no-frozen-lockfile` run **with `node_modules`
  present cannot fail this test** — pnpm prints `Already up to date` and re-emits settings from
  `node_modules/.modules.yaml`. It reported byte-identical for the *defective* yaml too. The discriminating
  test deletes `node_modules` as well.
* Done that way, in two pristine exports differing only in declaration order: vite-first emits an
  overrides block **2 lines different** from the committed lock; vite-last emits it **byte-identically**.
  Fixed, with the yaml annotated so nobody re-sorts it by taste.
* **Whole-graph byte-identity offline is not achievable here, and that predates this change.** A
  from-scratch re-resolution moves ~1577 lines (vitest, vite 8.2.2→8.3.3, jsdom, `@types/node`, yaml,
  undici, sharp, peer-hash suffixes throughout) because the cached packuments are newer than the store's
  vintage — the very condition that forced the six pins. Control: a pristine `git archive origin/master`
  export, carrying **none** of this change, drifts **1577 lines** against its own committed lock under the
  same command; of the drift on this branch, the lines attributable to the 17+6 addition are **0**. So the
  committed lockfile is the artifact; a full re-resolution moves ~1577 unrelated lines whether or not this
  merges, and that is worth knowing before anyone treats a regenerated lock as a review signal.

## 7. Deviations from the brief, each with its exact error text

1. **`--frozen-lockfile` is impossible for the one install that has to create the lockfile change.**
   With `CI=true` (which defaults frozen on), the first install of the 17 fails:
   `[ERR_PNPM_OUTDATED_LOCKFILE] Cannot install with "frozen-lockfile" because … 17 dependencies were
   added` (`attempt-install-unpinned.txt`). A frozen install cannot, by definition, produce a lockfile
   diff. Generating install therefore used `--no-frozen-lockfile` explicitly; **every** other install in
   this task, including the V1 reproducibility run, used the brief's exact
   `--offline --store-dir=$STORE --ignore-scripts --frozen-lockfile --config.confirmModulesPurge=false`.
2. **The change is wider than "devDependencies of `packages/client`"** — it also carries 6 `overrides`
   in `pnpm-workspace.yaml` and a 17-line devDependency block, not just `clsx`. Both were forced by
   measurement (§2, §3). `pnpm-workspace.yaml` is root workspace config, not a published manifest, and
   `check:artifacts` does not compare it; it is not owned by any live lane.
3. **`--offline` installs were run with the shared cache/store of the main checkout** (`.tmp-pnpm-store`,
   `.tmp-xdg`), as the environment recipe prescribes. No network was attempted, so no package was
   fetched: `Packages: +94`, `downloaded 0`.
4. **Rebase, not a second merge:** branched off `0fd46024` as instructed after `git fetch`; `origin/master`
   then moved twice — to `fba82095` (PRs #122/#123, docs only) and then to `d8b145c1` (PR #124, the
   a4-surface lane, which adds runtime sources, an a4p6 client spec and p4t6/classifier pins) — and the
   branch was rebased onto each and re-verified on the new base (`final-verification-v2-base-d8b145c1.txt`,
   W1–W8). Before each rebase it was verified that the incoming commits touch none of this change's three
   files: `git diff --stat 0fd46024 origin/master -- packages/client/package.json pnpm-workspace.yaml
   pnpm-lock.yaml` was empty at both points, so a rebase could not have hidden an interaction.
5. **`pnpm-workspace.yaml.base` was written inside the worktree** as a scratch backup during the
   without-overrides experiment and has been deleted; the worktree is clean apart from this evidence
   directory.

## 8. Recommendation — what §7.6's machine gate should say

1. **Assert the absence of a skip, not the exit code.** `exit 0` was already true while the leg was
   skipped. The gate should run the smoke and require zero `^SKIP ` lines **and** require the client leg
   by name to be a PASS: `/^PASS client plugin \(packages\/client\): name="dsh-agent-team-client"/m`.
2. **Do not assert a literal arm count** unless it is derived. Measured here: 11 arms (10+1 SKIP before,
   11 after). The round-2 receipt's "9 PASS + 1 SKIP" is one arm short of what the script actually
   prints at this base, so a hard-coded number written from that receipt would fail on green.
3. **Require the footer to be unqualified** — assert the output's last line is exactly
   `PASS composition-smoke`. That is the sentence this task was told to confirm is gone.
4. **State the leg's dependency in the gate's own text**: the client leg's meaning is "the host module
   closure of the built artifact resolves", and that now depends on `packages/client`'s devDependencies
   being installed. A gate that runs on a tree without an install (or with a different host generation)
   will legitimately SKIP again — the gate should say which of "not installed" vs "closure broken" it is
   reporting, since the 7.5 classifier can already tell those apart.
5. **The SKIP branch stays in the script.** It is correct behaviour and it is what made this probe
   possible; making the leg green removed a condition, not a guard.

## 9. What a human still has to decide

* ~~Whether the 6 parity overrides ship as repo policy.~~ **Ruled on review: ship them**, framed as
  host-generation parity pins rather than repo version policy — dropping them would break every frozen
  install, or ship a lock whose recorded settings misreport how its resolutions were made, or re-resolve
  to versions the host does not run and the store does not have. The alternative stays on the record for
  whoever wants it later: drop the 6 `overrides`, run **one networked** `pnpm install --no-frozen-lockfile`,
  commit the result, and the leg goes green identically — the 17 are what matter; the six floaters are only
  unreachable *offline*. That regeneration is not doable from this session, which has no network by
  instruction.
* **Re-measure, don't retype, on the next host-pin bump.** The pins are derived from the 0.2.0-rc.2
  generation. The comment in `pnpm-workspace.yaml` says so and points at this directory; the derivation
  is the `iterate.mjs` loop, not a hand-curated list. The same applies to `hoistPattern` (§3a) and to the
  declaration order of the `overrides:` block (§6a) — both are measured facts about this toolchain, and a
  future pnpm may change either.

## 10. Reproduction

```bash
cd .worktrees/a4-clsx
REPO=$PWD MAIN=/home/user/dsh-plugins/dsh-agent-team STORE=$MAIN/.tmp-pnpm-store
export CI=true XDG_CACHE_HOME=$MAIN/.tmp-xdg/cache XDG_DATA_HOME=$MAIN/.tmp-xdg/data \
       XDG_CONFIG_HOME=$MAIN/.tmp-xdg/config npm_config_cache=$MAIN/.tmp-npm-cache \
       npm_config_update_notifier=false
rm -rf node_modules && pnpm install --offline --store-dir=$STORE --ignore-scripts \
     --frozen-lockfile --config.confirmModulesPurge=false   # V1: exit 0, 0 downloads
node scripts/composition-smoke.mjs                          # 11 PASS arms, 0 SKIP, exit 0
```

Probes (read-only; they import the gate's own `scanModuleClosure` and `node:sqlite`, write nothing
outside the repo): `probe-enumerate.mjs` (§1), `store-query.mjs` (§2), `iterate.mjs` + `pins.json` +
`iterate-log.txt` (the convergence loop, run in `.tmp-faultscratch/offline-probe`, a scratch project
that never touches the real workspace).

## 11. Transcripts in this directory

| file | content |
| --- | --- |
| `before-build.txt` | base build (precondition for the closure scan) |
| `before-composition-smoke.txt` | base gate: 10 PASS + 1 SKIP + qualified footer, exit 0 |
| `before-enumerate-probe.txt` | instrument A + instrument B (§1) |
| `before-store-index.txt` | store membership of the 17 |
| `obtainability-transitive.txt` | the six floaters, the absent `micromark-util-edit-map`, host-lock parity, blast radius |
| `attempt-install-unpinned.txt` | the devDeps-only failure, verbatim + the frozen-lockfile note |
| `attempt-install-pinned.txt` | the converged offline install |
| `attempt-lockfile-without-overrides.txt` | why the overrides must ship |
| `iterate.mjs`, `iterate-log.txt`, `pins.json`, `verdict.txt`, `stage1-resolve.txt` | the 7-round convergence loop |
| `after-composition-smoke-pinned.txt`, `after-smoke-composition.txt` | the green gate |
| `after-build-and-composition.txt`, `after-typecheck-artifacts.txt`, `after-client-test.txt`, `after-lint-identities.txt`, `after-neighbour-suites.txt`, `after-eslint.txt` | per-gate captures at the pre-rebase HEAD |
| `published-surface-npm-pack.txt`, `published-surface-npm-pack-v2.txt` | the tarball is identical before/after, at both bases (§5) |
| `hoist-pattern-experiment.txt` | the hide-one-link experiment, the layout facts, the neutrality test and its positive control (§3a) |
| `byte-canonical-lock.txt` | the override-order defect, its cure, and the base-controlled limit of offline reproducibility (§6a) |
| `final-verification.txt` | V1–V13 at the first delivered HEAD `4f81dcf3` (base `fba82095`) |
| `final-verification-v2-base-d8b145c1.txt` | W1–W8 re-verification at the delivered HEAD `57d79282` (base `d8b145c1`, PR #124 merged) |
