# a5sf-p2-wiring — the PRODUCT-ROW half of the Alpha.5 P2 seam

> **Dated 2026-11-03 (real UTC at authoring time).** Alpha.5 Sandbox-First P2
> wiring prerequisite, after the two measurements named by `BL-14/P2-01` and the
> P2 seam package (PR #548): the mechanism existed and was proven host-free, but
> the compiled a5sf realm was **unreachable from the product row**.
> Branch `task/a5sf-p2-wiring-20261103`, worktree `.worktrees/a5sf-p2-wiring`,
> base `origin/master` = `7007fe672`.
>
> **NO HOST BOOT WAS PERFORMED BY THIS PACKAGE.** No tier that spawns a Host was
> run, no port was bound, no `DSH_HOME` was created, no `tests/homes/**` was
> written, and the shared host-start budget pool was **not** consumed — the pool
> is **0** and a live run still needs a USER ruling. Every measurement below is
> host-free.
>
> **CORE PATCH BUDGET = 0.** No upstream tree was read or written;
> `packages/**` changes here are Team's OWN packages. `tests/deepseek-harness-test-use/`,
> `AGENTS.md`, `docs/plans/active/**`, the authority pointer, `graph.yaml`,
> `scripts/a5sf-diag.mjs` and the other worktrees are untouched.

## 0. The gap this package closes (and the four steps it was measured as)

`dev/agent-workflow/evidence/a5sf-p2-seam/README.md` §4/§9.2 measured the
remaining work as **more than a call site**, four steps:

1. **Emit enrolment** — `packages/runtime/tsconfig.build.json` included neither
   `team-services/src` nor `member-io-policy/src`, so `mountA5sfRealm` resolved
   to nothing from the built runtime; the committed, freshness-gated
   `packages/runtime/dist` carried zero such artifacts.
2. **The call site** — no product code called the entry point
   (`agent-bindings.mjs` is the live Member setup callback).
3. **Host-free proof** — the call site had to be exercisable with fake
   root/member/compiled objects, including the default path and fail-closed
   transport.
4. **Measured evidence** — this package.

All four are done here. What is still NOT proven is listed in §7.

## 1. Step 1 — emit enrolment, dist placement, committed regeneration (DONE)

### 1.1 `packages/runtime/tsconfig.build.json` — enrolment by FILE, not by lane

```json
"team-services/src/mount.ts",
"team-services/src/guard-observability.ts"
```

**Why these two files and not the two directories.** `tsconfig` `include` is not
the emitted set: TypeScript compiles the import closure. `mount.ts` pulls
`install.ts` → `fs.ts`/`types.ts` → `member-io-policy/src/{types,path-rules,provider-capabilities}.ts`,
which is exactly what the built runtime needs — **measured emitted set: 5
`team-services` modules + 3 `member-io-policy` modules**. Enrolling the lane
*directories* would additionally emit `team-services/src/index.ts` +
`manifest.ts` (the Cordis loader/include plugin surface) and
`member-io-policy/src/{index,compile,invocation,approval-takeover,trust-registry}.ts`;
`compile.ts` imports `packages/domain` at RUNTIME, which this emit does not
carry, so a directory enrolment would ship a dist module whose import cannot
resolve. The file enrolment is the minimal closure the row actually resolves.

Measured emitted artifacts (committed):

```
packages/runtime/dist/packages/runtime/team-services/src/{fs,guard-observability,install,mount,types}.{js,js.map,d.ts,d.ts.map}
packages/runtime/dist/packages/runtime/member-io-policy/src/{path-rules,provider-capabilities,types}.{js,js.map,d.ts,d.ts.map}
```

(32 files; no `index`/`manifest`/`compile` artifact appears — verified by
`find packages/runtime/dist/packages/runtime/team-services`.)

### 1.2 `scripts/dist-placements/120-a5sf-p2-wiring.json` — the `.mjs` mirror entry

tsc never emits `.mjs`. The new call-site helper
`packages/runtime/src/plugin/live/a5sf-realm-row.mjs` is imported by the
byte-copied glue, so it must ride the dist mirror (the GLUE-6 law, and the one
home the artifact gate imports):

```
packages/runtime/src/plugin/live/a5sf-realm-row.mjs
  -> packages/runtime/dist/packages/runtime/src/plugin/live/a5sf-realm-row.mjs
```

`node scripts/place-dist-glue.mjs` now reports `101 placement(s)` (was 100).

### 1.3 Regeneration and the freshness gate

Build command is the repo's own (`package.json` scripts):
`pnpm -r build` then `node scripts/place-dist-glue.mjs`. The regenerated tree is
committed in the same commit as the source change, so
`node scripts/check-artifacts-committed.mjs` passes:

```
DSH-ARTIFACT-VERDICT script=check-artifacts-committed subject=index verdict=ok compared=1916 glue=101
[check-artifacts-committed] OK: 1916 files — working tree equals the git INDEX for both install surfaces (incl. 101 glue placement(s)).
```

`compared` moved 1883 → 1916 (+32 emitted TS artifacts + 1 new `.mjs` mirror).
No pre-existing dist artifact changed except the ones the build owns
(`host.js`/`.d.ts`/maps, the `agent-bindings.mjs` mirror, `plugin/types.d.ts`),
because this round edits `host.ts` and `plugin/types.ts`.

## 2. Step 2 — the call site (DONE, additive, default-preserving)

### 2.1 The one exported helper the product row calls

`packages/runtime/src/plugin/live/a5sf-realm-row.mjs` (NEW, plain JS like its
sibling glue):

| export | law |
|---|---|
| `a5sfRealmConfigOf(config)` | reads `config.a5sfEvidencePath`; absent ⇒ `undefined`; present non-blank string ⇒ frozen `{ evidencePath }`; present but blank/non-string ⇒ `TypeError` at row assembly (fail loud, never a silently disabled sandbox lane) |
| `mountMemberA5sfRealm({ root, a5sfConfig, provider, member })` | the ENABLEMENT LAW: **active iff** a row-configured `evidencePath` AND a resolved provider exist; otherwise `undefined` with **no provider call, no sink, no mount, no file write**. Active: builds the seam's own `createGuardConsultFileSink({ path })`, passes `(fact) => sink.record(fact)` as `onGuardConsult` to the ONE entry point `mountA5sfRealm`, returns the mounted realm untouched. No catch, no downgrade — a sink failure stays `GUARD_OBSERVATION_FAILED` (fail-closed) |

It is **not a second mount path**: it composes `mountA5sfRealm` (which composes
the two existing installers). It compiles nothing: the compiled
`CompileResult<MemberPolicy>` ceilings / `EffectiveIoPolicy` lanes arrive from a
row-supplied provider, because compiling or re-deciding a lane is the policy
compiler's authority, never this glue's.

### 2.2 `packages/runtime/src/plugin/live/agent-bindings.mjs`

Additive only:

1. **import** of the helper (with the rationale comment);
2. **optional dep** `deps.a5sfRealmProvider` — the LAZY accessor
   `() => { compiledFor } | undefined` (the `jobs`/`agentPresets` accessor
   pattern, so a service mounted after the factory is still seen). Factory-time
   validation: present but not a function ⇒ typed `Error`;
3. **`const a5sfRowConfig = a5sfRealmConfigOf(config)`** once at assembly
   (invalid config fails at row assembly, not at the first Member);
4. **the call site**, immediately after `consumptionState.set(sessionId, state)`
   in the shared `agentSetup` — i.e. right after `resolveConsumptionViews`
   resolved the **durable MemberInstance admission** and its bound template, and
   before any tool surface is mounted:

```js
if (a5sfRowConfig !== undefined && a5sfRealmProvider !== undefined && sessionId !== teamRoot) {
  const a5sfRealm = await mountMemberA5sfRealm({
    root: agentCtx,
    a5sfConfig: a5sfRowConfig,
    provider: a5sfRealmProvider,
    member: { sessionId, instanceId, teamRootSessionId: teamRoot, templateId: boundTemplate?.templateId, bindPath },
  })
  if (a5sfRealm !== undefined) toolDisposers.push(() => a5sfRealm.dispose())
}
```

* **member only** — `sessionId !== teamRoot`: a LEADER session owns no
  MemberInstance and never mounts;
* **disposer on the row** — `toolDisposers` is the row-stop drain (the same
  drain the model selection and tool registrations use); `dispose()` is
  idempotent and the agent-scope unwind covers it as well;
* **default-preserving** — both halves absent is one `&&` short-circuit: no
  provider call, no Context touched, no file written. The legacy path is
  byte-identical in behaviour.

### 2.3 `packages/runtime/src/plugin/host.ts` + `packages/runtime/src/plugin/types.ts`

* `host.ts` passes `a5sfRealmProvider: () => ctx.get('teamA5sfRealm') as { compiledFor(member: unknown): unknown } | undefined`
  (the lazy `ctx.get` accessor pattern; **not** in the hard `inject` array — an
  absent service keeps every non-a5sf row byte-identical).
* `types.ts` adds the JSON-safe `readonly a5sfEvidencePath?: string` field to
  `TeamPluginConfig` with the enablement law documented. The path comes from the
  **run/evidence configuration the operator boots with** — never derived, never
  hardcoded, never defaulted.

## 3. Step 3 — host-free proof (DONE)

`tests/world-factory/a5sf-p2-wiring.test.mjs` — 7 `node:test` arms, all
host-free (in-process Cordis unit root, `mkdtemp` fixtures, no boot/port/
DSH_HOME). RED → GREEN logs are `red-test.log` / `green-tests.log`.

| arm | law |
|---|---|
| W1 | the helper mounts ceiling + binding through the REAL installers with the row-configured sink; exactly one fact per consultation (schema `a5sf-guard-consult/1`, realm/member/binding/revision/method/locator/decision), and `dispose()` **really unmounts both realms** (same-identity remount proves it; while mounted the second mount answers `SERVICE_ALREADY_INSTALLED`) |
| W2 | default path does nothing: no config ⇒ `undefined`, the provider accessor is **never called** |
| W2b | config without provider ⇒ `undefined`; provider answering `undefined` ⇒ no mount; no sink file in either case |
| W3 | sink failure fails closed: the consulted call rejects `GUARD_OBSERVATION_FAILED` (decision + cause on the error) and `providerReads === 0` — an unrecorded decision never becomes an effect |
| W4 | config reader: absent ⇒ `undefined`; blank/`42`/`{}`/`[]` ⇒ `TypeError`; valid ⇒ frozen block |
| W5 | malformed provider answers (non-object, no `compiledFor`, empty `members`, non-array `bindings`) throw — a declared wiring that cannot mount is a fault, not a no-op |
| W6 | structural pin of the glue call site: the helper import, the both-halves guard, `sessionId !== teamRoot`, and the row-kept disposer |

**RED** (`red-test.log`) — the suite run against the BASE source
(`git stash push -u -- packages/runtime/src/plugin/live/a5sf-realm-row.mjs packages/runtime/src/plugin/live/agent-bindings.mjs`,
test kept): the failure is the absent wiring, not a missing test.

```
$ node --test tests/world-factory/a5sf-p2-wiring.test.mjs
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/packages/runtime/src/plugin/live/a5sf-realm-row.mjs'
ℹ pass 0   ℹ fail 1   [exit=1]
```

**GREEN** (`green-tests.log`) — the exact commands and their real tails:

```
$ node --test tests/world-factory/a5sf-p2-wiring.test.mjs     ℹ tests 7  ℹ pass 7  ℹ fail 0
$ node --test tests/world-factory/a5sf-p2-seam.test.mjs       ℹ tests 14 ℹ pass 14 ℹ fail 0
$ node --test tests/world-factory/a5sf-harness.test.mjs       ℹ tests 10 ℹ pass 10 ℹ fail 0
$ node --test tests/world-factory/a5sf-evidence.test.mjs      ℹ tests 12 ℹ pass 12 ℹ fail 0
$ node --test tests/world-factory/a5sf-read-gate.test.mjs     ℹ tests 13 ℹ pass 13 ℹ fail 0
$ ./node_modules/.bin/vitest run a5sf                         11 files / 166 tests passed
$ ./node_modules/.bin/vitest run packages/testkit/test/p4t6-session-event-scan.test.ts   20/20
$ pnpm -r typecheck                                            all 9 packages Done
$ pnpm -r build                                                all 9 packages Done
$ node scripts/check-artifacts-committed.mjs                   OK: 1916 files, glue=101
$ node scripts/eb3-ci-required.mjs                             pass workflows=9 findings=0
$ node scripts/eb3-ci-negative-controls.mjs                    24/24 controls behaved as required
```

CI enrolment (so the laws run in a layer, not only locally): ONE
`.github/workflows/ci-integration.yml` step and ONE
`dev/ci/eb3-ci-manifest.json` leg `a5sf P2 wiring` pinning the file token. What
the checker enforces is narrow: the matching `run:` invocation must carry the
file. An emptied `check[]` is not machine-detected (an inherited limitation of
every leg) — keeping the token is a review obligation, not a machine law.

## 4. What is now resolvable from the BUILT runtime (probe)

Run from `packages/runtime/dist` (no Host, no boot), importing the PRODUCED
artifacts exactly as the product row would:

```
$ cd packages/runtime/dist && node --input-type=module -e "…"
mountA5sfRealm      : function
createGuardConsultFileSink : function
readGuardConsultFile: function
GUARD_CONSULT_SCHEMA: a5sf-guard-consult/1
a5sfRealmConfigOf   : function
mountMemberA5sfRealm: function
createAgentBindings : function
host module exports : apply,buildGovernanceWarningContains,buildGovernanceWarningDocs,defaultGlueUrl,defaultSeamUrlCandidates,degradedAnchorBootLine
```

The stronger form is also measured: the WHOLE placed glue module graph imports
from the mirror without a Host —

```
$ cd packages/runtime/dist && node --input-type=module -e "import('./packages/runtime/src/plugin/live/agent-bindings.mjs')"
dist glue imported : true
glue exports count : 5
```

That means every relative edge of the product row now resolves inside `dist`:
the glue → `a5sf-realm-row.mjs` (mirror) → `../../../team-services/src/mount.js`
(emitted) → `./install.js`/`./fs.js` → `../../member-io-policy/src/*.js`
(emitted). Before this round the same import chain ended in
`ERR_MODULE_NOT_FOUND` for `team-services/src/mount.js`.

## 5. The measured p4t6 tie (`packages/testkit/test/p4t6-bookings/a5sf.json`)

ONE new scannable path (`packages/runtime/src/plugin/live/a5sf-realm-row.mjs`).
Every other touched file is already counted (`agent-bindings.mjs`, `host.ts`,
`plugin/types.ts`, the team-services sources) or outside the scan
(`packages/runtime/dist`, `scripts/dist-placements`, `tests/**`,
`.github/workflows`, `dev/**`).

Measured on THIS worktree, **after the final build and dist regeneration**, not
copied — with the helper on disk and the old booking still at `{1396, 1427}`:

```
scanner counts 1428, ledger derives 983 + 444 = 1427
AssertionError: expected 1427 to be 1428
```

Booked by name ⇒ 32 paths ⇒ the tie re-anchors to the booking's own 31-path sum:
`expectedDelta {from: 1396, to: 1428}`. Re-run: **20/20 pass**. The dist
regeneration moves the scan by **zero** (dist is outside the scanned tree) —
that is why this was measured last.

## 6. Diff surfaces

| file | why |
|---|---|
| `packages/runtime/tsconfig.build.json` | +2 file enrolments (the minimal import closure) |
| `packages/runtime/src/plugin/live/a5sf-realm-row.mjs` | **NEW** — the exported call-site helper (config reader + sink + mount) |
| `packages/runtime/src/plugin/live/agent-bindings.mjs` | additive optional dep + the guarded Member-setup call site + row-kept disposer |
| `packages/runtime/src/plugin/host.ts` | passes the lazy `teamA5sfRealm` provider accessor |
| `packages/runtime/src/plugin/types.ts` | `a5sfEvidencePath?: string` (JSON-safe row config) |
| `scripts/dist-placements/120-a5sf-p2-wiring.json` | **NEW** — the `.mjs` mirror placement |
| `packages/runtime/dist/**` | regenerated + committed (32 emitted TS artifacts, 1 mirror, 4 rebuilt host/type artifacts) |
| `.github/workflows/ci-integration.yml` | ONE CI step for the new node:test suite |
| `dev/ci/eb3-ci-manifest.json` | ONE `a5sf P2 wiring` leg pinning the file token |
| `packages/testkit/test/p4t6-bookings/a5sf.json` | measured tie `{1396, 1428}` + the one new path |
| `tests/world-factory/a5sf-p2-wiring.test.mjs` | **NEW** — 7 host-free arms |
| this evidence package | README + RED/GREEN logs |

## 7. What is STILL not proven (do not read any of this as C2)

1. **No Host was booted** — boot budget is still 0 and a live run needs a
   recorded USER grant. Nothing here claims a booted Host mounted the realm.
2. **No live agent row executed the call site.** The call site is proven
   host-free over the real installers with a fake Context/member/compiled
   objects; "a real Team member row mounted it during a live setup" is NOT
   proven. W6 pins the call-site SHAPE (source-level), not its live execution.
3. **No kernel / OS enforcement** (no Landlock/seccomp claim) and **no native
   `read` effect**: BL-14's own live half is untouched.
4. **No Host-attributable effect** and no live-pid conjunct in the oracle.
5. **The compiled objects are injected, not produced product-side.** This round
   wires the mount; it does not add a product policy compiler. A row must
   provide `teamA5sfRealm` (`compiledFor`) + `config.a5sfEvidencePath` for the
   wiring to activate. Whichever lane supplies the compiled ceilings is still
   the missing production half — this package makes the mount **reachable**, not
   **self-activating**.
6. **Tamper-evidence**: the JSONL file is unsigned transport, not authority.
7. **The evidence path is not sandboxed** by this code — it is the operator's
   run/evidence configuration; the parent directory must exist.

## 8. The one risk for the reviewer

**The activation depends on a service (`teamA5sfRealm`) that no row in this
tree provides yet.** The wiring is reachable and proven, but it is inert until a
composition supplies the compiled-realm provider — so a reviewer must not read
"wired" as "active in production". The honest statement is: the call site, the
emit, the dist artifacts and the freshness gate are now in place; the
production compiled-realm provider is the next half and is NOT part of this
package.
