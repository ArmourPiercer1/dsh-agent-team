# Web face — layer B (native-tool contract) acceptance, host-free

Task: **layer B acceptance of the Web capability face** — the per-native-tool
contract that the shared face-level (layer A) arms cannot cover.
Branch `task/a5sf-web-contract-20261107` (worktree `.worktrees/a5sf-web-contract`),
based on `origin/master` = `dbe4d7b81` (`A5SF SUB-CONTRACT`, #614). Predecessor
shapes: `dev/agent-workflow/evidence/a5sf-fs-face/README.md` and
`dev/agent-workflow/evidence/a5sf-subprocess-face/README.md`; this document
copies the **shape** (§1 layer split, §5 not-proven-with-one-shot-command, §6
mutation controls, §7 network claim discipline, §10 host precondition), **not**
their content. The §7 discipline is reused **verbatim in substance** because it
is the repo's standing rule for network claims, and this face is the one most
likely to be misread as a network sandbox.

Host starts spent this round: **0**. Egress this round: **0** — no socket, no DNS,
no proxy lookup, no listener, no boot. The only network surface any arm touches
is an **injected provider recorder** (`tests/world-factory/lib/a5sf-web-contract-world.mjs`),
which counts the steps a real transport would take and never takes one.
`CORE PATCH BUDGET = 0`: no `packages/**` file is changed by this branch. The
mutation runner edits two product sources **in its own process**, restores them
byte-for-byte, re-asserts sha256, and additionally asserts
`git status --porcelain -- packages/` is empty at the end (§6). No upstream file
was modified. No grade, no `V@B`, no candidate claim; the matrix gained evidence
pointers only (§8).

Voice note: every number below is copied from a run whose command is printed next
to it, on **this** host. §4 separates test-coverage gaps from one product
labelling defect; §5 lists exactly what is NOT proven and the one-shot boot
command that would be needed.

---

## 1. What layer B is here, and what the BL-18 arms already owned

| layer | question it answers | already owns (do **not** restate) |
| --- | --- | --- |
| **A** — capability face × permission axis | is the LANE around a `web_fetch` call correct: ceiling ∩ restriction, the network axis, pre-provider refusal, fact attribution, the row forwarding the face | `a5sf-web.test.mjs` (12 arms), `a5sf-web-row.test.mjs` (10 arms), `a5sf-member-policy.test.ts`, `a5sf-product-assembly.test.mjs` |
| **B** — per-native-tool contract | does the REAL face behave as its own contract says **inside** an admitted call: the guard/provider **order**, the denial's **wording discipline**, **where** the two named residuals stop mediating, fetch-vs-search lane expressibility, and the authoring-time **ambiguity** of the two face sources | **this document** |
| **C** — frozen-candidate live | does the assembled Host + preset + provider actually do it | previous boot rounds; not re-run here (`NOT_REACHED`, §5) |

The discipline (inherited from the FS/subprocess faces): an arm is written only
where the assertion is about the **face's own semantics** or the **order/identity**
of its side effects. **No arm here concludes "the network was confined".** Where
a deny fact appears it is the ordering/attribution witness for a property this
layer owns (P1, P2), not a confinement result.

**What the ten existing BL-18 arms leave open** (each became one arm below):

1. they assert the provider was entered once and saw the URL, but not that the
   guard had **already completed** when the provider was entered (P1);
2. they assert the deny code and the zero counters, but not that the refusal
   **names a capability rather than claiming a measurement** (P2);
3. they assert the residual tokens are **present** on the allow fact, but not
   **where mediation stops** — a redirect hop and a proxy lookup are never
   exercised (P3);
4. they treat `fetch` and `search` as two paths, but never ask whether they
   **share one lane and one guard instance**, or whether a per-method lane is
   even expressible (P4);
5. `ROW-AMBIGUOUS` asserts the `REALM_DECLARATION_INVALID` **code** for the
   two-source case, but not that both sources are **named**, that it is
   **authoring-time** (zero provider calls, no fact sink created), or that each
   single source alone still mounts (P5).

## 2. What is REAL in the world (and what each piece has to be)

One harness, no second world builder:
`tests/world-factory/lib/a5sf-web-contract-world.mjs` **extends** the BL-18
harness (`lib/a5sf-web-arms.mjs`) with a recorder boundary and the row topology.
The BL-18 harness gained exactly one optional parameter (`makeGovernedRealm({
boundary })`); with it omitted, behaviour is byte-identical.

| piece | real artifact | why |
| --- | --- | --- |
| confinement / composition | **PRODUCT** `mountA5sfRealm` (`packages/runtime/team-services/src/mount.ts:792`) with the `web: { effective, provider, realmId }` install spec (`install.ts:143-159`, mounted at `install.ts:399-409`) | this is the call the live Member setup makes; the arm drives the face the product mounted |
| row / composition key | **PRODUCT ROW** `mountMemberA5sfRealm` + `a5sfRealmConfigOf` + the `a5sfWebFace` factory path (`packages/runtime/src/plugin/live/a5sf-realm-row.mjs:750`, `:807-816`, `:636-680`) | P5 is about the authoring seam, so it must be the row that refuses |
| lane decision | **PRODUCT** `compileEffectiveIo` (`packages/runtime/member-io-policy/src/compile.ts:196-198`) | the arm never intersects a lane; P4 inspects the compiled object's shape |
| capability probe | **PRODUCT** `probeNetworkDenial` imported by the face (`web.ts:158`, BL-17) | the probe is not copied and not replaced |
| fact transport | **PRODUCT** `observeGuard` (`guard-observability.ts:168-215`) | one fact per consultation, `sequence` per observed guard — the P4 shared-instance witness |
| native module | **PINNED** `@deepseek-ai/dsh-tool-web` `lib/index.js` (`639ed01539`), mounted through the realm's own route-C seam | the shipped `web_fetch`/`web_search` row, not a reimplementation |
| network boundary | **FAKE** `contractBoundary` (recorder) | `factsAtEntry`, argument list, request keys, ambient proxy env, and every URL a socket would have used. No socket exists |

A real child process is NOT created by any arm; no port, no `DSH_HOME`, no
`tests/homes/**`.

## 3. The arms

File: `tests/world-factory/a5sf-web-contract.test.mjs` — **10** `node:test` cases.
Run: `node --test tests/world-factory/a5sf-web-contract.test.mjs` →
`tests 10 / pass 10 / fail 0` (`suite.log`).

### 3.1 P1 — the `allow` lane position: guard, then provider

**Semantics found.** `createConfinedWebClass(...).fetch` is three lines
(`packages/runtime/team-services/src/web.ts:209-213`):

```
210  const url = declaredUrlOf(request, 'fetch')
211  await guard(WEB_FETCH_GUARD_METHOD, url, WEB_NETWORK_RESIDUALS)
212  return provider.fetch(request, signal)
```

The guard is therefore **after** the locator read (`declaredUrlOf`, a pure read
of `request.url`) and **before** everything else — no request is constructed,
normalized or rewritten between the decision and the provider call; the provider
receives the **original** `request` object and the caller's `signal`. `search`
has the same shape (`:226-228`), with one extra pre-check (`:217-225`: a provider
without `search` refuses `IO_POLICY_UNSUPPORTED` instead of fabricating a result).

So the position is **correct**: the guard is not after any part of request
construction. That is a finding of *correctness*, not a defect — but it was
unpinned, and a two-line reorder would have been invisible to the existing
suite.

**Assertion (`P1-GUARD-BEFORE-PROVIDER`).** Through the product route and the
REAL `tool-web` module: exactly one provider fetch, `factsAtEntry === 1` (the
guard **completed** before the provider was entered), `facts.length === 1`
(exactly one guard evaluation for one call), `facts[0].method === 'web:fetch'`,
`facts[0].decision === 'allow'`, and `provider.url === facts[0].locator ===
DECLARED_URL`.

**Assertion (`P1-DECLARED-URL-UNMUTATED`).** A URL whose string form a parser
or normalizer **would** change (`/legal/./page%2Fsub?q=1#frag`) is driven
through: the provider receives that exact string, the guard is consulted on that
exact string, and the first transport hop is that exact string. No normalization,
no re-encoding, no rewrite between the model argument and the provider request.

**RED→GREEN.** `red-first-run.log`: at `8b1615121` (the tree before BL-18's
`a5bd88b85` added `web.ts`) the same suite is **10 fail / 0 pass** — the contract
surface does not exist. On the shipped tree both P1 arms are green.
**Mutation control M1** (provider entered before the guard) reds
`P1-GUARD-BEFORE-PROVIDER`; it also reds `P2-DENY-CAPABILITY-REFUSAL`, declared
in §6 because the deny lane's zero-call position **is** the same line.

### 3.2 P2 — the `deny` lane: a capability refusal, not an observation

**Semantics found.** The refusal is thrown **before** the provider line
(`web.ts:152-168`): the guard returns immediately for any lane that is not
`deny` (`:155`), asks the backend's own probe (`:158`), and refuses unless the
probe answers `enforced` (`:159-167`). The message is:

> `the effective lane requests network=deny, but the web provider's capability
> probe reports network-destination='unsupported' (<note>); refusing before any
> provider call instead of fetching under a deny claim this host cannot enforce.
> A backend that proves 'enforced' is the only configuration that admits this call`

It names the **dimension** (`network-destination`), the **level** the backend
answered (`unsupported`), the **source** (`the web provider's capability probe`),
and its **position** (`refusing before any provider call`) — and it makes **no
observation claim**. That is the correct shape: refusing to call is not a
measurement.

**Assertion (`P2-DENY-CAPABILITY-REFUSAL`, `P2-DENY-SEARCH-ALSO-CAPABILITY`).**
On `network: deny`, through the product route and the REAL module: typed
`NETWORK_UNCONFINED_REALM`, **exactly one** guard fact (`decision: deny`,
`decidedBy: NETWORK_UNCONFINED_REALM`, `annotations: undefined`), and **zero** on
every boundary counter — `fetches`, `searches`, `transport`, `dnsLookups`,
`connects`, `proxyLookups` — for both call paths. Then the **wording
discipline**, reused from the subprocess face's §7:

```
OBSERVATION_CLAIMS = [
  /observed (?:zero|no) connections?/i, /observes? (?:zero|no)/i, /no traffic/i,
  /zero (?:connections?|sockets?|traffic)/i, /syscalls? (?:recorded|observed|denied)/i,
  /measured (?:zero|no) /i, /did not connect/i, /no (?:network|egress) (?:activity|traffic)/i,
  /network was (?:blocked|isolated|denied)/i, /seccomp|netns|iptables/i,
]
```

A refusal matching **any** of those makes the arm **fail**; it must instead match
`capability probe`, `network-destination`, `unsupported`, and
`refusing before any provider call`. The arm also asserts the helper **rejects a
specimen** (`… capability probe: network-destination unsupported; observed zero
connections`) with `assert.throws` — the discipline is live, so a message change
is a test change rather than a silent loosening.

**RED→GREEN.** Pre-feature tree: both arms red (`red-first-run.log`). Shipped
tree: green. **Mutation control M2** appends an observation claim to the refusal
(`observed zero connections and no traffic`) → both P2 arms red, and nothing else
does.

### 3.3 P3 — the two named residuals, pinned as POSITIONS

`WEB_NETWORK_RESIDUALS` (`web.ts:92-95`) is a claim that two specific dimensions
are **unmediated on an allow lane**. An arm asserting "there is no redirect
handling" would be worthless; the arms below pin **where** mediation stops, so a
future fix changes the result.

**Redirect (`P3-REDIRECT-POSITION`).** `WEB_REDIRECT_UNMEDIATED_ON_ALLOW` says
the host fetch provider follows redirects under its own hop cap and this face
does not re-check the chain. Measured with a boundary that follows **one**
redirect **inside** the provider: `transport === [declared, cdn.example.test/moved/page]`
(two hops) while `fetches === 1` (one provider call) and `facts.length === 1`
(exactly one guard evaluation, on the **declared** URL). No fact names the
redirect target, and the caller receives the provider's **final** answer by
identity (`response === boundary.lastResponse`, `response.url === REDIRECT_TARGET`).
The boundary of mediation is therefore: *the declared URL is mediated; the
location the provider lands on is not, and is returned to the caller as-is.*

**Proxy (`P3-PROXY-POSITION`).** `WEB_PROXY_ENV_UNMEDIATED_ON_ALLOW` says the
provider resolves its dispatcher from the process-wide proxy policy and this face
neither selects nor vetoes a proxy. Measured with a sentinel
`HTTP_PROXY`/`HTTPS_PROXY` in the environment: the provider observes those exact
values at call time (`httpProxy`/`httpsProxy`), the face injects **no**
`NO_PROXY`, the provider is called with exactly **two** arguments (no dispatcher
third argument), the request object is **unchanged** (`JSON.stringify` before ===
after), `proxyLookups === 1` (the one resolution belongs to the provider), and
there is exactly **one** guard fact. The boundary of mediation is therefore:
*the face hands the provider the request and the signal and nothing else; proxy
selection is entirely downstream.*

**Assertion detail.** Both arms also assert the residual pair rides the **same
single allow fact** in declaration order — the disclosure and the position are one
statement. (The pair's *presence* is already asserted by `ADMIT-ALLOW`; this is
the position, not the presence.)

**RED→GREEN.** Pre-feature tree: both red. Shipped tree: green. **M3a** re-guards
the redirect target (a second fact appears, the target enters the guard) → exactly
`P3-REDIRECT-POSITION` reds. **M3b** makes the face pass `process.env.HTTP_PROXY`
as a third argument → exactly `P3-PROXY-POSITION` reds.

### 3.4 P4 — `search` vs `fetch`: one lane, one guard, and NOT expressible per method

**Semantics found.** The compiled axis is one field with a closed binary domain:
`NetworkAccess = 'allow' | 'deny'` (`packages/runtime/member-io-policy/src/types.ts:26`),
`EffectiveIoPolicy.network: { readonly access: NetworkAccess }`
(`types.ts:128`), and `compileEffectiveIo` computes it as a **conjunction** of two
`=== 'allow'` tests (`compile.ts:196-198`): `allow` only when the member ceiling
**and** the tool restriction both allow, otherwise `deny`. The face reads that
one field for **both** methods (`web.ts:155`), and there is **one** confined web
face per Member realm, mounted on the Member's own isolated scope
(`install.ts:325-327`, `:399-409`); a binding realm isolates **`fs` only**
(`install.ts:579`), so there is no per-binding web face either.

**Product statement (not a test gap): a lane that allows `fetch` and denies
`search` (or the reverse) is NOT EXPRESSIBLE.** One Member realm has one
compiled `effective`, and both call paths consult its one network field. Making it
expressible would require a second axis (or a second web face per method), which
neither the compiler nor the install seam carries.

**Assertion (`P4-NO-PER-METHOD-LANE`).** The compiled `network` object is frozen,
has **exactly** the key `access`, and its value is in `{'allow','deny'}`. An
out-of-domain input (`ask` — the only disposition that could admit a per-call
difference) cannot survive the intersection: the compiler still answers a total
policy (`ok: true`) but the effective value **degenerates to `deny`**, never to
an allow. The realm reports exactly one `web` surface, with `fetch` and `search`.

**Assertion (`P4-SHARED-GUARD-BOTH-PATHS`).** On an allow lane, through the REAL
module: `web_fetch` then `web_search` produce facts
`['web:fetch','web:search']` with `sequence [1, 2]` — **one** observed guard
instance serves both paths (`sequence` is per-guard, so two guards would each
restart at 1) — the same `decidedBy` (`ALLOW`) and one `policyRevision`. One
provider fetch and one provider search.

**The real request shape, and a labelled defect.** The pinned module calls
`ctx.web.search({ query, maxResults }, signal)` (one call **per query**, so an
N-query tool call produces N provider searches and N guard evaluations — the
fan-out is the module's, not the face's). `declaredUrlOf` (`web.ts:240-250`)
understands `{url}` or a `{queries: [...]}` array; for `{query}` it returns the
stable marker `<search:malformed-request>`. The arm pins the measured position
(marker, query text not leaked, request keys `['query','maxResults']`) and
reports the gap as **`GAP-WEB-CONTRACT-1`** in §4 — the `queries:N` branch is
unreachable for the product's own request shape.

**RED→GREEN.** Pre-feature tree: both red. Shipped tree: green. **M4** gives
`search` a **second** observed guard instance → the sequence restarts at 1 and
exactly `P4-SHARED-GUARD-BOTH-PATHS` reds.

### 3.5 P5 — `a5sfWebFace` composition: fail-closed at authoring time

**Semantics found.** The row resolves the compiled source first, then refuses the
config source when both exist (`a5sf-realm-row.mjs:807-816`):

```
807  let web = compiled.web
808  if (web !== undefined) assertConfinedWebFace(web, 'a5sfRealmProvider.compiledFor answered a `web` face')
809  if (a5sfConfig.webFace !== undefined) {
810    if (web !== undefined) {
811      throw new TeamServiceInstallError(
812        'REALM_DECLARATION_INVALID',
813        `the compiled realm answer carries a \`web\` face AND config.a5sfWebFace configures one;`
814        + ' two web-face sources for one Member realm is a fork — keep exactly one',
815        A5SF_WEB_FACE_KEY)
```

The refusal happens **inside `mountMemberA5sfRealm`**, before `mountA5sfRealm`,
before the evidence sink is created (`:824-828`), and before any request can
exist. The `reveal` field of the typed error is `a5sfWebFace`.

**Assertion (`P5-AMBIGUOUS-FAIL-CLOSED`).** Both sources supplied →
`REALM_DECLARATION_INVALID`, **no realm mounted**, the message names **both**
sources (`the compiled realm answer carries a \`web\` face` and `a5sfWebFace`) and
states the resolution (`exactly one`), `error.reveal === 'a5sfWebFace'`, **zero**
provider calls (fetch and search), **zero** DNS/connect/proxy accounting, the
evidence sink file was **never created** (so nothing was ever consulted), and the
inherited host `web` tripwire was never called.

**Assertion (`P5-EXACTLY-ONE-SOURCE`).** A two-row table on the same builder:
compiled-only mounts a face that refuses a deny-lane fetch with
`NETWORK_UNCONFINED_REALM`; config-only (a factory module the row imports) mounts
a face with the same behaviour. So **exactly one of the two paths works, and each
works alone** — the ambiguity is not a case where neither path works.

**RED→GREEN.** Pre-feature tree: both red (the row did not know `web` at all).
Shipped tree: green. **M5** disables the fork check → the config factory silently
overwrites the compiled face and exactly `P5-AMBIGUOUS-FAIL-CLOSED` reds.

## 4. Findings summary — coverage gaps vs product defects

**Test-coverage gaps (semantics found correct; only the pin was missing):**

- **P1** — the guard/provider order was correct but unpinned; a reorder would have
  passed every existing arm.
- **P2** — the refusal wording was already capability-shaped; no arm would have
  noticed a rewrite into an observation claim.
- **P3** — the residuals were asserted as **presence**, never as **position**.
- **P4** — "shared guard / one lane" and "per-method lane not expressible" were
  simply unasked.
- **P5** — `ROW-AMBIGUOUS` covered the code, not the two-source naming, the
  authoring-time position, or the single-source controls.

**Product defect (reported, NOT fixed — `CORE PATCH BUDGET = 0`):**

- **`GAP-WEB-CONTRACT-1` — the search locator is a "malformed request" marker for
  the product's own request shape.** `declaredUrlOf` (`web.ts:240-250`) checks
  `request.url`, then a `request.queries` **array**; the pinned `tool-web` sends
  `{ query, maxResults }`, so every real `web_search` fact records
  `<search:malformed-request>` and the `queries:N` branch (`:244-247`) is dead for
  the product path. Impact is **evidence quality, not enforcement**: the fact
  still names the method, the decision and the lane; it just cannot say *what* was
  consulted, and a future reader may read the marker as "the tool sent garbage".
  Minimal fix (one branch, ~4 lines, plus one arm assertion):
  `if (typeof request.query === 'string' && request.query !== '') return 'queries:1'`
  (a count, never the text — the current marker's one virtue is that the query is
  not leaked, and a fix must keep that). Reported for the owner; the arm above
  pins today's measured position so the fix will red it deliberately.
- **Observation, not a defect** — an out-of-domain `network.access` value cannot
  reach the effective policy as an allow: the intersection
  (`compile.ts:196-198`) computes `allow` only from two `=== 'allow'` tests, so
  anything else degenerates to `deny`. Fail-closed by construction, pinned in P4.

## 5. What is NOT proven (and the exact one-shot command a boot would run)

**None of the following is claimed by any arm here.**

| not proven | why it needs a Host / a real egress | one-shot command |
| --- | --- | --- |
| that a live Member/preset reaches this face with the model-visible `web_fetch`/`web_search` | the preset registry, binding glue and capability deny lane are assembled by the product row inside a boot | `node dev/agent-workflow/evidence/a5sf-candidate1/run-boot.mjs` (the frozen-candidate boot runner; port/allocation is the operator's) |
| a real HTTP request, real DNS, a real redirect chain against a live server | every arm's transport is a recorder; no socket exists in this suite | same boot runner, then the `M-14`/`M-15` live rows |
| that a proxy is actually used on an allow lane | the arms show the provider **inherits** the environment; they do not show a dispatcher honouring it | a loopback proxy listener the operator owns + a booted Member with `HTTP_PROXY` pointed at it |
| that a `network: deny` lane stops real egress | **not measurable by refusal**: the refusal is our own admission code; the OS was never asked | see §7 — a provider that reports `enforced` **with a mechanism and an evidence row**, a real client attempt under `deny`, and an out-of-band transport observation |
| the `enforced` branch of the probe on a real backend | no provider in this tree reports `enforced`; the real provider answers `unsupported` | only after a netns/seccomp provider exists; a boot would not change the probe's answer |
| that the redirect hop cap is upstream's, not this face's | the recorder simulates one hop; the real hop cap lives in the host provider | boot + a server that redirects more than the cap |

`NOT_REACHED` in this document means exactly the rows above. Nothing in §3 is
simulated at the **decision** level: refusals are measured at the provider
counter, and admitted calls are measured at the provider edge. The **transport**
is simulated, which is why §7 gates every network claim.

## 6. Mutation controls (one per property; P3 has one per residual)

`dev/agent-workflow/evidence/a5sf-web-face/mutations.mjs` applies a literal
single-occurrence edit to `packages/runtime/team-services/src/web.ts` (and, for
P5, to `packages/runtime/src/plugin/live/a5sf-realm-row.mjs`), runs the SAME
suite, records the red set, restores the file in a `finally`, re-asserts sha256,
and finally asserts `git status --porcelain -- packages/` is empty. Run:

```
node dev/agent-workflow/evidence/a5sf-web-face/mutations.mjs
```

Result (`mutations.log`): `MUTATION-CONTROLS-PASS`.

| control | edit | reds (declared) |
| --- | --- | --- |
| `M1` P1 | provider entered **before** the guard (`web.ts:211-212` swapped) | `P1-GUARD-BEFORE-PROVIDER`, `P2-DENY-CAPABILITY-REFUSAL` (**declared multi-arm**) |
| `M2` P2 | refusal gains `observed zero connections and no traffic` | `P2-DENY-CAPABILITY-REFUSAL`, `P2-DENY-SEARCH-ALSO-CAPABILITY` |
| `M3a` P3 redirect | the redirect target is re-guarded after the provider answers | `P3-REDIRECT-POSITION` |
| `M3b` P3 proxy | the face passes `process.env.HTTP_PROXY` as a third argument | `P3-PROXY-POSITION` |
| `M4` P4 | `search` gets its **own** observed guard (sequence restarts at 1) | `P4-SHARED-GUARD-BOTH-PATHS` |
| `M5` P5 | the two-source fork check is disabled (`:810`) | `P5-AMBIGUOUS-FAIL-CLOSED` |

`M1` is the one control that reds an arm outside its own property, and it is
**inevitable**: the deny lane's zero-call guarantee (P2) is the *same* line as the
allow lane's order guarantee (P1) — moving the provider above the guard both
removes the pre-provider fact and lets the deny lane fetch once. Declared here, as
the subprocess lane declared `M4`/`M6` and the FS lane declared `M12`. No other
control reds more than one arm, and no control reds an arm of a third property.

The baseline control (no edit) is green: `PASS baseline: red=[] expected=[]`.
`M2` is the control that proves the P2 wording discipline is not decorative: the
product change is a **message** change, and the arm is the only thing that fails.

## 7. What evidence would be required before anyone may claim the Web face is network-confined

**This section is the subprocess face's §7 discipline applied to Web, unchanged in
substance.** Refusing to call is **not** evidence of network confinement: it is a
statement about our own admission code, made before the OS (or even a socket) was
asked. A claim would require all of the following **observable facts**, on the
tree being claimed:

1. **A capability row with a mechanism and recorded evidence**, not just a level:
   `network-destination: enforced`, a non-null `mechanism` (e.g. `netns` + seccomp
   + no inherited sockets), and an `evidence://` row bound to the realm id and
   trust root, with the ABI/coverage listed (TCP **and** UDP, IPv6, raw sockets,
   AF_UNIX, inherited FDs, out-of-band routes). This host's row carries
   `mechanism: null` / `evidence: null` — a capability statement, not a
   measurement.
2. **A real fetch attempt that would otherwise reach the network and fails inside
   the deny lane**, with the failure being a kernel/transport denial (not a tool
   error and not our refusal): e.g. a booted Member's `web_fetch` against a
   listener the operator owns, under `network: deny`, with the provider's
   `enforced` row as the precondition.
3. **A positive control on the same invocation without the confinement** (same
   URL, no lane / no profile) that **succeeds** and is observed on the wire — so
   "it failed" cannot be the URL's own fault.
4. **An out-of-band observation of the transport itself** (a packet/socket
   counter, a listener that records zero accepted connections, a DNS log) for the
   deny-lane fetch, plus the same observation showing traffic for the control.
   "Zero transport entries" in a probe result is exactly what must **not** be used
   as this observation unless the probe says it measured syscalls/transport.
5. **A second consumer path** (the live Host preset with the row's `web` face and
   a real provider) showing the same deny lane on the model-visible
   `web_fetch`/`web_search`, because the host-free face is not the product's live
   wiring.

Until 1–5 exist, the strongest honest statement is the one this document makes:
*on this host, a `network: deny` web lane refuses at the admission layer with zero
provider calls, because the backend's own probe reports `network-destination:
unsupported`; no socket was ever created and the OS was never asked to deny
anything. On an `allow` lane the call is ordinary host egress — redirects and
proxy selection happen unmediated downstream (P3).*

## 8. Matrix pointers (no grade, no `V@B` change)

`docs/plans/active/alpha5-sandbox-first/TOOL-ACCEPTANCE-MATRIX.md`:

- §1.1.1 gains a Web-face layer-B paragraph pointing at this directory for the
  five properties, and the `M-14`/`M-15` note is corrected: the stale "live 因行
  不转发 `web` face 而不可达（T-04）" no longer holds — `#608` forwards and
  configures the face, so live is now **not run**, not **unreachable**.
- `M-14`/`M-15` remain `B` and `V@B=no`: these arms are host-free only, and the
  matrix records the `GAP-WEB-CONTRACT-1` pointer.

No grade moved, no `V@B` changed, no candidate claim.

## 9. Gates measured this round

| gate | command | result |
| --- | --- | --- |
| new suite | `node --test tests/world-factory/a5sf-web-contract.test.mjs` | **10/10 pass** (`suite.log`) |
| all a5sf world-factory suites | `node --test tests/world-factory/a5sf-*.test.mjs` | **385 tests, 385 pass, 0 fail** (`a5sf-suites.log`) |
| targeted vitest | `pnpm exec vitest run packages/runtime/test/{a5p4-network-closure,a5p4-realm-evidence,a5sf-service-install,a5sf-provider-composition,a5sf-member-policy}.test.ts` | **5 files / 58 tests pass** (`vitest.log`) |
| typecheck | `pnpm -r typecheck` | **rc 0**, 0 `error TS` (`typecheck.log`) |
| mutations | `node dev/agent-workflow/evidence/a5sf-web-face/mutations.mjs` | **MUTATION-CONTROLS-PASS** (`mutations.log`) |
| RED baseline | same suite at `8b1615121` (pre-BL-18) | **10 fail / 0 pass** (`red-first-run.log`) |
| host refusal (state 1) | `A5SF_WEB_CONTRACT_HOST_ROOT=/tmp/a5sf-web-contract-host-absent node --test …` | one `A5SF-WEB-CONTRACT-HOST-REFUSED` line, **10 skipped / pass 0** (`host-refusal-simulation.log`) |
| `git diff --check` | `git diff --check` | **rc 0** |

`tests/world-factory/a5sf-*.test.mjs` needs the gitignored pinned checkout at
`tests/deepseek-harness-test-use` (and, because `a5sf-tool-axis.test.mjs` reads a
worktree-relative path, a symlink to it inside the task worktree). The count above
is the real count on this host with that checkout present; `375` was the count
before this branch added ten.

## 10. Host precondition (the three states)

`tests/world-factory/a5sf-web-contract.test.mjs` loads two **built** pinned entries:

```
packages/web/web/lib/index.js        (the host WebRuntime, for the seam loader)
packages/web/tool-web/lib/index.js   (the real native web_fetch/web_search row)
```

1. **host absent or incomplete** → one machine-readable
   `A5SF-WEB-CONTRACT-HOST-REFUSED …` line and every case registered as
   **SKIPPED** (counted as not-run, `pass 0`), never as pass. Measured in
   `host-refusal-simulation.log`. `A5SF_WEB_CONTRACT_HOST_ROOT` exists only to
   exercise state 1 without moving the checkout.
2. **host present but an entry missing** → `A5SF-WEB-CONTRACT-HOST-INCOMPLETE`
   when `A5SF_REQUIRE_PINNED_HOST=1`: a partial/older checkout is a pin violation,
   not an absence.
3. **host present and complete** → every arm runs.

No environment variable lets **product** code take a different path: one flag
points the **test** at a candidate checkout (so states 1/2 are measurable without
moving the pin), and `A5SF_REQUIRE_PINNED_HOST=1` turns the refusal into a hard
failure for a lane that is supposed to provision the host.

## 11. Census / boundaries of this branch

- **`.mjs` only.** Added `tests/world-factory/a5sf-web-contract.test.mjs`,
  `tests/world-factory/lib/a5sf-web-contract-world.mjs`, and the evidence
  `mutations.mjs`; no scannable `.ts` was added, so no
  `packages/testkit/test/p4t6-bookings/` entry is required.
- **No new production consumer** of the confined-provider lane was added, so no
  `a5p4` named-mount ledger entry is required.
- **No `packages/**` change** on this branch. The mutation runner touched
  `web.ts` and `a5sf-realm-row.mjs` only inside its own process, restored them
  byte-for-byte (sha256 re-asserted) and asserted `packages/` is clean.
- **One test-lib signature gained an optional parameter**
  (`makeGovernedRealm({ boundary })` in `lib/a5sf-web-arms.mjs`); omitting it is
  byte-identical behaviour, and the 12 existing BL-18 arms still pass unchanged.
- **0 Host boots**, **0 egress**, **0 listeners**. No port, no `DSH_HOME`, no
  `tests/homes/**`, no real network call of any kind.
