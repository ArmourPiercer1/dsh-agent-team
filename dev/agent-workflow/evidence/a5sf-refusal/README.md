# The admission-refusal case class, the driver case manifest, and the caller fact

**Status: zero boots. No product change. No grade, no `V@B`, no matrix row.**

This lane closes two instrument holes BL-17/BL-18 exposed and encodes the
caller fact BL-18 readiness established:

1. a **truthful PASS** is now possible for a pre-provider **admission-refusal**
   observation (`caseClass: "admission-refusal"`), without claiming an
   enforcement this host's probe reports as `unsupported`;
2. a bundle whose **driver declares a case it will run but `cases` omits** is
   now `FAIL` (`BUNDLE_CASE_UNDECLARED`) — the BL-17 `PASS 16/16` hole;
3. `driver.caller-surface` reds a **strict-Member web caller** and passes the
   only reachable caller: a **legacy/non-strict Member whose preset already
   surfaces `web_fetch`/`web_search`**.

Before/after payloads, the negative controls, and the exact product lines are
below. The run that remains (P2-04 allocation #5) now has a bundle that can
legitimately PASS the preflight; it still needs its own grant and boot, which
this lane does not spend.

---

## 1. The new class in one paragraph (reviewer-checkable)

A case that declares `caseClass: "admission-refusal"` is graded **only** on a
refusal made by our own admission code **before** any provider entry, and on
nothing else: it must declare `guardFacts: 1`, `collector: "guard-fact"`,
`observable: "pre-provider-refusal"`, one `expectedFact` whose `decision` is
`deny` and whose `decidedBy` is the *exact* typed `expectedCode`, a
`refusalNaming: "capability"` (the refusal names the capability, not a
downstream observation), `providerEntries` with **all five channels**
`fetch/search/transport/dns/connect` exactly `0`, and an explicit
`claimsConfinement: false`. Any missing observable is a `FAIL`
(`POLICY_ADMISSION_REFUSAL_INCOMPLETE`), never `UNKNOWN`: the class exists so the
host-free verdict is **decidable**. `claimsConfinement: true`, any
`networkConfinement`/`confinement`/`isolation` field, a
`row`/`matrixRow`/`satisfiesRow` label containing `confinement`/`isolat`, or
`networkProbeEnforced: true` is a `FAIL` (`POLICY_ADMISSION_REFUSAL_CONFINEMENT_CLAIM`
/ `POLICY_ADMISSION_REFUSAL_PROBE_CLAIM`). The class can **never** satisfy a
network-confinement row: `caseSatisfiesNetworkConfinementRow()` returns `false`
for it unconditionally, and the PASS wording says **“admission refusal … NOT
network confinement and NOT isolation”** — it never says “isolated”. A case that
does not declare the class (or declares `connection-denial`) traverses the
**original** connection-denial branch byte-identically, including
`POLICY_NETWORK_PROBE_NOT_ENFORCED`; see the implementation comment at
`tests/world-factory/lib/a5sf-acceptance-preflight.mjs` (“THE FOURTH CASE
CLASS”), and the control in test `F4`.

## 2. The bundle-completeness hole (worse than the class hole)

BL-17's `PASS 16/16` was true of the table it was given: `cases` held 3 cases and
`plannedCases` had been narrowed to the same 3, while the driver's own
`CASES` literal declared **4** and the fourth (`network-deny-refusal`) — the
deny case the boot was spent on — was hand-checked outside the instrument.

`bundle.case-coverage` now reads the **driver's own case manifest**:

* `driver.caseManifest.cases` / `driver.driverCases` when declared;
* otherwise `sources.driver` **when that value is a path** (a top-level
  `const CASES = …` string-literal list in that file, parsed statically — never
  imported or executed). Prose under `sources.driver` (historical evidence
  bundles) is not treated as a path.

A manifest case absent from `bundle.cases` is `BUNDLE_CASE_UNDECLARED` (with
`caseId` and `source`); a duplicated one is `BUNDLE_CASE_DUPLICATED`. The legacy
`plannedCases` list keeps `CASE_PLANNED_MISSING`. If **neither** list is
declared, the check stays `UNKNOWN`, never `PASS`. A source that is declared but
unreadable/unparseable is `BUNDLE_CASE_PLAN_UNREADABLE` (a defect, not silence).

## 3. The caller fact (`driver.caller-surface`)

BL-18 readiness established: for a web face to be *reachable*, the preset must
surface `web_fetch`/`web_search`, and a **strict** Member cannot carry it, so
the caller must be legacy/non-strict. The check encodes each fact; every
finding and the PASS note cite the line:

| fact | line |
| --- | --- |
| the pair is `KNOWN_SENSITIVE_UNMANAGED` | `packages/runtime/operation-permission/permission-coverage.ts:158-159` |
| the classifier that makes it FATAL | `packages/runtime/operation-permission/permission-coverage.ts:294-317` |
| `permissionPolicy = boundTemplate.capabilities?.permissions` (strict iff declared) | `packages/runtime/src/plugin/live/agent-bindings.mjs:2472` |
| the realm mounts only for a Member, never the root session | `packages/runtime/src/plugin/live/agent-bindings.mjs:2598` |
| `builtinToolDeny` is applied only in selective mode | `packages/runtime/src/plugin/live/agent-bindings.mjs:2981` |
| route-C refuses to ADD/REMOVE a model-visible name | `packages/runtime/src/plugin/live/a5sf-realm-row.mjs:1040-1053` |
| the pinned host `standard` preset surfaces the pair via `@deepseek-ai/dsh-tool-web` (`fetch: true`) | `tests/deepseek-harness-test-use/packages/bundle/web-app/presets/standard.patch.yml:137-141` |

Rules: a web/network case with **no caller block** is `UNKNOWN`
(`DRIVER_CALLER_UNDECLARED`); `kind` must be `member`
(`DRIVER_CALLER_NOT_A_MEMBER`); `strict` must be exactly `false` and a
`capabilities.permissions` block is the strict mode
(`DRIVER_CALLER_STRICT_MEMBER`); the preset must name
`@deepseek-ai/dsh-tool-web` and surface **both** names
(`DRIVER_CALLER_PRESET_MISSING`). A bundle with no web/network case is
not-applicable (PASS with a note). A bundle that declares a strict-Member web
caller reds exactly this check.

## 4. Before / after

All payloads are the CLI's one line (`DSH-A5SF-PREFLIGHT {…}`); full files are
next to this README.

| run | before | after |
| --- | --- | --- |
| **BL-18** (truthful plan, `networkProbeEnforced: false`) | `FAIL 16/18 checks blocks=POLICY_NETWORK_PROBE_NOT_ENFORCED unknown=driver.caller-surface` (`bl18-before.payload.txt`) — the only old PASS was the same plan asserting `networkProbeEnforced: true` | **`PASS 18/18 checks`** (`bl18-after.payload.txt`): both deny cases are `admission-refusal`, zero provider entries, `claimsConfinement: false`, and the legacy caller is declared |
| **BL-17** (`a5sf-bl17-live2/preflight-bundle.json`) | `PASS 16/16 checks` (`bl17-before.payload.txt`, the archived historical payload) | **`FAIL 15/18 checks blocks=BUNDLE_CASE_UNDECLARED unknown=driver.leader-surface,driver.log-capture`** (`bl17-after.payload.txt`): `caseId: "network-deny-refusal"`, `source: "dev/agent-workflow/evidence/a5sf-bl17-live2/run-boot.mjs"` |

The BL-18 “after” is a **truthful** PASS: the plan no longer claims an
enforcement the host does not have, it declares the class that the observable
actually satisfies, and the caller declaration is the only composition in which
that face is reachable. It does **not** claim network confinement or isolation;
`disclosures` in the bundle still say no grade / no `V@B` / no product change.

## 5. Existing bundles that now fail

Scanned every `a5sf-zero-boot-preflight/1` bundle in the repo with the same
library (declared existence, repo-relative driver reads):

* `dev/agent-workflow/evidence/a5sf-bl17-live2/preflight-bundle.json` —
  **new FAIL**, `BUNDLE_CASE_UNDECLARED` (`network-deny-refusal`). This is the
  intended outcome.
* `dev/agent-workflow/evidence/a5sf-bl17-live2/archive/pre-boot-preflight-bundle.json`
  — the archived pre-boot copy of the same plan/payload (`PASS 16/16` at the
  time) — **same new FAIL**, same missing case.
* No other existing bundle gains a `BUNDLE_CASE_UNDECLARED`,
  `BUNDLE_CASE_PLAN_UNREADABLE`, `DRIVER_CALLER_*`,
  `POLICY_ADMISSION_REFUSAL_*` or `POLICY_CASE_CLASS_*` finding.
  `a5sf-surface/corrected.bundle.json` and the clean fixture still PASS
  18/18; `a5sf-surface/boot4-repro.bundle.json` still reds only its
  `POLICY_SURFACE_UNMANAGED`; the order/surface negative controls keep their
  single red.

**How many past PASSes were green for the wrong reason?** Two payloads, one
plan: the BL-17 live2 `PASS 16/16` and its archived pre-boot twin. The missing
case they certified nothing about is exactly `network-deny-refusal`. (The older
`a5sf-bl17-live` bundle was `PASS 13/13` under a smaller check set and is
`UNKNOWN` today, not a new FAIL.)

## 6. Negative controls (one red each, committed bundle + payload, re-read by a test)

`make-bundles.mjs` derives each control from `bl18-after.bundle.json`, so the
only difference is the named defect. Test `F2`/`F3`/`F6`/`F7` re-reads both the
bundle and the CLI payload.

| control | exactly one red | code |
| --- | --- | --- |
| `negative-controls/admission-refusal-incomplete.bundle.json` | `policy.paths` | `POLICY_ADMISSION_REFUSAL_INCOMPLETE` (missing `providerEntries`) |
| `negative-controls/admission-refusal-confinement-claim.bundle.json` | `policy.paths` | `POLICY_ADMISSION_REFUSAL_CONFINEMENT_CLAIM` (`claimsConfinement: true`) |
| `negative-controls/bundle-case-undeclared.bundle.json` | `bundle.case-coverage` | `BUNDLE_CASE_UNDECLARED` (`web-transport-deny`) |
| `negative-controls/strict-member-caller.bundle.json` | `driver.caller-surface` | `DRIVER_CALLER_STRICT_MEMBER` |

## 7. Reproduction (zero boots, no port, no DSH_HOME)

```bash
HOST=$(git rev-parse --show-toplevel)/tests/deepseek-harness-test-use
node scripts/a5sf-preflight.mjs --bundle dev/agent-workflow/evidence/a5sf-refusal/bl18-after.bundle.json --repo . --host-root "$HOST"
# -> DSH-A5SF-PREFLIGHT {"verdict":"PASS","summary":"PASS 18/18 checks",…}
node scripts/a5sf-preflight.mjs --bundle dev/agent-workflow/evidence/a5sf-bl17-live2/preflight-bundle.json --repo . --host-root "$HOST"
# -> FAIL … blocks=BUNDLE_CASE_UNDECLARED
node dev/agent-workflow/evidence/a5sf-refusal/make-bundles.mjs
```

No `.github/**`, no `packages/**`, no existing evidence file was modified; no
`harness.boot(`, no port, no `DSH_HOME`, no pristine-checkout write.
