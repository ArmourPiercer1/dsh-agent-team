# PD28-SERVICE-SEAM — the confined `skill`/`present` capabilities are served by the SEAM, not by forked tools

> Lane `PD28-SERVICE-SEAM`, branch `task/pd28-service-seam-20261114`, worktree
> `.worktrees/pd28-service-seam`, base `origin/master` = `24d2cf760`, then merged with `origin/master` = `9c730c3d7` (PD-27, #676). Evidence
> class **DEV-LIVE** (`eligible = false`, never merge evidence). `CORE PATCH
> BUDGET = 0`; no `V@B`, no grade, no Q7/Authority/CI change; no second policy
> source.
>
> One line: **the external audit of PD-26 is RIGHT.** `skill` and `present` are
> consumers of a `skills` service and of `fs` + `tools/result`; PD-26 restored
> them by forking the consumers, PD-28 deletes both forks and fixes the two
> services they were missing — and reproduces PD-26's live numbers
> **item-by-item with zero Team tool modules**.

---

## 1. The claim under test

An external audit of PD-26 (merged, #675) said, in effect:

> `skill` 只调 `ctx.skills.list()` / `ctx.skills.get()`，**不碰 fs**；`present` 只调
> `ctx.fs.lstat/resolve/stat` + `ctx.on("tools/result")`。工具本身没有能力可以
> "重实现"，它们只是**服务的消费者**。PD-26 写的那两个 `confined-*-tool.mjs`
> 重写的是消费者，缺的其实是**服务**。

If that is right, then PD-26's safety argument ("the tool is confined") rests on
*our hand-written copy of a host tool being correct*, and every future capability
needs a third, fourth, fifth fork. That is the failure mode the audit names:
"安全性与工具接入无关" would be false.

**Verdict: the route holds.** The proof is not an argument, it is the deletion:
PD-28 deletes both forks and the same two capabilities keep working, with the
same guard facts, against the pinned host packages.

---

## 2. What each seam actually lacked

| capability | what the tool consumes | what PD-23/PD-24 removed | what PD-26 did | what PD-28 does |
| --- | --- | --- | --- | --- |
| `skill` | `ctx.skills.list()` / `ctx.skills.get()` only — **no `fs` in the tool** | the `skill-filesystem` **provider** (its `list()` scans roots, so a denied root throws before `get()`) | copied the host definition into `confined-skill-tool.mjs`, reading via `ctx.fs.resolve` + `ctx.fs.readText` | mounts a Team `skills` **provider** on the Member realm (`inject = ['skills','fs']`): `list()` serves the declared catalog with **zero filesystem access**, `get()` reads the body through the Member's **confined** `fs`. Host `tool-skill` row untouched. |
| `present` | `ctx.fs.lstat/resolve/stat` + `ctx.on('tools/result')` | the `present` tool's event delivery, because the route-C **registration router** re-scoped its `tools` service | copied the host definition into `confined-present-tool.mjs`, and subscribed on `exec.agent.ctx` from inside the copy | mounts the **pinned host** `@deepseek-ai/dsh-tool-present` package **directly** on the realm scope (`direct: true`), so its own `ctx.on('tools/result')` listener is on the same `tools` isolate that dispatches |

Two facts measured here that PD-26 got wrong or did not measure:

1. **The event failure is the `tools` service isolate label, not the ctx scope.**
   `scopeOf(realmCtx)` is the **agent** in *both* mounts (direct and routed); a
   listener registered on a ctx whose `tools` resolves to a different isolate is
   dropped by `Service.prototype[filter]`'s label comparison. Measured with a
   scratch probe: the same host module mounted directly appends `1`
   `deliverables/presented`, mounted through the router appends `0`.
2. **The catalog cannot come from `skill-filesystem`.** Its discovery lists a
   root before any `get()`, so an out-of-lane root makes `list()` throw — it
   cannot *declare* an out-of-lane skill and then refuse only its body. The
   catalog is therefore authored declaration data (`a5sfSkillCatalog`, trusted
   World/preset config): **data, not authorization**. Every byte is still
   authorized at the confined `fs` guard, which is why the out-of-lane arm is a
   deny fact and not a list filter.

---

## 3. The two seams, and what fails closed

**`packages/runtime/src/plugin/live/a5sf-skill-provider.mjs`** (new, the only
scannable addition): `list()` returns catalog entries as candidates
(`provider = 'a5sf-confined'`, `rank = 300`, `source = 'declared'`, both
invocation flags true, no filesystem call at all); `get(candidate)` does
`ctx.fs.resolve` → `ctx.fs.readText` (**no `stat`** — exactly PD-26's fact
shape), strips frontmatter, and re-throws any read failure as a `HarnessError`
whose `code` is the guard's code (`IO_READ_DENIED`) with the code prefixed into
the message, so a refusal is typed in both the model text and `error.info.code`.
The catalog is validated (array of objects, name grammar, no duplicates, no
blank text) and a malformed catalog refuses at mount.

**`packages/runtime/team-services/src/mount.ts`** — the route-C attach grew one
deliberate mode, `direct: true`, used only by the `present` spec
(`expectedTools: ['present']`). It refuses, with typed codes, when the mount:
is observation-only; carries a binding identity; has an empty/invalid
`expectedTools`; names a tool already owned by a binding; has no `tools.get`;
or would create **any deferred descendant**. It verifies the mount by
**definition identity** (`after !== before` per expected name — the definition
object the pinned module registered), records a synthetic registration receipt
(`forwarded === observed === expected`, `dropped` empty) so the existing
`A5SF_EXPECTED_TOOLS_UNSHADOWED` gate still sees the name, and rolls the fiber
back on any failure. That is how a *host* module can be mounted without the
router and still be visible to the receipt ledger.

**`TeamIoDenial` is now a `HarnessError`** (`packages/runtime/team-services/src/types.ts`),
so the guard's code survives into `error.info.code` instead of being flattened
to `{name}` by `errorInfo()`. Message text is unchanged; the guard facts remain
the authoritative typed record.

**No `cordis.patch.yml` change was needed** (the file belongs to another web
lane; it was not touched). Its `tool-skill` / `tool-present` rows still point at
the pinned host packages, which is the point.

**Deleted**: `packages/runtime/src/plugin/live/confined-skill-tool.mjs`,
`.../confined-present-tool.mjs` (+ their `dist` copies and the
`scripts/dist-placements/190-a5sf-pd26-confined-skill.json` placement, replaced
by `190-a5sf-pd28-service-seam.json`). Zero Team tool modules remain for these
two names.

---

## 4. The live pair (two agreeing boots, `DEV-LIVE`)

> **Read this before the table.** The pair bound to this lane's product claim was
> measured at `6f9a8c1` on top of `24d2cf760`, i.e. BEFORE `origin/master` gained
> PD-27; it is preserved verbatim under `archive/pre-merge-6f9a8c1/`. The re-bind on
> the merged tree is **BLOCKED by a master regression** and is documented in §4.3 —
> `runs/` currently holds that failing pair (the honest state of the shipped tree),
> and §4.3 contains the controlled experiment that makes the same tree pass 6/6.

Command (slot-leased, `DSH_HOME` under `tests/homes/`, 3180-family ports, pinned
host tree read-only):

```
node tests/world-factory/drivers/a5sf-pd28-service-seam/run-boot.mjs
```

Both boots **agree on every counter** (`agreeing=true differing=[]`), 6/6 cases
each:

| case | verdict |
| --- | --- |
| `pd28:skill-confined` | **PASS** |
| `pd28:present-confined` | **PASS** |
| `pd28:fs-controls` | **PASS** |
| `pd28:fail-closed-typed` | **PASS** |
| `pd28:surface-restored` | **PASS** |
| `pd28:no-out-of-lane-bytes` | **PASS** |

### 4.1 Item-by-item against PD-26's own two-boot run

This is the comparison the route has to survive: **same readings, different
implementation**. PD-26's numbers are read from
`dev/agent-workflow/evidence/a5sf-pd26-confined-skill/runs/boot01|02/`
(`counters.json` / the agreement table), not from its prose.

| reading | PD-26 (two Team tool forks) | PD-28 (provider + pinned host module) | equal? |
| --- | --- | --- | --- |
| member surface | **31** (`skill`, `present` on it) | **31** | ✅ |
| `skill` in-lane body | returned, `1` allow fact (`readText`, `tool=skill`) | returned, `1` allow fact (`readText`, `tool=skill`) | ✅ |
| `skill` out-of-lane | `IO_READ_DENIED`, **0 body bytes**, `1` deny fact | `IO_READ_DENIED`, **0 body bytes**, `1` deny fact | ✅ |
| `skill` undeclared name | name refusal, **0 facts** | name refusal, **0 facts** | ✅ |
| `skillFacts` | `{total:2, allow:1, deny:1, denyCodes:[IO_READ_DENIED]}` | identical | ✅ |
| `present` in-lane | file presented, `2` allow facts (`lstat`+`stat`) | identical | ✅ |
| `present` out-of-lane (existing) | typed refusal at **first `lstat`**, `1` deny fact, **0 events** | identical | ✅ |
| `present` out-of-lane (missing) | same typed refusal, `1` deny fact, no `file not found` oracle | identical | ✅ |
| `presentFacts` | `{total:4, allow:2, deny:2, denyCodes:[IO_READ_DENIED ×2]}` | identical | ✅ |
| `deliverables/presented` events | **exactly 1** | **exactly 1** | ✅ |
| `factTools` | `{bash:3, read:2, grep:1, skill:2, present:4}` | identical | ✅ |
| guard allow / deny | `9` / `3` | `9` / `3` | ✅ |
| out-of-lane bytes in any model request | **0** (`requestsCarryingSecret: 0`, `skillOutBodyInRequests: 0`) | **0** | ✅ |
| Team tool modules for these names | **2** | **0** | — (the point) |

**Disclosed divergence (one, and it is a property of not forking):** PD-26's fork
also prefixed the code token into the model-visible refusal text; the pinned host
`present` renders the lane's message verbatim ("…is outside every allow subtree
of the lane"). The typed code lives in the guard **fact**
(`decidedBy: IO_READ_DENIED`) and in the tool result's `error.info.code` (pinned
host-free in `PD28-PRESENT`). The present judge therefore reads the code from
the fact, not from prose. This is a difference in *where the type is*, not in
what is refused, and it is the correct behaviour: we do not restate host text.

### 4.2 Artifacts

| path | what |
| --- | --- |
| `runs/boot01/`, `runs/boot02/` | **the merged tree as it actually ships**: the agreeing FAIL pair of §4.3 (`surfaceACount 0`, no Member created, `tool-web (dsh-agent-team/web-tool): never started`). Overwrites nothing — every earlier pair is archived |
| `archive/pre-merge-6f9a8c1/` | **the PASS pair bound to this lane's product claim** (§4.1), measured at `6f9a8c1` on `24d2cf760` before PD-27 landed |
| `archive/merged-9c730c3d7-row-unloadable/` | the first merged-tree FAIL pair (same readings as `runs/`) |
| `archive/master-control-9c730c3d7/` | **the control**: pristine `origin/master` with no PD-28 commit and no PD-28 file, failing identically (§4.3) |
| `archive/experiment-row-file-url-PASS/` | the merged tree with ONE line different (the `tool-web` row's specifier): **PASS 2/2, 6/6, surface 33**; `ROW-DIFF.txt` states the line and that it is not a proposed product form |
| `archive/experiment-row-file-url-stale-closedlist/`, `archive/experiment-row-relative-path/` | the two localization steps in between (URL + the driver's old closed-name list; then a relative specifier, which fails exactly like the bare name) |
| `agreement-postfix.txt` / `.json` | the two-run agreement table, every row identical (`agreeing=true differing=[]`) |
| `mutation-controls.log` | the two mutation controls + PIN, 8/8 |
| `driver.log`, `driver/logs/**` | the driver's own transcript and host instance logs |
| `archive/postfix-2026-11-08T09-48-28-531Z/` | the earlier pair from the same tree, **kept not rewritten**: it is the record of the judge correction described in §4.1 (5/6 on the present arm) and of the archive it replaced |
| `archive/postfix-2026-11-08T09-52-04-000Z/` | the intermediate pair, superseded by the README-bearing CLI rerun |
| `archive/pre-fix/` | the PIN arm's own transcript (`a5sf-realm-row.mjs` at `24d2cf760` + the module list it composed) |

### 4.3 The merge with PD-27 (`9c730c3d7`) and the re-bind — a MASTER regression, proven by control

The Owner's instruction was to merge `origin/master` after #676 landed and re-bind the
live pair on the merged tree (surface should become **33** = 31 + `web_fetch` +
`web_search`). The merge is done; the re-bind **cannot pass on the shipped merged
tree for a reason that has nothing to do with this lane**, and the evidence below
separates the two claims:

**(a) The merge itself.** Four conflicts, exactly the four predicted: the register
row/section insertion point, the matrix correction, and `a5sf-realm-row.mjs` (source
and dist mirror). Both lanes' additions are kept — PD-27's `confinedWebSpecOf` and
its `tool-web` row, PD-28's provider and direct mount; PD-26's two fork specs stay
deleted. The matrix is renumbered (PD-27 keeps §1.8.10, PD-28 moves to §1.8.11).
`dist` was re-generated (`tsc` + `place-dist-glue`, 109 placements), not hand-merged.
On the merged tree: p4t6 **1448 = 983 + 465**, 0 violations; `plugin-dsh-compat`
13/13; `check:install-manifest` **8** issues, the same set as master's own (the web
lane's peer-census repair, none from this lane); PD-28 host-free 5/5; PD-27 host-free
9 pass + 1 skip.

**(b) The re-bind.** Both boots agree and both FAIL at the **Member creation**, before
any probe:

```
activation: child-session creation failed for member 'inst-…':
  RemoteError: tool-web (dsh-agent-team/web-tool): never started
surfaceACount 0 · guardFacts 0 · every case REFUTED but `no-out-of-lane-bytes`
```

`never started` is the host's own preset audit: the row has **no fiber**, i.e. the
preset resolver never loaded it at all. The row is PD-27's
`- id: tool-web / name: 'dsh-agent-team/web-tool'` inside
`preset-a5sf-governed-member`. A profile-layer row may spell our package that way
(the bundle loader resolves it through the bundle's `package.json` exports: the
`dsh-agent-team/host` and `dsh-agent-team/spill-local` rows do); a **preset** row is
resolved against the host's module graph, where no `dsh-agent-team` package exists —
the same spelling that works one layer up cannot be loaded one layer down, and the
failure is total: no governed Member can be created, which is worse than the
fail-closed absence PD-27 intended.

**(c) The control that assigns the blame.** A plain `git worktree` of pristine
`origin/master` = `9c730c3d7` (no PD-28 commit, no PD-28 product file), booted with
the same driver, fails **identically** — same message, same counters, 2/2 agreeing
boots (`archive/master-control-9c730c3d7/`, with the Leader's intact 43-name surface
showing the profile layer is fine). So the regression is master's own.

**(d) The localization experiment.** Three one-line variants of that row, nothing else
touched (`archive/experiment-*/`, `ROW-DIFF.txt`):

| row `name` | result |
| --- | --- |
| `dsh-agent-team/web-tool` (shipped) | member never created — `never started` |
| `./packages/runtime/dist/…/confined-web-tool.mjs` | member never created — `never started` |
| `file:///…/confined-web-tool.mjs` (absolute) | **PASS 2/2 boots, 6/6 cases, `surfaceACount 33`** |
| the same row with `disabled: true` | **PASS 2/2 boots, 6/6 cases, `surfaceACount 31`** — the Member works, but the pair is **gone**: with the placeholder disabled the post-deny surface no longer carries the names, so `confinedWebSpecOf` declines and PD-27's feature silently disappears (`archive/experiment-row-disabled-surface31/`) |

The absolute-URL run reproduces the Owner's predicted surface exactly (31 + the web
pair) and every PD-28 row stays item-by-item equal to PD-26: `skillFacts
{total 2, allow 1, deny 1, IO_READ_DENIED}`, `presentFacts {4,2,2}`, exactly
**1** `deliverables/presented`, `factTools {bash:3,read:2,grep:1,skill:2,present:4}`,
`guardAllow 9 / guardDeny 3`, `requestsCarryingSecret 0`, `aModelRequests 19`. So the
merged tree is correct, this lane's seam still holds at 33, and the **only** defect is
the row's specifier form. The absolute path is worktree-local and is not a proposed
product form; making the row loadable for real is the web lane's call, not this lane's,
and this lane will not edit that row to fix it.

The fourth row of that table is the important negative result for whoever fixes it:
**deleting or disabling the row is not an equivalent fix**. It yields a bootable tree
and a green suite, but at surface **31** — `confinedWebSpecOf` only places names that
are already on the post-deny surface, so removing the placeholder removes PD-27's pair
instead of governing it. The fix therefore has to keep the names on the surface with a
loadable specifier, not remove them.

**The reusable rule, stated once so nobody has to rediscover it.** *A preset row's
specifier must resolve in the host's module graph; a bundle-subpath name only resolves
at the profile layer.* `dsh-agent-team/host` and `dsh-agent-team/spill-local` work
because profile rows are loaded by the **bundle** loader, which maps our package's
`exports` from the `package.json` sitting next to `cordis.patch.yml`. A row inside
`preset-a5sf-governed-member` is loaded by the **preset** registry, anchored in the
host tree, where no `dsh-agent-team` package exists. That sentence is the difference
between "the module does not exist" and "the module exists but this layer cannot see
it" — i.e. between a missing tool and a dead preset. The failure mode is the dangerous
half: the entry gets **no fiber**, the audit says `never started`, and the *Member
creation* fails, so every tool of the preset disappears at once instead of one name
being absent.

**Scope of that claim, because it decides what the fix is — and the fix is NOT a
product line.** The failure is proven for **this repo's DEV-LIVE layout**: the host
runs from `tests/deepseek-harness-test-use` and the bundle is the repo root, so
`dsh-agent-team` exists in no `node_modules` on the host's resolution path. The *same
spelling resolves* as soon as the bundle is on that path: this lane verified it with a
symlinked `node_modules` (`import('dsh-agent-team/web-tool')` → loads
`a5sf-confined-web`), and the Owner reproduced it independently on a pristine `master`
worktree by linking the repo into the host tree's `node_modules` — same result, exports
including `isConfinedWebFace`, exactly what `package.json`'s
`exports["./web-tool"]` declares. So **the row is correct for a packaged install; our
harness boots a tree whose bundle was never installed and then blames the preset.** The
remediation is instrument-side — provision the bundle into the pinned host tree's module
resolution, and gate every live arm on a hard precondition (`no row reported
never started`, `surfaceACount > 0`) before any case may be read — and **no product
line changes**. Recorded here because the measurement that establishes it was taken to
decide this lane's re-bind, not because this lane owns the row.

**What this cost, and why it was not caught at home.** In this harness, for one merge
window (from `#676` until the harness fix) the **shipped** governed preset could not
construct a Member at all: `createMember` failed with `tool-web … never started`, so a
governed Member had **zero** tools — **every confined face went with it, not one name**:
`skill`, `present`, `read`, `grep`, `shell`, the web pair, all of them, because the
failure is the preset entry tree, not a single row. It went one name too far and took
the whole surface.

It was caught by a **cross-lane re-bind** — this lane merged master and booted the
merged tree — and not by the lane that introduced it, and the reason is the reusable
lesson: **that lane's driver rewrote the row it was testing.** Its host-free rows mount
the module by absolute `file:` URL, which resolves fine, so its measurements booted a
tree that was **not** the shipped one: green host-free arms, green install arms, and a
composition nobody had started. **The instrument substituted the subject** — the row
under test was replaced by a form of the row that always works, so the arm could not
fail for the reason the product fails. That is the lesson, and it is not "write more
tests": the lane had tests for its module. It is that **a lane must boot the composition
as shipped, with no override, before claiming the name is back** — and that a re-bind on
a merged tree is the cheapest instrument that catches this class of defect, because it
is the only run whose input is exactly what a user gets.

**Consequence for this lane's evidence.** The bound live pair for the product claim
stays the pre-merge one (`archive/pre-merge-6f9a8c1/`, §4.1) — the lane's own claim
is unchanged by PD-27. The re-bound pair on the merged tree is **not** claimed: `runs/`
holds the honest failing pair, and the passing pair exists only as the disclosed
one-line experiment above.

---

## 5. Before/after, and why it is host-free

A boot always runs the tree it is in, so a "prefix" boot on this branch would
execute the fixed code with a byte-identical composition and measure nothing.
PD-26's before/after was possible because its fix was *composition-level*
(a `cordis.patch.yml` row). PD-28's fix is **code-level** (a provider, a mount
mode), so its before/after is measured **host-free**, against the real
`mountMemberA5sfRealm` + `attachA5sfNativeToolModules` + real pinned
`dsh-tool-skill` / `dsh-tool-present` / `dsh-skill` packages + the real compiled
guard:

```
A5SF_PD28_PIN=1 node --test tests/world-factory/a5sf-pd28-service-seam.test.mjs
```

`PD28-PIN` (skipped unless `A5SF_PD28_PIN=1`) boots the **pre-fix** composition
on the same tree:

| reading | pre-fix (PIN) | post-fix (this lane) |
| --- | --- | --- |
| `skill` in-lane | typed **`unknown tool "skill"`** (no provider anywhere) | declared body returned |
| `skill` out-of-lane | `unknown tool`, **0 facts** | `IO_READ_DENIED`, **0 bytes**, `1` deny fact |
| `present` in-lane | tool present, but **0** `deliverables/presented` events (routed mount drops the listener) | exactly **1** event, 2 allow facts |
| `present` out-of-lane (existing) | **ACCEPTED through the BASE `fs`** — a real out-of-lane file, **0 facts**, 1 event | `IO_READ_DENIED`, 0 facts → 1 deny fact, **0 events** |
| `present` out-of-lane (missing) | `file not found` through the BASE `fs` — an existence oracle, **0 facts** | `IO_READ_DENIED`, no `not found`, `1` deny fact |

The two mutation controls (also in `mutation-controls.log`) make the arms
load-bearing rather than decorative:

| control | change | must redden | measured |
| --- | --- | --- | --- |
| **M1** | `A5SF_PD28_SKILL_FS=base` — the realm's `skills` provider reads through the BASE `fs` instead of the confined one | `PD28-SKILL` **only** (out-of-lane body must appear) | reddens `PD28-SKILL`, nothing else |
| **M2** | `A5SF_PD28_PRESENT_ROUTED=1` — mount `present` through the registration router again | `PD28-PRESENT` **only** (the event must vanish / the OOL read must be accepted) | reddens `PD28-PRESENT`, nothing else |

`VERDICT PASS 8/8` (clean, M1, M2, PIN × both their positive and negative
expectations).

---

## 6. What is fixture, and what is product

- **Fixture**: the model is the shared scripted mock
  (`packages/tools/harness/mock-deepseek.mjs`); the skill files, the in-lane
  deliverable and the out-of-lane secret are World files; the transcript is a
  real delegated Member turn produced by that mock.
- **Product**: the shipped `cordis.patch.yml` rows and the opt-in
  `preset-a5sf-governed-member`; the realm provider/compiler; the confined `fs`
  provider and its guard sink (PD-17, `createMemberFsGuard` →
  `a5sf-guard-consult/1` facts); the route-C attach including the new direct
  mount; the new Team skill provider; and the **pinned host** `tool-skill` /
  `tool-present` packages (host tree read-only, `porcelain` empty before and
  after).

**Scope note — this lane asks for no further removals.** PD-25's fail-closed
removals (`goal` trio / `ask_user_question`) and the Goal trio's caller-writable
round cap are, per the Owner's Alpha.5 Preview scope, a **deliberate, accepted
boundary**: `ask_user_question` stays deferred and the cap stays acceptable until
a separate goal work package lands. Nothing in this lane reopens that decision,
and the "delete the consumer fork" pattern above is not an argument for closing
more tools — it is an argument for fixing the *service* when a name has to exist.

## 7. Gates

| gate | result |
| --- | --- |
| `node --test tests/world-factory/a5sf-pd28-service-seam.test.mjs` | 4 pass, 1 skipped (PIN) |
| `A5SF_PD28_PIN=1 node --test …` | 5 pass, 0 skipped |
| `node tests/world-factory/a5sf-pd28-mutation-controls.mjs` | `VERDICT PASS` (8/8) |
| live pair, pre-merge tree `6f9a8c1` (`archive/pre-merge-6f9a8c1/`) | **PASS** 2/2 boots, 6/6 cases each, `agreeing=true differing=[]`, surface 31 |
| live pair, merged tree `9c730c3d7` (shipped state, `runs/`) | **FAIL** 2/2 agreeing: no Member created (`tool-web … never started`) — master's regression, §4.3 |
| live pair, merged tree with the row's one-line specifier experiment (`archive/experiment-row-file-url-PASS/`) | **PASS** 2/2 boots, 6/6 cases, surface **33**, every PD-28 row equal to PD-26 |
| p4t6 (`npx vitest run packages/testkit/test/p4t6-session-event-scan.test.ts`) | 20/20 (booking `pd28-service-seam.json`: 1447 pre-merge, **1448 = 983 + 465** on the merged tree, 0 violations) |
| `plugin-dsh-compat` (frozen ten host-provides names) | 13/13 — no peer was added to root `peerDependencies` |
| a5sf family (`node --test` over the PD-1/12–19/21/23–26/28 suites + `a5sf-native-route-c` + PD-27) | 136 tests, 0 fail (pre-merge count 124; PD-27's 9+1 and the PIN arms included) |
| `pnpm -r typecheck` | 9/9 packages done |
| `npx eslint` on the changed product files | 0 errors (the 129 repo-wide errors are pre-existing and untouched) |
| `pnpm check:artifacts:head` / `check:artifacts:committed` | ok (post-commit) |
| `docs:probe --base origin/master` / `docs:sync --check` | 0 blocking / 0 blocking |
| `ci-pr-gate --only state-freshness` | pass |
| `eb3-evidence-guard` / `eb3-run-manifest` | pass / pass |
| `tests/world-factory/a5sf-debt-register.test.mjs` | all legs green except **`(c)` ids contiguous** — see the disclosure below |
| `check-install-manifest` | **8** issues on the merged tree — the same set as master's own; this lane adds none |

**Register contiguity: CLOSED.** The pre-merge tree was red on `a5sf-debt-register`'s
`(c)` leg by construction (`PD-1…PD-26, PD-28` is not contiguous); PD-27 landed on
master as #676, so the merged tree now carries `PD-1…PD-28` with no gap, no reserved
id and no exception, and the leg is green.

**Superseded arms, disclosed:** PD-26's host-free suite pinned the two forks, so its
three fork-importing arms now carry `{ skip: 'superseded by PD-28 …' }` (2 still run:
the composition arm and catalog validation, which now reads the provider's
normalizer); PD-26's mutation controls print a SUPERSEDED line and exit 0 rather than
mutate a file that no longer exists. Neither writes into PD-26's evidence.

## 8. Reproduce

```
# host-free seam proof + before/after
node --test tests/world-factory/a5sf-pd28-service-seam.test.mjs
A5SF_PD28_PIN=1 node --test tests/world-factory/a5sf-pd28-service-seam.test.mjs
node tests/world-factory/a5sf-pd28-mutation-controls.mjs

# the live pair (slot-leased; 3180-family ports; DSH_HOME under tests/homes/)
node tests/world-factory/drivers/a5sf-pd28-service-seam/run-boot.mjs
```
