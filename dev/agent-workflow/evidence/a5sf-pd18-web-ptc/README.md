# PD-18-WEB-PTC — governed-preset web/PTC disposition (fail-closed) + surface pin

**Verdict.** On the shipped `a5sf-governed-member` preset, `web_fetch`/`web_search`
and `workflow` were **host-executed second-class tools with zero Alpha.5 facts**.
PD-18's disposition is **fail-closed**: both are removed from that preset. This is
a **capability regression, not a completed fix** — a governed Member can no longer
use web or PTC at all. The capability still exists on the standard preset (proven
below), and the confined web face itself still works (proven below); it is simply
**not wired to the shipped governed preset**, because neither the composition-owned
web transport nor an interpreter-admitting confined subprocess face exists in this
tree, and creating either is outside `CORE PATCH BUDGET = 0`.

- Task: `PD18-WEB-PTC`; base `origin/master` = `d590d58a0`; branch
  `task/pd18-web-ptc-20261113`; worktree `.worktrees/pd18-web-ptc`.
- Record class: **DEV-LIVE**, never candidate evidence, `V@B` untouched.

## 1. The defect, pinned before the change

The recon rounds measured the pre-fix state on the shipped governed preset
(`dev/agent-workflow/evidence/a5sf-recon-review/README.md`,
`a5sf-recon-web/README.md`, `a5sf-recon-external/README.md`):

| executor | pre-fix path | a5sf facts | confinement |
| --- | --- | --- | --- |
| `web_fetch` / `web_search` | inherited **host** `ctx.web` provider | **0** | none; the only refusal was the base provider's SSRF policy (`resolves to a non-public IP`) |
| `workflow` (PTC) | real PTC node child under the **host** `sandboxPolicy` | **0** | none from Alpha.5; `confinedTurnLaunchers` unchanged |
| `bash` | confined terminal face | 9 `shellRead` facts | governed (the only governed executor) |
| `run_code` | not on the surface (`NOT_WIRED`) | — | — |

The pin is executable, not prose: `tests/world-factory/a5sf-pd18-web-ptc.test.mjs`
(`A5SF_PD18_PIN=1`) reads `git show d590d58a0:cordis.patch.yml` and asserts the
**pre-fix** preset declared `tool-web`, `workflow-ptc`, `tool-workflow`, then
asserts the current file declares none of them. The live pair's transcript shows
the post-fix shape: `ERROR: unknown tool "workflow"` / `"web_fetch"`.

## 2. Disposition per executor (explicit, each with its reason)

1. **`web_fetch` / `web_search` — FAIL-CLOSED / REMOVED from the governed preset.**
   Reason: wiring them to the governed web face requires a composition-owned
   transport (`a5sfWebFace`) that the shipped layer does not ship; the product
   assembly also refuses network narrowing with `NETWORK_UNCONFINED_REALM`, and an
   allow arm needs real egress that the controlled loopback endpoint cannot
   provide on this host. Therefore both rows (`tool-web`) are gone. A Member call
   is a typed `UNKNOWN_TOOL` refusal with zero execution and zero bytes.
2. **`workflow` (PTC) — FAIL-CLOSED / REMOVED (`workflow-ptc` + `tool-workflow`).**
   Reason: model-written JavaScript executed on the host is a general
   code-execution path; routing it onto the confined subprocess face is impossible
   as shipped because that face refuses interpreter argv (`node` is not a declared
   shell-class program), and inventing a new interpreter-admitting lane is a new
   capability outside the budget. A Member call is a typed `UNKNOWN_TOOL` refusal;
   no PTC child is created (`ptcRuntimeInMemberWindow = 0`).
3. **`run_code` — `NOT_WIRED`.** It is the PTC display name and is absent from the
   governed surface in `mode=native`; no new entry was invented for it.
4. **`lsp` — `NOT_WIRED`.** The pinned host carries an LSP module; this product has
   zero wiring to it (no preset row, no realm face). No entry was invented.
5. **MCP — `UNSUPPORTED`.** The shipped product declares `mcpServers: []`; there
   are no MCP tools on the surface to govern or remove.
6. **`skill` body read — `NOT_WIRED`.** `skill` remains on the surface (in-process
   guidance loading), but the body read is a real directory read with **no a5sf
   mediation**. It is not claimed as governed; this is an adjacent, unclosed gap.

`subagent` / `subagent_fork` remain on the governed surface. The **subagent child
realm assembly is UNMEASURED** in this round (code indicates the governed provider
would refuse a child without `instanceId`, but that is a code read, not a measured
boot). Nothing in this evidence claims otherwise.

## 3. What changed (surface, not core)

| file | change |
| --- | --- |
| `cordis.patch.yml` | governed preset rows `tool-web`, `workflow-ptc`, `tool-workflow` removed; SURFACE comment states the PD-18 fail-closed rationale and what is retained |
| `scripts/a5sf-governed-preset-surface.mjs` | notes updated (removed rows, PD-18 rationale); artifact regenerated |
| `dev/agent-workflow/evidence/a5sf-governed-preset/tool-surface.json` | regenerated: `standardRowCount 29`, `shippedRowCount 25`; removed = `tool-pwsh`, `tool-web`, `tool-workflow`, `workflow-ptc` |
| `tests/world-factory/a5sf-governed-preset.test.mjs` | G0 also asserts the three closed rows are absent |
| `tests/world-factory/a5sf-pd18-web-ptc.test.mjs` | NEW host-free pin (surface, typed refusal, web allow/deny, mutation hooks) |
| `tests/world-factory/drivers/a5sf-pd18-web-ptc/` | NEW live Member driver (two boots) |
| `dev/agent-workflow/evidence/a5sf-pd18-web-ptc/` | this evidence, mutations, live runs |

No `packages/**` TypeScript changed: `CORE PATCH BUDGET = 0`; no second policy
source, no Q7/Authority/Required-CI change, no matrix grade or `V@B` change.
The standard preset and the default deployment still declare both capabilities;
only the **opt-in governed preset** shrinks.

## 4. Host-free arms (positive and negative)

`node --test tests/world-factory/a5sf-pd18-web-ptc.test.mjs` — **5 pass, 1
skipped** (pin skipped without `A5SF_PD18_PIN=1`):

| arm | what it proves |
| --- | --- |
| `PD18-SURFACE-CLOSED` | governed preset declares none of `tool-web` / `workflow-ptc` / `tool-workflow`; keeps `tool-bash`, `tool-fs`, `tool-fs-search`, `tool-jobs`, `tool-skill` (surgical, not a blanket strip) |
| `PD18-SURFACE-POSITIVE-CONTROL` | the pinned **standard** preset still declares `workflow-ptc`, `tool-workflow`, `tool-web` (capability exists outside the governed preset) |
| `PD18-TYPED-REFUSAL` | a governed-shaped registry returns `isError=true` with `unknown tool "workflow"` / `unknown tool "web_fetch"`; a registered tripwire proves zero executions (`effects = 0/0`) |
| `PD18-WEB-ALLOW` | the confined web face admits one allow-lane call to a **real loopback** endpoint: 1 request, the endpoint bytes returned, 1 `web:fetch` allow fact |
| `PD18-WEB-DENY` | the same face refuses `network=deny` **before** the provider: typed `NETWORK_UNCONFINED_REALM` (not the host SSRF message), 0 endpoint requests, 0 provider entries, 1 deny fact |

The allow/deny arms are the harness proof that the **face is not broken**; they
are not evidence that the shipped governed preset can reach the web — it cannot,
by design of this disposition.

## 5. Mutation controls (≥2; each reddens exactly one named arm)

`node dev/agent-workflow/evidence/a5sf-pd18-web-ptc/mutation-control.mjs` — see
`mutations.log` (observed runs, not claims):

| mutation | change | expected red | observed |
| --- | --- | --- | --- |
| **M1** SURFACE-READD | re-add `tool-web` to the governed preset in a temporary copy of `cordis.patch.yml` (`A5SF_PD18_COMPOSITION`); repo file untouched | `PD18-SURFACE-CLOSED` | that arm red |
| **M2** DISPATCHABLE | register a tripwire `workflow` definition in the test registry (`A5SF_PD18_MUTATE_REGISTER_WORKFLOW=1`) | `PD18-TYPED-REFUSAL` | that arm red |

Baseline (no mutation) is green. M1 proves the surface arm reads the **shipped
declaration** rather than a constant; M2 proves the refusal arm measures
**absence + zero execution**, not a string.

## 6. Live Member pair (DEV-LIVE; boot evidence is not merge evidence)

Command (two boots, agreeing pair; the parent will re-test):

```
node tests/world-factory/drivers/a5sf-pd18-web-ptc/run-boot.mjs --boots 2
```

- Host pin read-only: `639ed015397290b3745d163aafe02ffee4aa3f84`; `host porcelain
  before/after: []`.
- Lease: `devlive-subprocess-1`, world `u5a5sfsub1`; ports in the 3180 family;
  `DSH_HOME` under `tests/homes/`; `:3080` untouched.
- Model: the shared scripted mock (`packages/tools/harness/mock-deepseek.mjs`);
  the /proc watcher, loopback endpoint and request log are disclosed fixtures.
- Both boots: **overall PASS, 8/8 cases**, `agreeing pair=true` (`agreement.json`
  / `.txt`). Stable rows include: 1 allow + 1 deny `shellRead` fact, 1 confined
  launcher, `ptcRuntimeInMemberWindow=0`, `endpointRequests=0`,
  `baseBwrapWithMarkers=0`.

Arm-by-arm (each case is the same in both boots):

| case | evidence |
| --- | --- |
| `pd18:member-bash-admitted` | in-lane bytes through the confined terminal; `isError=false` |
| `pd18:member-bash-denied` | typed `IO_READ_DENIED`; zero secret bytes |
| `pd18:member-surface-closed` | Member surface (40 names) names no `workflow`, `web_fetch`, `web_search`, `run_code`; `bash` present; endpoint 0 requests |
| `pd18:member-workflow-typed-refusal` | `isError=true`, text `unknown tool "workflow"`, no `42`; not the SSRF path |
| `pd18:member-web-typed-refusal` | `isError=true`, text `unknown tool "web_fetch"`; endpoint 0 requests / 0 bytes; **not** the base SSRF refusal |
| `pd18:leader-workflow-allowed` | **before** the Member window, the same Host tree on the standard BOOT_ROOT preset executed `workflow` and returned its deterministic `42`; the standard Leader surface (43 names) still has `workflow`/`web_fetch`/`web_search` |
| `pd18:guard-facts-shell-only` | the only guard facts are the two `shellRead` decisions (1 allow, 1 deny) |
| `pd18:no-member-code-exec` | 1 confined launcher for two bash commands; 0 `ptc-runtime` processes in the Member window; 0 base `bwrap` children with Member markers |

The flip is visible in the Member transcript: the pre-fix path would return `42`
for `workflow` and a host-SSRF error for `web_fetch`; the post-fix path returns
`unknown tool` for both, with no execution and no bytes.

## 7. Gates run in this worktree

| gate | result / log |
| --- | --- |
| a5sf family, pin on: `A5SF_PD18_PIN=1 node --test tests/world-factory/a5sf-*.test.mjs` | **578 tests, 572 pass, 0 fail, 6 skipped**; the PD-18 pin ran and passed — `a5sf-family.log` |
| PD-18 suite alone | 6/6 with the pin (`5 pass` + pin) — see family log |
| mutation control | PASS: baseline green, M1 → `PD18-SURFACE-CLOSED`, M2 → `PD18-TYPED-REFUSAL` — `mutations.log` |
| live pair `--boots 2` | PASS, 8/8 cases per boot, `agreeing=true differing=[]`, host porcelain empty — `driver.log`, `agreement.json/.txt` |
| web/subprocess/PTC package tests (`vitest run` on 5 files) | **85 tests, 5 files, all passed** — `package-tests.log` |
| `pnpm -r typecheck` | **9/9 workspace packages `Done`, exit 0** — `typecheck.log` |
| eslint (changed files) | **0 errors**; test/evidence paths are ignored by the repo config |
| `node scripts/check-artifacts-committed.mjs` | `verdict=ok compared=1973 glue=106` |
| `node scripts/doc-checks.mjs` | exit 0 |
| `node scripts/ci-pr-gate.mjs --only state-freshness` | `verdict=pass` (round 58, contract ok) — `ci-pr-gate.log` |
| `a5sf-debt-register.test.mjs` (register) | included in the family run above: pass |

## 8. Limits, stated plainly

1. **This is a capability regression.** Web and PTC are gone from the opt-in
   governed preset. That was chosen over leaving a host-executed, zero-fact
   surface in place; it is not parity with a governed implementation.
2. **Boot evidence is DEV-LIVE, not merge evidence**, and not `V@B`. The parent
   re-tests.
3. **Subagent child realm assembly is unmeasured** (see §2); the statement below
   is scoped to the Member turn that was measured.
4. **The web face is not wired to the shipped preset**; the allow/deny arms prove
   the face, not a shipped deployment path.
5. **`skill` body reads and `lsp`/MCP remain ungoverned/absent as labelled**; no
   new entries were invented.

## 9. The one-sentence answer

**Today a governed Member cannot run code on the host with zero facts — `workflow`
and `web_fetch`/`web_search` are off its preset and every call is a typed
`UNKNOWN_TOOL` refusal — but this is a fail-closed capability regression, and the
web deny lives at the host tool router (the tool is not dispatchable), not at the
a5sf web face; that face's own deny (`NETWORK_UNCONFINED_REALM`) is proven
separately and is not reached by the shipped preset.**
