# BL-18 pre-start readiness — **NO-GO** (host-free proof; zero boots)

**Status: the BL-18 deny lane CAN assemble on the `teamA5sfRealm` seam (proven
host-free), but the last P2-04 start cannot be certified by the shared preflight:
the only case the lane can observe is an admission refusal, and the preflight's
network-case rule refuses exactly that observable. No grade, no `V@B`, no product
change, no boot.**

- Branch: `task/a5sf-bl18-ready-20261108`, cut from `origin/master` =
  `63a745c65efda441da29f5fe0397851ad9614e89`. Two commits: the proof/rows/scripts
  commit `34c9e0ef010b7a14b754740b1b26de7e4b808cd5` — **the commit the bundles bind
  as `candidate.head` / `grant.boundCommit` / `runRecord.teamSha`** — and this
  evidence commit (bundles, payloads, this README) on top of it. Everything is
  evidence-side: no product file, no test file, no plan/matrix row changed.
- Boots spent: **0**. No port, no `DSH_HOME`, no pristine-checkout write, no
  `harness.boot(`. `:3080` and its home were never touched.
- P2-04 allocation: 4 of 5 spent; **1 remains**. This lane asks for none of it.
- Pristine host used **read-only** for the real `tool-web` import and the
  preflight's `--host-root`: a sibling worktree's
  `tests/deepseek-harness-test-use` at `639ed015397290b3745d163aafe02ffee4aa3f84`,
  porcelain clean (the tree is gitignored, so this worktree cannot contain it and
  was not rebuilt here — §8).

---

## 1. The prediction, graded

The previous lane (`evidence/a5sf-surface/README.md` §6) predicted:

> *the BL-18 deny lane would be declared on the product config path, which
> `product-assembly.ts` deliberately refuses for a narrowing `network: deny`,
> producing `NETWORK_UNCONFINED_REALM` at composition before any probe … It must
> ride the optional `teamA5sfRealm` seam row (`compiledFor()` with
> `provider.fetch/search`) … and the leader cannot be the web caller because
> `web_fetch` is known-sensitive-unmanaged and is now correctly denied for
> coverage.*

**Verdict: PARTLY RIGHT — right about the disease, wrong about the cure being
sufficient.**

| claim | verdict | evidence |
| --- | --- | --- |
| the product config path refuses a narrowing `network: deny` at COMPOSITION with `NETWORK_UNCONFINED_REALM`, before any probe | **RIGHT** | `assembly-proof.mjs` A1/A2; `product-assembly.ts:869` (ceiling) and `:551` (ToolBinding). Both throw before any scope or face exists. |
| that refusal would kill the whole run and measure nothing | **RIGHT** | it is a `TeamServiceInstallError` at config parse — the realm never mounts, so no case can run. |
| the deny lane must ride the optional `teamA5sfRealm` seam (`compiledFor()` + `provider.fetch/search`) | **RIGHT** | B: the shipped row mounts the realm and the face; the fetch refuses AT THE FACE, one fact, zero provider entries. |
| the leader cannot be the web caller | **RIGHT** | D: `web_fetch`/`web_search` are `KNOWN_SENSITIVE_UNMANAGED` (`permission-coverage.ts:146-168`), so a strict leader must deny them; and no realm mounts for the root session anyway (`agent-bindings.mjs:2598`). |
| riding the seam is *sufficient* to make the run measurable | **WRONG — incomplete** | (i) the seam alone does not surface `web_fetch`: route-C **refuses to ADD** a name, so the preset must already carry the pair (C2, `a5sf-realm-row.mjs:1050`); (ii) a STRICT caller Member cannot carry the pair at all (D); (iii) even with both fixed, the preflight still refuses to certify the admission-refusal case (`POLICY_NETWORK_PROBE_NOT_ENFORCED`, §6). |

The prediction named the right first abort. Copied verbatim, it would have
avoided that abort and died **one step later**, at the first Member create —
`A5SF_NATIVE_ASSEMBLY … would CHANGE the Member's model-visible tool surface
(added: ["web_search","web_fetch"])`.

---

## 2. The assembly proof (`assembly-proof.mjs`, green, zero boots)

`node dev/agent-workflow/evidence/a5sf-bl18-live/assembly-proof.mjs` →
`assembly-proof.log` (stdout) + `assembly-proof.json` (structured). It builds
in-process Cordis roots and calls the **shipped** seams: the realm row
(`mountMemberA5sfRealm` / `attachA5sfNativeToolModules`), the one compiler
(`compileEffectiveIo`), the one product assembler, the one coverage classifier,
and the **real pinned** `@deepseek-ai/dsh-tool-web` module (read-only import,
the same module `a5sf-web-row.test.mjs` mounts).

### 2a. The row mounts, the axis is `deny`, the refusal is AT THE FACE

```
B1 row mounted, faces = {"fs":"confined","web":"mounted","subprocess":null}
B2 compiled network axis = deny (compileEffectiveIo output)
B3 face.fetch refused: NETWORK_UNCONFINED_REALM / provider fetches=0 dns=0 connects=0
B4 one guard fact: method=web:fetch decision=deny decidedBy=NETWORK_UNCONFINED_REALM
B5 face.search refused: NETWORK_UNCONFINED_REALM / provider searches=0
```

The fetch is made through `realm.installation.members[0].faces.web.fetch(...)` —
the mounted face object, not a bespoke harness — and the refusal is a
`TeamIoDenial` with the typed code. The inherited host `ctx.web` is a tripwire in
this composition and was never consulted (`HostWeb.calls = 0`).

### 2b. The real caller reaches the same face refusal

```
C1 route-C attached the real module; surface={web_fetch,web_search}
C2 web_fetch through ToolRuntime → isError=true; provider fetches=0;
   fact decidedBy=NETWORK_UNCONFINED_REALM
```

The module is attached with the row's **own** `attachA5sfNativeToolModules` and
the call is dispatched through the **real** `ToolRuntime.execute` — the same
route a model tool call takes.

### 2c. The two refusal positions, and the code path that distinguishes them

Both use the same typed word; only the *position* differs. The distinguishing
code is:

| position | code | what it means |
| --- | --- | --- |
| **composition** (kills the run) | `product-assembly.ts:865-873` — `parseProductRealmDeclaration` reads `networkLane['mode'] !== 'allow'` and throws `NETWORK_UNCONFINED_REALM` **before any scope exists**. The ToolBinding sibling is `:548-558`. | a *narrowed lane with no enforcing face* is refused at config parse. |
| **composition** (kills the member, not the run) | `mount.ts:1472` (eager `web` inject) and `mount.ts:1650` (deferred `ctx.inject(['web'])`): a native module that consumes `web` on a realm whose `faces.web === null` is refused — the check reads the realm's **total** `faces` answer (`mount.ts:1526`), never `ctx.get('web')`. | the module must not fall back to the inherited host transport. |
| **face** (does NOT kill composition) | `web.ts:148` `createWebNetworkGuard` + `:160` `throw new TeamIoDenial('NETWORK_UNCONFINED_REALM', …)`, called from `ConfinedWeb.fetch` at `web.ts:209-213` **before** `provider.fetch`. | the realm mounted, the lane is deny, the backend's own probe reports `unsupported`, and the call is refused *at the call*. |

The line that separates "mounted and measurable" from "composition refused" is
the `faces` answer: with `web` declared and mountable, `mount.ts` admits and
`web.ts` owns the decision; with `web` absent/unmountable, `mount.ts` refuses the
whole mount (`mount.ts:1472`) or the row refuses the declared face
(`a5sf-realm-row.mjs:619`). **B proves the first branch is reachable; A proves the
second is not the same code path**, even though the token is identical.

---

## 3. The caller: who can reach the web face

`assembly-proof.mjs` D applies A2C-2's own classifier
(`permission-coverage.ts:294-341`, the same predicate the live gate throws with),
and the product source supplies the wiring rules.

| candidate caller | can it call the confined web face? | why |
| --- | --- | --- |
| **leader** (strict, `capabilities.permissions` declared) | **NO** | `web_fetch`/`web_search` are `KNOWN_SENSITIVE_UNMANAGED` (`permission-coverage.ts:146-168`, classifier `:294`). Not denied ⇒ `team.create` dies (that is boot #4). Denied ⇒ the tool is masked and cannot be called. And no realm mounts for the root session (`agent-bindings.mjs:2598`, `sessionId !== teamRoot`), so even a non-strict leader's `web_fetch` is the **inherited host** tool — real egress, zero guard facts. |
| **Member, strict** (`capabilities.permissions`) | **NO** | surface `web_fetch` ⇒ A2C-2 fatal; deny it ⇒ the post-deny surface lacks the name ⇒ route-C's surface-neutrality check refuses to **ADD** it (`a5sf-realm-row.mjs:1050`) ⇒ the confined face never attaches ⇒ nothing to measure. Proven in C2. |
| **Member, legacy / non-strict** (template declares **no** `capabilities` block) | **YES — the only such composition** | `permissionPolicy = boundTemplate.capabilities?.permissions` (`agent-bindings.mjs:2472`) is `undefined`, so A2C-2 never runs for that Member, and `builtinToolDeny` is only applied in selective mode (`:2981`). The preset's `web_fetch` stays visible, route-C shadows it onto the confined face, and a model call reaches the typed refusal (C). The realm still mounts for that Member (`:2598`). |
| **composition probe tool** (e.g. BL-17's `bash_probe` shape, injecting `web`) | **NO** | it is a *new* model-visible name; route-C's `added` check refuses it exactly like C2 unless the preset already registers that same name. |
| **plane-owned `web_fetch`** (`teamToolPlane.webEnabled: true`) | not this face | it is coverage-clean (D3), but it is the **plane web family's own transport** (`packages/tools/families/web.mjs`), not the realm's confined face — measuring it would measure a different implementation. |

**So the answer to the question as posed:** in the blueprint the previous lane
described, **the leader cannot call it, and a strict Member cannot either** — the
only caller is a **legacy/non-strict Member whose preset already surfaces
`web_fetch`/`web_search`**. That is two declared blueprint/composition facts the
§8b recipe does not state:

1. `preset-a5sf-bl18-base` must include `@deepseek-ai/dsh-tool-web` (the host's
   own `standard` preset mounts it with `{ fetch: true }`, so this is a
   supported composition — but a smoke-shaped preset silently lacks it and the
   attach then refuses).
2. the caller Member template must omit `capabilities` (or at least
   `capabilities.permissions`). If the plan copies a strict Member, **nobody in
   the declared blueprint can measure the deny lane**.

Both are composition/blueprint facts, not product changes, and the bundle in §6
declares them.

---

## 4. The mock: marker-routed, not ordinal

`bl18-marker-mock.mjs` + `mock-routing.mjs` (green, host-free; `mock-routing.log`).
The rule: every scripted reply is keyed on a **marker carried in the turn's own
text** (`MK_BL18_DISC`, `MK_BL18_CREATE`, `MK_BL18_FETCH`, `MK_BL18_SEARCH`,
`MK_BL18_COLLECT`); an unmarked or repeated turn gets a harmless no-tool reply.

Exercised orders: `ORDINAL-SAFE`, `RETRY` (a duplicated discovery turn fires no
tool and does not consume the create script), `DISCOVERY-FIRST` (the order that
shifts an ordinal script — discovery is request #1 and is answered with no tool),
`DUPLICATE`, `INTERLEAVED`, and `PRECEDENCE` (a request carrying an item marker
wins over the create marker, so the driver must not quote item markers in the
leader prompt).

**What a boot would still have to show** (this file cannot): (a) the discovery
request carries `MK_BL18_DISC` exactly once **before** `team.create`; (b) the
created leader's first request carries `MK_BL18_CREATE`; (c) the Member's
delegate prompt carries the item marker; (d) `final-mock-requests.json` contains
those markers in that order. If any of (a)–(d) fails, the routing table was
right and the driver's marker placement was wrong.

---

## 5. What the run would measure — and what it would not

If it were spent, the run would measure, for the first time on a real Host:

- the `teamA5sfRealm` seam row answering `compiledFor()` for a **live** Member,
  and `host.ts`'s lazy accessor delivering it (the p2-wiring evidence could only
  prove the fixture ceiling host-free);
- a real `web_fetch` **on the model-facing surface** of a governed Member,
  shadowed by the confined face rather than the inherited host tool;
- one `a5sf-guard-consult/1` deny fact and **zero provider entries** for a model
  tool call in a booted world.

It would **not** measure:

- **OS-level network isolation.** Quote
  `evidence/a5sf-subprocess-face/README.md` §7 rather than re-deriving it:
  *"Refusing to spawn is **not** evidence of network isolation: it is a
  statement about our own admission code, made before the OS was asked."* The
  five observables §7 requires (a capability row with a non-null `mechanism`,
  a real child attempt denied by kernel/transport, a positive control, an
  **out-of-band** transport observation, and a second consumer path) are absent
  on this host: this host's network row carries `mechanism: null` and
  `evidence: null`, i.e. it is a capability statement.
- **A live allow lane.** The provider is a composition boundary; entering it is
  a counter, not egress. A real allow-lane fetch is a different case class.
- **Any grade or `V@B` movement.** M-14 stays `NOT_WIRED` / `V@B=no`.

---

## 6. The preflight bundle — and why the run is **NO-GO**

`make-bundles.mjs` emits two bundles from **one plan**, differing in exactly one
field, and the pair is the finding:

| file | `cases[].networkProbeEnforced` | verdict |
| --- | --- | --- |
| `preflight-bundle.json` (**the plan**) | `false` — what this host's provider probe reports (`network-destination: unsupported`) | **FAIL 16/17** `blocks=POLICY_NETWORK_PROBE_NOT_ENFORCED` (`preflight.log`) |
| `preflight-enforced-claim.bundle.json` (**negative control, NOT the plan**) | `true` | **PASS 17/17** (`preflight-enforced-claim.log`) |

Everything else passes in both: `assembly.usable` (with `--host-root`),
`identity.*` (5 checks), `native.module-config`, `policy.fifo`, `cases.isolation`,
`bundle.case-coverage`, `driver.gate-order`, `driver.leader-surface` (the
discovery-first deny list computed from the declared surface — `web_fetch`,
`web_search`, `u5_canary`, `u6fs_probe` are denied; the rest are managed/team),
`driver.log-capture` (unbounded body retention on every fail-capable step),
`collector.shape`, `wiring.candidate`, `wiring.grant`, `wiring.run-record`.

The single failing check, verbatim:

```
POLICY_NETWORK_PROBE_NOT_ENFORCED  case web-fetch-deny claims a network denial but
the backend probe is not declared enforced; on this host the call is REFUSED, so
"zero connects" is unmeasurable
```

That check is **right about what it grades**: it grades a *connection-denial*
plan (probe `enforced` ⇒ the call is admitted and the transport denies
downstream). BL-18's observable is a *pre-provider refusal* at the face. The
preflight's closed case vocabulary (`axis: read | write | network`) has no class
for it, so:

- **truthful bundle ⇒ FAIL**, and
- **PASS is reachable only by asserting `networkProbeEnforced: true`**, which the
  composition's own probe contradicts and which §7 forbids claiming.

This is not a defect I introduced: BL-17's own bundle hit the same wall and
**excluded the network-deny case from `cases` entirely**, hand-checking it in the
driver (`evidence/a5sf-bl17-live2/preflight-bundle.json:287`). Its `PASS 16/16`
therefore never certified the very case it was spent on. Copying that precedent
for BL-18 would produce a PASS over a plan that does not contain the deny lane —
the exact "the start would measure nothing" failure this lane exists to prevent.

## 7. GO / NO-GO

> ### **NO-GO.**
>
> The BL-18 deny lane **can assemble** on the `teamA5sfRealm` seam (proven), but
> it **cannot be preflight-certified**: the only case it can observe is a
> pre-provider admission refusal, and `policy.paths` refuses that observable —
> the truthful bundle is `FAIL 16/17` and the only `PASS 17/17` in existence is
> the same plan with `networkProbeEnforced: true`, an enforcement claim this
> host's own probe (`network-destination: unsupported`) and §7 both forbid.
> Spending the last P2-04 start on it would buy a live wiring datum, not a
> certified confinement measurement.

**What must change first, and whose call it is:**

1. **A fourth case class for admission-refusal observations** — e.g.
   `face: 'web'`, `axis: 'network'`, `observable: 'pre-provider-refusal'`,
   `collector: 'guard-fact'`, graded on (fact present, typed code, zero provider
   entries) instead of (connection denied), with `policy.paths` keeping its
   current rule untouched for connection-denial claims. This is repo tooling
   (`tests/world-factory/lib/a5sf-acceptance-preflight.mjs` + its test), **within
   the Integration Owner's authority**, no product change, no upstream patch —
   but it changes the instrument that gates every lane, so it needs its own
   review and must not weaken the existing `networkProbeEnforced` rule.
2. **Or an OS-level network-denial backend** so `probeNetworkDenial` can answer
   `enforced` with a non-null mechanism — then the existing network case becomes
   honest. That needs Infra/owner work (netns + the ABI/coverage list §7 names)
   and belongs to BL-29 / P4-03, not to this lane.
3. **The caller blueprint change** (needed under *either* option above): the
   caller Member must be legacy/non-strict and the preset must surface
   `web_fetch`/`web_search` (§3). Also within the Integration Owner's authority.

I did **not** spend the start, did not weaken a check, and did not ship a bundle
that asserts enforcement. The last start remains unspent and BL-18's live half
remains unproven.

---

## 8. Gates measured this round

| gate | command | result |
| --- | --- | --- |
| assembly proof | `node dev/agent-workflow/evidence/a5sf-bl18-live/assembly-proof.mjs` | **rc 0**, scenarios A/B/C/C2/D/E green (`assembly-proof.log`, `assembly-proof.json`) |
| mock routing | `node dev/agent-workflow/evidence/a5sf-bl18-live/mock-routing.mjs` | **rc 0**, 6 orders (`mock-routing.log`) |
| preflight (plan) | `node scripts/a5sf-preflight.mjs --bundle …/preflight-bundle.json --host-root <pristine>` | **FAIL 16/17**, `blocks=POLICY_NETWORK_PROBE_NOT_ENFORCED` (`preflight.log`) |
| preflight (control) | `--bundle …/preflight-enforced-claim.bundle.json` | **PASS 17/17** — the control, not the plan (`preflight-enforced-claim.log`) |
| doc-checks | `node scripts/doc-checks.mjs` | **rc 0** |
| whitespace | `git diff --check` | **rc 0** |

No `node --test` suite was run: this lane changes no product or test source. The
`.mjs` files are evidence-side composition/demonstration scripts.

## 9. Disclosures and limits

- The pristine host was **borrowed read-only** from a sibling worktree
  (`tests/deepseek-harness-test-use` @ `639ed01539…`, clean) because it is
  gitignored and this worktree never had one. Nothing was written to it; the
  preflight payload names the actual root in `inputs.hostRoot`.
- The compiled face's fixture identity is `team/web`, `rev-bl18-proof`,
  `inst-bl18-web` — composition fixtures, disclosed, not product policy. The
  lane decision is the one compiler's answer (`compileEffectiveIo`), never
  re-derived here.
- The **satisfied-`allow` control** (a fetch that reaches the provider exactly
  once) is exercised by the existing `a5sf-web-row.test.mjs` ROW-ALLOW arm; this
  proof deliberately adds no second harness for it.
- The `web` face's own probe is the composition's; the proof's boundary answers
  `unsupported` because that is what this host's providers answer. A boundary
  that answered `enforced` would **admit** the call by design — which is why the
  PASS control is a false claim, not a stronger proof.
- No existing evidence file was modified; nothing under `docs/plans/active/**`
  was touched; no matrix pointer was added.
