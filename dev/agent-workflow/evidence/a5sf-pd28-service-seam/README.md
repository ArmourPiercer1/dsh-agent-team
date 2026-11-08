# PD28-SERVICE-SEAM — the confined `skill`/`present` capabilities are served by the SEAM, not by forked tools

> Lane `PD28-SERVICE-SEAM`, branch `task/pd28-service-seam-20261114`, worktree
> `.worktrees/pd28-service-seam`, base `origin/master` = `24d2cf760`. Evidence
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
| `runs/boot01/`, `runs/boot02/` | the agreeing PASS pair (`counters.json`, `member-probes.json`, `guard-facts.json`, `member-transcript.json/.txt`, `leader-surface.json`, `member-surface.json`, `diagnostics-final.json`, `host-log-final.log`, `run-record.json`, `teardown.json`, `summary.txt`) |
| `agreement-postfix.txt` / `.json` | the two-run agreement table, every row identical (`agreeing=true differing=[]`) |
| `mutation-controls.log` | the two mutation controls + PIN, 8/8 |
| `driver.log`, `driver/logs/**` | the driver's own transcript and host instance logs |
| `archive/postfix-2026-11-08T09-48-28-531Z/` | the earlier pair from the same tree, **kept not rewritten**: it is the record of the judge correction described in §4.1 (5/6 on the present arm) and of the archive it replaced |
| `archive/postfix-2026-11-08T09-52-04-000Z/` | the intermediate pair, superseded by the README-bearing CLI rerun |
| `archive/pre-fix/` | the PIN arm's own transcript (`a5sf-realm-row.mjs` at `24d2cf760` + the module list it composed) |

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

## 7. Gates

| gate | result |
| --- | --- |
| `node --test tests/world-factory/a5sf-pd28-service-seam.test.mjs` | 4 pass, 1 skipped (PIN) |
| `A5SF_PD28_PIN=1 node --test …` | 5 pass, 0 skipped |
| `node tests/world-factory/a5sf-pd28-mutation-controls.mjs` | `VERDICT PASS` (8/8) |
| `node tests/world-factory/drivers/a5sf-pd28-service-seam/run-boot.mjs` | 2/2 boots, 6/6 cases each, `agreeing=true differing=[]` |
| p4t6 (`npx vitest run packages/testkit/test/p4t6-session-event-scan.test.ts`) | 20/20 (booking `pd28-service-seam.json`, measured 1447 = 983 + 464) |
| a5sf family (`node --test` over the PD-1/12–19/21/23–26/28 suites + `a5sf-native-route-c`) | 124 tests, 0 fail (15 skipped: the PIN arms and pre-existing skips) |
| `pnpm -r typecheck` | 9/9 packages done |
| `npx eslint` on the changed product files | 0 errors (the 129 repo-wide errors are pre-existing and untouched) |
| `pnpm check:artifacts:head` / `check:artifacts:committed` | ok (post-commit) |
| `docs:probe --base origin/master` / `docs:sync --check` | 0 blocking / 0 blocking |
| `ci-pr-gate --only state-freshness` | pass |
| `eb3-evidence-guard` / `eb3-run-manifest` | pass / pass |
| `tests/world-factory/a5sf-debt-register.test.mjs` | all legs green except **`(c)` ids contiguous** — see the disclosure below |
| `check-install-manifest` | unchanged from base (9 pre-existing issues, only a line shift) |

**Disclosed: the register's contiguity leg is red on this branch by construction.**
`a5sf-debt-register.test.mjs` requires ids to be exactly `PD-1…PD-n`. PD-27 is the
**in-flight web lane** (`task/pd27-web-egress-20261114`, not merged, its row sits at
the same insertion point on its branch), so `PD-1…PD-26, PD-28` is not contiguous
until that lane merges. This lane was instructed to take **PD-28** (PD-27 reserved);
the alternatives — renumbering into another lane's id, or fabricating a PD-27 row —
were rejected. Every other register leg (`source` mention, anchors resolving,
required fields, consequence class, summary/detail agreement) is green.

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
