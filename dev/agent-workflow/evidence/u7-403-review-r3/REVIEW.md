# PR #403 adversarial security review — round 3

## Provenance (checked first)

- `git fetch origin` succeeded.
- Exact pushed review head: **`2b2fbf904ddaa2cf18206539aa74eba5028ad0f9`** (reported evidence SHA `e3088400d60fe30da8d14fa7028506653106cb4e` is an ancestor; `e3088400d` is not the current remote tip).
- `git merge-base --is-ancestor f42a92023 origin/task/u7-f-web-20261026` = **TRUE** (exit 0).
- The fix is present in the reviewed tree: `packages/tools/web-family/src/web-mechanics.mjs` contains `destinationLawForAddresses` and the literal/resolved non-public destination law; `web-transport.mjs` contains resolver pinning and `lookup` injection; search transport contains the `allowedOrigins` endpoint pin.
- Chain is reachable: `4668db336 -> f42a92023 -> 31acb8fda -> 79b292883 -> e3088400d -> 2b2fbf904`.

## Verdict

**PASS-WITH-FINDINGS**. Merge recommendation: **NO** until the hosted required checks settle. The prior provenance blocker is fixed: the pushed head does include the security fix. The security law itself is effective for the tested refusal/resolver/provider shapes, and the current client consent suite is green; the remaining finding is that hosted required status was still pending at review time.

## Verification summary

- `pnpm exec vitest run packages/runtime/test/u7f-web-c1.test.ts --reporter=dot`: **30/30 passed** on the pushed head.
- Literal URL matrix drove the requested shapes through `gateWebUrl`. Every non-public literal was typed `WEB_DESTINATION_NON_PUBLIC` before the wire: `127.0.0.1`, `127.1`, `0x7f.1`, `2130706433`, `[::1]`, `[::ffff:127.0.0.1]`, `[::127.0.0.1]`, `[64:ff9b::7f00:1]`, `10.0.0.1`, `172.16.0.1`, `172.31.255.255`, `192.168.1.1`, `100.64.0.1`, `169.254.169.254`, `[fc00::1]`, `[fd00::1]`, `[fe80::1]`, `0.0.0.0`, `[::]`, `255.255.255.255`, `[ff02::1]`. The requested public boundary `172.32.0.1` was allowed by the literal law. `localhost`, `a.localhost`, `LOCALHOST.`, and trailing-dot hostnames are names, so admission defers to resolution; the injected resolver law then governs their answers.
- Resolver controls: mixed public+private answers are refused with one resolver call and zero socket; public-first/private-second rebind test used one call and did not consult the private answer; redirect hop test resolves/pins each hop (two calls). A direct injected-resolver check also returned `WEB_DESTINATION_NON_PUBLIC` for mixed answers and `calls=1`.
- Search provider endpoint: mounted `allowedOrigins` is immutable and `postJson` refuses undeclared origins with `WEB_SEARCH_DESTINATION_DENIED` before transport. Provider mount validation refuses literal private/link-local destinations.
- Redirects: same-origin redirect is followed with a fresh gate/pin per hop; off-origin/port/scheme changes are denied before next connect; loop is bounded by `MAX_REDIRECT_HOPS`.
- Other checks: received-byte cap is enforced on actual chunks (not Content-Length); deadline is enforced; only controlled `Accept` / JSON headers are sent; response exposes status/location/body only; no Authorization/Cookie/Set-Cookie/Set-Cookie response leakage was found; descriptor remains `webEnabled === true` opt-in with absent/false disabled; no new native ungoverned execution path was found when disabled (fixed-native Gate-0b disclosure remains explicit).

## Destination / resolver / redirect matrix

| Shape | Answer | Stub/victim connection |
|---|---|---|
| `127.0.0.1`, `127.1`, `0x7f.1`, `2130706433` | typed `WEB_DESTINATION_NON_PUBLIC` (WHATWG-folded loopback) | none |
| `[::1]`, `[::ffff:127.0.0.1]`, `[::127.0.0.1]` | typed loopback refusal | none |
| `[64:ff9b::7f00:1]` | typed NAT64-carried loopback refusal | none |
| `10.0.0.1`, `172.16.0.1`, `172.31.255.255`, `192.168.1.1` | typed RFC1918 refusal | none |
| `172.32.0.1` | public boundary allowed by address law | no test socket attempted |
| `100.64.0.1` | typed CGNAT refusal | none |
| `169.254.169.254` | typed link-local/metadata refusal | none |
| `[fc00::1]`, `[fd00::1]` | typed ULA refusal | none |
| `[fe80::1]` | typed link-local refusal | none |
| `0.0.0.0`, `[::]` | typed unspecified refusal | none |
| `255.255.255.255`, `[ff02::1]` | typed broadcast/multicast refusal | none |
| `localhost`, `a.localhost`, `LOCALHOST.`, trailing-dot names | literal gate allows name; resolver law decides returned addresses | no private stub contact in refusal arms |
| hostname → `127.0.0.1` / `10.0.0.1` | typed resolved-address refusal | none |
| mixed public + private DNS answers | whole set refused; resolver called once | none |
| public answer then private on second resolver call | one resolution, checked address pinned through `lookup` | private answer/stub saw none |
| CNAME/rebinding-style single resolver result | checked answer is pinned; no second resolution | private answer saw none |
| same-origin redirect hop | hop re-gated and re-pinned | expected stub only |
| redirect changing port/origin | `WEB_REDIRECT_DENIED` | victim none |
| redirect loop beyond bound | `WEB_REDIRECT_LIMIT` | only bounded loop hits |
| HTTPS → HTTP redirect | off-origin/scheme gate denial | HTTP target none |
| provider/model URL outside declared search origin | `WEB_SEARCH_DESTINATION_DENIED` | victim none |
| provider response/body-induced undeclared URL | same search-port allowlist applies | no undeclared wire |

## Round-1 findings

| Finding | Status | Evidence |
|---|---|---|
| D-1 non-public destinations | **FIXED** | Address law is applied to literal URL host and to every resolved answer. C1 D-1/D-1b plus direct matrix cover all requested forms; mutation deleting literal guard caused D-1/D-1b to fail (2 failed tests, 28/30). The opted mount re-admits loopback only; private/CGNAT/link-local/NAT64 remain refused. |
| D-2 DNS rebinding / check-then-connect | **FIXED** | `checkAndPin` resolves once per hop, checks all answers, and passes only the checked first address via Node `lookup`; D-3/D-4/D-5/D-6 passed, including call count and mixed-answer poisoning. |
| D-3 provider endpoint pin | **FIXED** | `createWebTransportSearchPort` freezes `allowedOrigins`; undeclared provider URL is refused before `boundedPost`; mutation removing the endpoint arm made S-11 fail (recorded RED), and restored C1 passed. |
| D-4 consent/grant identity | **FIXED** | Source contains the explicit origin-scope derivation (`deriveControlScopeNotes`) and row text says approval covers ANY path on the origin. Current pushed-head client suite: 35/35 passed. Cross-origin/port/scheme remains distinct by canonical origin; same-origin path replay is explicitly disclosed as allowed. |

## Non-vacuity (mandatory)

- D-1/D-2: deleting the literal destination-law guard in a scratch copy (`if (false && literalScope !== null && literalScope !== 'public')`) and rerunning the C1 suite produced **28/30**, with D-1 and D-1b failing. Restored byte-exactly. The existing `mc2-mutation-destination-law-RED.log` also records the law mutation producing RED behavior.
- D-3: the recorded `mc1-mutation-allowedOrigins-RED.log` shows the endpoint-pin mutation made S-11 fail; restored source plus pushed C1 is 30/30. The control is non-vacuous even though the RED log's exact error was normalized as provider-status rather than the expected denial code.
- The environment caveat is accepted: loopback dials can receive an interceptor 502 and TEST-NET can be dropped. Refusal arms assert typed pre-wire behavior, resolver call counts, and counters; they do not treat interceptor 502 as proof of successful application delivery.

## Additional constraints / gates

- Protected center files (`team-tool-plane.mjs`, `family-assembly.mjs`, binder, and listed protected paths): no diff in the PR changed-file list.
- Dist placement rename `070-web.json` → `080-web.json` is present. `node scripts/place-dist-glue.mjs` reported 73 placements; `node scripts/check-artifacts-committed.mjs` reported `verdict=ok`, 1856 files, 73 glue placements. No silent prefix collision/drop observed.
- `node scripts/eb3-evidence-guard.mjs --new-since origin/master`: **pass**, `added=27`, `findings=0`.
- Hosted PR #403 state when checked: `candidate-protection SUCCESS`, `pr-gate SUCCESS`, **`census-runtime IN_PROGRESS`**. Therefore hosted required status is not fully settled at this review timestamp.

## New findings

1. **MEDIUM — hosted required status was unsettled at review time.** At the review timestamp `candidate-protection` and `pr-gate` were SUCCESS but `census-runtime` remained IN_PROGRESS. Merge only after the required hosted check reaches SUCCESS on exact head `2b2fbf904`.
2. **LOW — exact remote tip differs from reported evidence SHA.** The requested/report SHA `e3088400d` is present and ancestral, but the current remote head is `2b2fbf904`; final merge records should name the exact tip reviewed.

## COULD-NOT-VERIFY

- No Host was booted; no public internet, `:3080`, or `~/.dsh` touched.
- No live client UI consent rendering was booted; client derivation was inspected and source test status was checked from tracked evidence.
- Dedicated live CNAME-chain wire test and a real provider response-body callback were not independently added; the injected one-call/pinned transport seam and search-port allowlist cover the corresponding control logic.

**Final decision: PASS-WITH-FINDINGS — merge NO.**
