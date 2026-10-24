# A5M2-G2-WIRE round-72 — SEARCH-LANE TEST SUPPLY: exact list from the ACTUAL import graph (read-only; NO install/clone/Host)

Lane tip (ls-verified): `8300cbab0c4f04ca17f865de7512ba4a148f48fc`.
Inventory (measured, not inherited): this lane's search-lane specs are the
**5** `packages/runtime/test/a5m2-g2-*.test.ts` files, **4,391 lines**,
**115 direct `it/test` call sites** (connector-adapters, mcp-sdk-contract,
provider-seams, team-assembly, wire-c1). (The card's "21 spec / 276 tests"
face was NOT found in this lane; measured face reported as-is.)

## Method
Static + dynamic specifier scan of the 5 specs (walker
`scan-imports.mjs`, this dir) plus the load-form reality the walker alone
misses: my specs load lane modules and 639 modules via
`new URL(rel, import.meta.url).href` file-URLs — those legs were enumerated
directly (`grep new URL`). Package specifier roots extracted, then probed
across the three real trees.

## Naming correction (measured)
`install-c8dd3f07b/` **does not exist on this host** (searched). The only
existing standard-install tree:
`.worktrees/pack-int/install-bf4e89e1-20261023T203544Z/` — **flat npm
layout, ZERO @deepseek-ai entries** (by design: plugin pack install;
@deepseek-ai/* are PEERS supplied by the host side).

## SUPPLY TABLE (what a search-lane TEST run actually imports)

| specifier / module | required version | who supplies it | evidence | status |
|---|---|---|---|---|
| `vitest` | devDep range -> resolved **4.1.11** | LANE root install (r69 frozen link) | lane `node_modules/.pnpm/vitest@4.1.11_@opentelemetry+api@1.9.1_@types+node@22.20.1_jsdom@30.0.1_vite@8.2*` | **HIT (lane)** |
| `vitest` (venue side) | its own generation | test-use tree self-supply (2 vitest entries in its node_modules) — NOT used by my lane's runs | `tests/deepseek-harness-test-use/node_modules` count=2 | HIT (venue, role: its own tests) |
| `@modelcontextprotocol/client` | **2.0.0** | VENUE file-URL leg `mcp/mcp-client/node_modules/@modelcontextprotocol/client/dist/index.mjs`; ALSO lane `.pnpm/@modelcontextprotocol+client@2.0.0` | venue package.json version=2.0.0 | **HIT (venue + lane)** |
| `@modelcontextprotocol/server` (sic: `@modelcontextprotocol/server`) | **2.0.0** | VENUE nested `mcp/mcp-client/node_modules/@modelcontextprotocol/server` | venue package.json version=2.0.0 (lane `.pnpm` carries client+core, not server — file-URL leg loads VENUE's) | **HIT (venue)** |
| 639 COMPILED roots loaded by file-URL: `web/web-search-exa/lib/index.js`, `web/web-search-deepseek/lib/index.js`, `web/tool-web/lib/index.js`, `util/launch-environment/lib/index.js`, `web/` tree | 0.2.0-rc.2 checkout @ 639ed01539 | **VENUE tree itself** — measured: each compiled lib root has **ZERO external package imports** (self-contained dist bundle; grep for `from '<pkg>'` empty) | probe: imports resolve with no ERR_MODULE_NOT_FOUND (e.g. `WEB_SEARCH_MAX_RESULTS=8` load) | **HIT (venue, self-contained)** |
| stagehand src legs `experimental/browser-use-stagehand-native/src/launch.ts`, `src/worker-client.ts` | 639 checkout | VENUE full checkout; **PUBLIC** `./src/*` subpath (see export-hygiene) | package.json `:21 "./src/*": "./src/*"` | **HIT (venue, PUBLIC subpath)** |
| lane in-repo modules (specs' relative imports; g2-*.mjs family; team-tool-plane.mjs; pa-mount-registry.mjs; host-adjacent .ts) | workspace source | IN-REPO (zero package specifiers: mjs family grepped — **0 externals beyond node: builtins**) | this dir `scan-imports.mjs` + direct greps | **HIT (in-repo)** |

### HOST-RUNTIME specifier supply (recorded per card scope; NOT test-time)
`host.ts` runtime dynamic externals, measured: exactly the 2 literals
(`@deepseek-ai/dsh-launch-environment`, `@deepseek-ai/dsh-tool-web`) +
the `publicRoots` specifier variables (3 web-search roots) +
`@deepseek-ai/dsh-web-fetch-http`:

| specifier | required | lane link status |
|---|---|---|
| @deepseek-ai/dsh-launch-environment | 0.2.0-rc.2 | **HIT** `.pnpm/@deepseek-ai+dsh-launch-environment@0.2.0-rc.2_@deepseek-ai+cordis@4.0.4` |
| @deepseek-ai/dsh-tool-web | 0.2.0-rc.2 | **HIT** realpath `.pnpm/@deepseek-ai+dsh-tool-web@0.2.0-rc.2_...0ea441c693e9.../node_modules/@deepseek-ai/dsh-tool-web` |
| @deepseek-ai/dsh-web-fetch-http | 0.2.0-rc.2 | **HIT** `.pnpm/@deepseek-ai+dsh-web-fetch-http@0.2.0-rc.2_...` |
| @deepseek-ai/dsh-web-search-deepseek | 0.2.0-rc.2 | **HIT** `.pnpm/..._776d8605bdbd...` (transitively lock-carried) |
| @deepseek-ai/dsh-web-search-exa | 0.2.0-rc.2 | **MISSING in lane link AND lane lock (0 entries)** — by design: USER-CHOICE plugin, host-side install per the signed law; my specs never load it by specifier (venue file-URL leg only), so **zero TEST-time need** |
| @deepseek-ai/dsh-web-search-perplexity | 0.2.0-rc.2 | **MISSING** — same category/same conclusion |

## VERDICT
**SEARCH-LANE TEST SUPPLY: COMPLETE — zero missing.** Runner HIT (lane),
mcp HIT (venue nested + lane), 639 roots HIT (venue, self-contained),
everything else in-repo relative. The two MISSING entries are HOST-RUNTIME
user-choice plugin supply (signed law), NOT test-time supply; no install
is warranted for the search tests on this evidence.

## Hard constraints for any future top-up (recorded, not executed)
Budget 256MiB; df floor 6GiB (current measured: 8,860,815,360 B ≈ 8.25 GiB
— holds); existing store only (`.pnpm-store` v11, hardlink links);
frozen-lockfile; offline-first; no clones/Host.

## Export-hygiene note (per root's source-fact merge)
* src-subpath usages in MY lane's venue imports (stagehand
  `src/launch.ts`, `src/worker-client.ts`): **PUBLIC-legitimate** —
  per-importer evidence: `experimental/browser-use-stagehand-native/
  package.json:21` (pattern; sibling citations: `web/web-search-exa/
  package.json:21`, `mcp/mcp-client/package.json:21`, `web/tool-web/
  package.json:21` — all `"./src/*": "./src/*"`). **npm-equivalence caveat
  recorded**: ordinary npm `files` lists exclude `src`, so npm hosts are
  NOT equivalent — supported surface = full-639 checkout + normal TS
  launch.
* True deep-path (lib/ internals) usage in my lane's search files: **NONE
  FOUND** — venue legs load `lib/index.js` MAIN entry only; lane supply
  face (host.ts `out` + g2 supply) exports VALUES (lane closures, strings,
  frozen objects), never re-exports of private deep paths; the g2 mjs
  family has zero package imports at all. No flags.
