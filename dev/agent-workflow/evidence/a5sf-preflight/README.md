# a5sf-preflight — zero-boot preflight for the P2-01 six-row live acceptance

**Status: PASS (host-free). 0 boots spent. 0 Host starts. 0 ledger rows.**
**Review round 2 (B1–B6) applied**: row-2 fact scoping (`C9`), row-5/6 laundering
and post-boot abort severity (`C10`/`C11`), production-row + directive root
assertion (`A5`/`A6`), the real #575 stream as fixture (`B5`/`B6`), the
`go-no-go.mjs` gate (`§6`), and the prose corrected to the measured numbers.
This directory certifies the *driver* and the *assembly* before the first of the
three newly granted P2-01 boots is spent. It does not claim any row is PASS on
live data — that is what the boot is for.

- base: `origin/master` @ `93b007cd2` (fetched, verified; `#579` merged forward into
  this branch — never rebased)
- branch: `task/a5sf-preflight-20261103` (worktree `.worktrees/a5sf-preflight`)
- head: the commit that introduces this directory (`git log -1 --format=%H -- dev/agent-workflow/evidence/a5sf-preflight`).
  `dry-run.json.head` / `.productTreeClean` record the tree the committed run executed
  on — `head` is necessarily the parent (or the same) commit, because the run is itself
  part of the evidence, and `productTreeClean` ignores this directory (its own outputs)
  while refusing a dirty product tree. The go/no-go gate re-runs it **at the exact commit
  to be booted** (§6 #1).
- `packages/runtime/src/plugin/live/agent-bindings.mjs` sha256
  `df9b46af67cd903641285760cd72a78e57986e87959b2fbdbaf3f86dd6c6464b` — **byte-identical
  to `origin/master`** (CORE PATCH BUDGET = 0; asserted by `dry-run.mjs`, check
  `agent-bindings.mjs is untouched vs origin/master`)
- boot pool: `dev/agent-workflow/budgets/a5sf-boot-pool-20261103.json` (P2-01 now
  holds 6; the preflight consumes none)

One command re-verifies everything in this directory:

```bash
node dev/agent-workflow/evidence/a5sf-preflight/dry-run.mjs   # exit 0, 26/26 checks, goNoGo=true
node dev/agent-workflow/evidence/a5sf-preflight/go-no-go.mjs  # the boot authorisation (§6)
```

---

## 1. What #575 actually produced (the baseline this preflight repairs)

`dev/agent-workflow/evidence/a5sf-acceptance/run-record.json` @ `6d1b7a1fb`:
overall **FAIL**, 1 `NOT_REACHED` (row 5) and **5 FAIL** (precondition, rows
1–4, row 6), **boots: 1**. The five FAILs are all the same absence: the state
query read a Team with **one leader and no worker** while the acceptance Team was
created under a different root, so `surfacePerMemberRequest` was empty
(`memberRequestSeen: false`), no read/write call was ever made, and every
downstream judge was asked about observables that never existed. Row 6 archives
`null` and still printed FAIL.

Three driver defects, all reproduced in the committed #575 driver
(`dev/agent-workflow/evidence/a5sf-acceptance/run-boot.mjs`):

1. **Split root identity.** `ROOT = 'session-a5sf-acceptance-root'` (line 140)
   drives the p6t6 directive, the state query, the discovery prompt and the
   archive `as:`; `CREATE_ROOT = 'session-a5sf-acceptance-team'` (line 141)
   drives `team.create`, the delegate and the archive payload. The p6t6 state
   route answers for the directive's `rootSessionId`, so the run observed the
   **anchor** team forever. The product *refuses* the other obvious repair:
   `team.create` on an already-bound root takes the cold path and refuses a
   different blueprint (`TEAM_CREATE_BLUEPRINT_MISMATCH`, `s6-remote.ts`), so
   the dynamically built acceptance blueprint cannot bind on the boot root.
   The fix is therefore explicit two-root wiring, not "use one constant".
2. **Dispose-fault filter matched the root session NAME.** The #575 filter was
   `/a5sf: realm dispose failed|residency dispose failed|a5sf: native shadow/`.
   The committed `teardown.json` proves the failure mode exactly: `observations`
   has **20** lines and the filter's own `a5sfFaults` list has **27** (a different,
   longer snapshot — 8 of its lines are not in `observations`), every one of them
   an `a5p1-guard: … agent=session-a5sf-acceptance-team …` line. A real fault
   would have been invisible inside 27 false positives — and row 6 printed FAIL
   for that. The real stream is now the test fixture
   (`tests/world-factory/fixtures/a5sf-575-teardown-observations.json`, extracted
   read-only): the classifier returns managed 0 / foreign 0 / ignored 20 (and
   ignored 27 for the old list).
3. **Capture clipping.** The #575 transcript clipped tool results at **320
   chars** (`README.md` §5.3: the activation refusal's cause `(deferred …)` was
   lost with the World). The later committed driver fixed the transcript but
   still clipped `evidence.rowValues` at **900** and the teardown observation
   array at `slice(-20)`.

This directory contains the corrected driver, the shared host-free oracle, the
mount measurement, the negative controls and the go/no-go gate.

---

## 2. The corrected driver — `run-boot.mjs`

Same World, same mock model, same six rows; the defects are fixed *structurally*:

| defect | fix in `run-boot.mjs` |
| --- | --- |
| split root | imports `P2_01_ACCEPTANCE_ROOTS` from the tested contract; **no root literal exists in the driver** (dry-run check 1). `BOOT_ROOT` is the anchor (discovery only, and the production row's anchor); `ACCEPTANCE_ROOT` is `team.create` + archive + delegate + p6t6 directive + state query + oracle. `assertDriverRootWiring()` throws `ACCEPTANCE_ROOT_MISMATCH` unless `createRoot === stateQueryRoot === archiveRoot === oracleRoot === directiveRoot`, **and** unless the PRODUCTION row config's `rootSessionId` equals the boot root and the **p6t6 directive's** `rootSessionId` equals the acceptance root (review B3: without those two, anchoring the production row on the acceptance root passed the guard and died at `team.create`). `toolRouteRoot` is documented as a LABEL — dispatch is by member child session — and is not counted as evidence. |
| order | **discovery → surface → `team.create` → wait for `state(rootSessionId === ACCEPTANCE_ROOT, teamSession !== null)` → drive.** The wait is *after* create and asserts the same constant the create used; a false throws before any row is evaluated ("refusing to evaluate any row against a foreign team"). Dry-run check 4 asserts the source order. |
| dispose filter | `classifyDisposeFaults({observations, managed: {sessionId, instanceId}, duringManagedDisposal, managedRealmCount})`. Closed fault grammar (`^a5sf: realm dispose failed:` / `^p6t6: residency dispose failed for '([^']+)':`); a residency fault is `managed` only for the **exact** child-session id, `foreign` otherwise; the identity-less realm fault is attributed **only** inside this Member's disposal window; every non-fault line is counted as ignored, never as a fault. The REAL #575 stream (20 observations; the old filter's 27-line list) classifies as `managed: 0, foreign: 0, ignoredNonFault: 20 (27)` (`B5`), and a **decorated** real fault (`[error] …`, leading spaces, quoted sid) is still attributed (`B6`) — a fault cannot hide as `ignored`. |
| clipping | no driver-imposed bound on any row-verdict input: row results, the full request corpus, the entire observation arrays in `teardown.json`, and every `add()` detail are persisted verbatim. The **only** bound is the Host's own tool-result / mock-response size (evidence, not a capture decision). Display-only `console` lines stay bounded and are labelled as such. |
| FAIL vs NOT_REACHED | every row, precondition and teardown calls a judge from `tests/world-factory/lib/a5sf-acceptance-preflight.mjs`. A row whose observable was never produced is `NOT_REACHED`; a row the product answered wrongly is `REFUTED`; `PROVEN → PASS`. `oracle-samples.json` persists the exact sample + judge output per case. |
| abort severity | an abort **after** the Host was reached fills every unjudged case with `FAIL` / `RUN_ABORTED_AFTER_HOST_REACHED` ("UNJUDGED … not NOT_REACHED"); only a pre-boot abort (grant/identity refusal) fills `NOT_REACHED` / `RUN_ABORTED_BEFORE_BOOT`. A live `team.create`/mount regression can never read as "not reached" again (review B2). |
| row-2 fact scoping | the oracle scopes row 2 to the `readText` consultation; the row-4 `write` fact at the same `b.txt` locator is reported as `nonReadFacts` and is not counted. `C9` is the committed replay of the healthy stream → `PROVEN` (review B1). |
| provider composition | the run record's `providerComposition` names the row actually mounted (`relative(REPO_ROOT, EVIDENCE_ROW)`, the preflight copy), not the #575 path (review B5). |
| silent `read_image` fallback | `a5sfExpectedTools: { <tool-fs>: ['read','write','edit','read_image'] }` is declared on the row. If the World's `attachments` service ever disappears, the attach fails closed with `A5SF_EXPECTED_TOOLS_UNSHADOWED` **before any row**, naming `read_image` — instead of silently keeping the preset `read_image` with zero guard facts. |

The `#575` archive/delegate asymmetry is also gone: `as:` (actor), the payload
`rootSessionId` and the dispatch target are all `ACCEPTANCE_ROOT`.

---

## 3. The six-row oracle, re-derived in the driver

The decision function lives in
`tests/world-factory/lib/a5sf-acceptance-preflight.mjs` and is pinned by
`tests/world-factory/a5sf-acceptance-preflight.test.mjs` (**25/25 pass**, run by
`dry-run.mjs`). Each row has three outcomes; the test file feeds each judge a
NOT_REACHED sample, a REFUTED sample and a PASS base, and asserts the verdicts
differ (`C0`–`C3`), plus the review arms: the row-2 healthy replay (`C9`), the
three row-5 laundering arms (`C10`), the row-6 archive refusal (`C11`), the
real #575 stream (`B5`), the decorated-fault grammar (`B6`), the production
row / directive root assertions (`A5`/`A6`), and the **name-keyed vs blanket
invalidation** discrimination (`C12`: an `A5SF_MEMBER_REALM_INVALIDATED`-only
refusal is REFUTED with `BLANKET_INVALIDATION_ONLY`).

| row | PASS requires (state assertion) | REFUTED (the product answered wrongly) | NOT_REACHED (never asked) | #575 defect this repair kills |
| --- | --- | --- | --- | --- |
| precondition | a Member turn was captured (`surfacePerMemberRequest` non-empty), exactly **one** `read` schema, no duplicate names, prompt `read` mentions ≤ discovery's, the `tool:read` section count unchanged, ≥3 `read` calls | any of those clauses false (`MEMBER_SURFACE_DRIFT`) | no Member request at all (`NO_MEMBER_REQUEST`) | #575 printed FAIL with `memberRequestSeen:false` — an absence reported as a failure |
| 1 read A | result not error, planted bytes returned, ≥1 **binding-realm** allow fact with `toolBindingIdentity: 'dsh.fs/read'`, ≥1 confined provider row, and **no base-instance row** | bytes missing / no binding allow / served by base (`ROW1_CLAUSE_FAILED`) | no call or no result (`NO_READ_CALL_A` / `NO_READ_RESULT_A`) | #575 FAIL on a read that never happened |
| 2 read B | `isError`, typed lane refusal, no claim/write-content leak, **exactly one READ fact** for B (the later row-4 write fact at the same locator is not counted) and **exactly one** binding deny, **no** provider read | any clause false (`ROW2_CLAUSE_FAILED`) | no call/result (`NO_READ_CALL_B` / `NO_READ_RESULT_B`) | same |
| 3 read C | refused + typed, no leak, exactly one binding deny, no provider read, **and** the lane report shows ceiling `deny`, restriction `allow`, effective `deny`, with no widened allow entry | clause or no-widening false (`ROW3_CLAUSE_FAILED`) | no call/result, **or no lane report**, or no probe for C (`NO_LANE_REPORT_C`, `NO_LANE_PROBE_C`) | the no-widening claim had no channel; "pass" could be produced by an empty report |
| 4 write B | not error, disk equals the written content, a write allow fact exists, **every** write fact is on the ceiling realm (`toolBindingIdentity:null`), **zero** read-lane write facts, confined provider served | any clause false (`ROW4_CLAUSE_FAILED`) | no call/result (`NO_WRITE_CALL_B` / `NO_WRITE_RESULT_B`) | same |
| 5 post-invalidation | Member child session present, late tool registered, invalidation line observed, post-read refused with `A5SF_NATIVE_SHADOW_INVALIDATED` **and** the typed name, **not** the blanket `A5SF_MEMBER_REALM_INVALIDATED` freeze, no forbidden bytes, sink delta 0, counter delta 0, in-lane read also refused with the name-keyed code | the trigger was rejected (`INVALIDATION_TRIGGER_FAILED`), the tool was accepted but not registered (`INVALIDATION_TOOL_NOT_REGISTERED`), the tool IS registered + trigger 200 yet **no invalidation line** (`INVALIDATION_NOT_RAISED` — NoStaleShadow), the refusal is blanket-only (`BLANKET_INVALIDATION_ONLY`: the realm died, not the named shadow), or the post-read served bytes / missed the typed refusal (`ROW5_CLAUSE_FAILED`) | no Member session (`NO_MEMBER_CHILD_SESSION_IN_STATE`), **no trigger dispatched** (`NO_INVALIDATION_TRIGGER`), no post-read (`NO_POST_INVALIDATION_READ`) | #575's only NOT_REACHED — correct there; now "asked and not raised" can never be laundered into it (review B2, `C10`) |
| 6 teardown | archived lifecycle `ARCHIVED`, every post-stop dispatch explained (422 `NO_LIVE_AGENT` or a 200 refusal), **no** success after stop, **no** forbidden bytes, `classifyDisposeFaults` reports no managed/unattributed fault, sink delta 0, health 200, host alive | any clause false (`ROW6_CLAUSE_FAILED`), **or the archive was answered with a refusal** (`ARCHIVE_REFUSED`: non-200 or `ok:false` — review B2, `C11`) | no member (`NO_MEMBER_TO_STOP`), archive never dispatched (`NO_ARCHIVE_DISPATCH`), no post-stop dispatch (`NO_POST_STOP_DISPATCH`) | #575 printed FAIL with `archiveOk:false` and 27 false "faults"; a missing scenario is now NOT_REACHED, an answered refusal is REFUTED, and a fault must be identity-attributable |

Every judge returns `{verdict, reason, detail}` with `reason` a **closed code**
(`ACCEPTANCE_VERDICTS` + `C*` reason set); `toRunVerdict` maps `PROVEN→PASS`,
`REFUTED→FAIL`, `NOT_REACHED→NOT_REACHED`. The driver's case list is asserted
equal to `ACCEPTANCE_CASES` before a grant is taken and before boot.

Files: `oracle-samples.json` (written by a live run) persists the sample and the
judge output per case, so the decision can be re-derived without the World.

---

## 4. #576 mount compatibility — MEASURED, host-free

`probe-mount-compat.mjs` (output `mount-compat.json` / `mount-compat.log`) mounts
the **real pinned** `tests/deepseek-harness-test-use/packages/fs/tool-fs/lib/index.js`
through the product entry points (`mountMemberA5sfRealm` +
`attachA5sfNativeToolModules`) on a real Cordis root with real
`@deepseek-ai/dsh-tools` / `dsh-system-prompt` / `dsh-scope`, and declares
`a5sfExpectedTools = ['read','write','edit','read_image']`.

| arm | `attachments` provider | mounted | forwarded by the routed fibers | model-visible surface |
| --- | --- | --- | --- | --- |
| A | **real** `@deepseek-ai/dsh-attachment-local` (`LocalAttachmentStore`, `dshHome` = OS temp dir, deleted) | **yes** | `edit, read, read_image, write` (**4/4**) | `edit, read, read_image, write` |
| B | stub `attachments` service | yes | 4/4 | 4/4 |
| C | **none**, declaration present | **no** — `A5SF_EXPECTED_TOOLS_UNSHADOWED` | attach forwarded `write, edit, read`; message names `read_image` | — |
| D | **none**, undeclared | yes | `edit, read, write` (`read_image` absent) | `edit, read, write` |

The routed-mount metadata (product `NATIVE_REGISTRATION_ROUTING`) for arm A:

```
ceiling realm: toolBindingIdentity=null        forwarded=[write, edit, read_image]  observed=[read, write, edit, read_image]  dropped=[section:tool:read, read]
binding realm: toolBindingIdentity=dsh.fs/read forwarded=[read]                       observed=[read, write, edit, read_image]  dropped=[section:tool:write, write, section:tool:edit, edit, read_image]
```

So: **#576's outcome rule + the router-services merge reach a mounted,
identity-verified native surface with the real pinned module and a real
attachment store** — `mounted=true`, every declared name forwarded, and each name
served by exactly one lane with the other lane dropping both its definition and
its system-prompt section. Arm C proves the declaration is not vacuous; arm D is
the "what the World would look like with no attachments" premise.

**Measured gap (review B6).** The probe captures the router's `observed` and
`dropped` name lists; it does **not** capture the `forwardedSections` field, so
the system-prompt half of the cross-lane drop is only measured to the extent the
`dropped` list names `section:tool:<name>`. The four-arm table can show a
`section:` entry being dropped, but cannot show the surviving lane's forwarded
section content. That is a host-only observation; it is listed as such in §5
"structurally unverifiable" and is a row-5/6 *surface* premise, not a row claim.

Composition fact (also measured, `plan.json.attachmentsProvider`): the pinned
World profile composes `@deepseek-ai/dsh-attachment-local` from
`tests/deepseek-harness-test-use/packages/bundle/base/cordis.patch.yml` lines
138–139 (`- id: attachment-local`). #575 additionally observed the durable store
on the live Host. `dry-run.mjs` fails if that composition disappears — **an
absent provider is a preflight blocker, not something to work around.**

---

## 5. Dry-run output (what was actually executed)

`dry-run.log` (committed) — **26/26 checks PASS, `goNoGo=true`**, ~1 s, no Host:

1. static: no root literal / imports the contract / all seven judges used /
   `team.create` precedes the same-root state assertion / no clipped result /
   full observation arrays / `expectedTools` declared / **post-boot abort is
   `FAIL`, never `NOT_REACHED`** / row-2 facts scoped to `readText` / row-5+6
   refusal reasons present / production-row+directive root assertion present /
   the real #575 fixture exists;
2. `agent-bindings.mjs` byte-identical to `origin/master` (sha256 above);
3. `node --test tests/world-factory/a5sf-acceptance-preflight.test.mjs` →
   **25 pass, 0 fail** (three-way oracle, #575 split-root control, real stream,
   name-keyed vs blanket invalidation);
4. `run-boot.mjs --plan` → factory `createWorld` + patch layer emission
   (**6163 bytes**, sha256 `33ef72f1…6347`, in `plan.json`) + **both blueprints
   parsed by the host's own dist facade** + row-identity preflight (3 rows) +
   product lane algebra (A `allow` / B `deny` / C `deny`) + world **teardown**
   (`homeDeleted`, `releasedPorts: []`, no port ever bound) → `plan.log` /
   `plan.json`;
5. `probe-mount-compat.mjs` → §4 table → `mount-compat.json`;
6. head / base / pinned host / **`productTreeDigest`** recorded in
   `dry-run.json`. The digest is the binding identity: it covers
   `packages scripts tests docs/plans docs/contracts dev/engineering` and the
   lock/workspace manifests but **not** `dev/agent-workflow/evidence/**`, so
   `go-no-go.mjs` can tell "the evidence was committed after the run" (fine)
   from "the product tree changed after the run" (refuse).

**Negative controls** (`negative-controls.log`, kept as evidence): re-introducing
the two #575 defects into the driver — the `CREATE_ROOT` literal and
`.slice(0, 320)` on `rowValues.a` — makes `dry-run.mjs` exit **1** with exactly
those two checks FAIL (`checks=26 failed=2 goNoGo=false`); restoring the driver
returns it to 26/26. The oracle's own negative controls are `A4` (the #575 split
literals must throw `ACCEPTANCE_ROOT_MISMATCH`), `A5`/`A6` (production row /
directive root), `C9` (the healthy row-2 replay is PASS), `C10` (three row-5
laundering arms are REFUTED), `C11` (archive refusal is REFUTED) and the `C*`
families (a row whose observable is absent must not be PROVEN).

### Structurally unverifiable without a boot (and why)

1. a live `team.create` of the acceptance blueprint — it is an RPC against a
   running Host; there is no host-free entry point (the plan mode validates the
   blueprint with the host's own parser and pre-checks the row composition
   instead);
2. that the p6t6 directive the driver writes is the one the row reads — the
   directive path is World-internal and materialises only during boot (the
   host-free side proves the *identity* of `createRoot`/`directiveRoot`, not the
   file handoff);
3. that any row is PASS on live data — the dry run proves the decision function
   and the assembly, not the data;
4. that the Host's own teardown disposes the a5sf realm without a fault — the
   dispose-observation channel is a live-State route;
5. the **forwarded** system-prompt section content of the surviving lane — the
   support module does not expose it to the probe (only `observed`/`dropped`
   names), so §4 measures the drop, not the forwarded text.


---

## 6. Go / no-go gate — before spending the first of the three boots

The gate is a command, not a checklist a human can skim:

```bash
node dev/agent-workflow/evidence/a5sf-preflight/go-no-go.mjs   # exit 0 = GO
```

It writes `go-no-go.json` / `go-no-go.log` and **refuses** unless every line
below is literally true. Each item names the confirming measurement it performs.

| # | precondition | confirming measurement (inside `go-no-go.mjs`) | expected |
| --- | --- | --- | --- |
| 1 | the committed dry run is green | `dry-run.json.goNoGo === true`, 0 failed checks | true / 0 |
| 2 | the **product tree** still is the tree the dry run measured | `sha256(git ls-tree -r HEAD -- packages scripts tests docs/plans docs/contracts dev/engineering package.json pnpm-lock.yaml pnpm-workspace.yaml)` vs `dry-run.json.productTreeDigest` | equal. Evidence-only commits are ignored; any code/test/config change refuses until the dry run is re-run **and its output committed** |
| 3 | no uncommitted product change | `git status --porcelain --untracked-files=no -- ':!dev/agent-workflow/evidence'` | empty |
| 4 | on the preflight branch | `git rev-parse --abbrev-ref HEAD` | `task/a5sf-preflight-20261103` |
| 5 | **no boot was already spent** | `dev/agent-workflow/evidence/a5sf-preflight/ledger.jsonl` | absent (an orphan pre-registration would be a spent boot) |
| 6 | the pool allocates the three dedicated P2-01 starts | `/allocation[item ^= "P2-01"].boots` | **>= 6** (the amendment). At 3 it prints *"the pool amendment is not on this HEAD — merge master forward and re-run; do NOT spend a boot on the un-amended three-boot allocation"* and exits 1 |
| 7 | the pinned host tree is the pin and is clean | `git -C tests/deepseek-harness-test-use rev-parse HEAD` + `status --porcelain` | `639ed015397290b3745d163aafe02ffee4aa3f84` / empty |

`dry-run.json.head` is recorded for the reader and is deliberately **not**
compared: a committed dry run is written before the commit that carries it, so
it is always one commit behind. The value that must match is the product digest,
which is stable across evidence-only commits. That is the review-B5 fix.

After the gate is green, the boot itself is one command:

```bash
node dev/agent-workflow/evidence/a5sf-preflight/run-boot.mjs
```

Then re-run the gate (it will refuse with item 5 once a ledger row exists —
that is the point; the gate is for the FIRST of the three boots; boots 2 and 3
have their own grant/ledger discipline).

## 7. Disclosures / residual risk

1. **The realm-dispose observation carries no session identity.** The product
   text `a5sf: realm dispose failed: …` (in `agent-bindings.mjs`) has no
   `sessionId`. The preflight attributes it by (a) the disposal window
   (`duringManagedDisposal`) and (b) exactly one managed realm
   (`managedRealmCount`), and classifies any other occurrence as `unattributed`
   → row 6 REFUTED. A second concurrently-disposed realm with a real fault in the
   same window would be misattributed to this Member; the six-row World has
   exactly one managed realm, and the residency fault (`p6t6: residency dispose
   failed for '<sid>': …`) **is** exact-session. This is the same residual gap
   the #575 README disclosed, now bounded and machine-checked; removing it needs
   a product-side identity in that line, i.e. a core change this lane must not
   make.
2. **`attachments` presence is a composition fact plus a host-free mount
   measurement**, not a live observation of the acceptance World (§4, §6).
   The probe does not capture `forwardedSections`, so the system-prompt half of
   the cross-lane drop is measured only through the `dropped` list.
3. **`read_image`'s deferred registration is the mount's one async child.** The
   probe measures the current HEAD's settle behaviour with the real module; a
   future change to `dsh-tool-fs`'s inject list or to `DEFERRED_SETTLE_ROUNDS`
   would invalidate arm A without changing this directory. That is why the
   dry-run pins the tool-fs path and the pinned host SHA.
4. **Row 5's preset-definition identity is not HTTP-observable.** The row's PASS
   is the product's own invalidation line + the typed admission refusal (both
   inside the product), not a printed definition object; the host-free P0 arm
   asserts the definition identity directly. Stated in the driver's
   `presetDefinitionVisible` note.
5. **No live result is claimed here.** This preflight's own `run-record.json` is
   absent by design; the live run writes it.
6. **The boot pool on this branch reads 3**, because the amendment to 6 is
   landing on `master` separately. This is exactly why `go-no-go.mjs` has a
   pool check: on a tree that predates the amendment it must refuse, and it
   does (item 6). Do not work around it — merge `master` forward and re-run.
7. **The dispose-window attribution has one unavoidable blind spot** (also §7.1):
   an identity-less realm fault is attributed by window + single-realm count.
   The classifier reports it as `managed-disposal-window` in the record, so the
   reader can see which attribution rule fired.

---

## 8. Files

| file | role |
| --- | --- |
| `run-boot.mjs` | the corrected ONE-boot driver (§2) |
| `a5sf-realm-provider-row.mjs` | the six-row `teamA5sfRealm` provider + late-tool route; a **byte-identical copy** of the #575 row (sha256 `b691ce23…e46b`), which supplies members AND bindings (`bindings: [{toolBindingIdentity: 'dsh.fs/read', tools: ['read'], members: [...]}]`) |
| `go-no-go.mjs` / `go-no-go.json` / `go-no-go.log` | §6, the boot-authorisation gate (refuses on a stale product tree, a spent ledger, an unamended pool) |
| `probe-mount-compat.mjs` / `mount-compat.json` / `mount-compat.log` | §4, 4-arm move measurement |
| `dry-run.mjs` / `dry-run.log` / `dry-run.json` | §5, the one-command preflight (**26 checks**, `productTreeDigest`) |
| `plan.log` / `plan.json` | World plan: composition, patch layer, blueprints, lane algebra, teardown |
| `negative-controls.log` | the two #575 defects re-introduced → 2 FAILs, restored → 26/26 |
| `README.md` | this gate |

Shared contract (tracked, not in this directory):

- `tests/world-factory/lib/a5sf-acceptance-preflight.mjs` — verdicts, root
  identity (incl. production-row + directive values), dispose classifier (with
  log-decoration normalisation), seven judges, `ACCEPTANCE_CASES`
- `tests/world-factory/a5sf-acceptance-preflight.test.mjs` — **24 tests**: 3-way
  oracle per row, #575 split-root control, real-#575-stream fixture, decorated
  fault grammar, row-2 healthy replay, row-5 laundering arms, row-6 refusal
- `tests/world-factory/fixtures/a5sf-575-teardown-observations.json` — the real
  20-line observation stream read-only-extracted from the committed #575
  `teardown.json` (+ the old filter's 27-line result)

## 9. Boot-budget accounting

| item | delta |
| --- | --- |
| Host starts in this preflight | **0** |
| ledger rows written by this preflight | **0** (`ledger.jsonl` absent) |
| ports bound | **0** (`plan.json.world.teardown.releasedPorts = []`) |
| DSH_HOME created | 0 (plan worlds live under `tests/homes/` and are deleted; `dshHome` for the attachment store is an OS temp dir, deleted) |
| P2-01 allocation after preflight | unchanged: 6 boots, 3 newly granted dedicated to the six-row acceptance. The pool FILE on this branch still shows 3 until the separate master amendment lands; `go-no-go.mjs` item 6 refuses on that state rather than trusting prose |

---

## 10. Gates (all run in this worktree; raw transcripts in this directory)

| gate | result | raw |
| --- | --- | --- |
| `node dev/agent-workflow/evidence/a5sf-preflight/dry-run.mjs` | **26/26 PASS, exit 0, `goNoGo=true`** | `dry-run.log` / `dry-run.json` |
| `node dev/agent-workflow/evidence/a5sf-preflight/go-no-go.mjs` | refuses only the un-amended pool / stale tree — see §6; GO on the boot head after the amendment | `go-no-go.json` / `go-no-go.log` |
| all ten a5sf node suites (`node --test tests/world-factory/a5sf-*.test.mjs`) | **147/147** (25+30+12+9+10+8+14+9+13+17) | `all-a5sf-node-suites.log` |
| `node_modules/.bin/vitest run a5sf` | **166/166, 11 files** | `vitest-a5sf.log` |
| law suites + p4t6 (`u6-arc-a-fitness`, `u6-pr6-arc-d-adversarial`, `a4p3-intervention-lane-hygiene`, `p4t6-session-event-scan`), p4t6 last | **54/54, 4 files** | `law-and-p4t6.log` |
| `pnpm typecheck` (9 projects) | pass | `typecheck.log` |
| `pnpm build` | pass | `build.log` |
| `node scripts/place-dist-glue.mjs` | 101 placements, byte-identical, **no dist diff** | `place-dist-glue.log` |
| `node scripts/check-artifacts-committed.mjs` | pass (1916 compared, 101 glue) | `check-artifacts-committed.log` |
| `node scripts/check-artifacts-at-head.mjs` | pass (1916 compared, drift 0) | `check-artifacts-at-head.log` |
| `node scripts/eb3-evidence-guard.mjs --new-since origin/master` | pass, `findings=0` | `eb3-evidence-guard.log` |
| `node scripts/eb3-ci-required.mjs` | pass, `workflows=9 findings=0` | `eb3-ci-required.log` |
| `node scripts/eb3-ci-negative-controls.mjs` | **26/26** controls behaved as required | `eb3-negative-controls.log` |
| `node scripts/ci-pr-gate.mjs --only graph-parse,state-freshness,blueprint-fence,lint-identities` | pass (4/4 legs) | `ci-pr-gate.log` |
| `git diff --check origin/master..HEAD` | clean (exit 0) | `git-diff-check.log` |
| `pnpm ci:local --base origin/master` | **exit 2, `coverage=undetermined`** — see below | `ci-local.log` |

### Why `ci:local` is exit 2 (deliberate, not a failure)

All five steps it ran passed (`failed=0`). It returns 2 because the change adds TWO
paths it refuses to guess a blast radius for:

```
tests/world-factory/lib/a5sf-acceptance-preflight.mjs
tests/world-factory/fixtures/a5sf-575-teardown-observations.json
```

That is the tool's designed answer for a **new shared test library**
(`scripts/ci-local.mjs` header: "anything whose blast radius cannot be named (root
configs, shared test libraries, non-CI scripts) returns `coverage=undetermined` with
exit code 2 … Push and let L1/L2 cover it"), and its own unit test pins the identical
answer for `tests/world-factory/lib/a5sf-harness.mjs` (`scripts/ci-local.test.mjs`
L49–50). The library is nevertheless directly covered: its contract is imported by the
new `tests/world-factory/a5sf-acceptance-preflight.test.mjs` (24 tests, selected and
run by `ci:local` and by `dry-run.mjs`) and by the driver. Escaping the verdict would
require moving the contract into the test file (worse layering) or widening
`ci-local.mjs` (a CI-file change this evidence lane must not make); L1/L2 covers the
remainder exactly as the tool instructs.

### p4t6 tie

The p4t6 scanner total is **not re-booked** by this lane: the change adds only
`dev/**` evidence and `tests/world-factory/**` test/library files, no scanned source,
so `tests/paths.mjs`'s `A5SF` booking and the measured tie are unchanged. The p4t6
suite was measured **last**, after every other suite and after the evidence was on
disk (`law-and-p4t6.log`).
