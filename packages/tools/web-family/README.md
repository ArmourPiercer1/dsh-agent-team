# web-family — the governed NETWORK family (dsh.web-family)

Owner role: **U7-f web lane (first network-effect family)**. `web_fetch`
and `web_search` mount ONLY through the u7-w0b FamilyAssembly seam —
reviewed descriptor `packages/tools/families/web.mjs` + its sha256 entry
in `packages/tools/families/manifest.json` — with **ZERO diff to any
product center file** (`team-tool-plane.mjs`, `family-assembly.mjs`, the
binder untouched). The family is OPT-IN: the closed boolean
`planeCfg.webEnabled` (default FALSE; absent = FALSE = every existing
mount byte-identical, proven by C1 arms W-2/W-3; a non-boolean value
refuses the mount, W-4).

**DECISION-3 limit, restated**: the host sandbox claims FILE effects only
(bwrap without `--unshare-net`, partial Landlock — see
DECISION-3-ANSWER.md). Network confinement is NOT sandbox-claimable; what
this family enforces is the ADMISSION PLANE: provider-enforced upstream
(search provider is operator-supplied, never invented) + Team-enforced
admission (kernel plan/PA, declared == requested per call) + family law
(one bounded transport port: https-only default, no userinfo, redirects
stay inside the approved origin, bounded hops/bytes/timeout, typed
refusals, a refused call performs ZERO network effect).

**Review round 1 laws (REVIEW-403; RED-first arms D-*/S-10..S-12 in C1)**:

- **Non-public-destination law (H-1)** — the scheme law answers WHO may be
  asked, not WHERE the socket lands: `https://` says nothing about the
  address. So a second law runs on the ADDRESS itself, for every scheme,
  BEFORE any connect: loopback (unless the trusted mount opt re-admits it),
  RFC1918, CGNAT 100.64/10, link-local (169.254/16 — the metadata home —
  and fe80::/10), ULA fc00::/7, unspecified, multicast, broadcast, the
  reserved blocks, and every IPv6 form CARRYING an IPv4 of one of those
  scopes (v4-mapped, v4-compatible, well-known NAT64 64:ff9b::/96).
  WHATWG parsing folds the decimal/octal/hex IPv4 spellings before this
  file sees them; zone-scoped literals have no canonical origin and die at
  the URL law. The opt re-admits LOOPBACK ONLY — private space is never
  re-admittable — and the plain-http leg dials loopback ADDRESSES only (a
  `localhost` that re-resolves away from loopback is refused on its
  resolved bytes, not dialled). Code: `WEB_DESTINATION_NON_PUBLIC`, zero
  wire. A provider MOUNT declaring a literal non-public destination is
  refused at the mount (`PLANE_WEB_PROVIDER_REFUSED`).
- **Resolve-once + pinned connect (H-2/M-1, the DNS-rebinding twin of the
  symlink TOCTOU)** — per hop the hostname resolves EXACTLY ONCE, EVERY
  answer is checked against the law above (one private answer poisons the
  whole set), and the connect receives the checked address through an
  injected `lookup`: re-resolution between check and connect is
  structurally impossible, the window is deleted, not raced. TLS keeps
  validating the ORIGINAL hostname (servername comes from the request
  host), so pinning never weakens certificate checks. Each redirect hop
  resolves, checks, and pins AGAIN.
- **Mount-pinned provider endpoint (H-3)** — a provider-supplied URL is an
  undeclared, unrequested effect: the search port POSTs ONLY to origins
  the trusted mount declared for that provider (the same frozen set the
  contribution declares and the PA requested set carries — declared ==
  requested, now enforced at the socket too). An empty declared set
  reaches nothing. Code: `WEB_SEARCH_DESTINATION_DENIED`, zero wire.
- **Consent scope (disclosure)** — grants are PER-ORIGIN, so the text the
  human sees says so: both row descriptions state that an approval covers
  ANY path on the origin, and the ledger's control detail derives one
  consent-scope line per `connect` effect from the strict reviewPayload
  (client `deriveControlScopeNotes` — display-only, closed-vocabulary,
  never a guess). The durable row's kernel summary line is untouched
  (protected center); the origin was already carried verbatim inside the
  payload's effect locators.

| file | role |
| --- | --- |
| `src/web-mechanics.mjs` | pure mechanics: URL/scheme/userinfo law, the non-public-destination address law (scope classifier for IPv4/IPv6 spellings), redirect-stays-in-destination law, hop/byte bounds, typed refusal codes |
| `src/web-transport.mjs` | the ONE bounded transport port (node:http/https), deadline-wired, abort-safe, redirect-bounded; resolve-once + checked-address pin per call/hop; the search leg's mount-declared origin allowlist |
| `src/web-search-provider.mjs` | the closed provider-port shape; NO provider ships — mount-time validation, invalid candidates refuse (`PLANE_WEB_PROVIDER_REFUSED`) |
| `src/fetch-executor.mjs` | governed web_fetch body: declares the [tool-invoke + connect@origin] effect set (parseRequestedEffectSet), plans, asks, executes once, leak-safe results |
| `src/search-executor.mjs` | governed web_search body: same shape; no provider → typed `WEB_SEARCH_NO_PROVIDER` refusal pre-everything |
| `src/fetch-row.mjs`, `src/search-row.mjs` | the model-visible rows (native field-shape parity) |
| `src/web-family-contribution.mjs` | the declaration — FamilyContributionInput with literal nativeNames, closed familyId `dsh.web-family` |
| `src/index.mjs` | the public barrel — the only face consumers import |

Allowed outward edges, and only these: `node:*` builtins
(`node:http`, `node:https`, `node:dns` — the resolve-once law, `node:crypto`), `packages/contracts/src/*`
(closed vocabulary), and `packages/domain/tool-governance/src/*` — the
single thin face `parseRequestedEffectSet` used by the two governed
executors exactly as the fs-family executors use it (booked file-by-file
in `scripts/audit-a5-tool-governance-imports.mjs`). NO imports of the
plane (`src/plugin/live/*`), the governance-center lane beyond that face,
tool-dispatch, the dormant a5p5 lane, Host internals, or any SIBLING
family. `scripts/eb3-family-boundaries.mjs` books exactly this list; an
unbooked edge is a finding, not a warning.

Consumers: the plane itself (via the reviewed manifest), C1
`packages/runtime/test/u7f-web-c1.test.ts` (30 arms, MOCK-band stubs + fake resolvers only)
and C2 `tests/world-factory/{world-kinds/080-u7-f-web.mjs,suites/070-u7-f-web.mjs}`
(live pinned Host; the approvals ride the PUBLIC `team.resolveControl` v4
seam — the leader carries no control tools). Evidence and honest verdict
history: `dev/agent-workflow/evidence/u7-f-web-20261026/`.
