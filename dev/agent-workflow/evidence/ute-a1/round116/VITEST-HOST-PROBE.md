# The 40 host-importing vitest suites on rc.5 — probe verdict: **ENV-LIMITED at the Vite layer**

Round 116, 2026-11-25. Worktree `.worktrees/vnext-a1-cut`, branch `vnext/a1-cut`, HEAD for the probe
`5cb5c606203eaf07dd78a2a5c67b442899db2377`. This is the bounded experiment the round asked for: **can the 40
vitest suites that value-import `@deepseek-ai/*` be graded on rc.5 through the SAME one selector
(`TEAM_TEST_HOST=next` → `tests/next-host/host-select.mjs`), without adding a second host-selection
mechanism?** Five representative suites were run, not the whole population; every claim below has a log in
this directory.

**Verdict, stated first: NO — and the refusal is at the Vite (module-runner) layer, not at the selector.**
The one selector still works perfectly for plain Node; it cannot reach modules whose resolution Vite performs
first. Making it reach them requires a Vite-side redirect (measured to work in probe C), which is a **second
selection mechanism**; it is refused. The 40 suites stay **rc.2-only and are not counted as rc.5 coverage.**

---

## 1. How the population resolves the host today

| layer | mechanism | file:line |
| --- | --- | --- |
| the one selector | `TEAM_TEST_HOST` → `testHostMode()` / `resolveSelectedHostModule()` / `selectedHostTree()` | `tests/next-host/host-select.mjs:38,45,59,83` |
| Node lane (node:test, drivers, live boots) | a `module.register` resolve hook rewrites **bare** `@deepseek-ai/*` imports into the selected tree | `scripts/run-tests-hooks.mjs:68-75` |
| booted child host | `NODE_OPTIONS=--import tests/next-host/host-loader.mjs` registers that same hook | `tests/next-host/host-loader.mjs:24-26` |
| root vitest population | Vite resolves `@deepseek-ai/*` from the repo install (rc.2) — no alias, no plugin | `vitest.config.ts:10-12,31-36` (only `preserveSymlinks`) |
| `packages/client` vitest population | **its own** Vite plugin resolves every `@deepseek-ai/*` to the **rc.2 test-use source tree**; its `inline` regex also names `deepseek-harness-test-use` | `packages/client/vitest.config.ts:18-27,111-127,146-150,181` |

The client package is important: it does not merely *fall through* to the repo install, it **redirects
`@deepseek-ai/*` to `tests/deepseek-harness-test-use` source by name**. That redirect is already a Vite-level
host choice (pre-existing, rc.2-only); rc.5 grading cannot ride it.

## 2. The four bounded experiments (each log is in this directory)

A throwaway probe (`.scratch/r116/probe/`, gitignored, deleted from the tree after the run) imported
`@deepseek-ai/dsh-scope/package.json` and `@deepseek-ai/dsh-tools/package.json` through the Vite pipeline and
printed the version Vite actually resolved. rc.2 = `0.2.0-rc.2`; rc.5 = `0.2.2-rc.5`.

| # | setup | resolved version | log | what it proves |
| --- | --- | --- | --- | --- |
| **A** | no env (rc.2 baseline) | `0.2.0-rc.2` | `probe-a-baseline-rc2.log` | baseline is the repo install |
| **B** | `TEAM_TEST_HOST=next` + `NODE_OPTIONS=--import=…/host-loader.mjs` | **`0.2.0-rc.2`** | `probe-b-rc5-node-loader.log` | the Node loader is **not consulted** for a Vite-resolved import |
| **B2** | same loader, **plain Node** import | `0.2.2-rc.5` | `probe-b2-plain-node-loader.log` | the loader itself is correct and active — the failure is *where Vite sits*, not the selector |
| **D** | `server.deps.inline` for `dsh-scope`/`dsh-tools` (+ loader) | `0.2.0-rc.2` | `probe-d-rc5-inline-node-loader.log` | inlining does **not** route resolution through Node's loader; it only moves transformation into Vite |
| **C** | a Vite `resolveId` redirect derived **from** `resolveSelectedHostModule` | `0.2.2-rc.5` | `probe-c-rc5-vite-redirect.log` | a Vite-side redirect *would* work technically — this is exactly the second mechanism that is refused |

Why B fails is structural: Vite's module runner resolves the bare specifier to an absolute file itself and
then imports that URL. The Node hook only rewrites specifiers that `startsWith('@deepseek-ai/')`
(`run-tests-hooks.mjs:68`); it never sees a bare specifier, and it has no `load` hook keyed on absolute paths.
`--import` is therefore inert inside the Vite graph even though it is load-bearing for every `node:test` leg
and every live boot.

## 3. The representative suites — green, but on rc.2 modules (a false green, not coverage)

| population | rc.2 baseline | `TEAM_TEST_HOST=next` + the same Node loader | log pair |
| --- | --- | --- | --- |
| 3 runtime suites: `f15-mcp-live-loss`, `a5sf-service-install`, `mcp-blueprint-initial-grant` | **62 / 62 pass** | **62 / 62 pass** | `suites-runtime-rc2.log`, `suites-runtime-next-plus-loader.log` |
| 2 client suites: `team-dock`, `team-members` | **24 / 24 pass** | **24 / 24 pass** | `suites-client-rc2.log`, `suites-client-next-plus-loader.log` |

The identical green is the point of the probe, not evidence for rc.5: probes A/B show the modules those
suites imported were still `0.2.0-rc.2`. Running the whole 40 under `TEAM_TEST_HOST=next` would produce seven
green cells that grade the **legacy** host — precisely the false green the one-selector rule exists to
prevent. They are therefore **not** recorded as rc.5 coverage, and the population cell in
`RC5-TEST-MATRIX.md` stays N/A.

## 4. Why the working-looking options are refused

1. **`resolve.alias` / plugin in `vitest.config.ts` derived from the loader's mapping.** Probe C shows this
   works. It is refused anyway: it is a **second host-selection decision point** in a different resolver. The
   selector contract is one mechanism that decides *which host*, consulted by every lane; a Vite resolver that
   calls `resolveSelectedHostModule` duplicates the *decision* into Vite and must be kept in sync with the
   loader's rules (bare specifiers only, `parentIsInsideHost` containment, subpath handling). That is a second
   mechanism even when it reads the same authority, and it would silently change the whole root population.
2. **Extending the loader with a `load` hook for absolute paths.** Still a second mapping (path → host tree)
   inside the same file, and it would not help the client package, whose `resolveId` plugin short-circuits
   before any absolute path reaches Node.
3. **`server.deps.inline`.** Measured inert for host selection (D). It changes *who transforms*, not *who
   resolves*.
4. **Widening a timeout, retrying, or skipping.** None of these touches the resolver; all are forbidden.

## 5. What the host would need to expose (the precise blocker)

For the 40 suites to be graded on rc.5 **through one mechanism**, the selected-host decision has to be made
*inside Vite's resolution*, by the same authority, without a second rule set. Concretely, one of:

- a **Vite/Vitest-supported delegation** (a runner option that lets a bare-specifier import be resolved by the
  registered Node loader instead of Vite's resolver), which Vite 8.2.2 / Vitest 4.1.11 do not expose; or
- an **upstream host-provided Vite plugin** (published by the host, parameterised by the selected tree — not a
  repo-authored alias table), so the redirect is a host capability the selector merely points at rather than a
  second Team-side mechanism; or
- an owner ruling that these 26 client + 14 runtime suites are **host-version-agnostic** by contract, in which
  case they stop being an rc.5 gap by definition rather than by a green cell.

Until one of those exists, the honest record is: **ENV-LIMITED, layer = Vite module runner** (probes A/B/B2/D
in this directory), and **0 of 40** counted as rc.5 coverage.

## 6. Reproduction

```bash
# A/B/D/C (throwaway probe, gitignored; recreate under .scratch/r116/probe/ as in this round)
TEAM_TEST_HOST=next NODE_OPTIONS="--import=$PWD/tests/next-host/host-loader.mjs" \
  node node_modules/vitest/vitest.mjs run --config .scratch/r116/probe/vitest.probe.config.ts
# B2 — the same loader, plain Node:
TEAM_TEST_HOST=next node --import ./tests/next-host/host-loader.mjs \
  -e "import('@deepseek-ai/dsh-scope/package.json',{with:{type:'json'}}).then(m=>console.log(m.default.version))"
# representative suites
TEAM_TEST_HOST=next NODE_OPTIONS="--import=$PWD/tests/next-host/host-loader.mjs" \
  node node_modules/vitest/vitest.mjs run packages/runtime/test/f15-mcp-live-loss.test.ts \
    packages/runtime/test/a5sf-service-install.test.ts packages/runtime/test/mcp-blueprint-initial-grant.test.ts
```

## Appendix — the exact throwaway files (not shipped in the tree)

`host-probe.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import scopePkg from '@deepseek-ai/dsh-scope/package.json'
import toolsPkg from '@deepseek-ai/dsh-tools/package.json'

describe('host resolution probe', () => {
  it('records the tree Vite resolved for @deepseek-ai/*', () => {
    console.log(`PROBE dsh-scope version=${String((scopePkg as { version?: string }).version)}`)
    console.log(`PROBE dsh-tools version=${String((toolsPkg as { version?: string }).version)}`)
    expect(typeof (scopePkg as { version?: string }).version).toBe('string')
  })
})
```

`vitest.probe.config.ts` (A/B/D base; D adds `test.server.deps.inline`):

```ts
import { defineConfig } from 'vitest/config'
const ROOT = '/home/armourpiercer/projects/dsh-agent-team/.worktrees/vnext-a1-cut'
export default defineConfig({
  root: ROOT,
  resolve: { preserveSymlinks: true },
  test: { include: ['.scratch/r116/probe/host-probe.test.ts'], environment: 'node', pool: 'threads' },
})
```

`vitest.probe-alias.config.ts` (C — the refused second mechanism, kept only as the experiment):

```ts
import { dirname, join } from 'node:path'
import { defineConfig } from 'vitest/config'
import { resolveSelectedHostModule } from '../../../tests/next-host/host-select.mjs'
const ROOT = '/home/armourpiercer/projects/dsh-agent-team/.worktrees/vnext-a1-cut'
const HOST_SPECS = ['@deepseek-ai/dsh-scope', '@deepseek-ai/dsh-tools']
export default defineConfig({
  root: ROOT,
  resolve: { preserveSymlinks: true },
  plugins: [{
    name: 'probe-vite-host-redirect',
    enforce: 'pre',
    resolveId(source: string) {
      const m = /^(@deepseek-ai\/[\w.-]+)(\/package\.json)?$/.exec(source)
      if (m === null) return undefined
      const pkg = m[1]
      if (pkg === undefined || !HOST_SPECS.includes(pkg)) return undefined
      const entry = resolveSelectedHostModule(pkg, ROOT, 'next')
      return m[2] === undefined ? entry : join(dirname(entry), '..', 'package.json')
    },
  }],
  test: { include: ['.scratch/r116/probe/host-probe.test.ts'], environment: 'node', pool: 'threads' },
})
```
