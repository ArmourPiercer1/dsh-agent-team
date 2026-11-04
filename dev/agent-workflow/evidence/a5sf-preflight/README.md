# a5sf-preflight — zero-boot preflight for the P2-01 six-row live acceptance

**Status: boot 2 = 6/8 PASS (2026-11-04T08:19Z). Both remaining FAILs were
defects of the QUESTION; the repair round in §12.8 cost 0 boots.** 2 of the
pool's 6 P2-01 starts are spent (boot 1 `07:28Z`, boot 2 `08:19Z`); 4 remain, and
`go-no-go.mjs` still authorises another start.
**Review round 2 (B1–B6) applied**: row-2 fact scoping (`C9`), row-5/6 laundering
and post-boot abort severity (`C10`/`C11`), production-row + directive root
assertion (`A5`/`A6`), the real #575 stream as fixture (`B5`/`B6`), the
`go-no-go.mjs` gate (`§6`), and the prose corrected to the measured numbers.
This directory certifies the *driver* and the *assembly* before the first of the
three newly granted P2-01 boots is spent. It does not claim any row is PASS on
live data — that is what the boot is for.

- base: `origin/master` @ `37311eaaa` (fetched, verified; `#579`, the boot-pool
  amendment `#582` and the E8 admission freeze `#580` merged forward into this
  branch — never rebased)
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
node dev/agent-workflow/evidence/a5sf-preflight/dry-run.mjs   # exit 0, 57/57 checks, goNoGo=true
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

## 3. The oracle, re-derived in the driver — EIGHT cases

**The case set changed after the first live run (§11/§12): the precondition plus
SEVEN rows. Row 4 was split into 4a (the write the product allows) and 4b (the
write the guard allows on the ceiling while the Host refuses it downstream), and
rows 2/4 were renamed because their old ids named assertions the oracle no longer
makes. 4b was renamed a SECOND time after boot 2 (§12.8.2): the first split still
asserted a Team refusal the algebra does not produce.**
`ACCEPTANCE_CASE_IDS` is the named contract; the driver never indexes a
positional list (a split renumbers rows).

The decision function lives in
`tests/world-factory/lib/a5sf-acceptance-preflight.mjs` and is pinned by
`tests/world-factory/a5sf-acceptance-preflight.test.mjs` (**29/29 pass**, run by
`dry-run.mjs`; its live stream is the frozen boot-2 fixture, not the mutable
evidence sink — see §12.8.1). Each case has three outcomes; the test file feeds each judge a
NOT_REACHED sample, a REFUTED sample and a PASS base, and asserts the verdicts
differ (`C0`–`C3`), plus the review arms: the row-2 replay over the **REAL live
stream** (`C9`), the three row-5 laundering arms (`C10`), the row-6 archive
refusal (`C11`), the real #575 stream (`B5`), the decorated-fault grammar (`B6`),
the production row / directive root assertions (`A5`/`A6`), the **name-keyed vs
blanket invalidation** discrimination (`C12`), and the three post-live
corrections: the two-consultation rule (`C13`), the 4a/4b split (`C14`), the
temporal row-6 bound over the real stream (`C15`), and the product-bound
read/write partition (`C16`). The boot-2 repair round re-pinned `C14`/`C15` to
the live answer and added the probe-attribution arm to `C15` (§12.8). The precedence itself
is pinned host-free: `dry-run.mjs` reads `mount.ts` and requires the covered-name
branch (`expectedDefinitions.has(name)` → `refusalOf(name, record)`, the
name-keyed code) to precede the blanket `realmFreezeRefusalOf(record)` in
`admitCoveredTool` — post-#580 offsets covered branch +572 → refusalOf +639 →
realmFreeze +936. So row 5 CAN distinguish "the right shadow was condemned" from
"everything was refused because the realm died", in the oracle and in the
product.

| row | PASS requires (state assertion) | REFUTED (the product answered wrongly) | NOT_REACHED (never asked) | #575 defect this repair kills |
| --- | --- | --- | --- | --- |
| precondition | a Member turn was captured (`surfacePerMemberRequest` non-empty), exactly **one** `read` schema, no duplicate names, prompt `read` mentions ≤ discovery's, the `tool:read` section count unchanged, ≥3 `read` calls | any of those clauses false (`MEMBER_SURFACE_DRIFT`) | no Member request at all (`NO_MEMBER_REQUEST`) | #575 printed FAIL with `memberRequestSeen:false` — an absence reported as a failure |
| 1 read A | result not error, planted bytes returned, ≥1 **binding-realm** allow fact with `toolBindingIdentity: 'dsh.fs/read'`, ≥1 confined provider row, and **no base-instance row** | bytes missing / no binding allow / served by base (`ROW1_CLAUSE_FAILED`) | no call or no result (`NO_READ_CALL_A` / `NO_READ_RESULT_A`) | #575 FAIL on a read that never happened |
| 2 read B | `isError`, typed lane refusal, no claim/write-content leak, **≥1 read-path consultation exists**, **EVERY one of them is a deny**, **EVERY one is on the binding lane** (`realm:'binding'` + `toolBindingIdentity:'dsh.fs/read'`), **≥1 binding-lane read-path deny**, **no** provider read. The read PATH is the provider surface minus the product's closed write set (`writeText`, `editText`), so the count is not asserted and a future read method cannot slip past a name filter (§12.1) | any clause false (`ROW2_CLAUSE_FAILED`); the failed clause NAMES a decision, never a count | no call/result (`NO_READ_CALL_B` / `NO_READ_RESULT_B`) | #575 FAIL on a read that never happened; and the live FAIL on a `readText`-only filter that the product cannot emit (a refused read is recorded at `stat`) |
| 3 read C | refused + typed, no leak, exactly one binding deny, no provider read, **and** the lane report shows ceiling `deny`, restriction `allow`, effective `deny`, with no widened allow entry | clause or no-widening false (`ROW3_CLAUSE_FAILED`) | no call/result, **or no lane report**, or no probe for C (`NO_LANE_REPORT_C`, `NO_LANE_PROBE_C`) | the no-widening claim had no channel; "pass" could be produced by an empty report |
| 4a write in-lane | not error, disk equals the written content, a write allow fact exists, **every** write fact is on the ceiling realm (`realm:'member'`, `toolBindingIdentity:null` — which IS "no write fact on the read lane"), confined provider served. The target was READ first (a replace of an observed file, not a `createIfAbsent`) | any clause false (`ROW4A_CLAUSE_FAILED`) | no call/result (`NO_WRITE_CALL_4A` / `NO_WRITE_RESULT_4A`) | the old single row asked for an ALLOWANCE on B that the write⇒read coupling correctly refuses — it could never pass (§12.2) |
| 4b write B ceiling-allowed, read not implied (`CEILING_WRITE_ALLOWED_READ_NOT_IMPLIED`) | **clause 1 — two axes:** ≥1 write-ALLOW fact on the CEILING realm (`realm:'member'`, `toolBindingIdentity:null`) **and no write-allow fact on the binding/read realm**. **clause 2 — not blind delivery:** the observed outcome IS an error, the text is NOT an `A5SF_*`/lane refusal and NOT the typed read-coupling sentence, the disk still holds the planted content, and no planted byte came back to the model. The write reaching the confined provider is REPORTED (`providerWrote`), never checked | any clause false (`ROW4B_CLAUSE_FAILED`) — including a Team lane refusal (the ceiling did NOT admit the write), the read coupling (a different contract), an `A5SF_*` admission refusal, a changed disk, or returned planted bytes | no call/result (`NO_WRITE_CALL_4B` / `NO_WRITE_RESULT_4B`), or the target was not planted (`NO_PLANTED_B`: "unchanged" has no baseline) | the retired row demanded a refusal the algebra never produces (binding constrains READ only); the Host read-before-write policy is the observed refusal and is **not** a Team-lane property (§12.8.2) |
| 5 post-invalidation | Member child session present, late tool registered, invalidation line observed, post-read refused with `A5SF_NATIVE_SHADOW_INVALIDATED` **and** the typed name, **not** the blanket `A5SF_MEMBER_REALM_INVALIDATED` freeze, no forbidden bytes, sink delta 0, counter delta 0, in-lane read also refused with the name-keyed code | the trigger was rejected (`INVALIDATION_TRIGGER_FAILED`), the tool was accepted but not registered (`INVALIDATION_TOOL_NOT_REGISTERED`), the tool IS registered + trigger 200 yet **no invalidation line** (`INVALIDATION_NOT_RAISED` — NoStaleShadow), the refusal is blanket-only (`BLANKET_INVALIDATION_ONLY`: the realm died, not the named shadow), or the post-read served bytes / missed the typed refusal (`ROW5_CLAUSE_FAILED`) | no Member session (`NO_MEMBER_CHILD_SESSION_IN_STATE`), **no trigger dispatched** (`NO_INVALIDATION_TRIGGER`), no post-read (`NO_POST_INVALIDATION_READ`) | #575's only NOT_REACHED — correct there; now "asked and not raised" can never be laundered into it (review B2, `C10`) |
| 6 teardown | archived lifecycle `ARCHIVED`, every post-stop dispatch explained (422 `NO_LIVE_AGENT` or a 200 refusal), **no** success after stop, **no** forbidden bytes, `classifyDisposeFaults` reports no managed/unattributed fault, **every STOP-TIME fact carries a parseable `observedAt` and NONE is LATER than the stop instant** (snapshot taken before any probe), **every fact the row's own post-stop probes appended is a refusal** (`probeFactsAreRefusals`), health 200, host alive | any clause false (`ROW6_CLAUSE_FAILED`), **or the archive was answered with a refusal** (`ARCHIVE_REFUSED`: non-200 or `ok:false` — review B2, `C11`) | no member (`NO_MEMBER_TO_STOP`), archive never dispatched (`NO_ARCHIVE_DISPATCH`), no post-stop dispatch (`NO_POST_STOP_DISPATCH`), **no stop instant recorded** (`NO_STOP_INSTANT`) | #575 printed FAIL with `archiveOk:false` and 27 false "faults"; boot 2 printed FAIL because it re-read the sink AFTER its own probes and counted the probe facts as product facts (§12.8.1). A missing scenario is NOT_REACHED, an answered refusal is REFUTED, a fault must be identity-attributable, a probe is the row's stimulus |

Every judge returns `{verdict, reason, detail}` with `reason` a **closed code**
(`ACCEPTANCE_VERDICTS` + `C*` reason set); `toRunVerdict` maps `PROVEN→PASS`,
`REFUTED→FAIL`, `NOT_REACHED→NOT_REACHED`. The driver's case list is asserted
equal to `ACCEPTANCE_CASES` before a grant is taken and before boot.

Files: `oracle-samples.json` (written by a live run) persists the sample and the
judge output per case, so the decision can be re-derived without the World. The
row-6 sample keeps the stop-time fact array AND the probe delta SEPARATELY
(`facts` / `probeFacts`), because the row's temporal claim is over the first and
the probe clause is over the second. Boot 2's sample kept all ten in one array,
which is the defect §12.8.1 repairs.

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

`dry-run.log` (committed) — **57/57 checks PASS, `goNoGo=true`**, ~3 s, no Host:

1. static: no root literal / imports the contract / all **eight** judges used /
   the retired single row-4 id and judge are GONE / `team.create` precedes the
   same-root state assertion / no clipped result / full observation arrays /
   `expectedTools` declared / **post-boot abort is `FAIL`, never `NOT_REACHED`** /
   row-2 asserts a DECISION on every read-path consultation (the `readText`-only
   filter is absent) / row-5+6 refusal reasons present / production-row+directive
   root assertion present / the real #575 fixture exists;
2. **the corrections bound to their evidence** (§12, §12.8): the lib's
   `WRITE_PATH_METHODS` EQUALS `fs.ts`'s own `WRITE_METHODS`; row 4b asserts the
   ceiling-allowed / read-not-implied shape and *refuses to credit* the
   `IO_WRITE_REQUIRES_READ` sentence (it is the other product answer); row 6
   judges the stop-time sink and the probe delta separately; the eight case ids
   are the contract; the CURRENT run's `consultations.jsonl` carries 8 facts and
   NONE after the stop instant parsed out of the committed `run.log`, while the
   FROZEN boot-2 stream splits 8 + 2 and PROVES with the split, REFUTES when
   unsplit, and REFUTES with one fact injected 1 s after the stop;
3. `agent-bindings.mjs` byte-identical to `origin/master` (sha256 above);
4. `node --test tests/world-factory/a5sf-acceptance-preflight.test.mjs` →
   **29 pass, 0 fail** (three-way oracle, #575 split-root control, real live
   stream, name-keyed vs blanket invalidation, C13–C16);
5. `negative-controls.mjs` → **10/10 controls behave**: each correction is
   re-broken in the LIBRARY, the oracle suite must go red on the named test
   (`C9` / `C14` / `C15` / `C16`), and the original bytes are restored and
   sha256-verified (`allControlsBehaved=true`, library pristine, suite green
   again);
6. `run-boot.mjs --plan` → factory `createWorld` + patch layer emission
   (**6163 bytes**, sha256 `33ef72f1…6347`, in `plan.json`) + **both blueprints
   parsed by the host's own dist facade** + row-identity preflight (3 rows) +
   product lane algebra (A `allow` / B `deny` / C `deny`) + **the home-level
   sandbox-policy pin, bound to the base-bundle row it replaces** (§12.4) + world
   **teardown** (`homeDeleted`, `releasedPorts: []`, no port ever bound) →
   `plan.log` / `plan.json`;
7. `probe-mount-compat.mjs` → §4 table → `mount-compat.json`;
8. head / base / pinned host / **`productTreeDigest`** recorded in
   `dry-run.json`. The digest is the binding identity: it covers
   `packages scripts tests docs/plans docs/contracts dev/engineering` and the
   lock/workspace manifests but **not** `dev/agent-workflow/evidence/**`, so
   `go-no-go.mjs` can tell "the evidence was committed after the run" (fine)
   from "the product tree changed after the run" (refuse).

**The preflight no longer destroys the evidence it cites.** The previous version
of `dry-run.mjs` did `rmSync(run.log)` and pruned `logs/` to the newest
directory — i.e. re-running it deleted the committed live transcript and the
first live run's `instance-port3183.log`. It now saves the pre-existing
`run.log` bytes, restores them verbatim after the plan run (only the plan's
appended suffix becomes `plan.log`), and keeps every `logs/*/` directory that
holds an `instance-port*.log` or a composed profile. `dry-run.json.preserved`
records both sha256 values.

**Negative controls** (`negative-controls.json` / `.log`, kept as evidence):
ten source mutations, one per corrected clause
(`NC1` row-2 `readText` filter, `NC2a` 4a ceiling-only, `NC2b` 4b Team-lane
refusal, `NC2c` 4b read-lane laundering, `NC2d` 4b guard-denied write,
`NC3a` row-6 temporal clause, `NC3b` row-6 parseable `observedAt`,
`NC3c` row-6 probe delta counted as product facts, `NC3d` row-6 served probe,
`NC4` write-method partition). Each is
applied to the library, the oracle suite is run, the named test must fail, and
the library is restored byte-for-byte. The oracle's own controls remain `A4`–`A6`,
`C0`–`C3`, `C9`, `C10`, `C11`, `C12` (a row whose observable is absent must not
be PROVEN).

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
| 5 | **the ledger is a consistent budget account** | every row parses; every boot row belongs to a `runId` that has an intent row; each intent's `plannedStarts` equals the number of boot rows charged to it | empty `unparseable` / `orphanBootRuns` / `plannedMismatch`. This replaced "the ledger file must be absent": after the first live run legitimately spent one start, the old clause refused forever. **The ledger is append-only evidence, not a pre-run state** |
| 5b | **at least one start of the pool is still unspent** | `pool.allocation[item ^= "P2-01"].boots - ledgerBootRows` | `>= 1` (measured: 6 − 1 = 5) |
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

Then re-run the gate: items 1 and 2 refuse until the dry run has been re-run on
the new HEAD **and its output committed** (the evidence-only commit changes the
tree the dry run measured), item 3 refuses while the product tree is dirty, and
item 5b counts down (6 → 5 after the first run). Item 5 no longer refuses merely
because a start was spent — a gate that a successful run can never pass again is
a blocker, not a gate.

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
| `go-no-go.mjs` / `go-no-go.json` / `go-no-go.log` | §6, the boot-authorisation gate (refuses on a stale product tree, an INCONSISTENT ledger, an exhausted pool) |
| `probe-mount-compat.mjs` / `mount-compat.json` / `mount-compat.log` | §4, 4-arm move measurement |
| `dry-run.mjs` / `dry-run.log` / `dry-run.json` | §5, the one-command preflight (**57 checks**, `productTreeDigest`, preserved live transcript, the frozen boot-2 stream replayed) |
| `negative-controls.mjs` / `negative-controls.json` / `negative-controls.log` | the TEN mutation controls: each post-live correction, re-broken, must turn the oracle suite red on its named test; the library is restored byte-for-byte |
| `replay-defect-a.mjs` / `replay-defect-a.log` | §12.8.1, the host-free reproduction of boot 2's row-6 FAIL: the 8-fact stop-time sink PROVES, the 10-fact live sample REFUTES, the split PROVES and the injected +1 s twin REFUTES |
| `plan.log` / `plan.json` | World plan: composition, patch layer, home-level sandbox pin, blueprints, lane algebra, teardown |
| `run.log` / `consultations.jsonl` / `guard-facts.json` / `counter.json` / `transcript.json` / `teardown.json` / `run-record.json` | the BOOT-2 live run (§12.8), append-only evidence: the transcript, the product's own **8-fact stop-time** sink (`consultations.jsonl`; the 2 probe facts are in `teardown.json.probeFacts`), the provider counter, the run record |
| `logs/<world>/instance-port*.log`, `logs/<world>/composed-profile-*.patch.yml` | the launched composition + Host log of the first live run (§11); preserved by §5 |
| `oracle-samples.json` | written by boot 2: the exact sample each judge received (row 6's boot-2 sample keeps the 10-fact array the driver judged; the post-fix driver splits it) |
| `README.md` | this gate |

Shared contract (tracked, not in this directory):

- `tests/world-factory/lib/a5sf-acceptance-preflight.mjs` — verdicts, root
  identity (incl. production-row + directive values), dispose classifier (with
  log-decoration normalisation), **eight** judges, `ACCEPTANCE_CASE_IDS` (the
  named contract) + `ACCEPTANCE_CASES`, the read/write path partition
- `tests/world-factory/a5sf-acceptance-preflight.test.mjs` — **29 tests**: 3-way
  oracle per case, #575 split-root control, real-#575-stream fixture, decorated
  fault grammar, row-2 replay over the REAL live stream + the two-consultation
  rule, the 4a/4b split, the row-6 temporal bound + probe attribution, row-5
  laundering arms, row-6 refusal
- `tests/world-factory/fixtures/a5sf-575-teardown-observations.json` — the real
  20-line observation stream read-only-extracted from the committed #575
  `teardown.json` (+ the old filter's 27-line result)
- `tests/world-factory/fixtures/a5sf-boot2-row6-sample.json` — the FROZEN boot-2
  stream, extracted verbatim from `oracle-samples.json` and split at the recorded
  stop instant (8 stop-time facts, 2 probe facts). Pinned by `C9`/`C13`/`C15`
  so a later live run cannot move the regression stream under the suite

## 9. Boot-budget accounting

| item | delta |
| --- | --- |
| Host starts spent by the PREFLIGHT commands | **0** (the boot-2 repair round spent none) |
| Host starts spent by the live runs in this directory | **2** (boot 1 `07:28Z`, boot 2 `08:19Z`); 4 boots remain in the pool (§12.8) |
| ledger rows written by the preflight commands | **0** |
| ports bound | **0** (`plan.json.world.teardown.releasedPorts = []`) |
| DSH_HOME created | 0 (plan worlds live under `tests/homes/` and are deleted; `dshHome` for the attachment store is an OS temp dir, deleted) |
| P2-01 allocation after preflight | unchanged: 6 boots, 3 newly granted dedicated to the six-row acceptance. The pool FILE on this branch still shows 3 until the separate master amendment lands; `go-no-go.mjs` item 6 refuses on that state rather than trusting prose |

---

## 10. Gates (all run in this worktree; raw transcripts in this directory)

> The FIRST table is the original preflight record (28 checks, before the two
> live runs). The two tables after it are the current rounds; **§12.8.4 is the
> current one.**

| gate | result | raw |
| --- | --- | --- |
| `node dev/agent-workflow/evidence/a5sf-preflight/dry-run.mjs` | **28/28 PASS, exit 0, `goNoGo=true`** | `dry-run.log` / `dry-run.json` |
| `node dev/agent-workflow/evidence/a5sf-preflight/go-no-go.mjs` | refuses only the un-amended pool / stale tree — see §6; GO on the boot head after the amendment | `go-no-go.json` / `go-no-go.log` |
| all ten a5sf node suites (`node --test tests/world-factory/a5sf-*.test.mjs`) | **152/152** (25+35+12+9+10+8+14+9+13+17) | `all-a5sf-node-suites.log` |
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

### The correction round re-ran the gates (§12, after boot 1 — historical)

| gate | result | raw |
| --- | --- | --- |
| `node dev/agent-workflow/evidence/a5sf-preflight/dry-run.mjs` | **48/48 PASS, exit 0, `goNoGo=true`** (was 28/28) | `dry-run.log` / `dry-run.json` |
| `node dev/agent-workflow/evidence/a5sf-preflight/negative-controls.mjs` | **7/7 controls behaved**, library restored byte-for-byte, suite green after | `negative-controls.log` / `negative-controls.json` |
| all ten a5sf node suites | **156/156** (was 152; the oracle file grew 25→29) | `all-a5sf-node-suites.log` |
| `node_modules/.bin/vitest run a5sf` | **166/166, 11 files** (unchanged — the corrections are host-free test seams) | `vitest-a5sf.log` |
| `git diff --check origin/master..HEAD` | clean (exit 0). It reported **one** trailing space inside the committed live transcript (`run.log:33`, an artifact of a 320-char counter slice); the space was stripped and the driver's `log()` now strips trailing whitespace so no future transcript carries one. Nothing else changed in that line | `git-diff-check.log` |
| `node dev/agent-workflow/evidence/a5sf-preflight/go-no-go.mjs` | **GO**, no boot spent (see §12.7) | `go-no-go.log` / `go-no-go.json` |

### The boot-2 repair round re-ran the gates (§12.8, after boot 2 — current)

| gate | result | raw |
| --- | --- | --- |
| `dry-run.mjs` | **57/57 PASS, exit 0, `goNoGo=true`** (was 48/48; the new checks bind the two boot-2 repairs and replay the frozen stream) | `dry-run.log` / `dry-run.json` |
| `negative-controls.mjs` | **10/10 controls behaved** (was 7/7), library restored byte-for-byte, suite green after | `negative-controls.log` / `negative-controls.json` |
| the oracle test file | **29/29 pass** (`C14`/`C15` re-pinned to the live answer; `C15` gained the probe-attribution arms) | run in `dry-run.log`, suite evidence in `negative-controls.log` |
| all ten a5sf node suites | **156/156** (unchanged total; the oracle file is still 29 tests) | `all-a5sf-node-suites.log` |
| `node_modules/.bin/vitest run a5sf` | **166/166, 11 files** (unchanged — host-free seams) | `vitest-a5sf.log` |
| `git diff --check` (working tree and `origin/master..HEAD`) | clean (exit 0) | `git-diff-check.log` |
| `node dev/agent-workflow/evidence/a5sf-preflight/go-no-go.mjs` | **GO**, no boot spent by this round (see §12.8.4) | `go-no-go.log` / `go-no-go.json` |

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
new `tests/world-factory/a5sf-acceptance-preflight.test.mjs` (29 tests, selected and
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

## 11. THE FIRST LIVE SIX-ROW RUN — 2026-11-04T07:28Z (head `1ee898c33`, port 3183, 1 start)

> **This section is the historical record and is not rewritten.** The three FAILs
> it diagnoses were defects of the QUESTION. §12 is the correction round: what was
> changed, why the change corrects rather than relaxes, and the replay evidence
> for each. The run record (`run-record.json`) keeps the OLD case ids on purpose.

**Overall FAIL: 4 PASS / 3 FAIL.** The three FAILs are **contract/oracle defects, not enforcement
gaps** — and the run's most important result is that the Member **activated at all**, which is what
#576/#578/#580 were for. Every earlier attempt died before this point.

### The four PROVEN rows (live, real Host, real pinned `dsh-tool-fs`)

| row | verdict | reason code | what it rests on |
|---|---|---|---|
| composition precondition | **PROVEN** | `MEMBER_ACTIVATED_ONE_READ` | one read schema on the Member surface, prompt matches discovery, `tool:read` unchanged |
| row 1 read A (inside both) | **PROVEN** | `READ_A_ALLOWED_AND_CONFINED` | bytes returned **and** binding-realm allow fact **and** the confined provider served it |
| row 3 read C (ceiling denies) | **PROVEN** | `REFUSED_WITHOUT_WIDENING` | ceiling deny / restriction allow / effective deny from the lane report; no widened allow |
| row 5 post-invalidation | **PROVEN** | `SHADOW_INVALIDATED_AND_ADMISSION_REFUSED` | typed `A5SF_NATIVE_SHADOW_INVALIDATED` (**name-keyed, not the blanket freeze**), no bytes, no guard fact, no provider call, refused in-lane too |

Row 5 is the P0 invariant measured on a live Host for the first time: an invalidated managed shadow
was condemned **by name**, and the forbidden bytes never arrived.

### The three FAILs, with the raw facts

The complete live sink was five facts:
`stat allow` + `readText allow` on `a.txt`; `stat deny` on `b.txt`; `stat deny` on `c.txt`;
`writeText allow` on `b.txt` (ceiling realm).

1. **row 2 — `exactlyOneReadFactForB: false`.** Every other clause passed (refused, typed lane
   refusal, no claim leak, exactly one binding deny, no provider read). The defect is the oracle's
   method assumption: the live denial is recorded at **`stat`**, because the read tool stats the
   target first and never reaches `readText`. The /B1/ fix filtered on `readText`, so it counted
   zero. One read-path fact exists; the oracle looked for the wrong method name.
2. **row 4 — `notError: false`, `diskMatches: false`.** The write to `b.txt` was **refused**, and
   correctly so: `b.txt` is inside the ceiling but outside the restriction read allowance, and the
   product requires read permission to write (`IO_WRITE_REQUIRES_READ`, measured host-free in
   #579). The row asserts an allowance the product correctly denies, so the **row design** is
   wrong, not the enforcement. It should become two rows: write to a readable in-lane file
   (allowed, `writeText` fact on the ceiling only, disk matches) and write to `b.txt`
   (REFUSED with `IO_WRITE_REQUIRES_READ`, disk unchanged).
3. **row 6 — `noFactAfterStop: false`.** `sinkDelta=2`, but **no fact carries an `observedAt`
   after the archive**: the newest fact is `07:28:27.080` and the archive happened at
   `07:28:28.916`. The two counted facts are the last two **pre-stop** facts (sequences 4–5) that
   landed between the baseline read and the after-read — the sink is append-only and is read at two
   instants, so a count delta cannot express "nothing after the stop". Meanwhile
   `noSuccessAfterStop`, `noForbiddenBytesAfterStop`, `noManagedDisposeFault` and
   `noUnattributedRealmFault` were all true. The row must assert **no fact with an `observedAt`
   after the stop instant**, not a count delta.

### What this run therefore established

- The live Member assembly works end to end: activate → routed native surface → two-axis guard →
  provider, with a guard fact per consultation on the right realm.
- The **read** half of the contract is proven live: in-lane reads are confined, ceiling-denied reads
  are refused, and a post-invalidation read is refused by name with no bytes and no provider call.
- The remaining three rows fail on **how the driver asks the question**, not on what the product
  does. That is the honest reading, and it is why the two remaining dedicated starts are worth
  spending only after the oracle and row-4 design are corrected.

### Budget

`bootsSpent=1` of the three dedicated P2-01 starts; ledger rows = intent + boot1. The pool reserve
was not touched. Port released, home deleted, no orphan Host.

---

## 12. The correction round — three defective questions, repaired

> **§12.1–12.7 are the record of the correction round after boot 1 and are kept
> as written.** Boot 2 (`§12.8`) then measured that two of those corrections were
> themselves wrong about the product: the row-4b expectation (§12.2) and the
> row-6 fact-set reading (§12.3). §12.8 supersedes them and is the current
> contract; the case table in §3 is updated to match.

The first live run asked three questions that the product could not answer
correctly (§11): a `readText`-only fact filter, ONE row demanding an allowance
the write⇒read coupling refuses, and a COUNT of an append-only file standing in
for "nothing after the stop". **No product code changed** (CORE PATCH BUDGET = 0;
`packages/**` untouched; `agent-bindings.mjs` sha256 unchanged, checked by
`dry-run.mjs`). The run count went from **7 to 8 cases** (precondition + 7 rows).

| fix | where | what changed |
| --- | --- | --- |
| 1 read-PATH decision | `tests/world-factory/lib/a5sf-acceptance-preflight.mjs:99` (`ACCEPTANCE_CASE_IDS`), `:121` (`WRITE_PATH_METHODS`), `:138` (`isReadPathConsultation`), `:604` (`judgeRow2`) | the row no longer counts `readText` facts; it asserts a DECISION on every read-path consultation |
| 2 the 4a/4b split | lib `:710` (`judgeRow4a`), `:765` (`judgeRow4b`); driver `run-boot.mjs:435` (read w4a), `:992` (plant B + w4a), `:1361`/`:1392` (samples) | the allowed write and the refused write are two cases, two ids, two dispatches — **4b's expectation superseded by §12.8.2** |
| 3 the temporal bound | lib `:917` (`judgeRow6`); driver `:1555` (`stopInstant`) | no fact may carry an `observedAt` later than the instant the archive was answered — **the input set superseded by §12.8.1** |
| (fixture) sandbox pin | driver `:342` (`homeSandboxPin`), `:1003` (written before the spawn) | the deployment file-sandbox fallback root is pinned to the World workspace (§12.4) |
| replays | `tests/world-factory/a5sf-acceptance-preflight.test.mjs:603` (`C9`), `:705` (`C13`), `:736` (`C14`), `:780` (`C15`), `:835` (`C16`) | each fix replayed over the REAL live stream, plus a refuting twin |
| controls | `negative-controls.mjs` (7 controls, §12.5) | each fix re-broken in the library must turn the oracle suite red |

### 12.1 Fix 1 — row 2 asserts a DECISION, not a count

**The live defect.** `exactlyOneReadFactForB` counted `method === 'readText'`
facts. The native `read` tool STATS its target first; when the binding lane
denies the stat, `readText` is never reached, so a correctly refused read
produces **zero** `readText` facts. The live stream for B was `stat`/`deny` —
the clause reported `readFactsForB: 0` on a refusal that was right.

**The rule now** (`judgeRow2`): let the read PATH be every consultation whose
`method` is NOT in the product's closed write set (`writeText`, `editText` — read
from `fs.ts` at runtime by `dry-run.mjs`, not copied by faith). Then:

1. ≥1 read-path consultation must exist (a refusal nobody recorded is not
   evidence);
2. EVERY one must be `deny`;
3. EVERY one must be on the BINDING lane (`realm:'binding'` +
   `toolBindingIdentity:'dsh.fs/read'`) — a ceiling deny cannot be credited to
   the restriction;
4. ≥1 binding-lane read-path deny must exist.

The count is not asserted. The row-4 `writeText` fact at the same locator is
excluded by the product's own partition and reported in `nonReadPathFacts`.

**Why a legitimate double consultation is never a failure OF THIS RULE.** A
healthy read of an ALLOWED target is stat-then-readText: two allow facts (the
live A stream). B is not an allowed target, so two ALLOWS refute the row — on the
DECISION, never on the multiplicity. Two DENIES at the same locator are equally
acceptable: both consultations were refused, which is the stronger form of the
same claim.

**Replays, verbatim from the test run:**

```
✔ C9 row 2 replay over the REAL live stream: stat-deny + the later writeText allow at B is PROVEN
   reason=BINDING_DENY_ON_READ_PATH readPathFacts=1 readPathMethods=["stat"]
   nonReadPathFacts=[{method:"writeText",decision:"allow",realm:"member"}] factsForB=2
   (the replaced filter counts 0 `readText` facts on the same stream)
✔ C13 row 2 rule for TWO read-path consultations: two denies PROVE, two allows REFUTE, the COUNT is never the failure
   two denies  -> PROVEN,  failed=[]
   two allows  -> REFUTED, failed=["bindingDenyOnReadPath","everyReadPathConsultationDenied"]   (both DECISION clauses)
   write-only  -> REFUTED, readPathFacts=0
```

`C9`'s fixture is `consultations.jsonl` — the committed live sink itself, not a
synthetic stream. That was the original mistake: the old fixture contained a
`readText` deny the product never emits, so the oracle was pinned against a
stream the World cannot produce.

### 12.2 Fix 2 — row 4 splits into 4a and 4b (a correction, not a relaxation)

> **The split is current; the 4b EXPECTATION below is superseded by §12.8.2.**
> Boot 2 measured the guard allowing the write on the ceiling realm and the Host
> read-before-write policy refusing it downstream. Read this subsection for why
> the split was made, not for what 4b now asserts.

**The live contradiction.** Row 4 wrote `b.txt` and demanded "allowed **and** no
read-lane fact". `b.txt` is inside the ceiling write lane but OUTSIDE the
binding read allowance, and the product refuses to write what the Member may not
read (`IO_WRITE_REQUIRES_READ`, `team-services/src/fs.ts:122-128`, measured
host-free in #579). The row could only ever FAIL. The live refusal was in fact
the **Host file sandbox** (`[sandbox: file access denied under workspace-write
mode]`), because `b.txt` was never planted and the deployment root — not the
Team lanes — fenced the write (§12.4). Two independent defects in one row.

**The split.** Both halves keep the property "the write must not cross
channels", measured from opposite sides:

| | 4a — the write the product ALLOWS | 4b — the write the product REFUSES |
| --- | --- | --- |
| target | `<workspace>/axis/allow/w4a.txt` (inside the ceiling **and** the read allowance), read first, then written | `<workspace>/axis/b.txt` (inside the ceiling, outside the read allowance), **planted** with claim content |
| expected live result | `notError`, disk = the new content, ≥1 write fact, **every** write fact ceiling-realm (`realm:'member'`, `toolBindingIdentity:null`), confined provider served | `isError`, the text **is** the product's read-coupling sentence, disk = the planted content, **no write-allow fact on the read lane**, no provider write call |
| what must never happen | a write fact on the read (binding) lane | a write-allow laundered onto the read lane |
| live-derived expectation | the ceiling `writeText` allow fact, exactly as the live run measured for B | the ceiling allow is EXPECTED (the ceiling lane admitted it) and is reported, not counted |

**Why this corrects rather than relaxes the question.** The product's write⇒read
coupling is *intended*, and it is already measured host-free (#579). A row that
demands an allowance the product is designed to refuse is not a stricter test —
it is a test of nothing, because its only possible answer is FAIL. The real
invariant ("a write admitted on one lane must not appear as an allow on the
other") is now asserted **twice**, on an allowed write and on a refused one, and
the refused half additionally pins the refusal's IDENTITY (the read-coupling
sentence, not any error). `judgeRow4b` refuses to credit the live host-sandbox
denial: it is an error, but not the asked question.

**Replays** (`C14`):

```
✔ C14 rows 4a/4b: the split is two questions, and neither loosens the other
   4a PROVEN; crossed write fact -> REFUTED, failed=["everyWriteFactOnCeiling"], readLaneWriteFacts=1
   4a stale disk -> REFUTED; base-instance provider -> REFUTED; error result -> REFUTED
   4b PROVEN with the read-coupling sentence; ceiling allow REPORTED (realm="member")
   4b on the LIVE row-4 text (host sandbox denial) -> REFUTED, typedReadCouplingRefusal=false
   4b changed disk -> REFUTED; unplanted target -> NOT_REACHED (NO_PLANTED_B)
   4b laundered read-lane allow -> REFUTED
```

### 12.3 Fix 3 — row 6's bound is an INSTANT, not a delta

> **The instant (not a delta) is current; the FACT SET below is superseded by
> §12.8.1.** Boot 2 showed that the bound was being judged over a sink re-read
> after the row's own probes; it now runs over the stop-time snapshot, with the
> probe delta as a separate refusal clause.

**The live defect.** `sinkDelta === 0` counted facts in a window of an
APPEND-ONLY file read at two instants. Two pre-stop facts (sequences 4–5) landed
in the window, so a clean teardown reported `noFactAfterStop: false` while the
newest fact (`07:28:27.080Z`) plainly preceded the archive
(`07:28:28.916Z`).

**The rule now** (`judgeRow6`): the driver records `stopInstant` — the instant
the archive dispatch was answered — and the row asserts

* every fact carries a parseable `observedAt` (`factsAreTimestamped`), and
* no fact's `observedAt` is LATER than `stopInstant` (`noFactAfterStop`).

An unparseable timestamp cannot be proven to precede the stop, so it fails
closed. `sinkDelta` is still carried in the sample and reported as
`sinkDeltaObserved`, and is **not** checked — C15 proves that the verdict is
unchanged for `sinkDelta` 0 and 2 on the same stream. The other clauses
(`noSuccessAfterStop`, `noForbiddenBytesAfterStop`, the two dispose-fault
clauses) are untouched.

**Replays** (`C15`), over the real stream, stop instant parsed from the committed
`run.log`:

```
✔ C15 row 6 temporal bound: PROVEN over the REAL live stream, REFUTED by one later observedAt
   PROVEN  : factsObserved=5, factsAfterStop=[], newest=2026-11-04T07:28:27.080Z, stop=2026-11-04T07:28:28.916Z
   REFUTED : one injected fact with observedAt=2026-11-04T07:28:29.500Z -> failed=["noFactAfterStop"]
             factsAfterStop=[{method:"writeText",locator:"/w/after-stop.txt",observedAt:"2026-11-04T07:28:29.500Z"}]
   boundary: a fact AT the stop instant is NOT after it -> PROVEN
   undated : observedAt=null -> REFUTED, failed=["factsAreTimestamped"]
   no stop : stopInstant=null -> NOT_REACHED (NO_STOP_INSTANT)
```

### 12.4 The fixture correction the write rows needed: the sandbox-policy pin

This is disclosed because it changes the WORLD, not the oracle — and it is the
one change that decides whether the write rows can observe the Team lanes at all.

The base bundle mounts `sandbox-policy` with
`workspaceRoot: !!js process.cwd()` — the cwd of the spawned `dsh web`, i.e. the
**pristine host tree** — and `mode: workspace-write`. A confined provider asked
without a per-call policy resolves `ctx.sandboxPolicy.resolve()` with NO session,
which falls back to that deployment root. The a5sf realm provider deliberately
drops the caller's policy (`createConfinedFileSystemClass` → `void policy`), so
**every Team write is fenced by the deployment root, not by the World**. Measured
consequence in §11: row 4 was refused by the host sandbox and the Team lanes were
never consulted.

The driver now writes the launcher's documented **home-level** patch layer into
the World's own `DSH_HOME` (`<home>/cordis.patch.yml`, applied AFTER the profile
patch, so it outranks it) with one replacement row that RESTATES the whole config
of the row it replaces:

```yaml
- id: sandbox-policy
  config:
    mode: "workspace-write"
    workspaceRoot: "<world>/workspace"
```

Three independent checks in `dry-run.mjs` keep this honest host-free: the base
row's key set equals the pinned key set (`mode`, `workspaceRoot` — a patch
replaces the WHOLE config), the base row's `workspaceRoot` expression is
literally `!!js process.cwd()` (i.e. the defect is real), and the pinned root
equals the World workspace the write rows target. Because the pin makes the HOST
fence allow exactly the root the Team ceiling write lane already allows, the write
rows measure the TEAM lanes. Nothing is shared: the file lives inside the World
home, which is deleted with the World.

### 12.5 Negative controls (mutation, not inspection)

`negative-controls.mjs` re-breaks each corrected clause in the library, runs the
oracle suite, requires the NAMED test to fail, and restores the original bytes
(sha256-verified; a stale backup from a crashed run is restored at start):

| control | mutation | must break |
| --- | --- | --- |
| `NC1` | row 2 filters `method === 'readText'` again | `C9` |
| `NC2a` | 4a accepts any write fact (`writeFacts.length > 0`) | `C14` |
| `NC2b` | 4b accepts ANY refusal | `C14` |
| `NC2c` | 4b ignores a read-lane write allow | `C14` |
| `NC3a` | row 6's temporal clause is always true | `C15` |
| `NC3b` | row 6 stops requiring a parseable `observedAt` | `C15` |
| `NC4` | `WRITE_PATH_METHODS` loses `editText` | `C16` |

Result: `allControlsBehaved=true`, library pristine, suite green again
(`negative-controls.json` / `.log`; `dry-run.mjs` fails if any control stops
behaving). The `NC2a` control is itself a finding: the first version of `judgeRow4a`
had two clauses for one property ("every write fact is on the ceiling" and "no
write fact on the read lane"), so mutating either left the other to catch it — one
property, one clause.

### 12.6 What is still least certain

**That the pin + the planted `B` + the prior read of `w4a.txt` actually produce
4a ALLOWED and 4b REFUSED-by-read-coupling in one live run.** Three unverified
links chain here: (a) the home-level patch really outranks the profile patch for
`sandbox-policy` in this launcher, (b) the host's read-before-edit policy accepts
the model's read of `w4a.txt` as the observation its write needs, (c) the
write⇒read refusal reaches the model as the prose sentence rather than being
re-rendered by the tool layer. Each is plausible from the source and each is
cheap to check `--plan`-side, but none can be confirmed without spending a boot —
which this lane must not do.

### 12.7 The gate after the corrections (no boot spent)

`go-no-go.mjs` was re-run on the corrected tree. Two of its items were THEMSELVES
defective for this phase and were repaired with the rest:

* item **5** used to require that `ledger.jsonl` **not exist** ("no boot was already
  spent"). After the first live run legitimately spent one start, that clause
  refused forever — a gate a successful run can never pass again is a blocker.
  It now reads the ledger as a budget ACCOUNT: every row parses, every boot row
  belongs to a runId with an intent row, and each intent's `plannedStarts` equals
  the boot rows charged to it.
* a new item **5b** asserts the pool still has a start for the run being
  authorised: `boots (6) − bootRows (1) = 5 ≥ 1`.

Result on this head, with **no boot spent by the correction round**:
`go-no-go.log` / `go-no-go.json` — see the committed files for the verbatim line.

---

## 12.8 THE SECOND LIVE RUN (boot 2, 2026-11-04T08:19Z) — 6 of 8 PASS, and both FAILs were still the QUESTION

One Host start (port 3182), clean teardown, **6 PASS / 2 FAIL**. The six PASSes
are the composition precondition, row 1 (read A confined), row 2 (binding deny on
the read PATH — the §12.1 repair holds on a second live stream), row 3 (refused
without widening), row 4a (write allowed with every write fact on the ceiling
realm, disk matches) and row 5 (post-invalidation refused by name, no bytes, no
guard fact, no provider call). Boot 2 ran at head `0dec8f2d6`; the run record and
the transcript are the top-level evidence files in this directory.

### The complete live sink — TEN facts, not eight

| # | observedAt | realm | method | decision | target | what it is |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 08:19:25.314Z | binding | stat | allow | `axis/allow/a.txt` | row 1 |
| 2 | 08:19:25.320Z | binding | readText | allow | `axis/allow/a.txt` | row 1 |
| 3 | 08:19:25.351Z | binding | stat | **deny** | `axis/b.txt` | row 2 |
| 4 | 08:19:25.382Z | binding | stat | **deny** | `restriction-outside/c.txt` | row 3 |
| 5 | 08:19:25.408Z | binding | stat | allow | `axis/allow/w4a.txt` | row 4a read |
| 6 | 08:19:25.410Z | binding | readText | allow | `axis/allow/w4a.txt` | row 4a read |
| 7 | 08:19:25.438Z | member | writeText | allow | `axis/allow/w4a.txt` | row 4a write |
| 8 | 08:19:25.470Z | member | writeText | allow | `axis/b.txt` | row 4b write (ceiling) |
| 9 | **08:19:27.332Z** | binding | stat | **deny** | `axis/b.txt` | **the row's own `postArchiveRead` probe** |
| 10 | **08:19:27.385Z** | binding | stat | **deny** | `axis/b.txt` | **the row's own `postDropRead` probe** |

Stop instant (the archive answer): **08:19:27.285Z**. Facts 9–10 are AFTER it and
are the ONLY facts after it. `consultations.jsonl` (copied before the stop) holds
facts 1–8; the two probe facts are persisted in `teardown.json.probeFacts` and in
`oracle-samples.json` row 6. The earlier reading of "the complete live sink = 8
facts" came from the copy, not from the sink the judge saw.

### 12.8.1 Defect A — row 6 counted its own post-stop probes as product facts

**The observed FAIL.** `noFactAfterStop: false` while the 8 facts in the committed
sink all preceded the stop. **The real cause is not the comparison.** The
comparison in `judgeRow6` was already correct — it rejects an unparseable
`observedAt` explicitly and compares epoch milliseconds — and replaying the
committed sink plus the recorded stop instant PROVES. The wrong line was in the
DRIVER, `run-boot.mjs` row-6 sample assembly:

```js
// boot 2 (wrong): re-read AFTER postArchiveRead / postDropRead had been dispatched
facts: parseJsonl(sinkPath).filter((f) => f?.schema === 'a5sf-guard-consult/1'),
```

Those two probes are real guard consultations; each appended a real
`stat`/deny/binding fact at b.txt (facts 9–10). The row then judged those facts
against its temporal bound and refuted a clean teardown **on its own stimulus**.
The `sinkDelta=2` line in `run.log` and the two refusals in
`teardown.json.refusalCodesAfterStop` are the same two probes. No second sink, no
NaN, no clock disagreement, and no different stop value: the sample was re-read
after the row had appended to it.

**The repair (driver + judge).** The driver snapshots the sink as an ARRAY
(`factsAtStop`) immediately after the archive answer and BEFORE any probe; passes
that as `facts`; computes `probeFacts` as the delta after the probes; and persists
both. `judgeRow6` judges the temporal bound over `facts` only and adds one
clause, `probeFactsAreRefusals`: a stopped Member may be consulted, but every
fact the probe appended must be a **deny** — an allow would mean it was still
being served. `sinkDelta` remains reported, never checked.

**The two required replays over the REAL stream** (`replay-defect-a.mjs` →
`replay-defect-a.log`, verbatim):

```
A. consultations.jsonl                    = 8 facts
   newest observedAt in that file        = 2026-11-04T08:19:25.470Z
   judgeRow6(sink, stop)                 = {"verdict":"PROVEN","reason":"NO_USABLE_UNCONSTRAINED_SHADOW","factsObserved":8,"factsAfterStop":[],"probeFacts":0,"failed":[]}
B. the LIVE sample the driver judged     = 10 facts (oracle-samples.json row6)
   newest observedAt in that sample      = 2026-11-04T08:19:27.385Z
   judgeRow6(live sample, stop)          = {"verdict":"REFUTED","reason":"ROW6_CLAUSE_FAILED","factsObserved":10,"factsAfterStop":[{"method":"stat","locator":"…/axis/b.txt","realm":"binding","observedAt":"2026-11-04T08:19:27.332Z"},{"method":"stat","locator":"…/axis/b.txt","realm":"binding","observedAt":"2026-11-04T08:19:27.385Z"}],"probeFacts":0,"failed":["noFactAfterStop"]}
   facts after the stop, verbatim:
     2026-11-04T08:19:27.332Z  stat/deny  realm=binding  b.txt
     2026-11-04T08:19:27.385Z  stat/deny  realm=binding  b.txt
C. attribution: factsAtStop(8) === consultations.jsonl(8)? true
   every post-stop fact targets b.txt? true; teardown.json refusalCodesAfterStop has 2 entries (the row's own postArchiveRead + postDropRead), each a refusal:
     status=200 ok=false "authored locator '…/axis/b.txt' is outside every allow subtree of the lane"
     status=200 ok=false "authored locator '…/axis/b.txt' is outside every allow subtree of the lane"
   the row's own probes appended exactly the facts it then counted: after = before + 2
D. repaired split: factsAtStop=8, probeFacts=2
   judgeRow6({facts: factsAtStop, probeFacts: factsAfterStop}) = {"verdict":"PROVEN","reason":"NO_USABLE_UNCONSTRAINED_SHADOW","factsObserved":8,"factsAfterStop":[],"probeFacts":2,"failed":[]}
   judgeRow6({facts: factsAtStop + one fact at stop+1s})       = {"verdict":"REFUTED","reason":"ROW6_CLAUSE_FAILED","factsObserved":9,"factsAfterStop":[{"method":"stat","locator":"/w/after-stop.txt","realm":"binding","observedAt":"2026-11-04T08:19:28.285Z"}],"probeFacts":2,"failed":["noFactAfterStop"]}
   judgeRow6({facts, probeFacts with one ALLOW})             = {"verdict":"REFUTED","reason":"ROW6_CLAUSE_FAILED","factsObserved":8,"factsAfterStop":[],"probeFacts":3,"failed":["probeFactsAreRefusals"]}
```

`C15` pins all four arms (PROVEN split / REFUTED unsplit / REFUTED +1 s /
REFUTED served probe) and keeps the boundary, undated and no-stop cases. The live
stream is now the FROZEN fixture
`tests/world-factory/fixtures/a5sf-boot2-row6-sample.json`: testing directly
against `consultations.jsonl` made the suite red the moment boot 2 rewrote it
(`C1`/`C5`/`C9`/`C15` failed on the boot-2 head), and a regression stream must
not move under the suite.

### 12.8.2 Defect B — row 4b asserted a refusal the algebra does not produce

**The observed FAIL.** `writeText allow`, realm **member** (`toolBindingIdentity:
null`) for b.txt, `noReadLaneWriteAllow: true`, and a provider counter row
(`write-call`, instance `fs-4`). So the guard **allowed** the write, bounded by
the CEILING alone — which is what the current algebra promises: the binding
restriction constrains the READ axis. The refusal the retired row saw was the
Host's own read-before-write policy:

```
Error: cannot modify "…/workspace/axis/b.txt": file has not been read — read the file, then retry
```

`#579` measured a write⇒read coupling on **`edit`**, which reads then writes;
plain `write` does not read. The retired row demanded the coupling's refusal on a
write the ceiling admits, so its only possible answer was FAIL. That was the
question's contradiction, not a product defect.

**The rule now** — `CEILING_WRITE_ALLOWED_READ_NOT_IMPLIED`, case id
`live:row4b-write-b-ceiling-allowed-read-not-implied`:

1. **The guard allows a write the binding lane cannot read.** ≥1 write-ALLOW
   fact on the CEILING realm (`realm:'member'`, `toolBindingIdentity:null`) and
   **no** write-allow on the binding/read realm. This is the two-axis statement:
   a write is ceiling-bounded.
2. **The bytes are not delivered blindly.** The observed outcome IS an error;
   the text is **not** an `A5SF_*`/lane refusal and **not** the typed read-coupling
   sentence; the planted content on disk is unchanged; no planted byte came back
   to the model.

| clause | live-derived expectation (boot 2) | what refutes it |
| --- | --- | --- |
| 1 ceiling allow | one `writeText`/allow fact, `realm:"member"`, `toolBindingIdentity:null`; `readLaneWriteAllowFacts: 0` | no ceiling allow (the guard denied the write); a write-allow on the binding realm |
| 2 not blind | `isError: true`, Host policy text (`file has not been read`), `disk == planted`, no planted bytes in the result | a Team lane refusal, an `A5SF_*` refusal, the read-coupling sentence, a changed disk, returned planted bytes |

The provider counter is **reported** (`providerWrote: true` in the live run),
never checked: the write really did reach the confined provider, and a row
demanding "no provider write" would ask the product for something it does not
promise on the write axis. **The Host read-before-write refusal is NOT a security
property of the Team lanes** — it is the upstream tool policy answering a
different question — and neither this README nor the row may describe it as one.
`C14` covers the PROVEN shape plus: the read-coupling refusal (the retired row's
answer) → REFUTED, a lane refusal → REFUTED, an `A5SF_*` refusal → REFUTED, no
ceiling allow → REFUTED, changed disk → REFUTED, returned planted bytes →
REFUTED, laundered read-lane allow → REFUTED.

### 12.8.3 Open semantic question — should `write` imply `read`? (awaiting a user ruling; NO code change)

Today a Member can be told to overwrite a file whose bytes it can never inspect.
The Team guard permits that by design of the current algebra: the binding
restriction is a READ restriction, and a write is bounded by the ceiling alone.
Boot 2 measured the consequence: the guard allowed the write to b.txt, the write
reached the provider, and only the Host's own read-before-write policy stopped
it. If that Host policy were absent (or the file had been read by someone else
first), the bytes would land. The alternatives:

1. **Leave the algebra as-is and disclose it** (current state). Two independent
   axes, each with its own law; a write lane that is wider than the read lane is
   the operator's choice when compiling the Member. The cost is that a Member can
   be instructed to overwrite content it cannot inspect, and the only guard
   against blind delivery is the Host's read-before-write policy — which is an
   upstream tool policy, not a Team guarantee.
2. **Add a write⇒read coupling at the policy layer**: a write whose target lies
   outside the Member's read allowance is refused (by the Team lane, typed), i.e.
   the write lane is intersected with the read lane. This matches what `edit`
   already does, makes the two axes non-independent on the write side, and would
   turn the b.txt write into a typed Team refusal — but it also removes the
   ability to compile a write-only Member, and it is a product-algebra change
   (new policy semantics + tests), not an oracle fix.

This lane changes **no algebra** and takes no position beyond the measured facts:
the question is recorded, the row asserts only what the product promises today,
and the choice is left to the user. If option 2 is chosen, row 4b's clause 1
becomes "the guard refuses with the new typed code" and this subsection is the
place to record the ruling.

### 12.8.4 Controls and gates after this repair

**One gate hole found and closed while repairing this round.** `dry-run.mjs`
checked `plan.json`'s contents but not the `--plan` run's exit status, so a
failed plan run left the PREVIOUS `plan.json` in place and every plan check
passed against it. It bit this round exactly once: the driver's own `CASES` list
still carried the old row-4b id after the lib rename, `--plan` exited 1 on
`assertCaseListMatchesContract`, and the plan checks were green anyway. The plan
run's exit status is now the FIRST plan check; `--plan` is green again after the
driver list was updated.

| gate | result | raw |
| --- | --- | --- |
| `dry-run.mjs` | **57/57 PASS, exit 0, `goNoGo=true`** (was 48/48) | `dry-run.log` / `dry-run.json` |
| `negative-controls.mjs` | **10/10 controls behaved**, library restored byte-for-byte (`873eadc7…`), suite green after | `negative-controls.log` / `negative-controls.json` |
| the oracle test file | **29/29 pass** | `node --test tests/world-factory/a5sf-acceptance-preflight.test.mjs` |
| all ten a5sf node suites | **156/156** | `all-a5sf-node-suites.log` |
| `vitest run a5sf` | **166/166, 11 files** | `vitest-a5sf.log` |
| `git diff --check` | clean (working tree and `origin/master..HEAD`) | `git-diff-check.log` |
| `go-no-go.mjs` | see the committed `go-no-go.log` (no boot spent by this round) | `go-no-go.log` / `go-no-go.json` |

The controls that are load-bearing for THIS round: `NC2b` (4b credits a Team lane
refusal), `NC2c` (4b launders a read-lane allow), `NC2d` (4b accepts a
guard-denied write), `NC3c` (row 6 re-counts the probe delta as product facts —
the boot-2 defect itself) and `NC3d` (row 6 accepts a served probe). The earlier
controls (`NC1`, `NC2a`, `NC3a`, `NC3b`, `NC4`) still behave.

**What this round is least certain about on the next live run** (a new boot was
NOT spent here, by instruction): that the repaired driver's stop-time snapshot
lands before any delayed product-side emission that would legitimately be
post-stop; that the Host read-before-write policy (not a newly typed Team
refusal) is still what refuses a write to an unread in-lane file; and that the
b.txt write still reaches the confined provider (the counter is reported, not
asserted). None of those can be settled host-free.
