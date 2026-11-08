# PD-27 — CONFINED-WEB: can real web egress be attached to a governed Member's network face today?

**Lane**: `PD27-WEB-EGRESS` · branch `task/pd27-web-egress-20261114` · worktree `.worktrees/pd27-web-egress`
· base `origin/master` = `24d2cf760` (`PD26-CONFINED-SKILL`, merged in) · record class **HOST-FREE**
(no boot, no port, no `DSH_HOME`; real transport, real sockets, real tool router, real guard facts)
· `eligible = false`, **no `V@B`, no grade, no Q7/Authority/CI change, `CORE PATCH BUDGET = 0`**.

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
`NETWORK_UNCONFINED_REALM` before any realm exists, so the deny arm is only reachable through a
composition-supplied compiled answer; (2) the ceiling is **one boolean** (`NetworkAccess =
'allow' | 'deny'`; `member-io-policy/src/types.ts` says destination ACLs are a future interface), so
"no host outside the ceiling" is not expressible today and is not claimed.

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

## 7. What is NOT measured here, stated plainly

**The booted two-arm pair is not run in this window, and nothing here claims it.** No `DEV-LIVE`
record exists for PD-27. What that step must show, and the design it must use:

1. `--boots 2`, slot-leased (`dev-live-slots.mjs`), 3180-family ports, `DSH_HOME` under `tests/homes/`,
   pinned host tree read-only, `bindings.teamSha` = a commit on this branch;
2. **pre-fix arm**: boot the archived `24d2cf760` composition, one delegated governed Member turn, both
   names typed `unknown tool`, zero facts — the live form of §4's PIN;
3. **post-fix allow arm**: one delegated turn on the shipped opt-in preset with a composition-supplied
   face + the real transport; record the body **byte count** and the **source host**, plus exactly one
   allow fact;
4. **post-fix deny arm**: the same world with a `network: deny` compiled answer; record **zero
   connections** from the transport's own counter (the counter must be proven live by the allow arm in
   the same boot), one typed deny fact, and the `unknown tool`-free surface.

The reason it is not there is budget, not a blocker: the host-free chain covers definitions, dispatch,
the real transport, both lanes, the redirect policy and the mutation controls, but a real Member turn
additionally exercises the agent scope, the delegation path and the mock model script — machinery that
the PD-26 driver (`tests/world-factory/drivers/a5sf-pd26-confined-skill/run-boot.mjs`) already carries
and that would be adapted by swapping its two case families for the two arms above.

Also **not** measured, and not claimed: per-host ceilings (the axis is boolean), a kernel-level
network proof (`deny` refuses at admission; `probe()` answers `unsupported` for the real transport, so
`deny` cannot be admitted at all today), and destination auditing of a provider answer that names a
host the request did not (only the **declared** locator is audited).

## 8. Reproduce

```bash
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
| `check:install-manifest` | 8 issues, **the same 8 the base tree reports** (pinned-dist `new URL()` sites); the lane's own new import is a declared dependency |
| `check:artifacts:head` | **PASS** with an explicit writable store: `node scripts/check-artifacts-at-head.mjs --store-dir $PWD/.pnpm-store` → `verdict=ok … drift=0`, "HEAD carries its own build" (1981 compared files). Without `--store-dir` it is **NOT-RUN** in this sandbox, and a refusal is not a "fresh" verdict (log line below) |
| `check:artifacts:committed` | **PASS**: `verdict=ok compared=1981 glue=110` — the working tree equals the git index on both install surfaces |
| p4t6 session-event scan | **20/20** with the booking (`scanner counts 1449`, ledger `983 + 465 + 1`) |
| debt register | PASS once the evidence file exists (this file) |

Without `--store-dir`, `check:artifacts:head` refuses to run here — a sandbox limitation, **not** a
green verdict:

```
[check-artifacts-at-head] NOT-RUN: the only discoverable pnpm store ... is not writable, so the
scratch cannot be installed. Pass --store-dir <writable path>; a refusal is not a verdict of "fresh".
```

With the writable store the scratch installs and the build is verified (`verdict=ok`, `drift=0`), so
the committed dist surface **is** a fresh build of itself.
