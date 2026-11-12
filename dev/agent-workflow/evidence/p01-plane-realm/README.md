# P01 — Plane × Realm: the **realm BINDING repair** (`P01-PLANE-REALM`)

**Branch:** `task/p01-plane-realm-20261111` (worktree `.worktrees/p01-fix`), base
`origin/master` @ `b5df94c3f` (PD-41 #719).
**Class:** repo **live** evidence. DEV-LIVE, n=1 (see "What this is not").
**Scope after the owner's ruling (2026-11-11):** Task A only — **realm binding
repair**. Deliverable B (routing the plane's `bash` onto the realm's confined
terminal face) was **withdrawn from this lane mid-flight**; the adapter, its
dist placement and its injection are **not on this branch**. The measurement it
produced before withdrawal is kept below, clearly labelled, because it is the
evidence for the `bash`-ownership finding.

## Result (read this first)

| proposition | verdict |
| --- | --- |
| a Member realm's FORWARDED native tools (`read`/`write`/`edit`/`read_image`) are DECLARED to the closed-world Guard and bound `verified` | **PASS** — host-free A1–A5 + real Host (`a5sf-bind: realm-forwarded names declared=[read,write,edit,read_image]`) |
| a `write` INSIDE the v5-compiled ceiling succeeds **with an `a5sf-guard-consult/1` ALLOW fact on the realm sink** | **PASS** (DEV-LIVE, n=1) |
| a `write` OUTSIDE the ceiling is refused with the typed deny and **zero bytes** on disk | **PASS** (DEV-LIVE, n=1, `IO_WRITE_DENIED`) |
| a Member **without** a realm is byte-identical | **PASS by construction + regression** (no attach ⇒ nothing declared; `a5sf-native-route-c` 8/8, `a5sf-dual-plane` 53/53, `a5sf-governed-preset` 17/17, `a5sf-bash` 21/21, `a5sf-fs-contract` 20/20 stay green) |
| **the plane's `bash` is the NATIVE DSH tool definition** | **NO — REPORTED FINDING, not fixed here.** See "P0 finding: plane `bash` ownership" |

The binding repair is what the PD-42 live run was missing: before it, every
Member with a declared permissions policy was refused `TOOL_BINDING_UNVERIFIED`
on `read`/`write` (PD-42 evidence, `dev/agent-workflow/evidence/pd42-v5-cellings/README.md` on
branch `task/pd42-v5-cellings-20261111`, rows "in-ceiling `write` allowed: no"). After it, the SAME world allows the
in-ceiling write and refuses the out-of-ceiling one through the compiled
ceiling.

## Exact product change (2 files, both assigned)

### `packages/runtime/src/plugin/live/a5sf-realm-row.mjs` (+107)

* `a5sfAttachedToolNames(fibers)` — reads the registration receipts the mount
  itself publishes (`NATIVE_REGISTRATION_ROUTING`, mount.ts:1906-1926) and
  answers the **`routing.forwarded`** names of **`realm === 'ceiling'`** fibers,
  in fiber order, deduped. It never reads `observed` (which also lists names the
  router DROPPED for a sibling fiber) and never a module's `expectedTools` (a
  declaration, not a measurement). A binding-targeted fiber forwards exactly one
  name owned by another realm and is excluded.
* `a5sfBindableRealmNames({attachedNames, surface, planeOwned, lookup})` — the
  ONE admission predicate, pure and dependency-free so the wiring and a
  host-free proof judge the **same** table. A name is declared **only** when all
  four arms hold: forwarded (above) **AND** on the post-attach model surface
  **AND** not plane-owned/placement **AND** readable at
  `tools.get(name, runtimeAgent)` (the same gate `bindAll` applies,
  install.ts:1173-1185). Anything else is `skipped` with a named reason and
  keeps the pre-P01 refusal.

### `packages/runtime/src/plugin/live/agent-bindings.mjs` (+75)

* the route-C attach's **return value is now captured** (`a5sfAttachedFibers`) —
  it was `await`ed and discarded, which is why the receipts were unreadable;
* after the plane placed (so its own names/placement feed are known) the
  predicate runs and each declared name is pushed into **both** own-name faces:
  * `a5PlaneOwnedNames` → the Guard's `assemblyOwnedNames`, which keeps the name
    OFF the inherited-native lane so `bindInheritedSurface` cannot pin it
    `verified:false`;
  * `ownNames` (before `bindOwnTools`) → the list that actually **mints** the
    verified bind.
  **Neither is the coverage `teamToolNames` list**: these names keep their
  native `PERMISSION_TOOL_NAMES` classification, which is their management fact
  (`read`/`write` must not become "team-tool-owned" to the A2C-2 gate).
* dist mirror updated (`packages/runtime/dist/.../a5sf-realm-row.mjs`,
  `.../agent-bindings.mjs`); `node scripts/check-artifacts-committed.mjs` →
  `verdict=ok`.

`packages/runtime/team-services/src/product-assembly.ts` is **unchanged by this
PR**. The two cherry-picked PD-42 commits (`f900d3d1e`, `b11679ee8`) carry its
v5 gate; see "Sequencing".

## Host-free proof (committed)

`node --test tests/world-factory/a5sf-p01-realm-binding.test.mjs` → **9/9 pass**
(`host-free/p01-realm-binding.test.log`):

| arm | what it proves |
| --- | --- |
| A1 | the receipt reader takes `forwarded` only: an OBSERVED-but-DROPPED name (`bash`) and a binding-realm name never appear |
| A1b | an absent/empty attach answers an empty set |
| A2 | the positive arm: forwarded ∩ on-surface ∩ not-plane-owned ∩ readable ⇒ **declared** |
| A3 | a **plane-owned** name is not double-bound (`skipped: plane-owned`) |
| A3b | off-surface and unreadable names are refused, each by its own reason |
| A3c | an empty receipt declares nothing (never a wide bind) |
| A4 | on the **real guard algebra**: the declared name bound `verified` dispatches with no denial, while the SAME name unverified answers `TOOL_BINDING_UNVERIFIED` / `binding-unverified` |
| A4b | a name ABSENT from `forwarded` is never declared and keeps the pre-P01 refusal |
| A5 | no attach ⇒ no declared names, no skipped names (the no-realm world) |

The suite is in `tests/world-factory/` (outside the `packages/**` p4t6 scan
universe), so **no p4t6 booking is needed**; measured after the change:
`scanned 1506, ledger derives 1506, violations 0` (`host-free/p4t6-measurement.txt`).

## DEV-LIVE real Host (n = 1)

Command (`:3080` never touched; loopback ports 3503/3513; fresh `DSH_HOME`):

```sh
C1_PD42_CELLINGS=1 C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1 node \
  tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs \
  --worktree "$PWD" \
  --testuse /home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-test-use \
  --host-port 3503 --mock-port 3513 --evidence-dir <dir> --keep
```

One Team, ONE saved v5 blueprint carrying BOTH `memberIoCeilings` (worker +
officer) and `reviewRouting` (officer, `whenOfficerUnavailable: hold`). Pinned
host `639ed01539`, plane takeover on, governed Member preset, realm derived from
the SAME bound document.

| field | DEV-LIVE n=1 |
| --- | --- |
| v5 `team.create` with both families | PASS (Officer routing live, `wakes=3`) |
| realm-forwarded names DECLARED | `read,write,edit,read_image` (both governed agents) |
| `write` inside ceiling | **PASS**, file content `pd42-inside-<stamp>`, `allows=1` |
| realm sink facts | **2** — one `writeText` **ALLOW**, one `writeText` **DENY** |
| `write` outside ceiling | **PASS** refused `IO_WRITE_DENIED`, `outsideExists=false` (zero bytes) |
| approved `bash` executed | PASS, `c1-a6-allow-<stamp>` bytes on disk, `succeeded`, `facts=1` |
| durable requests / decisions / consumptions | 2 / 2 / 2 (each consumed once, none pending) |
| durable execution-result | `succeeded`, exactly 1 |
| realm guard facts for the approved `bash` | **0** (see the P0 finding) |

Raw: `dev-live/realm-sink.jsonl`, `dev-live/pd42-ceiling.json`,
`dev-live/a6-execution-result.json`, `dev-live/instance-bind-lines.log`,
`dev-live/checks.log`.

A representative sink line (the ALLOW on the approved path):

```json
{"schema":"a5sf-guard-consult/1","realm":"member","memberIdentity":"inst-0qa2dex0964l","toolBindingIdentity":null,
 "policyRevision":"a5sf1:58236eb2c4338d13b9c27c4dfbf102df","method":"writeText",
 "locator":"…/workspace/pd42-inside-2026-11-11T20-11-04.txt","decision":"allow","decidedBy":"ALLOW",
 "sequence":1,"observedAt":"2026-11-11T20:11:18.970Z","tool":"write","callId":"call-c1-0t4t4qhk"}
```

## P0 finding: the plane's `bash` ownership (reported, NOT fixed here)

**The plane's `bash` remains the product's `bash` on this branch, and its Tool
body is the plane's own row implementation, not the native DSH
`dsh-tool-bash-persistent` definition. That violates A5-NATIVE-01/02** (a
governed tool must be the NATIVE DSH ToolDefinition with only its execution
backend replaced, never a re-implemented body behind the same name/schema).
Closing it belongs to the native-preservation lane (restore the native
definition; wrap `terminal-bash` to apply the Member ceiling). This lane
deliberately did **not** work around it.

Measured support for the finding, from the **withdrawn** experiment (below): when
the plane's shell backend was temporarily served by the Member's own confined
terminal face, the approved `bash` produced realm facts (`spawn` + `spawn:write`,
`policyRevision: a5sf1:…`, `tool: "bash"`, the real `callId`). With that
injection removed — i.e. on this branch, the shipped shape — the same approved
call produces **zero** realm facts (`dev-live/realm-sink.jsonl` has exactly two
facts, both `writeText`). So the approved call is confined by the PLANE's
provider and never touches the Member's compiled ceiling: the ownership defect is
in the tool body/backend, not in the realm's faces.

### Withdrawn experiment (NOT on the branch)

`withdrawn-shell-backend/` keeps the two runs taken while an adapter
(`a5sf-realm-shell-backend.mjs`, + `backends.shell` injection, + dist placement
230) existed. Both runs agreed: `write` in-ceiling ALLOW, out-of-ceiling
`IO_WRITE_DENIED`, approved `bash` **with** realm `spawn`/`spawn:write` facts,
one consumption, one `succeeded`. The owner then ruled that perfecting that
routing keeps a self-implemented `bash` as the product's `bash`, so the adapter,
its injection, its dist placement and its dist mirror were removed before the
commit and the branch's DEV-LIVE run above was taken without it. Nothing in this
PR depends on that code; the evidence is retained only because it measures the
P0 finding.

## What is NOT proven / not done

1. **`PD42-3` (a read OUTSIDE the ceiling refused `IO_READ_DENIED` with a guard
   fact) does not pass, and its arm is wrong by construction** — not a product
   regression. The arm reads the file the denied write never created, at
   `${HOME}/…`, one level ABOVE the realm read root. The governed read row's
   FIRST step is the pure-lexical anchor (`lexicalAnchor(rootDir, rawPath)`,
   `packages/tools/fs-family/src/fs-mechanics.mjs:175-191`), which refuses an
   absolute target that escapes the governed root with `locator-rejected`
   **before** the lane decision and therefore before any guard consult — zero
   bytes, no fact, by design (PR358 fix-5: no fs I/O before approval). A
   read-out-of-lane guard fact needs an IN-ROOT but out-of-lane target, which
   PD42's kit does not construct. Left to the acceptance lane rather than
   bending another lane's kit.
2. **Two-run agreement for the whole conjunction** — this lane delivers n=1
   DEV-LIVE, as instructed; the two-run acceptance belongs to the acceptance
   lane.
3. **Goal from direct human input (≥2 rounds → human Stop → paused) and relay
   `GOAL_TOOL_AUTHORITY_REQUIRED` in the same Team** — not attempted here.
4. **Execution ownership of `bash`** — see the P0 finding.
5. `eslint .`, `check:install-manifest` and the pre-existing
   `tests/deepseek-harness-test-use`-dependent reds were not run/fixed.

## Sequencing (PD-42 dependency)

PD-42's product gate (v5 accepted as a `memberIoCeilings` source) is **not on
`master`** at this branch point; without it the required v5 two-family document
is refused at boot. This branch therefore carries PD-42's two commits
cherry-picked with `-x` (`f900d3d1e`, `b11679ee8`). **#720 merges first, then
this branch is rebased onto the new `master` and the two cherry-picks are
dropped**, with the commit message saying the gate arrived from #720. Do not
merge master in and leave both copies.

## Regression (this tree)

* `node --test tests/world-factory/a5sf-p01-realm-binding.test.mjs` → 9/9
* `node --test tests/world-factory/a5sf-governed-preset.test.mjs` → 17/17
* `node --test tests/world-factory/a5sf-native-route-c.test.mjs` → 8/8
* `node --test tests/world-factory/a5sf-dual-plane.test.mjs` → 53/53
* `node --test tests/world-factory/a5sf-bash.test.mjs` → 21/21
* `node --test tests/world-factory/a5sf-fs-contract.test.mjs` → 20/20
* `npx vitest run packages/runtime/test/u6-arc-a-fitness.test.ts` → 12/12
  (with the named override below)
* `npx vitest run packages/runtime/test/a5p1-closed-world-guard.test.ts
  packages/runtime/test/a5pbr2-binding-feed.test.ts …` → 105/105 across the
  guard / plane-backend / approval-takeover / member-policy / service-install set
* `pnpm -r run typecheck` → all 9 workspace projects `Done`
* `node scripts/check-artifacts-committed.mjs` → `verdict=ok` (after the dist
  mirror is committed with the sources)
* p4t6: `scanned 1506 / ledger 1506 / violations 0` — no new scannable
  `packages/**` file, so no booking.

## ARC-A override

`agent-bindings.mjs` is a protected-centre file. The ledger entry
(`dev/agent-workflow/ledgers/arc-a-protected-center.json`) is a NAMED override
citing `P01-PLANE-REALM`, with the exact post-change digest
(`d0c4549c83f29c47…`) and the reason recorded there. `a5sf-realm-row.mjs` and
`a5sf-realm-shell-backend.mjs`-class files are not floor members; the new
`a5sfBindableRealmNames` / `a5sfAttachedToolNames` helpers live in the row module
this lane owns.

## Files in this evidence directory

| path | what |
| --- | --- |
| `dev-live/realm-sink.jsonl` | the realm sink of the DEV-LIVE run (2 facts: write ALLOW, write DENY) |
| `dev-live/pd42-ceiling.json` | the kit's ceiling-arm record (facts + file/zero-byte readings) |
| `dev-live/a6-execution-result.json` | the durable `succeeded` execution-result fact |
| `dev-live/instance-bind-lines.log` | the Host log line proving the realm names were declared |
| `dev-live/checks.log` | the kit's PASS/FAIL lines for the run |
| `host-free/p01-realm-binding.test.log` | 9/9 host-free binding-repair proof |
| `host-free/p4t6-measurement.txt` | measured scanner total vs ledger |
| `withdrawn-shell-backend/` | the two withdrawn runs (evidence for the `bash` P0 finding only) |
