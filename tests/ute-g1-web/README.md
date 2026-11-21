# `tests/ute-g1-web` — UTE G1 WEB family, old-path baseline (stage B1)

The reproducible, observed **old-path baseline** for the two model-visible
members of the `dsh.web-family` retirement unit — `web_fetch` and `web_search` —
plus a family-level and a **real per-member negative control**.

This lane claims exactly three things:

1. the CURRENT product composition (pinned host `0.2.0-rc.2` + the confined
   `web` face BL-18/PD-30 + the PD-27 confined web shadow) behaves as the
   reviewed fixture says it does against a REAL loopback fixture;
2. every refusal in that fixture is a decision of the declared admission, the
   pinned transport's own policy, or the caller's cancellation — proven by a
   mutation that turns it RED;
3. no admitted call touched a non-loopback socket, and that zero is produced by
   a shim proven load-bearing in both directions.

It claims **no** new path, **no** retirement, **no** network-confinement proof
and **no** approval of any semantic difference. See §7 for the UNKNOWN list.

## 0. Composition — measured first, not assumed

`probe-composition.mjs` is STEP 0. Its transcript
(`dev/agent-workflow/evidence/ute3-web-b1-20261120/composition-probe.txt`)
contains:

* `PROBE-REGISTRY web_fetch=registered web_search=registered`
* `PROBE-MEMBER <m> reachable=yes providerCalls=1 inheritedServiceCalls=0` and
  `confined=yes facts=1 factMethods=web:<m>:allow` for both members
* `PROBE-MEMBER web_fetch out-of-lane outcome=deny … decidedBy=WEB_DESTINATION_FORBIDDEN`
  with `servedRequests=-` (nothing reached the wire)
* `PROBE-PLANE claims=web_fetch,web_search native-claim=DIRECT (no alias)`,
  `enabled(absent)=false enabled(webEnabled=true)=true`
* `PROBE-PLANE verifyPlaneNames(web keys) gate=PLANE_NAMES_INVALID` and
  `verifyPlaneNames(search/bash control) gate=accepted`
* `PROBE-NET admitted-call sockets=1 loopback=1 external=0 forwarded=1 destinations=127.0.0.1:3182`
* `PROBE-VERDICT web-members-reachable=2/2 external-sockets=0 witness=load-bearing baseline=PROCEED`

So: **both members are reachable on the product route and both reach the
confined face.** There is no mounting gap in this family, and this fixture
therefore records the PRODUCT route for both members. No test-only composition
is used anywhere.

**The legacy governed plane is DIFFERENT from Search's, and that difference is
recorded rather than inherited.** `packages/tools/families/web.mjs` claims the
fixed native spellings `web_fetch`/`web_search` directly (opt-in `webEnabled`,
ABSENT = FALSE, `disabledOwned` empty, module sha256 pinned in
`packages/tools/families/manifest.json`). `verifyPlaneNames` is a DIFFERENT gate
closed to `grep`/`glob`/`bash`, and it refuses a web key as `PLANE_NAMES_INVALID`.
Search's `PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED` conclusion was **not**
transferred. A governed-plane `webEnabled:true` MOUNT is not run here (it needs
the whole governed kernel/PA lane); that is an UNKNOWN in §7, and
`lib/semantic-differences.mjs` measures the governed DESCRIPTOR and the legacy
TRANSPORT instead of pretending to dispatch through it.

## 1. Layout

| file | role |
|---|---|
| `lib/world.mjs` | the host-free C1 world: real Cordis `Context`, real `ToolRuntime`, a real loopback fixture behind a composition provider, and the product route-C seam `mountMemberA5sfRealm` + `attachA5sfNativeToolModules` |
| `lib/fixture-server.mjs` | the real `node:http` fixture (sanctioned port 3182) and its arrival log |
| `lib/fixture-provider.mjs` | the composition's provider: the PINNED `HttpFetchProvider` (injected resolver) + a bounded JSON search POST |
| `lib/net-witness.mjs` | the process-wide socket witness (refcounted; refuses non-loopback before `original.connect`) |
| `lib/corpus.mjs` | the fifteen declared vectors, each with its OWN transport bounds and a design claim |
| `lib/scenario.mjs` | one execution of one vector; serializes the witnesses; TSV cells |
| `lib/effect-oracle.mjs` | the witnesses and the TOTAL web→category refusal mapping (imports the FS vocabulary) |
| `lib/compare.mjs` | field-by-field grading of a capture, and the corpus design-claim check |
| `lib/semantic-differences.mjs` | the three measured, retirement-blocking differences between the governed family and the product face |
| `lib/old-path.mjs` | the capture loop (one world per vector) |
| `capture-old-path.mjs` | CLI: `--write` re-derives the fixture; bare run verifies it |
| `probe-composition.mjs` | STEP 0 composition measurement |
| `probe-semantic-differences.mjs` | measures the three differences |
| `negative-controls.mjs` | 11 controls (2 per-member + 2 positive arms + 6 family/seam + 1 claim check) |
| `lane-suite.test.mjs` | the lane's own gates (8 tests) |
| `golden/old-path.tsv` | the reviewed fixture (15 rows) |
| `golden/old-path.meta.txt` | identity, record shape, normalization, retained semantics, non-coverage |
| `golden/COVERAGE.md` | member → vectors → control table (gate-checkable) |

Run:

```bash
node tests/ute-g1-web/probe-composition.mjs
node tests/ute-g1-web/capture-old-path.mjs --write   # then bare to verify
node tests/ute-g1-web/negative-controls.mjs
node --test tests/ute-g1-web/lane-suite.test.mjs
node scripts/ute-retirement-gate.mjs --family web
```

## 2. Why the transport is the composition's (and why that is not a patch)

The confined `web` face **ships no transport by design**:
`packages/runtime/team-services/src/web.ts` takes a provider
(`{fetch, search?, searchAvailable?, …}`) and confines the DECISION around it.
The product therefore always supplies a transport, and this lane supplies the
pinned one:

* `web_fetch` runs the REAL `@deepseek-ai/dsh-web-fetch-http` `HttpFetchProvider`
  from the pinned tree — redirects, byte caps, char caps, content-type refusal
  and deadlines are all PINNED-HOST code, not fixture code;
* the pinned provider's default resolver refuses non-public addresses, so the
  loopback fixture is reached through the provider's OWN documented constructor
  argument (`resolveAddresses`). That is the public seam the provider documents;
  nothing upstream was patched (**CORE PATCH BUDGET = 0**);
* `web_search` is composition fixture code: a bounded JSON POST to the declared
  origin set, because the pin ships no search HTTP client. Its refusal paths
  (`WEB_PROVIDER_UNAVAILABLE`) are the face's, not the fixture's.

A network-effect baseline needs a responder. The alternative — recording only
refusals — would have claimed coverage while never executing the effect.

## 3. The fifteen vectors

| id | member | what it pins |
|---|---|---|
| `WB-F1-inline-text` | `web_fetch` | successful fetch, deterministic body, `(HTTP 200)` header line |
| `WB-F2-inline-html` | `web_fetch` | pinned HTML→Markdown conversion (heading, strong, GFM table) |
| `WB-F3-redirect-chain` | `web_fetch` | two same-origin hops, final URL/status, THREE arrivals for ONE call |
| `WB-F4-redirect-cap` | `web_fetch` | the redirect budget refusing the third hop (`maxRedirects=2`) |
| `WB-F5-status-404` | `web_fetch` | an HTTP error status is DATA: 404 + body, admitted |
| `WB-F6-content-type-refused` | `web_fetch` | `application/octet-stream` refused after 10 bytes were written |
| `WB-F7-body-byte-cap` | `web_fetch` | `maxResponseBytes=2048` refuses a 4096-byte body |
| `WB-F8-body-char-cap` | `web_fetch` | `maxBodyChars=120` TRUNCATES and admits, with the footer |
| `WB-F9-timeout` | `web_fetch` | `timeoutMs=250` against a 1500 ms route: one arrival, 0 bytes |
| `WB-F10-abort-before-dispatch` | `web_fetch` | a pre-aborted signal: no request, no fetch, no fact |
| `WB-F11-destination-forbidden` | `web_fetch` | the PD-30 SSRF leg refusing a local name before the provider |
| `WB-F12-url-malformed` | `web_fetch` | a non-http scheme refused as a malformed request |
| `WB-S1-search-single` | `web_search` | one query → five sources, `Sources:` list |
| `WB-S2-search-multi` | `web_search` | two queries merged into `### <query>` sections, deduped |
| `WB-S3-search-unavailable` | `web_search` | an unavailable provider refused as `route-unresolved` |

Each vector DECLARES its own `maxResponseBytes`/`maxBodyChars`/`timeoutMs`/
`maxRedirects`. A cap vector that inherited whatever default was in force would
be measuring the default, not the bound.

## 4. Record shape

Header: `id entry network outcome refusal codes effects facts text net`. The
authoritative description is
[`golden/old-path.meta.txt`](./golden/old-path.meta.txt); the short version:

* `effects` carries the FIXTURE SERVER's own arrival log (count, digest, ordered
  list), the bytes it wrote, and the admitted value's status/kind/truncation —
  the corroborating side effect that makes a text answer evidence;
* `facts` carries `fetches/searches/allow/deny/hostweb` — the confined face was
  reached and the inherited host service was NOT;
* `net` carries `loopback/external` from the socket witness — an admitted row
  must show a real wire event and every row must show zero external attempts.

## 5. Negative controls

`node tests/ute-g1-web/negative-controls.mjs` → `NC-VERDICT GREEN controls=11 failed=0`.
The transcript is committed at
`dev/agent-workflow/evidence/ute3-web-b1-20261120/negative-controls.txt` and the
table of what each control turns RED is in
[`golden/COVERAGE.md`](./golden/COVERAGE.md). The two per-member controls widen
only what the composition DECLARES (a destination, a search capability) and
show the refusal disappear; their `-POSITIVE` arms show the unmodified vectors
still reproduce. A control that cannot go RED is not a control.

## 6. Semantic differences — three, all blocking, none approved

`node tests/ute-g1-web/probe-semantic-differences.mjs` measures, on ONE fixture:

| id | what moves |
|---|---|
| `SD-WEB-1-native-name-claim-collision` | the legacy family claims the same two native names the route-C face serves; the seam names no winner |
| `SD-WEB-2-redirect-ownership` | the legacy transport answers ONE hop and the row drives the chain; the route-C provider follows itself → 3 arrivals per call, disclosed as `WEB_REDIRECT_UNMEDIATE_ON_ALLOW` |
| `SD-WEB-3-refusal-surface` | the governed row raises TYPED refusals; the route-C body/format/deadline refusals are PROSE over an ALLOW fact |

`approval` is `null` on all three, and the retirement ledger says so explicitly.
The lane suite re-measures them and REDs if any is claimed resolved.

## 7. What this lane does NOT claim (UNKNOWN list)

1. **No new path.** `newPathVerified` is false: no enumerator, no next-host
   provider, zero `NEW-PATH-VECTOR` `PASS` lines.
2. **Network confinement is not proven.** The host sandbox claims FILE effects
   only. `net.external=0` is measured per run by a shim proven load-bearing; the
   pinned provider still follows same-origin redirects (`WEB_REDIRECT_UNMEDIATE_ON_ALLOW`)
   and still honours a proxy for public names (`WEB_PROXY_ENV_UNMEDIATE_ON_ALLOW`).
3. **The governed `webEnabled:true` mount/dispatch** is not run — needs the
   governed kernel/PA lane.
4. **`capSearchSources` is not exercised**: the shadow mounts the host default
   `searchMaxResults=50` and the composition exposes no key to lower it; the
   fixture's 5 sources stay under the cap. An explicit gap, not a dropped vector.
5. **Un-exercised mapped codes**: `WEB_BLOCKED_URL` (declared unmapped on
   purpose), `WEB_INVALID_URL`, `WEB_PROVIDER_ERROR`,
   `WEB_SEARCH_DESTINATION_DENIED`.
6. **Cross-origin redirect refusal** is mapped but not measured (the fixture
   chain is same-origin).
7. **Mid-flight cancellation** is not expressible; only a pre-dispatch abort.
8. **A live boot** is out of scope: this is a C1 host-free capture. A vector is
   an EFFECT record, so a boot would add transport, not evidence.
9. **`retirement` stays FORBIDDEN.** This stage establishes two of the four
   terms (`oldBaseline`, `negativeControlsPass`) and deliberately leaves
   `newPathVerified` and `semanticDifferencesResolved` false.
