WEB-ROW
BL-18 live-half unblock: the realm row forwards and configures the confined `web` face

Base: `origin/master` @ `a5bd88b85` (BL-18 backend half, #606). Branch
`task/a5sf-web-row-20261106`, worktree `.worktrees/a5sf-web-row`.
**Host-free: 0 boots, 0 sockets, 0 DNS, no DSH_HOME; CORE PATCH BUDGET = 0.**

> The task brief named master `e78bfd8af`; that object does not exist in this
> clone (`git cat-file -t e78bfd8af` → `fatal: Not a valid object name`).
> `origin/master` is `a5bd88b85`, which is the BL-18 backend half this PR
> extends, so the worktree was cut from it as instructed.

## What changed

1. `packages/runtime/src/plugin/live/a5sf-realm-row.mjs` — `mountMemberA5sfRealm`
   now forwards a confined `web` face from exactly the same place it forwards
   `subprocess`: `compiled.web = { effective, provider.fetch/search }`, shape
   checked. A new row-config key `a5sfWebFace` (`string | { url, config? }`)
   names a composition module whose `createConfinedWebFace({ member, members,
   config })` answers the SAME shape, so a row whose compiled answer carries no
   `web` can still mount the confined face. One source per realm: both present ⇒
   `REALM_DECLARATION_INVALID`.
2. `packages/runtime/src/plugin/types.ts` — the config key joins the shipped
   row-config type with its fail-closed contract.
3. `packages/runtime/dist/**` — the four artifacts the build regenerated (the
   row `.mjs` placement and `types.d.ts`/maps).
4. Tests: `tests/world-factory/a5sf-web-row.test.mjs` (10 host-free arms).
5. Evidence: `dev/agent-workflow/evidence/a5sf-web/README.md` §8b (+ §7/§8/§9
   corrected to the dated state), mutation controls, raw gate logs.
6. `docs/plans/active/alpha5-sandbox-first/ALPHA5-SANDBOX-BACKLOG.md` BL-18 —
   wiring landed; live half still unmeasured.

## What is proven (host-free)

* RED on the base: 9 of the 10 arms fail with the ACTUAL hole — `faces.web` is
  `null` (the compiled face is dropped) and the real `tool-web` module is
  refused at composition, so there is no product composition to measure.
* GREEN: the row mounts the face; a `network: deny` lane driven through the
  row's own `attachA5sfNativeToolModules` + the real pinned
  `@deepseek-ai/dsh-tool-web` refuses BEFORE the provider with **0 fetch, 0 DNS,
  0 connect, 0 proxy**, the host `ctx.web` tripwire never consulted, and exactly
  one `web:fetch` fact (`decision: deny`, `decidedBy: NETWORK_UNCONFINED_REALM`).
  An allow lane reaches the provider exactly once with the declared URL and one
  ALLOW fact carrying the typed redirect/proxy residuals.
* Fail closed on absence: a declared face without a provider refuses typed
  `NETWORK_UNCONFINED_REALM` at composition time (no realm, no tool, no host
  fallback); a configured factory answering no face refuses the same way; a lone
  config key with no a5sf realm is a config fault.
* A realm with no web declaration is unchanged: `faces.web === null` and the
  real module is still refused typed. The `a5sf-p2-seam` pin
  `{fs:'confined',subprocess:null,web:null}` is NOT edited (a binding realm
  still mounts `fs` only).
* Mutations: (M1) presence check removed ⇒ only the two absence arms red;
  (M2) web guard bypassed ⇒ only the two deny arms red. Every touched file is
  restored byte-identically (sha256 in the report).
* No second permission computation: the row contains no compiler, no
  intersection, no probe and no guard (pinned by `ROW-NO-SECOND-COMPILER`); the
  face still reads `effective.network.access` and BL-17's imported
  `probeNetworkDenial`.

## Gates

| Gate | Result |
| --- | --- |
| arms RED → GREEN | 9F/1P → **10/10 pass** |
| `node --test tests/world-factory/a5sf-*.test.mjs` | **323/323** (measured baseline before this branch: **313/313**) |
| runtime targeted vitest (`a5sf-*` + `a5p4-lane-hygiene`) | **204/204, 14 files** |
| `tsc` (runtime) | rc 0 |
| `pnpm -r typecheck` | rc 0 |
| eslint (touched sources) | rc 0 |
| census / ledgers | no new scannable `.ts`; no new lane edge ⇒ no booking. `p4t6` **20/20**, `a5p4` **8/8** |
| artifact index / at-head | index regenerated and committed with the dist change |
| `git diff --check` | rc 0 |

## What is NOT done

* **No boot, no strace, no egress.** Steps 3–7 of §8 are now RUNNABLE (exact
  commands in §8b) but **not executed**; step 8 (cross-generation revocation)
  remains BLOCKED on a missing control surface, not on the web face.
* The default product composition is unchanged: **no shipped preset gains a web
  face**. `product-assembly.ts` still refuses a narrowed network lane, so the
  deny steps must ride the OPTIONAL `teamA5sfRealm` provider seam (the same
  public seam the 2026-11-03 live row used); the allow step can ride the pure
  product declaration path + `a5sfWebFace`.
* BL-18 stays IN-PROGRESS / `V@B=no`; M-14 stays `NOT_WIRED`. Nothing is
  merged or settled by this PR.
