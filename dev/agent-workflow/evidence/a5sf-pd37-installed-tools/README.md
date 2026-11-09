# PD-37 (INSTALLED-TOOLS) — the installed Preview's tool execution is fixed

**Lane**: `PD37-INSTALLED-TOOLS` ｜ branch `task/pd37-installed-tools-20261109`
**Base**: `origin/master` @ `838f9d919` (PD-36 INSTALL-SMOKE #688 merged on top of `41a272c6d` PD-35 STOP-OUTCOME)
**Register**: PD-37 (contiguous behind PD-36) ｜ **No** upstream patch (`CORE PATCH BUDGET = 0`), **no** `packages/**`
product change, **no** change to `V@B` / grades / `PREVIEW-GO`.

This directory resolves **PD-36** (`a5sf-pd35-install-smoke/`): the shipped artifact's *first tool call
ended the turn with `Cannot read properties of undefined (reading 'prepare')`*. PD-36 stayed a real
block in a real shipped artifact; this lane names the line that caused it and proves the fixed
artifact in the same install form.

---

## 1. Root cause: a **partial duplicate of the host core** in the profile layer

**Hypothesis (a) is the cause; (b) and (c) are refuted.**

`@deepseek-ai/dsh-tools` exports its scheduler key as a **plain `Symbol(...)`**:

```
packages/core/tools/src/index.ts:480   export const TOOL_RUNTIME_SCHEDULER: unique symbol = Symbol('@deepseek-ai/dsh-tools.scheduler')
```

`Symbol(...)` mints a *new* symbol per module instance (unlike `Symbol.for(...)`). The agent loop
reads `ctx.tools[TOOL_RUNTIME_SCHEDULER].prepare(...)` using the symbol of **its** `dsh-tools`
instance. `dsh plugin add` installed our plugin's `dependencies` into the **profile**, and the
app-boot profile layer answers a `@deepseek-ai/*` import from the profile first — so the `tools`
service row was the profile's copy while the host's `dsh-agent-loop` kept its own. Different symbol
→ `tools[symbol] === undefined` → `undefined.prepare`.

Measured in the pre-fix install (`08-module-instances.json`, a diagnostic row inserted into the
profile's patch layer):

| probe | value |
| --- | --- |
| `cache.dsh-tools` | **two** module URLs — `<test-use>/packages/core/tools/lib/index.js` **and** `<profile>/node_modules/@deepseek-ai/dsh-tools/lib/index.js` |
| `cache.agent-loop` | only the host copy (the profile never gets `dsh-agent-loop`) |
| `pluginImport.scheduler.prepare` | `undefined` |
| `pluginImport.sameSymbol` | `false` |
| `imported.dsh-tools.scheduler.prepare` | `"function"` (the profile copy is healthy in isolation — it is the *identity* that breaks) |

**Why a "complete" duplicate is falsely green**: when pnpm resolves the full closure into the
profile (some pnpm/lockfile shapes install all ~289 `@deepseek-ai` packages, `dsh-agent-loop`
included), the profile is self-consistent and tool calls work — the same luck that PD-36's arm C
saw as red and this checkout saw as green. Only **zero** profile-local host copies is stable.

**Why the World is green**: the WorldFactory mounts the production row by absolute `file://` URL
next to a patch file and declares **no** `dsh.profile.bundles` entry, so no profile dependency
install ever happens and resolution stays on the host installation — one module instance. The
World's green was an install-graph artifact, not a proof of install usability. Nothing in the
harness supplies a row the bundle lacks.

**Refuted hypotheses**: (b) the plugin's `routerContext.provide('tools', …)` / `ctx.isolate` route
is a *latent* bug (see §6) but not reachable on the plain/legacy row and cannot explain a failure
that reproduces with the plugin **not loaded at all** (this lane booted a profile whose bundles were
`[@deepseek-ai/dsh-base, @deepseek-ai/dsh-web-app]` plus one `@deepseek-ai/dsh-tools` directory and
got the identical error). (c) no WorldFactory-supplied row is involved.

## 2. The fix (our manifest only)

`package.json` at the base declared **six** `@deepseek-ai/*` packages as **runtime dependencies**:
`dsh-skill`, `dsh-tool-fs`, `dsh-tool-web`, `dsh-tools`, `dsh-web-fetch-http`,
`dsh-web-search-exa`. `dsh plugin add` therefore installed them (and their closure, which includes
`dsh-tools`) into the profile.

Five of the six are **host-provided**: they resolve out of the pinned host install with **no plugin
installed** (`09-host-provides-six.txt`). They move to `peerDependencies` (exact `0.2.0-rc.2`,
`peerDependenciesMeta.optional: true`) so they are *never installed into a profile* and resolution
stays on the host's single instance.

The sixth, `@deepseek-ai/dsh-web-search-exa`, is **not** host-provided (it exists in the host source
tree but is not in the host CLI's install scope). It stays a regular dependency, per the rule "the
poison is the `dsh-tools` copy, not the six as a class": it drags no `dsh-tools`, and the profile it
produces contains only `dsh-web-search-exa`, `schemastery`, `cosmokit` (`01-install-fixed.txt`).

The peer set widens **10 → 15** by *re-typing* six already-required packages (five of them now
peers, one of them the audited dependency exception). No new package family, no version change, no
widening of the compatibility contract: all fifteen pins are the same exact `0.2.0-rc.2`, now
explicitly optional. `packages/testkit/test/plugin-dsh-compat.test.ts` carries the loud re-audit and
the regression rule (§4).

## 3. The installed-shape proof (two consecutive boots, same artifact)

Artifact: `dsh-agent-team-0.1.1-alpha.2.tgz`, **4 210 077 bytes**,
`sha256 61fd2e48d4d78593d2d8cd16efe8c737f50d794d80d4a93b96dd8d695169efb4`.

Install: `dsh plugin --profile web add <tgz>` into a pristine profile whose `pnpm-workspace.yaml` is
the one the CLI itself writes (`packages: ['.']`, `nodeLinker: hoisted`, `autoInstallPeers: false`)
plus machine-local `storeDir` and `strictDepBuilds: false` (this sandbox blocks native install
scripts). Profile `node_modules`: `dsh-agent-team`, `yaml`, `zod`; `@deepseek-ai/` = 3 packages, **no
`dsh-tools`** (`01-install-fixed.txt`).

Each round boots the real `dsh web` against a scripted model and drives the four actions through the
public RPC surface (the same `session/*` remotes the Web client uses):

| action | round A (`03`, `04`) | round B (`05`, `06`) |
| --- | --- | --- |
| `web_fetch http://127.0.0.1:3495/pd37-probe` | tool executed → host's SSRF guard `WEB_BLOCKED_URL` ("resolves to a non-public IP address") | same |
| `web_fetch https://registry.npmjs.org/-/ping` | **HTTP 200**, body returned | **HTTP 200** |
| `write` + `read` `<workspace>/pd37-proof.txt` | file written, read back (`PD37_FS_OK`) | same |
| `create_goal` (max 50) | goal created, `phase=active`, `activation=armed` | same |
| goal continuation | **5 rounds** (`roundsStarted=5`, 6 turns) | **4 rounds** (5 turns) |
| Stop = `goals/pause` + `session/cancel` | `active → paused`, `armed → disarmed`; the live turn ends `aborted/user`; **no model request after Stop** (13 → 13 in 4 s) | same (12 → 12) |

The local-endpoint `web_fetch` cannot return 200 in this host version: `web-fetch-http` rejects any
non-public destination unconditionally (no config switch). The call still **executes end-to-end**
(real tool runtime + transport) and returns the host's typed verdict, and the public fetch proves the
success path. The Stop click was **not** clicked in a browser (none is installed here): the identical
RPC sequence the button issues was driven directly, and the abort is visible in the session log as
`turn/end {kind:'aborted', reason:{kind:'user'}}`.

## 4. Negative control and the pins

**Negative control** (`02-install-prefix.txt`, `07-negative-control-session.jsonl`): the same profile
shape and the same driver, with the **pre-fix** manifest (base `package.json`, six core
dependencies). Install puts **11** `@deepseek-ai` packages in the profile (`dsh-tools` present,
`dsh-agent-loop` absent); the first `bash` call produces `tool/result` "recorded but not durably
settled" and `turn/end {kind:'error', error:{message:"Cannot read properties of undefined (reading
'prepare')", code:"UNKNOWN"}}`. Same driver, same host, same port family — the only difference is
the manifest.

**Pin 1 (CI, host-free)** — `packages/testkit/test/plugin-dsh-compat.test.ts`:
the exact 15-name peer set, each exact-RC and `optional: true`; no peer may be a regular dependency;
and **no `@deepseek-ai/*` may be a regular or optional dependency at all**, except the single audited
host-absent name (asserted as exactly that name, and asserted not to be a peer). RED-first: putting
`@deepseek-ai/dsh-tools` back into `dependencies` fails that test (`×`, measured 2026-11-09).

**Pin 2 (manual gate)** — *boot a bare profile with the installed bundle and assert one tool call
succeeds*. This **cannot run in CI**: it needs a real `pnpm pack`, a real `pnpm add` into a clean
profile, a booted `dsh web` and a scripted model — network/registry access, a writable `DSH_HOME`
and minutes of wall clock, none of which the host-free suites have. It is registered here as the
manual gate that Pin 1 stands in for; the driver is re-derivable from the command list in §7.

## 5. What this does and does not establish

- **Does**: the shipped artifact's tool execution works in the ordinary install form, twice in a row
  (four actions + a multi-round goal + Stop), and the order-of-magnitude cause is a manifest line we
  own.
- **Does not**: re-measure `team.create` → Leader turns in this lane. That leg ran green in PD-36 up
  to the first tool call; the code on that path is unchanged here, but this lane only executed a
  plain session. `team_collect`, the DOM click on Stop, and restart-no-continuation remain
  unmeasured, exactly as PD-36 recorded them.
- **Does not**: relax any verdict. `PREVIEW-GO`, `V@B`, grades and `release BLOCKED` are untouched;
  `PREVIEW-CONTRACT-2026-11-16.md` gains an **append-only** correction (§2.3.1 + §5.3).

## 6. Latent, non-causal observation (not fixed here)

`packages/runtime/team-services/src/mount.ts` (~line 482) returns `Reflect.get(target, prop)` for
symbol properties on the null-prototype router it builds. The scheduler is a symbol, so on the
**a5sf realm** path the router-facing `tools` would drop it. `mountMemberA5sfRealm` skips plain and
legacy rows, so this is unreachable in the shapes measured above and is **not** the install defect
(which reproduces with no plugin loaded). Registered as a separate observation in PD-37's row; no
code change in this lane.

## 7. Re-derivation (commands)

```bash
# artifact
cd .worktrees/pd37-installed-tools && pnpm pack --pack-destination <dir>

# pristine profile, exactly the shape the CLI writes
mkdir -p <home>/profiles/web
printf 'packages:\n  - .\nnodeLinker: hoisted\nautoInstallPeers: false\nstoreDir: <store>\nstrictDepBuilds: false\n' > <home>/profiles/web/pnpm-workspace.yaml
printf '{"name":"dsh-profile-web","private":true,"dsh":{"profile":{"bundles":["@deepseek-ai/dsh-base","@deepseek-ai/dsh-web-app"]}}}\n' > <home>/profiles/web/package.json
printf '[]\n' > <home>/profiles/web/cordis.patch.yml
DSH_HOME=<home> node tests/deepseek-harness-test-use/apps/cli/lib/bin.js plugin --profile web add <tarball>

# boot + scripted model + RPC drive (scratch driver, never committed)
DSH_HOME=<home> DEEPSEEK_BASE_URL=http://127.0.0.1:3494 DEEPSEEK_API_KEY=<fake> \
  node tests/deepseek-harness-test-use/apps/cli/lib/bin.js web --port 3211 --no-open
```

The mock model is `packages/tools/harness/mock-deepseek.mjs`; the four-action script is the one
described in §3 (steps keyed by tool-result count, `stopAfterRequests` to interrupt mid-round). The
raw `dsh web` logs, session trees and helper scripts stay in the gitignored
`tests/dsh-homes/pd37/` and are re-derivable from the above.
