# a5sf-e8-freeze — close the E8 window by freezing the whole Member's admissions

Lane: `task/a5sf-e8-freeze-20261103`, worktree `.worktrees/a5sf-e8-freeze`.
Base: `origin/master` = **`93b007cd2f496877e70abec4ee5aec25f9be4753`** (#579, merged
forward — the lane started at `6fbe33c01` and merged `93b007cd2` forward; #579 touches
neither `mount.ts`, the row, nor the assembly suite). The evidence is committed at the
branch head it describes (see §12).

**What this lane does:** while a Member's managed realm is **invalidated**, refuse
**every** new tool invocation for that Member at the existing `tools/pre-execute`
admission point — not only the names in `expectedDefinitions`. This is not a second
approval system: it consumes the invalidated state the realm already holds, at the one
admission point that already existed. Rationale: the boundary has failed, so nothing
further should execute. The deny is **realm-scoped**: it lasts while THIS realm is
mounted and invalidated, and it lifts when the Member is disposed and re-assembled with
a verified attach — which is a caller obligation, not a seam invariant (§7 states the
measured boundary).

**Scope note (measured limitation, named so it is not mistaken for a regression):**
`definition.execute()` called DIRECTLY still runs the tool body while the realm is
frozen. That is pre-existing and identical on the base tree; it is unreachable from the
model/PTC path, which goes through `tools.execute` → `tools/pre-execute` and therefore
hits the admission point this lane arms. The freeze is an ABSTRACTION-level refusal at
the documented admission seam, not an OS-level confinement of a caller that already
holds the definition object.

Host boots = **0**. Ports = **0**. No `DSH_HOME`, no `tests/homes/**` write, no
`tests/deepseek-harness-test-use/**` write; every arm is an in-process Cordis unit root
and the measurement probe uses the **real pinned** `@deepseek-ai/dsh-tool-subagent`
(0.2.0-rc.2 @ `639ed01539`) through the real product entries
(`mountMemberA5sfRealm` → `attachA5sfNativeToolModules` → `mount.ts`).
CORE PATCH BUDGET = **0**. `packages/runtime/src/plugin/live/agent-bindings.mjs`
untouched, sha256 **`df9b46af67cd903641285760cd72a78e57986e87959b2fbdbaf3f86dd6c6464b`**
(verified with `sha256sum` at the head).

Changed files (team-owned only): `packages/runtime/team-services/src/mount.ts` (the
seam: freeze + attach record), `packages/runtime/src/plugin/live/a5sf-realm-row.mjs`
(one acknowledged-empty rule + carries the specifier), the committed
`packages/runtime/dist/**` rebuild, and `tests/world-factory/a5sf-assembly.test.mjs`.

## 1. The defect, as measured (not re-derived)

On the base tree, the preset plane's listener registers a name first inside a
synchronous `subagent/provider-added` emission; `tools/change` fires the invalidation
record; teardown is deferred one microtask; and **a dispatch issued from another
listener inside the same emission** was ADMITTED because the newly landed name was not
yet in the managed coverage set. On head, the body that then ran was the confined
managed definition — but it was exactly the definition the record exists to refuse; on
base it was the preset definition with zero guard facts.

### 1.1 RED — the exact sequence, with the real pinned module (`red-probe-e8-freeze.log`)

```
[2026-11-04T05:15:12.335Z] E8-same-emission-dispatch-window-CLOSED: mounted=true elapsedMs=16 preset=[] after=[] routings=[{"realm":"ceiling","forwarded":[],"observed":[],"dropped":[],"forwardedSections":[]}]
[2026-11-04T05:15:12.336Z] E8-same-emission-dispatch-window-CLOSED: FAIL — THE WINDOW CALL IS DENIED (E8 closed) with the freeze code: window={"isError":false,"text":"BASE-PROVIDER-RAN:in-process","info":null}; the refusal says what un-freezes the Member: text=BASE-PROVIDER-RAN:in-process; NO body ran in the window (preset or managed): providerStarts=1; the covered refusal also runs no body: providerStarts=1
[2026-11-04T05:15:12.367Z] RESULT arms=4 PASS:0 FAIL:4
```

The window dispatch was admitted (`isError:false`), the body **ran**
(`BASE-PROVIDER-RAN:in-process`, `providerStarts=1`) while the invalidation record was
already set. `red-probe-e8-freeze.json` is the same run's structured record.

### 1.2 RED — the suite arms (`red-suite-e8.log`, base tree, new arms first)

```
✖ E3-fold (event-driven 2026-11-03) the OTHER order: ...
✖ E8 (freeze 2026-11-03) a dispatch issued inside the boundary emission is REFUSED by the frozen realm; neither body serves
✖ E8-lift (freeze 2026-11-03) the freeze lifts ONLY on a full verified re-assembly — a fresh mount + attach admits calls again
✖ ACK-1 (allowEmpty 2026-11-03) an acknowledged-empty attach carries the flag explicitly; a non-empty attach does not
✖ ACK-2 (allowEmpty 2026-11-03) `allowEmpty` may acknowledge an EMPTY frontier that DECLARED names: accepted, and the names are carried as acknowledged, never as verified
ℹ tests 34 / pass 29 / fail 5
```

The E8 failure verbatim (pre-fix):

```
  AssertionError [ERR_ASSERTION]: a dispatch inside the invalidated boundary must be REFUSED: managed-event-body
  false !== true
```

### 1.3 GREEN — same arms, same tree (this branch)

```
[2026-11-04T06:08:42.733Z] E8-same-emission-dispatch-window-CLOSED: PASS
[2026-11-04T06:08:42.751Z] E8-lift-full-reassembly-admits-again: PASS
[2026-11-04T06:08:42.757Z] ACK-empty-frontier-recorded: PASS
[2026-11-04T06:08:42.764Z] ACK-nonempty-frontier-not-acknowledged: PASS
[2026-11-04T06:08:42.764Z] RESULT arms=4 PASS:4 FAIL:0
```

Suite: `35/35` in `all-a5sf-node-suites.log` (34 before review #1's ACK-2b pin).

## 2. The fix — one admission point, the realm's own state

`mount.ts`'s `admitCoveredTool` (armed on `tools/pre-execute` at a successful attach)
now does:

1. `invalidation === null` → delegate to the rest of the waterfall (unchanged);
2. record non-null → `foldForwardedRegistrations()` (unchanged; it is still the only
   way a name that lands inside the boundary emission enters the managed set);
3. the name **is** a managed covered name → the existing name-keyed refusal
   (`A5SF_NATIVE_SHADOW_INVALIDATED`, same message, same realm naming);
4. **every other invocation** (the window's not-yet-landed name, an unmanaged name, a
   state/non-I/O tool, an unknown name) → the blanket freeze refusal
   (`A5SF_MEMBER_REALM_INVALIDATED`).

No second policy system, no lane evaluation, no new listener. The record is the
realm's own state and the admission point already existed (P0).

## 3. Typed codes and PRECEDENCE (pinned)

| code | when | names |
| --- | --- | --- |
| `A5SF_NATIVE_SHADOW_INVALIDATED` (`A5sfNativeShadowInvalidatedError`) | the realm is invalidated **and** the dispatched name is a covered managed name | the tool name, the Member, the realm that lost the shadow, the record's reason |
| `A5SF_MEMBER_REALM_INVALIDATED` (`A5sfMemberRealmInvalidatedError`) | the realm is invalidated and the name is anything else — including a name that had not landed at admission | the Member, generation, the record's reason, and "nothing further executes … until a full re-assembly mounts a new realm and a new native attach verifies a new shadow (all calls refused until re-assembly)" |

**Precedence is name-keyed first, blanket second.** This is pinned by the suite in two
places: the E8 arm asserts the in-window call gets the blanket code and the covered
call after the emission gets the specific code; `E3`/`E3-fold`/`P0-1` keep asserting
the specific code for covered names (all merged assertions unchanged).

**The accepted cost, stated:** non-I/O calls (state tools, and every unmanaged preset
tool of the same Member) are denied during invalidation too. That is deliberate — the
boundary failed, so nothing further executes; a "this tool does not touch the managed
realm" exemption is not decidable at admission and would recreate the window.

## 4. `allowEmpty: true` is a DECLARED HAZARD, never a verification

A successful managed attach publishes `realm.nativeAttachRecord`
(`schema: 'a5sf-native-attach/1'`):

```ts
{
  emptyFrontierAcknowledged: boolean,      // some accepted module had allowEmpty:true AND forwarded nothing
  emptyFrontierModules: readonly string[], // the module names whose empty frontier was acknowledged
  emptyFrontierSpecifiers: readonly string[], // the ROW-CONFIG specifiers (a5sfNativeToolModules[].url)
  acknowledgedNames: readonly string[],    // declared expectedTools of those entries (see below)
}
```

- **Lifecycle of the record (corrected 2026-11-04, review #1 C1 — the previous
  sentence described a field the code does not produce):** `null` before any attach,
  and after an attach that was ROLLED BACK (refused at verification) or abandoned by a
  caller refusal while the realm was HEALTHY. It stays **non-null** while the realm is
  invalidated, INCLUDING after `disposeNativeToolModules()` on that path (that method
  deliberately keeps the deny and the covered names, so the record still describes the
  attach that was verified and then invalidated); `dispose()` does not clear it either —
  the realm object is unassembled and a reader still holding it gets the last attach's
  record beside `nativeInvalidation`. A non-empty attach records
  `emptyFrontierAcknowledged: false`.
- **`emptyFrontierSpecifiers` is what an operator needs to trace the acceptance** back
  to the configuration line; a boolean alone cannot be followed. The row forwards
  `spec.url` into the seam only for this record.
- **`acknowledgedNames`**: an entry that carries `expectedTools` is normally refused if
  the attach does not shadow the declared names (merged `EXPECT-2`/`C2-d` contract,
  unchanged). The ONE narrow exception is an entry that ALSO carries `allowEmpty: true`
  **and forwarded nothing**: the empty frontier is explicitly acknowledged, so the
  declared names are recorded as ACKNOWLEDGED (unshadowed, unverified) instead of
  refused. A PARTIAL frontier is still refused even with `allowEmpty` — now MEASURED
  as a contract by **ACK-2b** (`A5SF_EXPECTED_TOOLS_UNSHADOWED`, naming the declared
  but unshadowed tool; review #1 C5), not merely by the merged EXPECT-2 path. This is a
  disclosure widening, not a verification: the row cannot see what the preset plane
  serves for the name.
- **README statement the ruling requires:** `emptyFrontierAcknowledged: true` means
  the composition DECLARED that the empty frontier is intended. It does **not** mean the
  frontier was verified, and it does not mean the name is safe: the row cannot see the
  preset plane's module config, so an acknowledged-empty entry is a statement by the
  composition, not evidence from the seam. This lane MEASURES the accepted shape
  (`ACK-empty`): the attach is accepted, the flag/specifier are recorded, and the
  managed name stays `UNKNOWN_TOOL` — nothing about what the preset plane would serve is
  verified. The preset-serving outcome of a divergent composition remains the
  `a5sf-event-driven` E7 measurement/hazard, unchanged by this lane.

## 5. Registration semantics did NOT change

Listeners keep running; `tools/change` still triggers the fold/re-verification. A
registration that arrives **within the same synchronous emission** as the invalidation is
still recorded by the fold (the teardown is deferred one microtask for exactly that).
That is the whole scope of the claim: **after** the deferred teardown the router fiber is
gone, so a later registration into it throws Cordis `INACTIVE_EFFECT` and never lands —
a pre-existing deferral consequence, not introduced here, and nothing a caller should
read as "late registrations keep being tracked". With the blanket freeze the fold is now
the **name-keyed diagnostic** (it decides which typed code the refusal carries), no
longer the last line of defence. Proof:

- **E8** asserts a covered call **after** the emission returns
  `A5SF_NATIVE_SHADOW_INVALIDATED` — reachable only if the fold put the
  late-landed name into `expectedDefinitions`; and asserts the attach-time routing
  receipt correctly stays a snapshot (the name landed later).
- **E3, E3-fold, C3-a…C3-f, P0-1, P0-2** all stay green (`all-a5sf-node-suites.log`),
  including the fold arm, the name-keyed coverage arms and the P0 recovery arm.
- The deferred-registration probe (`a5sf-deferred` A1–A7) still reports **7/7 PASS**
  on this tree (`deferred-probe.log`), so settle/fold behaviour is unchanged.

## 6. ⚠ THE SUPERSEDED BOUNDARY — read this before reviewing the test diff

This is the one change in this lane that narrows an existing merged acceptance claim.
It is **not** a test fix for a passing implementation; it is forced by the E8 ruling.

**The old assertion (merged, verbatim, dated 2026-11-03, in `E3-fold`):**

```js
// The preset plane's own (unmanaged) name is outside the declaration and
// outside this attach's managed set: it is NOT denied, and that is expected.
const plane = await dispatch(root, agentKey, 'x_event_plane_probe', {})
assert.equal(plane.isError, false, `an unmanaged name is not the deny's business: ${plane.text}`)
assert.equal(plane.text, 'preset-plane-body')
```

**The new assertion (this branch, same arm):**

```js
// ... the old block is quoted in full in the arm's comment ...
const plane = await dispatch(root, agentKey, 'x_event_plane_probe', {})
assert.equal(plane.isError, true, `an unmanaged name is ALSO refused while the realm is frozen: ${plane.text}`)
assert.equal(plane.info?.code, 'A5SF_MEMBER_REALM_INVALIDATED', `the blanket refusal is typed`)
assert.equal(plane.text.includes('preset-plane-body'), false, 'the unmanaged preset body must not serve either')
// Precedence, re-asserted AFTER the blanket case: a covered name is not
// swallowed by the freeze — it keeps the specific shadow code.
const coveredAgain = await dispatch(root, agentKey, 'x_event_probe', {})
assert.equal(coveredAgain.isError, true)
assert.equal(coveredAgain.info?.code, 'A5SF_NATIVE_SHADOW_INVALIDATED')
assert.equal(coveredAgain.text.includes('managed-event-body'), false)
```

**Why it is forced:** `x_event_plane_probe` is a preset-plane tool dispatched on the
invalidated Member's own agent scope. The ruling says every new invocation for that
Member is refused; the alternative (freeze except preset-plane names) is undecidable at
admission — the plane that registered a name is not evidence available there — and
would recreate the very intra-emission window E8 measures. The user approved this
re-pin on 2026-11-04 with the explicit condition that it be disclosed here.

**Honest statement:** this DOES narrow the merged `E3-fold` arm's claim (one trailing
control assertion), and only that assertion. What a reviewer must check to satisfy
themselves it is not a weakening:

1. In that arm, **no other assertion changed** — the fold, the `surfaceAdded`/
   `lateRegistrations` record assertions and the covered-name
   `A5SF_NATIVE_SHADOW_INVALIDATED` clause still execute byte-identically (diff the arm
   against `origin/master`; only the trailing block differs).
2. The two new assertions in the arm are **stronger**, not weaker: they pin BOTH the
   blanket freeze and the name-keyed precedence in the same arm, so the precedence is
   visible to a future reader rather than a single flipped boolean.
3. The merged arm is still **red on the base tree** with the new pin
   (`red-suite-e8.log`: `an unmanaged name is ALSO refused while the realm is frozen:
   preset-plane-body`), i.e. the new expectation is a contract, not a tautology.

## 7. The freeze is bounded — and what happens to a Member that cannot re-assemble

- **Set only by the invalidation record.** `invalidation` is assigned in exactly one
  place (`invalidateNativeShadow`) and never cleared while the realm lives; the
  admission check keys off that one field. There is no other switch. The E8 arm first
  asserts the healthy realm admits the same unmanaged name and only then that the
  record freezes it.
- **The guarantee is REALM-SCOPED; the lift is a CALLER OBLIGATION (corrected
  2026-11-04, review #1 C2 — the earlier "lifted only by a full verified re-assembly"
  was stronger than the mechanism).** While THIS realm object is mounted and
  invalidated, its admission listener refuses every call, and
  `disposeNativeToolModules()` cannot lift that (asserted in the E8 arm). But the
  freeze dies with the realm: review #1 measured on this tree that a plain `dispose()`,
  a fresh mount with **no attach**, and a fresh mount whose attach is **refused** all
  leave a live agent ctx with no managed admission at all — it serves the preset with
  zero guard facts. The seam cannot distinguish "tear down for good" from
  "re-assemble", so **the soundness of the lift is a product-lifecycle obligation, not
  a seam invariant**: anything that disposes a realm and then dispatches on the same
  live agent ctx is outside the managed-Member lifecycle and re-opens the Member on the
  preset. The compliant path — dispose → fresh mount → attaching a new realm whose
  verification settles without a record — is measured by E8-lift on the same
  agent/tool plane (`UNKNOWN_TOOL` for an unknown name; the re-attached shadow forwards
  `subagent` and executes it once). Product enforces the other half: `close()` in
  `agent-bindings.mjs` awaits every `handle.dispose()` before the realm disposers, so a
  realm is never disposed while its Member's agent ctx is live, and re-assembling a
  Member means a new Member.
  - **Why this lane carries NO cross-assembly freeze token (the choice, stated):**
    `mount.ts` owns one realm and has no lifetime or authority beyond it. A
    module-global freeze keyed by Member/agentKey would outlive the realm, could only
    be cleared by its own inventor, and would silently freeze a fresh, legitimate
    assembly (or leak across teams with a reused key) — a worse failure mode than the
    disclosed obligation. Carrying a freeze across re-assembly is a product
    lifecycle/status decision, not a seam patch; this lane therefore states the
    obligation and does not invent cross-realm authority.
- **A Member that can never re-assemble is permanently frozen (fail closed) — and in
  product the ONLY signal is one stderr line (corrected 2026-11-04, review #1 C4).**
  The seam records the typed `realm.nativeInvalidation` (reason, `uncovered`,
  `surfaceAdded`, `surfaceRemoved`, `lateRegistrations`, `observedAt`) and writes one
  `console.error` line at invalidation time. But the frozen live glue
  (`agent-bindings.mjs`, untouched by design) **retains only the disposer closure, not
  the realm object**, and has zero consumers of `nativeInvalidation` /
  `nativeAttachRecord`; so "an operator sees the record" is NOT a present product
  capability — the stderr line is the only product signal, with no status field and no
  query. The typed record is available to tests/diagnostics that hold the realm.
  **Tracked condition, named rather than invented:** the product still needs a
  Member-status ("frozen pending re-assembly") and re-assembly path outside this lane's
  frozen file; until it exists, a permanent freeze is an availability failure that is
  visible only in the log, and the *availability* half of this ruling is not closed.

## 8. Arms

| arm | where | what it pins |
| --- | --- | --- |
| **E8** | suite + probe (real pinned module) | the exact measured sequence: preset listener registers inside the emission, invalidation record set, in-window dispatch by another listener → **denied** with `A5SF_MEMBER_REALM_INVALIDATED`; neither preset nor managed body runs; `surfaceAdded` names the late name; the emission completes |
| **E8 (precedence half)** | suite + probe | after the fold, the covered name still yields `A5SF_NATIVE_SHADOW_INVALIDATED`; no body runs |
| **E8-lift** | suite + probe | freeze lifts only on a full verified re-assembly; invalid realm refuses partial re-attach; `disposeNativeToolModules` does not lift it; the fresh attach is verified (`forwarded:["subagent"]`, no ack) and admitted |
| **ACK-1** | suite + probe | acknowledged-empty attach records the flag, the module name and the ROW-CONFIG specifier; a non-empty attach does not |
| **ACK-2** | suite | `allowEmpty` + declared `expectedTools` on an EMPTY frontier is accepted with the names recorded as ACKNOWLEDGED |
| **ACK-2b** | suite | `allowEmpty` acknowledges ONLY an empty frontier: a PARTIAL frontier that also declares an unshadowed name is still REFUSED with `A5SF_EXPECTED_TOOLS_UNSHADOWED` (review #1 C5), and the refused attach leaves no attach record (C1 lifecycle) |
| **E3-fold (re-pinned)** | suite | see §6; registration/fold assertions unchanged, blanket-vs-name-keyed precedence asserted together |

## 9. Gates (all run on this tree, at the committed head)

| gate | result | raw |
| --- | --- | --- |
| all a5sf node suites (9 files) | **127/127 pass** | `all-a5sf-node-suites.log` |
| `vitest run a5sf` | **166/166, 11 files** | `vitest-a5sf.log` |
| deferred-registration probe A1–A7 | **7/7 PASS**, then the committed JSON/log were restored | `deferred-probe.log` |
| E8 probe (real pinned module) | **4/4 PASS** | `probe-e8-freeze.log`, `probe-e8-freeze.json` |
| law suites (`u6-arc-a-fitness`, `u6-pr6-arc-d-adversarial`, `a4p3-intervention-lane-hygiene`) + `p4t6-session-event-scan` | **54/54, 4 files** | `law-and-p4t6.log` |
| `pnpm typecheck` | pass | `typecheck.log` |
| `pnpm build` + `node scripts/place-dist-glue.mjs` | pass, 101 placements | `build.log`, `place-dist-glue.log` |
| `node scripts/check-artifacts-committed.mjs` | verdict=ok, 1916 compared | `check-artifacts-committed.log` |
| `node scripts/check-artifacts-at-head.mjs` | verdict=ok, drift=0 | `check-artifacts-at-head.log` |
| `node scripts/eb3-evidence-guard.mjs --new-since origin/master` | pass, findings=0 | `eb3-evidence-guard.log` |
| `node scripts/ci-pr-gate.mjs --only graph-parse,state-freshness,blueprint-fence,lint-identities` | pass (4/4) | `ci-pr-gate.log` |
| `node scripts/eb3-ci-required.mjs` | pass, workflows=9 | `eb3-ci-required.log` |
| `node scripts/eb3-ci-negative-controls.mjs` | **26/26 controls behaved as required** | `eb3-negative-controls.log` |
| `git diff --check origin/master..HEAD` | clean | `diff-check.log` |
| `pnpm ci:local --base origin/master` | **RED on 2 full-pool load flakes**, both pass 3/3 isolated — see §10 | `ci-local.log`, `ci-local-red-isolation.log` |
| **p4t6 tie, MEASURED LAST** | **1428** (`filesScanned=1428`, ledger `expected=1428`, `violations=[]`) — see §11 | `p4t6-measured-tie.log` |

## 10. `pnpm ci:local --base origin/master` — verbatim, one RED run (two load flakes)

```
DSH-CI-LOCAL verdict=fail steps=6 failed=1 coverage=determined files=2 wall=246.5s
 Test Files  2 failed | 481 passed (483)
      Tests  2 failed | 5991 passed (5993)
```

The full transcript was 1,214,830 bytes (over the 1 MiB evidence bound), so
`ci-local.log` keeps the invocation/steps head, **both failing test blocks**, the selected
a5sf `node --test` block and the verdict verbatim (`[TRANSCRIPT TRIMMED FOR THE EVIDENCE
BOUND]` banner at the top of the file). The two reds:

1. `packages/runtime/test/a5g6-install-face-render.test.ts` — GLUE-6 LEG B, "the four
   definitions all carry a render…": `Error: Test timed out in 5000ms.` This is the
   pre-existing full-pool load/timeout flake other lanes have booked at this tree
   (same file, same 5 s timeout, e.g. `a5sf-deferred` §6).
2. `packages/runtime/test/a5-cancel-glob.test.ts` — C4, "EVERY boundary this row asks
   answers with the typed refusal": the cancel race settled on `after-settle` where the
   arm expected `walk-aborted` (a timing race under the 483-file parallel pool).

Neither file imports any a5sf module (`grep -n "a5sf"` over both: no match), and neither
is touched by this lane. **Isolation proof** (`ci-local-red-isolation.log`): each file
ALONE on this same tree, three consecutive runs each:

```
a5-cancel-glob.test.ts          26/26 pass   (run 1, 2, 3)
a5g6-install-face-render.test.ts  5/5  pass   (run 1, 2, 3)
```

So the flake identity here is **two files**, both load/timing; the selection moves between
lanes, which is why both names and the isolation runs are recorded rather than a re-run's
verdict alone.

## 11. p4t6 tie — MEASURED LAST on this tree

(`p4t6-measured-tie.log`, produced after every other gate in this lane; the scanner walks
`packages/**` only, so evidence files cannot move it.)

```
MEASURED p4t6 tie, MEASURED LAST on this tree (all files on disk at run time):
  scanSessionEventVocabulary: filesScanned=1428 files.length=1428 hits={"eventString":15,"payloadSymbol":0,"declarationMerge":0,"total":15}
  ledger derived expected=1428 violations=[] summed=445
```

Exact equality, no tolerance; the `p4t6-session-event-scan` suite asserts
`filesScanned === ledger.expected` and passed **20/20** in `law-and-p4t6.log` (54/54 with
the three law suites). **The tie stays 1428**: this lane adds no scannable `packages/**`
path (the code edit rides the already-counted `mount.ts`/row, the arms ride the
already-counted `tests/world-factory/a5sf-assembly.test.mjs`, everything else is `dev/**`).

## 12. Head and the sharpest reviewer risk

Head = the commit that last touched this directory
(`git log -1 --format='%H %s' -- dev/agent-workflow/evidence/a5sf-e8-freeze`).
Base `origin/master` = `93b007cd2` (§ top).

**Sharpest risk.** The freeze is Member-wide and has no per-tool exemption: during
invalidation every tool call of the Member is denied, including state/non-I/O tools and
preset-plane tools that do not touch the managed realm. That is the ruling's accepted
cost, but it makes **availability** the residual risk, not confinement: a Member whose
realm is invalidated is out of service until the product re-assembles it (new realm +
new verified attach). Today the frozen glue has **no automatic re-assembly and no
Member-status surface** for "frozen pending re-assembly" (only `nativeInvalidation`
and the log line), so a Member that legitimately needs, say, `todo`/`goal` state after
an unrelated late preset registration will keep answering the freeze refusal until the
caller disposes and re-assembles. That can, in the worst case, stall the Member
permanently, and it will be visible in tool errors but not in a status field. This lane
does not invent that status path (the glue is frozen); it names it as the remaining
product gap. A reviewer should also note the one merged-arm narrowing disclosed in §6.

## 13. Review #1 corrections (2026-11-04) — disposition

| # | condition | disposition |
| --- | --- | --- |
| **C1** | `nativeAttachRecord` non-null after a refused `disposeNativeToolModules()` while invalid contradicted its JSDoc and README | **Prose corrected, code unchanged** (the code is the intended semantics: the record describes the attach that was verified and then invalidated). `mount.ts` JSDoc and §4 now give the full lifecycle, including that `dispose()` does not clear it, and ACK-2b additionally pins that a ROLLED-BACK attach leaves no record. |
| **C2** | "lifted only by a full verified re-assembly" was stronger than the mechanism (freeze dies with the realm; plain dispose / mount-without-attach / refused-attach all serve the preset with zero guard facts) | **Rephrased as a realm-scoped guarantee plus an explicit CALLER OBLIGATION** (§7, and the intro): the seam cannot distinguish teardown from re-assembly, product lifecycle (`close()` ordering, new Member) is what makes the lift sound, and dispatching on the same live ctx after disposing a realm re-opens the Member on the preset. **No cross-assembly token was added**; §7 states why (cross-realm module-global authority would outlive the realm and could silently freeze a fresh legitimate assembly — a worse failure mode than the disclosed obligation). |
| **C3** | "a registration that arrives during invalidation is still recorded by the fold" was true only within the same synchronous emission | **Qualified** (§5): the fold catches a registration in the same synchronous emission; after the deferred teardown the fiber is gone, the registration throws `INACTIVE_EFFECT` and does not land (pre-existing deferral). §5 also now says the fold is the name-keyed diagnostic, not the last line of defence. |
| **C4** | "an operator sees the record/log" overstated: the glue retains only the disposer closure and has zero `nativeInvalidation` consumers | **Corrected** (§7): in product the ONLY signal is the single stderr line; the typed record is available to tests/diagnostics that hold the realm. §7/§12 keep "permanent freeze, no status surface" and name the status/re-assembly path as a **tracked condition**, not a present capability. |
| **C5** | README attributed the partial-frontier refusal to ACK-2, which did not assert it | **Assertion added**: `ACK-2b` (new, 35/35 suite) pins `allowEmpty` + one forwarded + one unshadowed declared name → `A5SF_EXPECTED_TOOLS_UNSHADOWED`, typed, naming the missing tool; it also pins the rolled-back attach's null record. |
| scope | direct `definition.execute()` still runs the body (pre-existing, unreachable from the model/PTC path) | **Named** in the scope note at the top of this README so it is not mistaken for a regression. |

Everything above is documentation plus one new assert-only arm: the seam's behaviour is
unchanged from `449b79179`, and all logs in this directory were regenerated at the new
head (`all-a5sf-node-suites.log` 127/127, `vitest-a5sf.log` 166/166, probe 4/4, deferred
7/7, law+p4t6 54/54, gates and `pnpm ci:local` re-run).
