# PD-27 — CONFINED-WEB: can real web egress be attached to a governed Member's network face today?

**Lane**: `PD27-WEB-EGRESS` · branch `task/pd27-web-egress-20261114` · worktree `.worktrees/pd27-web-egress`
· base `origin/master` = `24d2cf760` (`PD26-CONFINED-SKILL`, merged in) · **two evidence classes**:
the **DEV-LIVE** booted pair (`runs/allow`, `runs/deny`, `archive/pair-prefix`; 2 agreeing boots per
arm, `recordClass=DEV-LIVE`, `teamSha=09268e58e`) and the **HOST-FREE** suite (real transport, real
sockets, real tool router, real guard facts, no boot) · `eligible = false`, **no `V@B`, no grade, no
Q7/Authority/CI change, `CORE PATCH BUDGET = 0`**.

**Question** (the owner's, verbatim in intent): the governed preset lost `web_fetch`/`web_search` at
PD-18 because the row ran on the **inherited base `web`** with zero `a5sf-guard-consult` facts. Can a
real transport be attached to a governed Member's network face **today**, so the pair comes back
governed rather than removed?

---

## 1. The answer, in one paragraph

**Yes for the allow lane, with two conditions the product does not meet on its own, and no for
anything finer than one boolean per Member.** The `web` face itself shipped in BL-18/PD-15
(`team-services/src/web.ts`: a guard reading the compiled `network.access`, then a required
capability probe, then an optional face-bound proof) and the pinned host transport
(`@deepseek-ai/dsh-web-fetch-http`) is a **public, injectable class** — so a composition **can** give
a realm a face that really connects. What was missing was never the transport: it was a way to put
the two **names** on a context whose `ctx.web` **is** that face. That is what this lane installs (a
route-C shadow, §3), and it is measured here end to end over a real socket (§5). The two conditions:
(1) the face and its transport are **supplied by the composition** — the shipped governed realm
answers `subprocess` + `terminal` only, and the product assembly refuses a narrowed network lane with
`NETWORK_UNCONFINED_REALM` before any realm exists; (2) the ceiling is **one boolean**.

**(1) stated exactly, because it is load-bearing:** *a `network: deny` Member is **not constructible
through the blueprint path*** — `product-assembly.ts` refuses `NETWORK_UNCONFINED_REALM` before a
realm exists — **so the deny arm only exists when a composition supplies a compiled answer. That
means the deny evidence demonstrates the mechanism, not a path a user can take today.**

**(2) stated exactly:** *`NetworkAccess` is one boolean.* Today "network confinement" means **one
bit**, decided **before the transport**, with **no per-host ACL** — so **a permitted Member may reach
any host its transport can resolve.** `member-io-policy/src/types.ts` says destination ACLs are a
future interface; nothing in this lane narrows that, and a ceiling of "no host outside the list" is
not expressible. That is the honest ceiling and it is a product gap, not a wording choice.

**Where the line sits**: `allow` → real egress, decided by the compiled lane, one allow fact; `deny` →
**pre-wire admission refusal** with a typed code and zero connections, not a kernel-level netns proof.

## 2. What was installed

| piece | file | why |
| --- | --- | --- |
| the shadow / name-holder | `packages/runtime/src/plugin/live/confined-web-tool.mjs` (new) | places `web_fetch`/`web_search` on a context; takes the realm's confined `web` **only** when the scope carries the confined marker, otherwise serves the host definitions over a **refusing** `web` view (typed `NETWORK_UNCONFINED_REALM`, zero provider entries) |
| the confined marker | `team-services/src/web.ts` (`A5SF_CONFINED_WEB_MARK` on `ConfinedWeb.prototype`), exported from `team-services/src/index.ts` | a `.mjs` shadow copied into the dist mirror cannot import a TS constant, so both sides resolve **one** registry symbol (`Symbol.for('a5sf.confined.web.face')`) |
| the route-C attach | `packages/runtime/src/plugin/live/a5sf-realm-row.mjs` (`confinedWebSpecOf`) | appends the web shadow to the realm's native re-mount **after** the capability deny lane, narrowing its registration to the visible subset and refusing to shadow when the composition already owns a web provider |
| the preset row | `cordis.patch.yml` (`tool-web` → `dsh-agent-team/web-tool`) | the preset scope keeps the **names** fail-closed; it must never carry the host `@deepseek-ai/dsh-tool-web` row, which is ordinary ungoverned egress whenever the realm owns no face |
| packaging | root `package.json` export `./web-tool` + `@deepseek-ai/dsh-tool-web` dependency, `packages/runtime/package.json`, `pnpm-lock.yaml`, `scripts/dist-placements/200-a5sf-pd27-confined-web.json` | the row resolves our module through the package's own export map; the dist mirror is placed by enumeration, not by hand |
| locator fix | `team-services/src/web.ts#declaredUrlOf` also reads the **singular** `query` the host tool sends | PD-15 recorded `<search:malformed-request>` as a residual; the audit fact now names the declared query |
| p4t6 booking | `packages/testkit/test/p4t6-bookings/pd27-confined-web.json` | one new `packages/**` file; measured `scanner counts 1449, ledger derives 983 + 465 = 1448` before booking, delta = `paths.length` |

## 3. Why a shadow and not the host row (the design decision, stated so it can be attacked)

The preset mounts its rows on the **registry generation scope above the agent**, so their `ctx.web`
is the inherited BASE provider (that is PD-17/PD-18's measured hole). Mounting the host `tool-web`
row there is exactly the regression PD-18 removed. So the preset carries **our** module, which is a
**name holder**: it delegates the tool **definitions** to the pinned host package's public `apply`
(so description/parameters/output/presenters/`timeoutMs` are the shipped ones *by construction* —
pinned field-for-field in `PD27-PARITY`), and contributes only a **context**. On the preset scope the
context is a refusing view; inside the Member's isolated scope, where the realm mounted the confined
face, the route-C attach re-mounts the same module and `ctx.web` **is** the face.

**Structural note (so a later reader does not mistake this for the pattern the external audit
objected to):** this module is a **mounting adapter**, not a fork. It imports the pinned host
package's **own** `apply` and lets it register the definitions, so the description, the parameter
schema, the output schema, the presenters and the timeout are the host's bytes — `PD27-PARITY`
compares them field-for-field against the host package's own definitions. What this file adds is a
**context** (which `web` service the definitions see). The `confined-*-tool.mjs` pattern the audit
objected to **reimplemented** a tool's behaviour and could drift from the host; this one cannot drift
on the definition surface, and its only behavioural claim is the refusal path
(`PD27-REFUSE`/`PD27-E2E-DENY`), which is measured.

Surface neutrality is unchanged from PD-26: `attachA5sfNativeToolModules` refuses to add or remove a
name, and the shadow registers only the subset already visible (a scoped registration sits **outside**
the inherited `tools.restrict` filter, so placing a denied name would silently re-enable it).

## 4. PIN — the before/after is measured, not narrated

`A5SF_PD27_PIN=1` reads the branch point out of git (`git show 24d2cf760:cordis.patch.yml`): the
preset declares **no** `tool-web` row, and a **real** `ToolRuntime` answers the host router's typed
`unknown tool "web_fetch"` / `unknown tool "web_search"` — the same file also asserts the shipped
composition **does** declare the row, so the pin compares two real states.

## 5. The measured arms (numbers written by the suite itself)

`node --test tests/world-factory/a5sf-pd27-confined-web.test.mjs` — 9 arms + `PD27-PIN`, all green;
the allow/deny/redirect arms append their own numbers to `host-free-runs.jsonl`:

| arm | transport | result | connections | facts |
| --- | --- | --- | --- | --- |
| `PD27-E2E-ALLOW` | pinned `HttpFetchProvider`, real socket | HTTP 200, body verbatim (`bodyBytes=25`, `renderedBytes=134`), source host `127.0.0.1` | **1** (`GET /known`) | **1 allow** (`web:fetch`, locator = the declared URL) |
| `PD27-E2E-DENY` | the **same** provider, present and reachable | typed `NETWORK_UNCONFINED_REALM`; the provider is never entered (probe `network-destination='unsupported'`) | **0**, `serverRequests=[]` | **1 deny** (`decidedBy=NETWORK_UNCONFINED_REALM`) |
| `PD27-E2E-REDIRECT` | allow lane, 302 to another origin | `WEB_REDIRECT_BLOCKED` | declared origin **1**, target **0** | 1 allow |
| `PD27-E2E-SEARCH` | allow lane | host search shape | — | 1 allow, locator `query:pd27 locator query` (not the malformed marker) |
| `PD27-DISPATCH` | real `ToolRuntime` | the name **dispatches** (not `unknown tool`) and returns the host presentation (`HTTP 200` + untrusted-content banner) | 1 | 1 allow |
| `PD27-REFUSE` | a base provider that **would** answer | typed `NETWORK_UNCONFINED_REALM` with `error.code` | provider entries **0** | 0 |

Two disclosures on the fixtures: the local servers are the effect witness (the provider's own
documented `resolveAddresses` seam answers `127.0.0.1`, because the shipped resolver refuses
non-public destinations — the socket, request, parse and redirect policy are the shipped ones), and
the "already visible subset" is the surface the arms pass in.

## 5b. THE BOOTED PAIR (DEV-LIVE) — a real Host, a real delegated Member turn, a real socket

One command per arm, `--boots 2` (the agreeing pair), slot-leased through `dev-live-slots.mjs`, port
3180-family, `DSH_HOME` under `tests/homes/`, pinned host tree read-only (porcelain empty before and
after, recorded in `host-tree-porcelain-<arm>.txt`). The driver is
`tests/world-factory/drivers/a5sf-pd27-web-egress/run-boot.mjs` — the PD-26 driver's shape, so a
reader can diff them — and it starts a **local HTTP server in-process** (`127.0.0.1`, ephemeral port,
its **own** `connection` counter) serving `A5SF_PD27_KNOWN_BODY_BYTES` on `/known` **and** on
`/denied`, so a deny arm that reached the transport would **succeed** and be caught by the counter
rather than by a 404.

| arm | boots | surface | result | server connections | guard facts | inherited host `web` |
| --- | --- | --- | --- | --- | --- | --- |
| `allow` (`runs/allow`) | 2/2 **PASS**, agreeing | 33 tools, **incl. `web_fetch` + `web_search`** | the Member received the body **verbatim** + the host's `HTTP 200` presentation | **1** (`pathHits={"/known":1}`) | **1 allow** (`web:fetch`, locator = the declared URL) | **0 calls** |
| `deny` (`runs/deny`) | 2/2 **PASS**, agreeing | 33 tools, same surface | typed `NETWORK_UNCONFINED_REALM` **before the provider** | **0** (`pathHits={}`) | **1 deny** (`decidedBy=NETWORK_UNCONFINED_REALM`) | **0 calls** |
| `prefix` (`archive/pair-prefix`) | 2/2 **PASS**, agreeing | 31 tools, **no** network pair | host router's typed `unknown tool "web_fetch"` | **0** | **0** | **0 calls** |

The three arms are the same driver, the same mock model, the same blueprint shape and the same local
server; only `--arm` changes, and `--arm prefix` boots the **archived** `24d2cf760` composition
(`archive/pre-fix/cordis.patch.yml`, `A5SF_PD27_COMPOSITION=…`) so "before" is measured on the same
Host. Every boot writes `run-record.json` (`recordClass=DEV-LIVE`, `bindings.teamSha=09268e58e`,
`candidateClaimEligibility.eligible=false`), `member-transcript.{json,txt}`,
`member-probes.json`, `member-surface.json`, `guard-facts.json`, `server.json`,
`host-web-calls.json`, `counters.json`, `summary.txt`, `teardown.json`.

**One composition adaptation, disclosed and recorded** (`preset-effective.json` in every boot): the
shipped preset names its network row `dsh-agent-team/web-tool`, a subpath export of **this
repository's root package**. A real install has that package in the profile's `node_modules` (that is
how the shipped root row `dsh-agent-team/host` resolves); the pinned test tree does not — its
`node_modules` carries `@deepseek-ai/*` only. So, exactly as the driver already rewrites the host row
to a file URL, it points the **same module** at its file URL inside the preset. Nothing is swapped:
the module, its config and its row id are the shipped ones, and the rewrite is written into the boot's
evidence. (In the pre-fix arm there is no such row at all — that absence is the defect.)

The local server overlaps nothing: `server.json` is the server's own accounting, `guard-facts.json` is
the product's, and `host-web-calls.json` is a read-only tripwire wrapped around the **inherited** host
`web` service's prototype — it forwards every call unchanged and recorded **zero** in all six boots.

## 6. Mutation controls (a suite that cannot go red is not evidence)

`node tests/world-factory/a5sf-pd27-mutation-controls.mjs` → **VERDICT PASS (8/8)**, log in
`mutation-controls.log`, artefacts under `archive/`:

| control | mutation | reddens | stays green |
| --- | --- | --- | --- |
| M1 | shadow takes whatever `ctx.web` it is handed (marker check removed — the PD-18 shape) | `PD27-REFUSE` (the base provider is **entered** and returns its body) | every E2E arm (they mount the real face) |
| M2 | the pre-fix composition (`24d2cf760`) | `PD27-SURFACE` only | `PD27-PIN` (it reads the shipped file by path) |
| M3 | **swap the decision for a direct connect**: after a typed refusal the same request is retried against the real transport | `PD27-E2E-DENY` **on the server's own connection counter** | `PD27-E2E-ALLOW` |

M3 is the arm that matters for the deny claim: if it measured a message instead of egress it would
stay green.

## 7a. Where the live pair still stops, and that is the answer too

The allow arm's transport is the pinned host `HttpFetchProvider` **mounted by the composition**, and
the deny arm's compiled answer is likewise the composition's. That is the mechanism, not the product
path: **a `network: deny` Member is not constructible through the blueprint path** — `product-assembly.ts`
refuses `NETWORK_UNCONFINED_REALM` before a realm exists. And the ceiling is **one boolean**: a
permitted Member may reach **any host its transport can resolve**, with no per-host ACL. Both
statements are the point of this lane, not footnotes to it.

## 7. What is NOT measured, stated plainly

Measured now (was the gap in the previous draft of this file): the booted two-arm pair — allow,
deny and the recorded pre-fix composition — 2 agreeing boots each, §5b.

Still **not** measured, and not claimed:

1. **A kernel-level network proof.** `deny` refuses at admission: the real transport's capability
   probe answers `network-destination='unsupported'`, so `deny` **cannot be admitted at all today**.
   What is proven is that the call is refused before any provider entry and that the server's own
   counter stays at zero — not that a hostile socket could not be opened by other code in the process.
2. **Per-host ceilings.** The axis is boolean (`NetworkAccess = 'allow' | 'deny'`); "no host outside
   the list" is not expressible, and a permitted Member can reach any host its transport can resolve.
3. **A user-reachable deny path.** See §1 disclosure (1): the deny arm exists only because a
   composition supplied the compiled answer.
4. **`web_search`'s real search backend.** This lane proves the **name**, the **dispatch**, the
   governed **fact** and the deny/allow decision — **not** that a real search index or upstream
   backend answers. `web_search`'s search provider is out of scope here and is being picked up as
   separate work; surface + dispatch must not be read as search capability.
5. **Destination auditing of a provider answer** that names a host the request did not (only the
   **declared** locator is audited; `web_search` audits the declared query, not the returned links).

## 8. Reproduce

```bash
# THE BOOTED PAIR (each arm: 2 agreeing boots, slot-leased, 3180-family)
node tests/world-factory/drivers/a5sf-pd27-web-egress/run-boot.mjs              # allow
node tests/world-factory/drivers/a5sf-pd27-web-egress/run-boot.mjs --arm deny   # deny
A5SF_PD27_COMPOSITION=$PWD/dev/agent-workflow/evidence/a5sf-pd27-web-egress/archive/pre-fix/cordis.patch.yml \
  node tests/world-factory/drivers/a5sf-pd27-web-egress/run-boot.mjs --arm prefix
node tests/world-factory/drivers/a5sf-pd27-web-egress/run-boot.mjs --plan       # host-free preflight, zero boots

node --test tests/world-factory/a5sf-pd27-confined-web.test.mjs
A5SF_PD27_PIN=1 node --test tests/world-factory/a5sf-pd27-confined-web.test.mjs
node tests/world-factory/a5sf-pd27-mutation-controls.mjs
A5SF_PD27_EVIDENCE=$PWD/dev/agent-workflow/evidence/a5sf-pd27-web-egress \
  node --test tests/world-factory/a5sf-pd27-confined-web.test.mjs     # rewrites host-free-runs.jsonl
npx vitest run packages/testkit/test/p4t6-session-event-scan.test.ts  # booking tie
node --test tests/world-factory/a5sf-debt-register.test.mjs
```

## 9. Gate receipts (this commit)

| gate | result |
| --- | --- |
| `pnpm -r typecheck` | PASS (9 packages) |
| `eslint` on every touched file | PASS (0 errors; the two test files are outside eslint's scope by the repo's own ignore pattern) |
| `check:install-manifest` | **8** issues, and they are the 8 pre-existing computed-URL sites (two in `a5sf-realm-row.mjs`, six in `packages/tools/web-family`). Base `origin/master` reports **10**: those 8 **plus two undeclared bare imports** — `@deepseek-ai/dsh-tool-fs` (PD-17's `confined-fs-tool.mjs`, which that lane declared in `packages/runtime` but never at the root) and this lane's `@deepseek-ai/dsh-tool-web`. Both are now root **dependencies**; the audited DSH-peer contract stays at its **ten** names (see the booking note in `plugin-dsh-compat.test.ts`, and §9a) |
| `check:artifacts:head` | **PASS** with an explicit writable store: `node scripts/check-artifacts-at-head.mjs --store-dir $PWD/.pnpm-store` → `verdict=ok … drift=0`, "HEAD carries its own build" (1981 compared files). Without `--store-dir` it is **NOT-RUN** in this sandbox, and a refusal is not a "fresh" verdict (log line below) |
| `check:artifacts:committed` | **PASS**: `verdict=ok compared=1981 glue=110` — the working tree equals the git index on both install surfaces |
| p4t6 session-event scan | **20/20** with the booking (`scanner counts 1449`, ledger `983 + 465 + 1`) |
| debt register | PASS once the evidence file exists (this file) |
| `eb3-evidence-guard` | **PASS** (`findings=0`; 157 added evidence files, none over the 1 MiB bound) |
| `eb3-run-manifest` | **PASS** (`records=281`, 8 of them this lane's `DEV-LIVE` records) |
| `plugin-dsh-compat` (peer census) | **13 passed** — the frozen ten unchanged, see §9a |

Without `--store-dir`, `check:artifacts:head` refuses to run here — a sandbox limitation, **not** a
green verdict:

```
[check-artifacts-at-head] NOT-RUN: the only discoverable pnpm store ... is not writable, so the
scratch cannot be installed. Pass --store-dir <writable path>; a refusal is not a verdict of "fresh".
```


### 9a. Booking the peer census (the `ci-census` red, and why the ten stayed ten)

`packages/testkit/test/plugin-dsh-compat.test.ts` failed on its frozen `EXPECTED_HOST_PEERS` literal
with **4 failed / 9 passed**. The extra peer was **mine and wrong**: the PD-27 commit put
`@deepseek-ai/dsh-tool-fs` into the root manifest's `peerDependencies` to clear
`check:install-manifest`, which is the wrong instrument — a peer *is* the audited host-provides
contract, and widening it to silence a packaging gate is exactly the silent absorption that literal
exists to prevent. Audited and rejected: the set stays **ten**. The missing declaration is real
(PD-17's `confined-fs-tool.mjs` imports the host package and only ever declared it in
`packages/runtime`), so it now rides the **dependency** lane — the same shape `@deepseek-ai/dsh-skill`,
`@deepseek-ai/dsh-tools` and this lane's `@deepseek-ai/dsh-tool-web` use — and the same edit books
`@deepseek-ai/dsh-tool-web`. The whole file is **13 passed** again; `check:install-manifest` goes
**10 → 8** (the two sites in `a5sf-realm-row.mjs` and six in `packages/tools/web-family`, all
pre-existing), i.e. this lane *pays down* an inherited gate failure instead of absorbing it.

**No re-boot was needed for this change, and none was run for it**: it is a manifest declaration (who
provides `@deepseek-ai/dsh-tool-fs`/`-web`), not a composition row, a provider or a guard — the
allow/deny decision path, the guard facts and the member surface are untouched. (The committed
`runs/allow` pair *is* a re-measurement — the allow arm re-ran once while the agreement table was
being regenerated, during the earlier commit. It reproduced the pair exactly: the counters projection
is identical, only the timestamps differ; the previous pair is kept under
`archive/allow-2026-11-08T10-18-59-515Z/` and is bound to the earlier `teamSha` `09268e58e`, the new
one to `3d4ab1cbc`. Both are agreeing pairs, and both bindings are verified in a plain clone.)


With the writable store the scratch installs and the build is verified (`verdict=ok`, `drift=0`), so
the committed dist surface **is** a fresh build of itself.
