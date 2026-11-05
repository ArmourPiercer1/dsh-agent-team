# BL-18 (P2-05) native `web_fetch` — BACKEND half (host-free evidence)

Task row: `BL-18 | P2-05 原生 web_fetch（本地 mock provider、network=deny 前置拒绝、普通 DSH fetch 不受影响）`.
Branch: `task/a5sf-web-20261105` (worktree `.worktrees/a5sf-web`), based on `origin/master`
= `8b1615121` (BL-17 merged).
Claimed state when this README was written: **backend half only** — the refusal / boundary
half is proven host-free; the LIVE half is **NOT PROVEN**. `V@B = no`, **no Host boot, no real
network egress, no DNS lookup, no socket was authorised or executed this round**. BL-18 stays
**NOT DONE** in `ALPHA5-SANDBOX-BACKLOG.md`; the row now records exactly which half exists.

Voice note: every number below is copied from a run whose command is printed next to it.
Nothing here says "a governed Member can fetch". On every governed realm in this tree a
`network: deny` web call is **refused before the provider is entered** (§5), and the product
composition still mounts **no** confined web face, so the model-visible native `web_fetch`
remains the inherited host tool (§7) — that is the honest product state, not an oversight.

---

## 1. What the row asks, and which half this is

| Row clause | This round |
| --- | --- |
| 本地 mock provider (a local mock provider proves the allow path without egress) | **PROVEN host-free** (arm `ADMIT-ALLOW`: exactly ONE provider call with the declared URL, the mock's bytes reach the model-facing result; `UNCHANGED-SHAPE` compares it byte-for-byte with the ordinary host path). |
| `network: deny` 前置拒绝 (refused BEFORE any connection attempt) | **PROVEN AS A PRE-PROVIDER REFUSAL, NOT AS A NETWORK DENIAL** (arms `DENY-*`; §5 — `0` provider fetches, `0` DNS, `0` connects, `0` proxy lookups). |
| 普通 DSH fetch 不受影响 (a non-governed Member keeps fetching as today) | **PROVEN host-free on the real composition path** (arms `ORDINARY-DSH-FETCH`, `UNCHANGED-SHAPE`: a real `WebRuntime` + the real pinned `tool-web` module + a mock provider on `ctx.web`, no realm, no guard). |
| The tool face is wrap-able without a CORE patch | **YES — route C at a public seam** (§2/§7). The native `web_fetch` is upstream's `@deepseek-ai/dsh-tool-web`; it is re-mounted into the Member's isolated `web` scope exactly as the BL-16/17 `fs`/`subprocess` faces are. No upstream source is touched; `CORE PATCH BUDGET = 0` holds. **Not** a `CORE_SEAM_BLOCKER`. |

## 2. What was built (no new policy evaluator, no upstream patch)

| File | Change |
| --- | --- |
| `packages/runtime/team-services/src/web.ts` (**new**, 250 lines) | The confined `web` face: `createConfinedWebClass(Base, { effective, provider, onGuardConsult, realmId })` subclasses the host's OWN `web` class (sampled from the live service, never imported by name) and REPLACES `fetch`/`search`. `createWebNetworkGuard` reads `effective.network.access` (the P1-02 compiled lane) and, for `deny`, calls BL-17's `probeNetworkDenial` — the imported one — admitting only an explicit `enforced`; everything else throws the typed `TeamIoDenial('NETWORK_UNCONFINED_REALM')` **before the provider line**. `WEB_FETCH_GUARD_METHOD = 'web:fetch'`, `WEB_SEARCH_GUARD_METHOD = 'web:search'`, and the typed residual set `WEB_NETWORK_RESIDUALS`. |
| `packages/runtime/team-services/src/subprocess.ts` | `probeNetworkDenial` parameter widened from `ConfinedProcessProvider` to the structural `NetworkCapabilityProbeCarrier` (`{ probe? }`), and `ConfinedProcessProvider` now declares its OPTIONAL `probe`. **One probe, two lanes** — a widening with no call-site or behaviour change. |
| `packages/runtime/team-services/src/types.ts` | `NETWORK_UNCONFINED_REALM` added to the closed `TEAM_IO_DENIAL_CODES` (the same token the install vocabulary already carries; a caller compares one concept), and `RealmServiceFaces.web` (required, total: the confined web surface or `null`). |
| `packages/runtime/team-services/src/install.ts` | `ConfinedWebRealmSpec` + `web?` on `InstallMemberIoProvidersInput`: a DECLARED web face needs a live `web` base class (typed `PROVIDER_UNAVAILABLE` otherwise), is mounted on the SAME isolated chain (`isolate('web')`), and is reported in `faces.web`. Atomic rollback and idempotent dispose extended. |
| `packages/runtime/team-services/src/mount.ts` | `A5SF_NETWORK_UNCONFINED_REALM`; `web?` forwarded to the install; the **pre-mount** refusal for any module whose declared `inject` contains `web`, and the **deferred** refusal for a child that defers `ctx.inject(['web'], …)` — both at composition time, before any tool definition exists, and both reading the realm's `faces` answer (never `ctx.get('web')`, which returns the inherited host service when no shadow was mounted). |
| `packages/runtime/team-services/src/index.ts` | Barrel exports for the face, its options, the guard methods and the residual set. |
| `tests/world-factory/lib/a5sf-web-arms.mjs` (**new**, 381 lines) | The host-free harness: the ONE compiler (`compileEffectiveIo`), the real realm mount, the real pinned `tool-web` module, a fake network boundary with per-step counters (`dnsLookups`, `connects`, `proxyLookups`, `probeCalls`), a host-web TRIPWIRE class, and the ordinary no-realm composition. |
| `tests/world-factory/a5sf-web.test.mjs` (**new**, 291 lines) | The 12 arms (§4). |
| `dev/agent-workflow/evidence/a5sf-web/mutation-controls.mjs` | The three mutation controls (§4.2). |
| `packages/testkit/test/p4t6-bookings/a5sfweb.json` | Census booking for the one new scannable source (`web.ts`), `1433 → 1434`, measured (§3). |
| `tests/world-factory/a5sf-p2-seam.test.mjs`, `packages/runtime/test/a5sf-bl16-grep-realm.test.ts` | Two existing pins updated for the widened shapes: the frozen `faces` answer gains `web: null` (the same TOTAL-answer law), and the BL-17 probe cast is read through one local structural view because `ConfinedProcessProvider` gained the optional probe member. |

### 2.1 The decision is NOT a second permission computation

The faces already had ONE compiler: `compileEffectiveIo` (ceiling ∩ tool restriction) →
`EffectiveIoPolicy`. This round adds **no second intersection and no second evaluator**:

* the web decision is `effective.network.access` — a field the P1-02 compiler already produced,
  the SAME object the `fs` face guards with. The face never re-intersects, never reads a
  blueprint, and never accepts a Member-supplied input;
* the refusal is a `TeamIoDenial` and travels through the SAME `observeGuard` transport
  (`a5sf-guard-consult/1`) as `IO_READ_DENIED` / `IO_WRITE_DENIED` / `IO_ASK_REQUIRES_APPROVAL`,
  so a reader of the fact stream sees one vocabulary, not two;
* the capability answer is BL-17's `probeNetworkDenial` **imported**, not copied
  (`PROBE-REUSE` pins the import by source, the same regression-sentinel pattern BL-16/17 use
  for `rg`). Two probes that can disagree is exactly the dual-authority defect this vertical
  keeps finding.

## 3. Gates measured on the final tree

| Gate | Command | Verdict |
| --- | --- | --- |
| runtime typecheck | `node_modules/.bin/tsc -p packages/runtime/tsconfig.json --noEmit` | **rc 0** (no output) |
| workspace typecheck | `pnpm -r typecheck` | **rc 0**, every package `Done` |
| lint (touched sources) | `eslint packages/runtime/team-services/src/{web,subprocess,mount,install,types,index}.ts packages/runtime/test/a5sf-bl16-grep-realm.test.ts` | **0 errors** (the world-factory `.mjs` arms and the evidence script are eslint-ignored by the repo config, matching every other lane) |
| world-factory (ALL a5sf) | `node --test tests/world-factory/a5sf-*.test.mjs` | **313/313 pass, 0 fail**. Measured baseline before this round = **301/301** (BL-17 merged: 280 + 21); this round adds **12** (`node-tests-all.log`; per-gate summary in `verdict.txt`) |
| BL-18 backend arms | `node --test tests/world-factory/a5sf-web.test.mjs` | **12/12 pass** (`arms-green.log`); pristine sources: **11 of 12 fail** (`arms-red.log`) |
| mutation controls | `node dev/agent-workflow/evidence/a5sf-web/mutation-controls.mjs` | **control: PASS**, 3/3 `RED-AS-REQUIRED` (`mutation-controls.json`) |
| runtime vitest groups | `vitest run test/a5sf-*.test.ts test/a5g6-install-face-render.test.ts test/a3p4-permission-lifecycle-e2e.test.ts test/p7t3-lifecycle-fact.test.ts` (from `packages/runtime`) | **16 files, 234/234 pass** |
| p4t6 census | `vitest run test/p4t6-session-event-scan.test.ts` (from `packages/testkit`) | **20/20 pass** with `a5sfweb.json`; unbooked run reads `scanner counts 1434, ledger derives 983 + 450 = 1433` (`.scratch/p4t6-unbooked.log`) |
| **the census leg itself** | `node scripts/ci-pr-gate.mjs --full --only census --census-captures 2 --census-test-timeout 90000 --store-dir <repo>/.pnpm-store --transcript-dir .scratch/census-transcripts` | **the identity CI named is GREEN after the booking in §3.2**; the leg's remaining local reds are load-induced timeouts in files this branch does not touch (three consecutive runs produced three *different* unrelated reds; none of them `a5p4`, and CI's two captures on `b1cb21d87` were identical). Logs: `census-leg/BEFORE.txt`, `census-leg/AFTER.txt` |
| whitespace | `git diff --check` | **rc 0** |
| artifact gate (index) | `node scripts/check-artifacts-committed.mjs` | see §3.1 |
| artifact gate (head) | `node scripts/check-artifacts-at-head.mjs` | see §3.1 / `artifacts-head.verdict.txt` |

Environment note (disclosed, not hidden): this worktree has no `node_modules` and no pristine
host checkout of its own — exactly like every other task worktree in this repo. Both are
**gitignored symlinks** (`node_modules → ../a5sf-s1/node_modules`,
`tests/deepseek-harness-test-use → ../../../tests/deepseek-harness-test-use`), so the measured
counts above are the counts a full checkout produces; neither is committed and neither changes
any verdict (`a5sf-tool-axis.test.mjs` aborts without the pristine tree, which is why the
number would otherwise read 297).

### 3.1 Artifact gate

This branch changes `packages/runtime/team-services/src/*.ts`, which feeds the committed install
surface, so `pnpm -r build` was run and the rebuilt `packages/runtime/dist/**` (including the new
`web.{js,d.ts,js.map,d.ts.map}`) is committed with it. The index-side verdict says only that the
working tree matches the index; `check-artifacts-at-head.mjs` (which materialises the commit,
builds it and compares) is the answer to "does the commit carry its own build" — its verdict for
the final commit is in `artifacts-head.verdict.txt` next to this file.

### 3.2 The census leg: the one identity CI named, and why my local replica missed it

CI on `b1cb21d87` (run 42017915427, job 127213143103) failed `ci-census / census-runtime` with
**exactly one** new identity:

```
NEW RED(S) 1: TEST packages/runtime/test/a5p4-lane-hygiene.test.ts::a5p4 lane purity and dormancy
  NAMED MOUNTS ONLY: every production reference to the lane is a booked row with one pinned public-face edge
AssertionError: unnamed production consumers of the confined provider lane:
  runtime/team-services/src/web.ts: expected [ 'runtime/team-services/src/web.ts' ] to deeply equal []
```

**It was mine, and it was a real omission — of a different ledger than the one I had booked.**
`web.ts` carries exactly one edge into the confined-provider lane:

```ts
import type { ProviderResult } from '../../sandbox-provider/index.js'
```

(a type-only import, because the ONE probe it calls — BL-17's `probeNetworkDenial`, imported from
`./subprocess.js` — answers that shape). The p4t6 booking I added covers a *file census*
("is every scanned `.ts` booked"), which is why the p4t6 suite was 20/20 in CI. The a5p4 ledger
covers a different question: *"is every production reference to the lane a named mount with one
pinned public-face edge"*. The new file passed the first and broke the second. **Two ledgers, two
questions; my local replica ran one suite, the gate runs nine roots and grades them as an identity
set.** That is the whole divergence — a new red identity, not a count disagreement. The counts did
move too (`668f/8824l` vs the baseline document's `626/7936`), and the gate says so out loud while
still drawing the verdict from the set: `compareCensus` fails only on `added`.

**The correction is a booking, not a code change** — the ledger's own `types-only` shape, the same
one the BL-16 `subprocess` face beside it uses:

```ts
{
  file: 'runtime/team-services/src/web.ts',
  lane: 'bl-18 — Member realm confined web face (types-only; provider instance injected)',
  edge: "import type { ProviderResult } from '../../sandbox-provider/index.js'",
  kind: 'types-only',
}
```

Local state after it (`census-leg/AFTER.txt`): the `a5p4` identity is gone, the p4t6 suite is
still green, no collection-error files from this branch. Three consecutive census-leg runs on this
worktree produced three *different* remaining reds — `alpha5-glob-backend` X3 and
`alpha5-search-backend` P11 (`expect(...).toBe('cancelled')` against a `timeoutMs: 1` backend),
and `a5-read-slice-window` ("Hook timed out in 10000ms" in `beforeAll`) — each in a file this
branch does not touch, each green in isolation here, each a timeout race that CI's two identical
captures never saw. They are load on this box, not regression, and they are disclosed rather than
argued away: the census of record is the CI run on the pushed head.

## 4. The 12 arms, RED → GREEN

TDD shape per arm: the arm file was written first and executed against the **pristine
`origin/master` sources** (implementation copied aside, the five tracked sources restored with
`git checkout --`, `web.ts` removed), then the implementation was restored and the same file
re-run. Both logs are committed:

* `arms-red.log` — pristine sources: **11 of 12 fail**. The one that passes is the *context* arm
  whose subject pre-exists this round and must NOT change: `ORDINARY-DSH-FETCH` (the shipped
  host `web_fetch`).
* `arms-green.log` — this branch: **12/12 pass**.

| Arm | Pins |
| --- | --- |
| `ADMIT-ALLOW` | governed realm, `network: allow`: **exactly one** provider `fetch`, with the DECLARED URL, the mock body reaching the model result; **one** ALLOW fact on `web:fetch` carrying the typed residual `WEB_REDIRECT_UNMEDIATED_ON_ALLOW` + `WEB_PROXY_ENV_UNMEDIATED_ON_ALLOW` |
| `SHADOW` | the call resolves the CONFINED face, not the inherited host `ctx.web` (the host service is a TRIPWIRE: `calls === 0`) |
| `DENY-PRE-REFUSAL` | `network: deny`: `0` provider fetches, `0` DNS lookups, `0` connects, `0` proxy lookups, **one** deny fact with `decidedBy = NETWORK_UNCONFINED_REALM`, and the probe asked exactly once |
| `DENY-TYPED-CODE` | the face throws `TeamIoDenial` with `code = NETWORK_UNCONFINED_REALM` and carries `memberIdentity` / `method` / `target`; `0` provider entries; one fact |
| `DENY-SEARCH-SECOND-PATH` | the sibling `web_search` on the same face is refused identically (`web:fetch` then `web:search`, both `NETWORK_UNCONFINED_REALM`), `0` searches, `0` DNS/connects — the deny lane is not bypassable by the other network row on this face |
| `DENY-PROBE-ABSENT` | a backend with NO probe answers `unsupported` (closed), never a default allow; the refusal says the capability could not be proven |
| `PROBE-LOAD-BEARING` | a backend whose probe reports `enforced` IS admitted (one fetch, one ALLOW fact) — the refusal is the probe's ANSWER, not a hardcoded string. No backend in this tree reports `enforced` (§5.1), which is why the product path refuses |
| `UNCONFINED-REALM-MOUNT` | a realm with NO confined web face refuses the REAL pinned `tool-web` module at composition time with `NETWORK_UNCONFINED_REALM` (message names the `web` injection and the inherited service); the host `ctx.web` is never consulted; no `web_fetch` definition exists to run |
| `PROBE-REUSE` | regression sentinel: `web.ts` imports `probeNetworkDenial` from `./subprocess.js`, defines no probe of its own, and never calls `.probe(` directly |
| `ORDINARY-DSH-FETCH` | NO Alpha.5 realm: the real `WebRuntime` + the real pinned `tool-web` + a mock provider on `ctx.web` fetch exactly as today (one call, declared URL, body delivered) — **green on pristine sources too** |
| `UNCHANGED-SHAPE` | a `network: allow` realm returns model text BYTE-IDENTICAL to the ordinary host path for the same URL and body — the face adds an admission fact, not a different fetch |
| `COMPOSITION` | the web provider and the face are composition inputs: `effective` carries no `web` and no `provider` field (a Member cannot supply or widen them), and `createConfinedWebClass` refuses to build without a provider |

### 4.1 What the RED run proves

The RED failures are not "module not found" noise: the pristine tree has no `web` face, so
`createConfinedWebClass` is absent (TypeError), `mountA5sfRealm` ignores a `web` spec, and
`mountNativeToolModules` mounts the real `tool-web` module against the **inherited host
`ctx.web`** (the exact hole §7 describes — the arm catches it: the typed refusal is `null`
where `NETWORK_UNCONFINED_REALM` was required). `ORDINARY-DSH-FETCH` passing on both sides is
the control that says the ordinary path was never touched.

### 4.2 Mutation controls (each mechanism independently load-bearing)

`node dev/agent-workflow/evidence/a5sf-web/mutation-controls.mjs` — literal single-occurrence
edits to the real source, sha256 verified before/after every mutant, `control: PASS`:

| Mutant | Edit | Required RED | Observed |
| --- | --- | --- | --- |
| `M1-web-pre-refusal-removed` | the `deny` leg returns after probing instead of throwing | the four DENY arms only | `DENY-PRE-REFUSAL`, `DENY-TYPED-CODE`, `DENY-SEARCH-SECOND-PATH`, `DENY-PROBE-ABSENT` — **RED-AS-REQUIRED** (all others green) |
| `M2-web-delegation-removed` | the mock returns a canned object WITHOUT the provider being consulted | the provider-entry arms | `ADMIT-ALLOW`, `SHADOW`, `PROBE-LOAD-BEARING`, `UNCHANGED-SHAPE` — **RED-AS-REQUIRED** (every DENY arm stays green) |
| `M3-web-residual-removed` | the ALLOW constituent drops `WEB_NETWORK_RESIDUALS` | only the residual assertion | `ADMIT-ALLOW` — **RED-AS-REQUIRED** |

## 5. The refusal's position, and how "zero connects" was observed

The refusal is thrown by `createWebNetworkGuard` inside `ConfinedWeb.fetch`/`search` **before the
`provider.fetch(request, signal)` line**. There is no socket, DNS resolver or proxy dispatcher
above that line in this composition: the injected provider is the ONE object that owns a
transport, so "the refusal is before the connection attempt" is a property of the call order, and
the arms measure it on the boundary object itself.

**What was measured (exact):** the fake boundary counts `dnsLookups`, `connects` and
`proxyLookups` on every entry, and the DENY arms assert all three are `0` (with
`fetches.length === 0` and `probeCalls === 1`). `DENY-SEARCH-SECOND-PATH` re-asserts the same
counters after a second call path.

**What was NOT measured, and is not claimed:** no syscall-level observation exists in this
round — no `strace`, no eBPF, no Host boot. The claim is "zero entries into the only object that
could perform a DNS/connect step", not "the kernel observed zero `connect(2)` calls". The live
half (§8) is what would turn the second sentence into a measured fact, and it was not run.

### 5.1 Why no backend admits `deny` here

`capability-probe.log` (committed, generated host-free) records all three carriers this face can
meet: a provider with no probe → `unsupported`; the fake boundary's probe → `unsupported`; the
shipped `sandbox-provider` network row → `unsupported` (its note is the verbatim Landlock
TCP-bits disclaimer). The host's real confined-process probe was measured at **`unsupported`** by
BL-17 (`evidence/a5sf-bash/README.md`) and is **cited, not re-measured** — no boot happened
here. Consequence: on every composition that exists today, a `network: deny` web call is refused
before the provider.

## 6. Redirect / proxy honesty — what the refusal covers and what it does not

The native `web_fetch` at the pin goes through the host `ctx.web`; the host fetch provider
(`packages/web/web-fetch-http` at `639ed01539`) follows **same-origin** redirects under its own
hop cap (`WEB_REDIRECT_BLOCKED` on a cross-origin hop) and resolves its dispatcher through the
process-wide proxy policy (`proxyRouteFor` from `@deepseek-ai/dsh-http-proxy`). This face does not
change either behaviour.

* **On a `network: deny` lane neither can bypass the refusal, by construction.** A redirect is
  only followed *after* a response exists, and a proxy is only resolved *when a request is
  made*; the refusal happens before the provider is entered, so there is no request. The DENY
  arms assert exactly that: `0` fetches, and therefore `0` proxy lookups and `0` connects. A
  "redirect to an allowed-looking host" needs a first connection the deny lane never makes.
* **On an `allow` lane this face does NOT mediate redirects or proxies**, and it does not pretend
  to: the admitted call carries the typed residual
  `WEB_REDIRECT_UNMEDIATED_ON_ALLOW` + `WEB_PROXY_ENV_UNMEDIATED_ON_ALLOW`
  (`WEB_NETWORK_RESIDUALS`) as annotations on its own ALLOW fact. That is a machine-readable
  limit on the exact fact, not prose: `M3` shows the arm goes red when the residual is removed,
  so the disclosure cannot silently rot. The ALLOW lane is ordinary host egress; the only thing
  this face adds there is admission.

**Residuals encoded (named, not hidden):**

1. `R1` — the pre-refusal is *position-based*. Any call path that reaches a real transport
   **without** going through `ctx.web` on the Member's isolated scope is not covered by it. The
   composition-time refusal (`UNCONFINED-REALM-MOUNT`) closes the `web`-injecting native module
   case; it cannot close a module that reaches the network through a different service.
2. `R2` — the **product family** `web_fetch` (`packages/tools/web-family`, mounted only behind
   `planeCfg.webEnabled`) owns its own bounded transport and consults the Team lane + kernel PA,
   **not** `effective.network.access`. It is **not covered by this round** and is BL-24 (P3-03)'s
   row. With `webEnabled` true on a realm that also denies network, this row would be a second,
   unconsulted path. This round neither mounts nor widens it.
3. `R3` — no OS-level network confinement is claimed anywhere. The refusal is an admission
   decision; it is not a netns, seccomp or Landlock TCP guarantee (that is BL-29 / P4-03).

## 7. Honest product state (why BL-18 is still NOT DONE)

* The **backend** half is proven host-free and mutation-controlled: the face exists, the lane
  decision is the compiled one, the refusal is before the provider, the composition-time refusal
  closes the inherited-service path, and the ordinary host fetch is unchanged.
* The **live** half (real egress, real DNS, a redirect chain against a live server, proxy-env
  behaviour, the model actually seeing `web_fetch` in a booted world) is **unproven**.
* **Product wiring is deliberately left unwired.** `a5sf-realm-row.mjs` forwards a compiled
  `subprocess` face (BL-16 shape) but has no `web` forwarding, and no product composition
  supplies a web provider. A composition that declared one today would hand an `allow` lane's
  calls to a real transport **with no OS network confinement at all** — the same reasoning that
  keeps BL-17's persistent shell unwired. The row's own 禁网 clause cannot be met by this host's
  backend, so "just wire it" would be egress dressed as governance.
* `product-assembly.ts` still refuses a `network: deny` declaration at assembly time
  (`REALM_DECLARATION_INVALID` path). That refusal is **unchanged**, and remains *correct for the
  current composition*: the product tree supplies no web provider, so a narrowed network lane
  still has no enforcing face. What changed is that the capability now exists at the backend
  seam; making that sentence stale is a product-wiring decision (with its own live acceptance),
  not this round's.
* **Is the `web_fetch` face a CORE seam blocker? NO.** It is upstream's `tool-web`, and it is
  wrap-able at a public seam: the host `web` class is sampled from the live service, subclassed,
  mounted under `root.isolate('web', …)`, and the module is re-mounted through the realm's own
  `mountNativeToolModules` route-C seam — verified by `ADMIT-ALLOW`/`SHADOW` on the real pinned
  module, with **zero** upstream edits. The consumer side is proven; the missing piece is a
  network-denying transport and a boot, not a Core patch.
* `ALPHA5-SANDBOX-BACKLOG.md` row BL-18 records this state verbatim
  (`IN-PROGRESS (BACKEND-PARTIAL, V@B=no)`) and the matrix row M-14 keeps `NOT_WIRED` / `V@B=no`
  (unchanged: no live half was measured, so no grade moves).

## 8. NOT proven (the live half) — one-shot acceptance checklist

Nothing in this section was run this round: no Host boot, no real fetch, no DNS, no proxy.

**Read this before spending a boot slot.** Steps are marked `RUNNABLE` or `BLOCKED` — the
`BLOCKED` ones cannot be executed on this tree *as it stands*, and the reason is not the
operator's environment: **no product composition supplies a confined web provider, and
`packages/runtime/src/plugin/live/a5sf-realm-row.mjs` forwards the compiled `subprocess` face but
has no `web` forwarding**, so there is no row config key, no service and no constructor that would
put a web face on a Member. The unblocking change is named under each blocked step; it is the
BL-18 product-wiring follow-up, not something these commands can work around. Do not improvise a
mount and then record it as a live row: a bespoke harness proves the harness, not the product.

Common preconditions (verbatim from `.github/workflows/census-runtime.yml`; that file is the
authority if this drifts):

```bash
# 0. the pinned pristine host, if this checkout has none (TEST_METHODS §2)
SHA=$(node -e "import('./tests/paths.mjs').then((m) => console.log(m.TEST_USE_BASELINE_SHA))")
VER=$(node -e "import('./tests/paths.mjs').then((m) => console.log(m.DSH_BASELINE_VERSION))")
CH=$(node -e "import('./tests/paths.mjs').then((m) => console.log(m.CLIENT_COMMIT_HASH))")
mkdir -p tests/deepseek-harness-test-use
git -C tests/deepseek-harness-test-use init -q .
git -C tests/deepseek-harness-test-use remote add origin https://github.com/ArmourPiercer1/deepseek-harness
git -C tests/deepseek-harness-test-use fetch -q --depth 1 --no-tags origin "$SHA"
git -C tests/deepseek-harness-test-use checkout -q --detach FETCH_HEAD
cd tests/deepseek-harness-test-use
pnpm install --ignore-scripts --store-dir "$PWD/../../.pnpm-store"
ESBUILD_WORKER_THREADS=1 DSH_CLIENT_COMMIT_HASH="$CH" pnpm run build
test -f apps/cli/lib/bin.js && echo "host build ok"
cd ../..

# 1. build THIS repo — the census leg and a live host both REFUSE an unbuilt checkout
CI=true pnpm install --frozen-lockfile --store-dir "$PWD/.pnpm-store"
pnpm run build
pnpm build:composition
```

| # | Step | Runnable today? | Exact command / state |
| --- | --- | --- | --- |
| 1 | **Host boots** with a world `DSH_HOME`, pinned runtime | **RUNNABLE** | `DSH_HOME=$PWD/tests/homes/bl18-live node tests/deepseek-harness-test-use/apps/cli/lib/bin.js web --port 3181 --no-open` — success = the line `dsh web: http://127.0.0.1:3181/?token=...` appears (TEST_METHODS §2 health check 1). Never `:3080`. |
| 2 | **Ordinary DSH unaffected (live)** — no Alpha.5 realm, `web_fetch` still fetches | **RUNNABLE** (step 1 host) | In that world's tool plane call `web_fetch` on a URL you control (a local server: `python3 -m http.server 3491`), then `grep` the world's tool-call log for the returned body and confirm **no** `a5sf-guard-consult` fact exists for it. Record the body byte-length and the absence of the fact. |
| 3 | **Deny lane, pre-connection (the row's core claim)** — `network: deny`, `web_fetch`, kernel-observed zero connections | **BLOCKED** | Needs a `web` face on the Member. Unblock = forward a compiled web face in `a5sf-realm-row.mjs` (mirror the existing `compiled.subprocess` block: shape `{ effective, provider }` with `provider.fetch`/`provider.search`, mounted by `mountA5sfRealm`), plus a provider constructor the row can call. Then: `strace -f -e trace=connect,sendto,sendmsg,socket -o .scratch/bl18-deny.strace -p <host pid>` **before** the call, call `web_fetch`, stop the trace, and require (a) the typed `NETWORK_UNCONFINED_REALM` refusal, (b) exactly one `web:fetch` fact, (c) **zero** `connect`/`sendto`/`sendmsg`/`socket` lines for the target host/port. This is the only step that upgrades §5's provider-counter claim to a kernel-observed fact. |
| 4 | **Deny lane, redirect shape** — a `302` to an allowed-looking host is never followed | **BLOCKED** (same unblock) | Start a local server whose only response is `302 Location: http://127.0.0.1:3491/allowed-looking`, re-run step 3, and require the same refusal plus **no** request line in the server's access log. |
| 5 | **Deny lane, proxy env** — a proxy cannot be consulted before a request exists | **BLOCKED** (same unblock) | Re-run step 3 with `HTTP_PROXY=http://127.0.0.1:3492 HTTPS_PROXY=… ALL_PROXY=…` pointed at a logging proxy (`python3 -m http.server 3492` is enough to log nothing), and require the same refusal and **no** proxy log entry. |
| 6 | **Allow lane, exactly one call, residuals visible** — `network: allow` | **BLOCKED** (same unblock) | Local server on `3491`, call `web_fetch` for `http://127.0.0.1:3491/legal/page`, require exactly one request line, the body in the model-facing result, one ALLOW fact carrying `WEB_REDIRECT_UNMEDIATED_ON_ALLOW` + `WEB_PROXY_ENV_UNMEDIATED_ON_ALLOW`, and record which redirect/proxy dimensions the host provider actually exercised (hop count, proxy route). |
| 7 | **Second call path** — `web_search` on the same face | **BLOCKED** (same unblock) | Repeat step 3 with `web_search`: same pre-provider refusal, zero connections, one `web:search` fact. |
| 8 | **Cross-generation** — revoke the Member's policy revision mid-flight | **BLOCKED** (same unblock + a control surface) | Revoke while a `web_fetch` is in flight; record that the call is refused/aborted rather than completing under the old lane. |

What a green step 3–7 would NOT prove, even after the wiring lands: that the *model* sees the
confined tool rather than a shadow of it (step 3's fact stream is the evidence for that, not the
tool's output), that a redirect chain across origins is safe under `allow` (it is not mediated —
§6), and that a non-`ctx.web` transport is confined (it is not — §6 R1/R2).

## 9. Honest intermediate state (why BL-18 is still NOT DONE)

* The backend half (allow-path mock, `network: deny` pre-provider refusal, the sibling
  `web_search` path, the composition-time unconfined-realm refusal, the probe's load-bearing
  role, the residual disclosure, ordinary-fetch invariance) is proven host-free and
  mutation-controlled.
* The live half (real egress, real DNS, redirect chain, proxy env, a booted Member's tool
  surface, cross-generation behaviour) is **unproven**; §8 is the checklist, not a result, and
  five of its eight steps are marked `BLOCKED` on the product wiring rather than on the operator.
* The **census leg** (nine roots, two captures, identity-set graded) is green for the identity this
  branch introduced: the `a5p4` NAMED MOUNTS red is fixed by the `types-only` booking in §3.2. The
  leg was red in CI before that booking and is the reason this README grew §3.2.
* The product composition is deliberately left unwired: no `web` provider is supplied, so a
  governed Member's model-visible `web_fetch` is still the inherited host tool. Saying otherwise
  would be the exact silent-widening failure this seam exists to refuse.
