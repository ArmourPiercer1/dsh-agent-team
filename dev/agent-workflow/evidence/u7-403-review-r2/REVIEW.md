# PR #403 adversarial security review — round 2

**Verdict: BLOCKED**  
**Merge recommendation: NO**

## Reviewed head and scope

The exact remote PR head reviewed is **`4668db336110963d3a41d4b6d3614eb6f01e64dc`** (`chore(evidence): untrack raw census captures (scratch policy), 2026-10-27 07:23:41Z), from `origin/task/u7-f-web-20261026`.

The round-1 fix commit named by the author, `f42a92023c99225751f06e95fac008705c82e02b`, is **not an ancestor of this PR head**. Its parent is `4668db336`; therefore the fix commit is a sibling/descendant on the local task branch, not included in the remote PR ref. The PR head's source still has the round-1 vulnerable implementation and does not contain the 11 new adversarial arms or the client consent derivation. This is a release-blocking provenance failure independent of whether the unmerged fix commit itself is adequate.

For completeness, I also checked out `f42a92023` in the review PR worktree and ran its new C1 suite: 30/30 passed. That result is **not evidence for the reviewed PR head**, because `f42a92023` is absent from `4668db336`.

## Commands and checks

- `git fetch origin`: succeeded.
- `gh pr view 403 --json headRefOid,statusCheckRollup`: head `4668db336`; all listed hosted checks SUCCESS.
- `pnpm exec vitest run packages/runtime/test/u7f-web-c1.test.ts --reporter=dot` at reviewed head: **19/19 passed** (the original suite only; no fix-round tests are present).
- The same command at unmerged fix commit `f42a92023`: **30/30 passed**.
- `node scripts/eb3-evidence-guard.mjs --new-since origin/master` using the script copied from `origin/master`: **pass**, `added=20`, `findings=0`.
- No Host was booted; `:3080` and `~/.dsh` were not touched; no public internet was reached.

## Destination / rebinding / redirect drives

The table records the exact shapes exercised in the unmerged fix commit where the new arms exist, and whether they are present in the reviewed PR head. The reviewed head has no corresponding arm and remains vulnerable as described below.

| Shape | Expected law | Result on `f42a92023` fix worktree | Stub/victim connection | Present at reviewed `4668db336`? |
|---|---|---|---|---|
| `127.0.0.1`, `127.0.0.2`, `127.1` loopback literals | typed non-public refusal unless trusted loopback opt | `WEB_DESTINATION_NON_PUBLIC` (opt path admits loopback) | no connection on refusal; opted HTTP arm attempted wire and got sandbox 502 | **No new arm** |
| `0x7f000001`, `2130706433`, `0177.0.0.1` | canonicalized loopback refusal | `WEB_DESTINATION_NON_PUBLIC` | zero stub/victim hits | **No** |
| `[::1]`, `[::ffff:127.0.0.1]`, `[::127.0.0.1]` | IPv6/mapped/compatible loopback refusal | `WEB_DESTINATION_NON_PUBLIC` | zero | **No** |
| `10.0.0.1`, `172.16.5.9`, `172.31.255.255`, `192.168.0.5` | RFC1918 refusal | `WEB_DESTINATION_NON_PUBLIC` | zero | **No** |
| `100.64.0.1`, `100.127.255.255` | CGNAT refusal | `WEB_DESTINATION_NON_PUBLIC` | zero | **No** |
| `169.254.169.254` | link-local/metadata refusal | `WEB_DESTINATION_NON_PUBLIC` | zero | **No** |
| `[fc00::1]`, `[fd00::1]` | ULA refusal | `WEB_DESTINATION_NON_PUBLIC` | zero | **No** |
| `[fe80::1]`, zone literal `[fe80::1%25eth0]` | link-local refusal / typed URL refusal | `WEB_DESTINATION_NON_PUBLIC`; zone `WEB_URL_INVALID` | zero | **No** |
| `0.0.0.0`, `[::]` | unspecified refusal | `WEB_DESTINATION_NON_PUBLIC` | zero | **No** |
| `255.255.255.255`, `[ff02::1]` | broadcast/multicast refusal | `WEB_DESTINATION_NON_PUBLIC` | zero | **No** |
| hostname resolving to `127.0.0.1` | resolved-address law | fix arm uses injected resolver and refuses/controls by opt | zero on refusal | **No** |
| mixed public + private resolver answers | any private answer poisons set | `WEB_DESTINATION_NON_PUBLIC`; resolver called once | zero | **No** |
| public first, private/loopback second answer | connect pinned to checked first answer; no second resolve | resolver call count 1; first checked address only | private victim zero | **No** |
| CNAME/rebinding-style hostname | one resolution and pinned lookup | fix suite's injected resolver demonstrates one-call pin; no native CNAME traversal proof | no second-answer victim wire | **No** |
| same-origin redirect hop | resolve/check/pin each hop | 2 resolver calls for 2 hops; stub saw expected page/redirect | stub connected only to checked loopback opt | **No** |
| redirect changing port/origin | off-origin denied before next connect | original suite W-11 covers off-origin victim zero; fix does not add a separate changed-port row | victim zero | **Original W-11 only** |
| redirect loop beyond hop bound | `WEB_REDIRECT_LIMIT` | original W-10 passes; 6 stub hits, no final page | stub sees bounded same-origin loop only | **Original W-10 only** |
| provider URL outside trusted declared destination | typed `WEB_SEARCH_DESTINATION_DENIED` | fix S-11 passes; victim zero | victim/stub zero | **No** |
| provider response/body-induced URL | endpoint must remain mount-pinned | no dedicated body-following arm; provider port URL check is present only in unmerged fix | no wire in S-11 | **No** |

### Environment caveat and non-vacuity

The fix-round loopback positive arm is explicitly honest about this host's proxy behavior: opted HTTP to a non-80 loopback port reached the transport and returned a sandbox-generated 502. That arm is not used as proof of successful application delivery; it proves admission + PA walk + attempted socket path. The refusal arms assert typed pre-PA refusal, resolver-call count where applicable, and unchanged stub counters.

A mutation/non-vacuity control exists in the unmerged fix evidence (`MC-1/MC-2` claims and `u7fweb-review1-c1-RED.log`), but it is not part of the reviewed PR head. At the reviewed head, removing the destination law cannot be shown RED because that law is absent; the original 19-arm suite still passes without exercising the missing security property. This is itself proof that the reviewed head's old evidence is vacuous for the new requirements: the full suite remains green while HTTPS private destinations and resolver TOCTOU remain untested and admitted.

## Round-1 findings

| Finding | Status on exact PR head `4668db336` | Own reproduction / evidence |
|---|---|---|
| D-1 / F-403-1: HTTPS private/non-public destinations admitted | **NOT FIXED** | At the reviewed head `web-mechanics.mjs` has no `destinationLawForAddresses`, no literal host scope, and `gateWebUrl` only gates `http` loopback. The old suite is 19/19 green while no HTTPS private matrix exists. `https://127.0.0.1/`, `https://10.0.0.1/`, `https://169.254.169.254/`, `[::1]`, mapped IPv6 and numeric spellings are not refused by the URL gate before PA/transport. |
| D-2 / F-403-3: DNS rebinding/check-then-connect TOCTOU | **NOT FIXED** | Reviewed head imports no DNS resolver and passes URL directly to `https.request`; no checked-address lookup pin exists. A resolver can answer public at admission and private at connect. No resolver-call-count or pinned lookup arm exists at the PR head. |
| D-3 / F-403-2: provider search endpoint not mount-pinned | **NOT FIXED** | Reviewed head's `createWebTransportSearchPort`/`boundedPost` accepts provider URL after only scheme validation; it does not compare `url.origin` to a frozen mounted destination set. A provider can use the bounded port for an undeclared/private origin. No S-11 arm exists at the PR head. |
| D-4: consent identity/scope derivation | **NOT FIXED / absent** | The client `deriveControlScopeNotes` addition and row text are in `f42a92023`, not in `4668db336`. The reviewed head does not contain the claimed “ANY path on this origin” derivation. |

## Additional re-checks

- **Response bound:** original transport counts bytes as received and destroys/refuses on overrun; original W-9 passed. This does not compensate for missing destination law.
- **Wall-time bound:** original W-12 passed in the 19-arm suite.
- **Credential/header leakage:** original transport sends only controlled headers and exposes limited response fields; original leak arm passed. No credential jar was found.
- **`webEnabled` default false:** descriptor remains opt-in/false at the reviewed head; original W-2/W-3 passed.
- **Native Gate-0b:** fixed-native `web_fetch`/`web_search` claims remain a disclosed trust surface pinned by reviewed manifest/census rather than Gate-0b. No new un-governed native execution path was proven, but this is not a substitute for the missing destination controls.
- **Network confinement:** correctly disclosed as admission-plane only; no sandbox network-isolation claim is accepted.
- **Protected center / plane files:** no diff was found to `team-tool-plane.mjs`, `family-assembly.mjs`, binder, or the 33 protected paths in the PR changed-file list.

## Consent replay / origin identity

The intended fix text (only in unmerged `f42a92023`) states that approval covers any path on the origin. That is an explicit disclosure of per-origin grant scope, not path-specific consent. The client derivation is pure and keys only on `connect` + `network-destination`; however it is absent from the actual PR head. Therefore no consent-scope fix can be credited to PR #403 as currently published. Cross-origin/port/scheme changes remain governed by the existing origin fingerprint/redirect law only; a path on the same origin is intentionally covered by the stated per-origin scope.

## COULD-NOT-VERIFY

- A live Host C2 run was not repeated (review rules prohibit booting a Host); hosted checks were read from PR metadata/evidence.
- Dedicated CNAME-chain and redirect-port rows were not independently added because the advertised fix commit is not in the reviewed PR head; the relevant new resolver/redirect code was inspected at the unmerged fix commit only.
- The author’s claimed fix-round evidence cannot be attributed to `4668db336` because the commit containing it is not reachable from that head.

## Final decision

**BLOCKED. Do not merge.** The remote PR head is the pre-fix vulnerable code. The author must publish a PR head that contains `f42a92023` (or an equivalent reviewed fix), regenerate derived artifacts/evidence, and rerun the security review against the actual reachable head.
