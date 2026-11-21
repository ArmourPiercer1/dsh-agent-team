# UTE-3 stage B1 — WEB family, old-path baseline + per-member negative controls

Task: `UTE-3 / G1 Web family, stage B1`. Worktree
`.worktrees/ute3-web-b1-20261120`, branch `task/ute3-web-b1-20261120`, base
`origin/master` @ `60dfe5e03`. **CORE PATCH BUDGET = 0** — no upstream source was
edited; the pinned host tree `tests/deepseek-harness-test-use` was read only.

## What this round establishes, and what it does not

| term | this round | why |
|---|---|---|
| `oldBaseline` | **established** | 15 `(request → effect)` vectors measured on the CURRENT product composition (`composition-probe.txt`, `capture-run-1/2.txt`, `golden/old-path.tsv`) |
| `negativeControlsPass` | **established** | 11 controls GREEN, one REAL control per member with POSITIVE arms (`negative-controls.txt`) |
| `newPathVerified` | **FALSE** | no new path exists for Web; zero `NEW-PATH-VECTOR` `PASS` lines (`new-path-absent.txt`) |
| `semanticDifferencesResolved` | **FALSE** | three measured differences, all blocking, **no approval found** (`semantic-differences.txt`) |
| `retirement` | **FORBIDDEN** | the four-term predicate is not satisfied; `ute-retirement-gate --family web` refuses with `UTE_NEW_PATH_UNVERIFIED`, `UTE_SEMANTIC_DIFFERENCES_UNRESOLVED`, `UTE_VECTOR_UNREPRODUCED`, `UTE_MEMBER_UNCOVERED` (`gate-refusal.txt`) |

## Files in this directory

| file | what it is |
|---|---|
| `composition-probe.txt` | STEP 0: census, reachability, confined-face proof, legacy-plane answer, socket/egress proof |
| `capture-run-1.txt`, `capture-run-2.txt` | two consecutive captures, both `OLD-PATH-GOLDEN compare=identical` |
| `lane-suite.txt` | `node --test tests/ute-g1-web/lane-suite.test.mjs` (8/8) |
| `negative-controls.txt` | the committed control transcript the retirement gate greps for `NC-MEMBER <member>` |
| `semantic-differences.txt` | the three measured differences (all `blocking=true`, `approval=null`) |
| `new-path-absent.txt` | the honest absence record `terms.newPathVerified` points at |
| `gate-refusal.txt` | `ute-retirement-gate --family web` and `--all` transcripts |

## The one finding a reviewer should read first

**The legacy governed plane's answer for Web is NOT Search's answer, and the
probe says so instead of reusing a conclusion.**
`packages/tools/families/web.mjs` CLAIMS the fixed native spellings
`web_fetch`/`web_search` directly (opt-in `webEnabled`, ABSENT = FALSE,
`disabledOwned` deliberately empty, module sha256 pinned in
`packages/tools/families/manifest.json`). Search instead mounts only the aliases
`team_grep`/`team_glob` and is refused at the plane-name gate with
`PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED`. For Web that gate is simply not the
gate: `verifyPlaneNames` is closed to `grep`/`glob`/`bash` and answers
`PLANE_NAMES_INVALID` for a web key, while the FamilyAssembly seam accepts the
native names. That is `SD-WEB-1`: with `webEnabled: true` an install has TWO
producers of the same two names and no seam names the winner. It is blocking,
and nobody has approved it.

## The transport question, disclosed rather than hidden

The confined `web` face ships **no transport by design**
(`packages/runtime/team-services/src/web.ts` takes a provider), so every
composition must supply one and this lane supplies the PINNED
`@deepseek-ai/dsh-web-fetch-http` `HttpFetchProvider`. Its default resolver
refuses non-public addresses, so the loopback fixture is reached through the
provider's OWN documented constructor argument. Nothing upstream was patched
(**CORE PATCH BUDGET = 0**), all fetch semantics (redirects, byte/char caps,
content-type refusal, deadlines) stay pinned-host code, and only `web_search`'s
JSON POST is composition fixture code because the pin ships no search client. A
network-effect baseline needs a responder; recording only refusals would have
claimed coverage without ever executing the effect.

## The egress zero, and why it is a measurement

`net.external=0` on every row is produced by a witness that patches
`net.Socket.prototype.connect` (undici's connector funnels through it) and
refuses a non-loopback target BEFORE `original.connect`. Three things make that
zero load-bearing rather than decorative:

1. `NC-NET-SHIM-LOAD-BEARING` — with the witness removed the world REFUSES to
   report a clean zero (`NET_WITNESS_MISSING`).
2. `NC-NET-COUNTER-POSITIVE` — one non-loopback connect through the patched
   prototype moves `external` to 1 while the REAL connect runs ZERO times
   (`forwarded=0`, `EGRESS_REFUSED`), so the counter is not a constant.
3. The lane suite pins the witness's UNDICI reading: undici's connector forwards
   its option bag through an array-like wrapper, so a naive reader defaults every
   connect to `localhost:0` and would classify an EXTERNAL fetch as loopback.
   The witness unwraps it and the golden's destinations are
   `127.0.0.1:3182` — verified by a dedicated test, not by inspection.

The threshold is honest: this proves no non-loopback socket was ATTEMPTED in
these runs. It is not a network-confinement proof (the host sandbox claims FILE
effects only), and the pinned provider still follows same-origin redirects
(`WEB_REDIRECT_UNMEDIATE_ON_ALLOW`) and still honours a proxy for public names
(`WEB_PROXY_ENV_UNMEDIATE_ON_ALLOW`). Both residuals are on every allow fact.

## UNKNOWN (explicit, never skipped)

1. **No new path** — `newPathVerified` is false by construction.
2. **Network confinement is not proven** (see above).
3. **The governed `webEnabled:true` mount/dispatch is not run** — it needs the
   governed kernel/PA lane; the descriptor and the legacy transport are measured
   instead.
4. **`capSearchSources` is not exercised** — the shadow mounts the host default
   `searchMaxResults=50` and the composition exposes no key to lower it; the
   fixture's 5 sources stay under the cap.
5. **Mapped but un-exercised codes** — `WEB_BLOCKED_URL` (declared unmapped on
   purpose: it covers credentials-in-URL AND non-public resolution, so one
   category would be a guess), `WEB_INVALID_URL`, `WEB_PROVIDER_ERROR`,
   `WEB_SEARCH_DESTINATION_DENIED`.
6. **Cross-origin redirect refusal** is mapped, not measured (the fixture chain
   is same-origin).
7. **Mid-flight cancellation** is not expressible; only a pre-dispatch abort.
8. **A live boot** is out of scope (C1 host-free capture).
