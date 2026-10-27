# PR #403 Security Review (head `4668db336`)

## Verdict

**PASS-WITH-FINDINGS** (do not merge as-is). Hosted checks are green, but the network family has two security-critical destination-control gaps that the current C1/C2 evidence does not exercise: HTTPS private-address SSRF and an unpinned provider search port. A DNS-resolution TOCTOU is also not proven closed.

## Hosted state

Command: `gh pr view 403 --json headRefOid,statusCheckRollup`

Verbatim tail: `"headRefOid":"4668db336110963d3a41d4b6d3614eb6f01e64dc","statusCheckRollup":[... candidate-protection SUCCESS ... census-runtime SUCCESS ... ci-required SUCCESS ...]`.

## Attacks driven / answers

| Attack | Answer |
|---|---|
| Family disabled by absent/false `webEnabled` | **PASS**. `packages/tools/families/web.mjs` declares a closed boolean and `enabled: ... === true`; evidence W-2/W-3 reports byte-identical no-web plane. |
| HTTPS `127.0.0.1`, `localhost`, `[::1]`, `0.0.0.0`, `169.254.169.254` with loopback opt-out | **FAIL (finding F-403-1)**. `gateWebUrl` only restricts loopback for `http`; an `https:` URL to any of these hosts passes to PA and then the transport. `isLoopbackHost` is not used for HTTPS/private destinations. The requested law is refusal before connect when loopback is not enabled. |
| Decimal/octal/hex and mapped IPv6 loopback spellings | **PARTIAL / NOT PROVEN**. The simple regex rejects common decimal/octal/hex spellings, but the code has no numeric-IP canonicalization or DNS/address validation, so this is not a complete destination law. |
| Userinfo, mixed-case scheme, trailing-dot host, IDN/punycode | **PASS for userinfo/scheme parsing; NOT PROVEN for host identity**. `URL` normalizes scheme and userinfo is rejected. There is no host allow/deny or canonical DNS/IP policy for trailing-dot/IDN confusables. |
| Redirect allowed origin → disallowed host/port/scheme | **PASS for a single hop in the tested shape**. Redirect is evaluated before the next transport call and W-11 says victim count stayed zero. This does not repair initial private-address acceptance. |
| DNS rebinding between gate and connect | **COULD-NOT-VERIFY / finding F-403-3**. `gateWebUrl` computes only `parsed.origin`; `https.request(target)` resolves again later. No resolver injection, pinned address, or connect-time identity check exists. A hostname can therefore resolve to a public address during admission and a private address during connect (TOCTOU analogue of #404). |
| Response bytes cap | **PASS in implementation shape**. `web-transport.mjs` counts chunks as received and destroys the response on overrun; no partial body is returned. |
| Deadline and redirect-hop bounds | **PASS in implementation shape / C1 evidence**. Deadline is passed to transport and redirects are capped at `MAX_REDIRECT_HOPS`. |
| Authorization/Cookie/Set-Cookie leakage | **PASS for explicit headers/results**. Transport sends only `accept` (or JSON content headers), exposes only status/location/body, and sanitizes errors. No credential jar is present. |
| `web_search` without provider | **PASS**. `search-executor.mjs` returns `WEB_SEARCH_NO_PROVIDER` before effects/PA/transport. |
| Search provider destination declaration vs actual requested wire destinations | **FAIL (finding F-403-2)**. `validateWebSearchProvider` records declared origins, but `createWebTransportSearchPort`/`boundedPost` accepts any HTTPS URL and does not compare the URL to the mounted destination set. A provider function can call `port.postJson({url: 'https://169.254.169.254/...', ...})` after approval; the PA fingerprint names only declared origins. This is a declared-vs-requested effect mismatch and SSRF path. |
| Native/Gate-0b bypass when enabled/disabled | **PARTIAL / DISCLOSED**. The PR explicitly pins fixed-native names via manifest/census rather than Gate 0b; disabled mounts do not enable the family. I did not find a path in the reviewed descriptor that mounts it when `webEnabled !== true`, but the fixed-native bypass is a residual trust assumption requiring manifest/census integrity. |
| Mutation: remove one requested arm | **PASS (claimed and evidence present)**. `mutation-control-RED.log` reports the off-destination redirect mutation made W-11 RED; no independent rerun was possible without booting a Host. |

## Per-check results

| Check | Result | Command / verbatim tail |
|---|---|---|
| Zero diff protected center files | VERIFIED from PR changed-file list | `git diff --name-only origin/master...4668db336` — evidence README states zero lines in `team-tool-plane.mjs`, `family-assembly.mjs`, binder, ARC-A protected set. |
| Default opt-in | VERIFIED | `git show 4668db336:packages/tools/families/web.mjs | grep -n -E 'webEnabled|default|enabled'` → `config: Object.freeze({ webEnabled: 'boolean' })`; `enabled: (cap) => cap.planeConfig.webEnabled === true`. |
| Raw census scratch untracked | VERIFIED by PR claim; command not rerun on frozen head | PR README: “Raw capture JSONs are kept ON DISK only, untracked”. |
| C2 record schema (`overall`, `finishedAt`, `bindings.authority`) | COULD-NOT-VERIFY completely | Evidence README names `overall=PASS 7/7`; full record inspection was not completed in this review. |
| Hosted current head | VERIFIED | `gh pr view 403 ...` → head `4668db336...`; all listed checks SUCCESS. |
| Network confinement is not sandbox-claimable | VERIFIED / correctly disclosed | PR body states bwrap lacks `--unshare-net` and Landlock is partial; no sandbox claim is made. |

## Findings

### F-403-1 — HIGH: HTTPS private/link-local destinations are admitted (SSRF)

**Location:** `packages/tools/web-family/src/web-mechanics.mjs:151-176` (`gateWebUrl`), transport construction around `web-transport.mjs:95-115`.

`gateWebUrl` applies `isLoopbackHost` only in the `scheme === 'http'` branch. With default `https`, `https://127.0.0.1/`, `https://localhost/`, `https://[::1]/`, `https://0.0.0.0/`, and `https://169.254.169.254/` are admitted. The transport then connects to the URL host. This directly violates the requested “refuse before connect when loopback is not enabled” law and is not covered by the current tests, which exercise non-HTTPS scheme rejection rather than HTTPS private-address rejection.

**Required fix/evidence:** canonicalize and reject loopback, unspecified, private, link-local, mapped, and reserved numeric addresses (and DNS answers resolving to them) before connect unless an explicit trusted mount opt-in exists; add request-counter tests for every spelling and a DNS-rebinding test.

### F-403-2 — HIGH: Search provider can use the bounded port for undeclared destinations

**Location:** `packages/tools/web-family/src/web-search-provider.mjs:72-115`, `packages/tools/web-family/src/web-transport.mjs:216-285`, `packages/tools/web-transport.mjs:288-305`.

Mount validation freezes `destinations`, and `search-executor.mjs` fingerprints those destinations. But the search port's `postJson` only checks that the URL is HTTPS; `boundedPost` does not enforce membership in the mounted destination set. A provider can therefore request an arbitrary HTTPS URL after the approval for a different origin. The declared effect set and actual requested/wire set differ, exactly the class this PR says is structurally prevented.

**Required fix/evidence:** construct the search port with an immutable allowed-origin set and reject any URL not in it before `httpsRequest`; test provider attempts to call a victim/private origin and assert zero victim hits and no grant/fingerprint mismatch.

### F-403-3 — MEDIUM/HIGH: DNS rebinding TOCTOU is not closed

**Location:** `packages/tools/web-family/src/web-mechanics.mjs:151-176` and `packages/tools/web-family/src/web-transport.mjs:111-170`.

Admission canonicalizes a hostname but does not resolve/pin an address. Node's request path resolves independently after admission. A rebinding hostname can pass the admission observation and connect to a different address. The PR's “origin” identity is not equivalent to a safe network destination without resolver pinning/connect-time verification.

**Required fix/evidence:** perform a trusted resolution once, reject unsafe answers, and connect using the pinned address while preserving Host/SNI; or implement equivalent connect-time address verification. Add a deterministic resolver/rebinding test.

## COULD-NOT-VERIFY

- I did not boot a Host or touch `:3080` (per review rules), so C2 claims were read rather than independently reproduced.
- I did not independently rerun all 19 C1 tests or the raw census commands.
- The provider's arbitrary-URL attack and DNS rebinding require a dedicated test seam not present in the PR evidence.
