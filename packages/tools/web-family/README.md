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

| file | role |
| --- | --- |
| `src/web-mechanics.mjs` | pure mechanics: URL/scheme/userinfo law, redirect-stays-in-destination law, hop/byte bounds, typed refusal codes |
| `src/web-transport.mjs` | the ONE bounded transport port (node:http/https), deadline-wired, abort-safe, redirect-bounded |
| `src/web-search-provider.mjs` | the closed provider-port shape; NO provider ships — mount-time validation, invalid candidates refuse (`PLANE_WEB_PROVIDER_REFUSED`) |
| `src/fetch-executor.mjs` | governed web_fetch body: declares the [tool-invoke + connect@origin] effect set (parseRequestedEffectSet), plans, asks, executes once, leak-safe results |
| `src/search-executor.mjs` | governed web_search body: same shape; no provider → typed `WEB_SEARCH_NO_PROVIDER` refusal pre-everything |
| `src/fetch-row.mjs`, `src/search-row.mjs` | the model-visible rows (native field-shape parity) |
| `src/web-family-contribution.mjs` | the declaration — FamilyContributionInput with literal nativeNames, closed familyId `dsh.web-family` |
| `src/index.mjs` | the public barrel — the only face consumers import |

Allowed outward edges, and only these: `node:*` builtins
(`node:http`, `node:https`, `node:crypto`), `packages/contracts/src/*`
(closed vocabulary), and `packages/domain/tool-governance/src/*` — the
single thin face `parseRequestedEffectSet` used by the two governed
executors exactly as the fs-family executors use it (booked file-by-file
in `scripts/audit-a5-tool-governance-imports.mjs`). NO imports of the
plane (`src/plugin/live/*`), the governance-center lane beyond that face,
tool-dispatch, the dormant a5p5 lane, Host internals, or any SIBLING
family. `scripts/eb3-family-boundaries.mjs` books exactly this list; an
unbooked edge is a finding, not a warning.

Consumers: the plane itself (via the reviewed manifest), C1
`packages/runtime/test/u7f-web-c1.test.ts` (19 arms, MOCK-band stub only)
and C2 `tests/world-factory/{world-kinds/080-u7-f-web.mjs,suites/070-u7-f-web.mjs}`
(live pinned Host; the approvals ride the PUBLIC `team.resolveControl` v4
seam — the leader carries no control tools). Evidence and honest verdict
history: `dev/agent-workflow/evidence/u7-f-web-20261026/`.
