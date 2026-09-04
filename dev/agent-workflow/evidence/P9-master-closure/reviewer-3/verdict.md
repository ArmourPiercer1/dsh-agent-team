# R3 Verdict — installability & red lines
# Reviewer: R3 (independent reviewer 3 of 3, P9-master-product-closure gate)
# Tree: int/P9-master-product-closure @ 8cf9fcb (D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\P9-MC)
# Baseline: master @ 2c1c200; R122 verified world references/.dsh-test-s8-2026-09-04T12-26-59 (read-only); RC1 worktree (read-only)
# Date: 2026-09-04. Mode: strictly read-only (single write = this file).

VERDICT: NO-GO

The product artifacts (dist host surface + client composition shim) are byte-identical to the
R122 live-verified R122 world and all git red lines hold. However, the documented install chain
(docs/INSTALL.md) for an independent machine has two independent, deterministic gaps: a host
row mounted exactly per the doc's template fails fail-closed config validation, and the
documented `pnpm install && pnpm build && pnpm build:composition` chain does not make the
runtime bare imports of the glue and seam modules resolvable. Both must be fixed (doc-level,
no product-surface change required) before master can be called an installable product.

────────────────────────────────────────────────────────────────────────────
## Per-check table
────────────────────────────────────────────────────────────────────────────

| # | Check | Expected | Observed | Pass/Fail |
|---|-------|----------|----------|-----------|
| 1.1 | `scripts/place-dist-glue.mjs` exists and does what doc §2 says | Copies `packages/runtime/src/plugin/live/agent-bindings.mjs` byte-identical to `packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs`; fail-closed; notes upstream-resolver.mjs needs no copy | Script exists; exactly this behavior (PLACEMENTS table; exit 1 on missing src or missing dist root; header documents the resolver exemption). Resolver exemption corroborated by host.ts hookCandidates layout list (L176-180) | PASS |
| 1.2 | `scripts/build-client-composition.mjs` exists and does what doc §2 says | Builds tsc ESM client dist + CSS into single-file `window.__ModuleLoader__.load` bundle, identity class map + `<style>` injection, fail-closed baseline-external set, emits `dsh.client` manifest + inert Node half into out dir | Script exists; exactly this behavior (EXTERNALS fail-closed die; CSS identity map; writes client-bundle.js + index.js + package.json) | PASS |
| 1.3 | Root `package.json` has `build:composition` with the documented exact command | `node scripts/place-dist-glue.mjs && node scripts/build-client-composition.mjs packages/client packages/client/composition-shim` | package.json L13 matches verbatim; `packageManager pnpm@11.7.0` and `engines node ^22.19.0 \|\| >=24.0.0` also match doc §1 | PASS |
| 1.4 | `.gitignore` covers `packages/client/composition-shim/` | Entry present | `.gitignore` L14 `packages/client/composition-shim/` (plus `dist/` L8, `references/` L1) | PASS |
| 1.5 | Dist entry points the doc claims exist after build (P9-MC disk) | `packages/runtime/dist/packages/runtime/src/plugin/host.js`; `…/plugin/live/agent-bindings.mjs`; `packages/runtime/root-binding/harness/seam.mjs`; `packages/client/composition-shim/` | All four exist on disk (dist built in-tree, 1017 files). host.js ESM graph walked (236 files): self-contained, only runtime bare external = `yaml` (declared dep of packages/runtime). `dist/packages/legacy/session-reader/index.js` (loadLegacyInspect dist candidate, host.ts L294) exists | PASS |
| 1.6 | Doc's dist surface = the R122-verified surface | Byte-identical host artifacts vs RC1 worktree (the tree R122 mounted) | SHA-256 SAME for: dist host.js, dist agent-bindings.mjs, src agent-bindings.mjs, seam.mjs, upstream-resolver.mjs (RC1 vs P9-MC). Matches evidence/P9-master-closure/byte-compare.md recorded hashes | PASS |
| 1.7 | Mount template field names match R122 world `profiles/web/cordis.patch.yml` field by field | bootPhase, rootSessionId, blueprintSource, seedMembers, staticModel, environmentFacts, externalPolicyFacts, glueUrl, seamUrl, client row name all present with matching names/semantics | All 9 documented fields match the R122 row (same names; same 3 environmentFacts; same glue/seam relative paths; client row id `dsh-agent-team-client`). **BUT the R122 row additionally carries `generation: 1`, `deniedSelection: null`, `mcpServer: null` — all absent from the doc template** (see B1). `defaultWorkspace` correctly documented as optional bullet | **FAIL** (see B1) |
| 1.8 | file:// URL conventions + relative client-row fallback coherent with R122 | Forward-slash `file:///D:/…` host row; client fallback = DSH_HOME-local dir + `../../<dir>/index.js` | Host file:// form matches R122 exactly. Fallback guidance (`DSH_HOME/team-client-row/` + `../../team-client-row/index.js`) matches R122's `../../s8-client-row/index.js` form. Caveat: R122 used the relative form as the primary (verified) form; the doc leads with the unverified file:// form (see N1) | PASS (with N1) |
| 2.1 | `s8-client-row/package.json` (R122) vs fresh-machine `composition-shim/package.json` manifest shape | Same `dsh.client` manifest + `./client` export | Byte-identical (SHA-256 B4509233… both). name `@dsh-agent-team/client`, `dsh.client.platform: web`, exports `.`, `./client`, `./package.json`, files [client-bundle.js, index.js] | PASS |
| 2.2 | `composition-shim/client-bundle.js` exists on disk (generated during gates) | Present, = verified R122 artifact | Present (845,581 B); SHA-256 2097CE5E… byte-identical to `references/.dsh-test-s8-…/s8-client-row/client-bundle.js` and to byte-compare.md record. `index.js` also byte-identical (D385C065…) | PASS |
| 3.1 | R122 blueprint YAML model facts | Model lives in row-level `staticModel`, not blueprint | R122 `blueprintSource` contains no model facts (leader/members/requirements/envelopes/policyStates/quotas/metadata only); row `staticModel: {provider: deepseek-official, model: s8v-model}` = the fake test model | PASS |
| 3.2 | Doc §4 real-model requirement coherent with repo contracts | `staticModel` = real provider/model required for real installs; no contradiction with code | Doc §4 states exactly this and correctly labels R122's fake model a test rig. Code: host.ts fail-closed validation `{provider, model}` strings (L238-243); root.ts passes provider/model into the root agent (L641-642, L1361-1394). No contradiction | PASS |
| 4.1 | `git log --oneline -5` | int tip 8cf9fcb = merge + R125 | `8cf9fcb R125(1/2)` → `232316d Merge task/upstream-rc1-compat` → `2c1c200 R124` → `a733e9f R123` → `c5ef6e6 R122` — matches merge-audit.md | PASS |
| 4.2 | `git status --porcelain` | Clean or only untracked gate artifacts — report exactly | Exactly one entry: `?? dev/agent-workflow/evidence/P9-master-closure/` (untracked closure-evidence directory incl. gate-*.log, byte-compare.md, merge-audit.md, and this reviewer's output). No modified/staged/tracked changes | PASS (reported exactly) |
| 4.3 | `git merge-base --is-ancestor master int/P9-master-product-closure` | exit 0 (master ff-able) | exit 0; master 2c1c200 is an ancestor of int 8cf9fcb (merge commit 232316d has master as parent 1) | PASS |
| 4.4 | int branch not pushed | No remote `int/P9-master-product-closure` | `git branch -r`: absent. Single `git ls-remote origin` (exit 0) remote heads: int/P8-S-backend-closure 7d07330, int/P8-remote-projection 3fa4c1f, int/T12-production-closure c455c43, master a733e9f, task/P9-ui-legacy-reuse dc056d5, task/T12-vertical-slice 3e7da91, task/upstream-rc1-compat bd38827 — no P9-master closure ref. (Remote master @ a733e9f = R123; local master 2c1c200 ahead 1 = R124 bookkeeping, by design per router log R124 L1686 — see N7) | PASS |
| 4.5 | CORE PATCH BUDGET = 0: `git diff --name-only 2c1c200 8cf9fcb -- references` | Empty | Empty (exit 0). `references/` is fully untracked/gitignored (0 tracked files); int range = 6 files per merge-audit.md §5 (2 scripts + INSTALL.md + .gitignore + package.json + eslint.config.mjs), none upstream | PASS |
| 5.1 | Troubleshooting row "host 行加载失败" corresponds to a real documented failure mode | R122 evidence of glue-dist-missing / file-path boot failures | Router log R122 L1645: first 5 S8 boot failures = install-topology/build-layout, incl. (i) dist missing glue mirror `agent-bindings.mjs` (tsc emits no .mjs) and (ii) worktree node_modules missing undeclared `@deepseek-ai/*` → fixed by junction-farm reconciliation. Row's remedy covers (i) via the productized build chain but not (ii) — see B2 | PASS (with B2) |
| 5.2 | Troubleshooting row "client 行加载失败" corresponds to a real failure mode | Missing shim / file:// not accepted → relative fallback | `pnpm build:composition` is the sole producer of `composition-shim/` (gitignored); the fallback form is exactly R122's verified form. Real failure mode, coherent remedy (see N1 re: which form is verified) | PASS |
| 5.3 | Troubleshooting row "页面 404" corresponds to a real failure mode | DSH web shell artifact missing | TEST_METHODS.md §2.3: `GET /?token=` → 200 needs `apps/web/dist`; 404 without it (source-installed DSH must `pnpm build:web` once) — doc row matches this documented semantics | PASS |
| 5.4 | Troubleshooting row "成员轮次不动" corresponds to a real failure mode | Model credential / staticModel misconfig | Consistent with doc §4 + R122 fake-model fact (deterministic test rig, not a real provider); root.ts shows the model flows into member model rounds | PASS |

────────────────────────────────────────────────────────────────────────────
## Blocking findings
────────────────────────────────────────────────────────────────────────────

### B1 — INSTALL.md §3 mount template omits three required row-config fields (deterministic boot failure)

`validateTeamPluginConfig` (packages/runtime/src/plugin/host.ts, called raw at L391, no
normalization) fail-closes on the doc template as written:

- L222: `generation` must be a positive integer — `undefined` fails. Template omits it.
- L245-252: `deniedSelection` must be present and be `null` or a plain object — `undefined`
  fails (`c.deniedSelection !== null && c.deniedSelection === undefined` → fail). Template omits it.
- L253-261: `mcpServer` must be present and be `null` or `{name, port}` — `undefined` fails.
  Template omits it.

The R122 verified row carries all three (`generation: 1`, `deniedSelection: null`,
`mcpServer: null`). A user who mounts the doc template verbatim gets
`TEAM_PLUGIN_CONFIG_INVALID: dsh-agent-team row config: generation must be a positive integer`
at host-row apply — the row never loads, before glue/seam are even touched.

**Required doc fix** — add to the §3 template under `config:`, matching the R122 row:

```yaml
        generation: 1
        deniedSelection: null
        mcpServer: null
```

### B2 — Documented fresh-machine chain cannot resolve the glue/seam runtime bare imports (deterministic boot failure)

The two modules the row loads at runtime via config URLs import bare specifiers that are
declared nowhere in this repo, so `pnpm install` never provides them:

- glue `agent-bindings.mjs` (dynamic-imported at apply, host.ts L455; failure text L459
  "the glue module (…) could not be loaded"): `@deepseek-ai/dsh-session`,
  `@deepseek-ai/dsh-agent`, `@deepseek-ai/dsh-llm`, `@deepseek-ai/dsh-mcp-client`.
- seam `seam.mjs` (dynamic-imported at root storage binding, host.ts L421):
  `@deepseek-ai/dsh-storage-domain`, `zod`.

Evidence the fresh clone lacks them:
- `packages/runtime/package.json` declares only `yaml`; no `@deepseek-ai/*` or `zod` anywhere
  in any package.json; `pnpm-lock.yaml` contains zero `@deepseek-ai/dsh-*` entries.
- Disk state of P9-MC (real `pnpm install` from the R125 gate): `packages/runtime/node_modules`
  = {yaml} only; root `node_modules` = root devDeps only, **plus** an `@deepseek-ai/` dir of
  junctions pointing into `references/deepseek-harness-test-use/packages/…` — i.e., the
  gitignored test-harness "junction farm" (seam.mjs L28-30 self-documents: "resolve through
  the harness's gitignored node_modules junction farm (run.mjs, ensureProbeResolution)";
  router log R122 L1645 (ii): boot failed until "junction-farm reconciliation … 10
  specifiers … 0 unresolved"; RC1 root node_modules carries 8 `@deepseek-ai/*` + `zod` links;
  every P8-S postflight removed the farm).
- Node resolves these from the importing file's location walking up through
  `packages/runtime/node_modules` → `packages/node_modules` → `<clone>/node_modules`; none
  contains them on a fresh machine. Cloning inside a DSH source checkout also does not fix
  it (verified: test-use root `node_modules` has no `zod` and only 2 of the 8
  `@deepseek-ai/*` links).
- The R122 boot only succeeded with the farm present, while the DSH instance itself ran from
  a complete monorepo checkout — empirical proof that DSH's loader does NOT resolve the
  plugin's bare specifiers from the DSH install.

Result on an independent machine following INSTALL.md: host-row apply fails at glue load
(boot), or, if that were bypassed, the storage seam fails at root binding. INSTALL.md §6
troubleshooting does not cover this failure mode.

**Required fix (either, documented in INSTALL.md):**
(a) doc-level: add a mandatory "dependency resolution" step — after `pnpm install`, create
links in `<clone>/node_modules/` for the verified farm set: `@deepseek-ai/dsh-session`,
`@deepseek-ai/dsh-agent`, `@deepseek-ai/dsh-llm`, `@deepseek-ai/dsh-mcp-client`,
`@deepseek-ai/dsh-storage-domain`, `@deepseek-ai/dsh-persona`, `@deepseek-ai/dsh-scope`,
`@deepseek-ai/dsh-system-prompt`, `zod` → pointing into the target machine's DSH 0.1.2-rc.1
source checkout (`packages/core/session`, `packages/core/agent`, `packages/llm/llm`,
`packages/mcp/mcp-client`, `packages/storage/storage-domain`, `packages/preset/persona`,
`packages/core/scope`, `packages/core/system-prompt`; zod from that checkout's pnpm store),
mirroring the R122-verified RC1 farm; and add a troubleshooting row for
"glue module could not be loaded" → this step. (The 8+1 set is the empirically working set;
the 6 top-level plugin imports are the minimum.)
(b) product-level alternative: declare the required `@deepseek-ai/*` + `zod` as dependencies
of `packages/runtime` (they carry `publishConfig: {access: public}` in DSH source, so an npm
declaration is possible) so `pnpm install` provisions them — but version alignment with
DSH 0.1.2-rc.1 would need pinning/verification, and this changes the product surface, so it
is a decision for the main agent, not a reviewer preference.

Neither gap requires changing the verified artifacts (dist + shim stay byte-identical).

────────────────────────────────────────────────────────────────────────────
## Non-blocking observations (doc corrections, precise)
────────────────────────────────────────────────────────────────────────────

- N1 — INSTALL.md §3 leads with `file://` for the client row, but the R122-verified form is
  the DSH_HOME-relative one (`../../s8-client-row/index.js`); browsers cannot fetch `file://`
  resources from an `http://` page, and DSH serves client rows through its `/plugins/` static
  route (R122 probe: index injects `/plugins/??@dsh-agent-team/client/client.js&rev=…`).
  Recommend making the relative form the primary (or explicitly marking file:// unverified).
- N2 — §3 hot-reload bullet: the shipped `web` profile already defaults to
  `patchReload: live` (DSH rc.1 app-boot: "The shipped `web` template uses live reload";
  profile.spec.ts pins `PROFILE_TEMPLATES.web.patchReload === 'live'`). The "否则重启"
  fallback never applies to the documented `profiles/web` target; harmless, but worth a
  one-line note.
- N3 — §2 "9 个包 tsc → packages/*/dist" is imprecise: `packages/legacy`'s build emits into
  `packages/runtime/dist` (tsconfig.build.json `outDir: ../runtime/dist`), so
  `packages/legacy/dist` does not exist after build (matches on-disk state; the runtime dist
  mirror contains `packages/legacy/session-reader/` which host.js actually consumes).
- N4 — R122 `blueprintSource` string carries YAML `---` document markers; the doc's inline
  template omits them. Both parse identically (YAML.parse); informational only.
- N5 — `dev/agent-workflow/evidence/P9-master-closure/` is untracked. Repo discipline
  (ROUTER_RULES §7: 日志随每轮落盘提交) and router-log R123 precedent expect evidence to be
  committed with the integration; the archive path was already noted as pending user
  decision. Bookkeeping before the ff; does not affect installability.
- N6 — Router log R122 L1649: `upstream-resolver.mjs` redirect path computation was never
  functional (dirname×3 vs ×4); resolution always relied on node_modules walk + install
  state. Consistent with the doc's "no copy needed" claim (layout candidates still load the
  file), but it means B2's environment step is the sole resolution path on a fresh machine.
- N7 — Remote `master` is at `a733e9f` (R123); local master `2c1c200` (R124 bookkeeping) is
  ahead 1 by design (router log R124 L1686: "master 现领先 origin 1，由下一次用户授权推送
  携带"). The post-gate push must carry both. Informational.

────────────────────────────────────────────────────────────────────────────
## Evidence pointers
────────────────────────────────────────────────────────────────────────────

- docs/INSTALL.md (audited in full); docs/TEST_METHODS.md §1/§2.3
- scripts/place-dist-glue.mjs; scripts/build-client-composition.mjs; package.json L13; .gitignore L14
- packages/runtime/src/plugin/host.ts L205-276 (validateTeamPluginConfig), L290-294 (legacy mirror candidate), L403-427 (seam load), L455-460 (glue load); packages/runtime/src/plugin/root.ts L641-642
- packages/runtime/src/plugin/live/agent-bindings.mjs L13-15 (header: prebuilt @deepseek-ai/* only); packages/runtime/root-binding/harness/seam.mjs L28-34 (junction-farm self-documentation + imports)
- references/.dsh-test-s8-2026-09-04T12-26-59/profiles/web/cordis.patch.yml (R122 mount, field-by-field baseline); …/s8-client-row/{package.json,index.js,client-bundle.js}
- dev/agent-workflow/evidence/P9-master-closure/{byte-compare.md,merge-audit.md,gate-summary.md}
- dev/agent-workflow/SESSION_ROUTER_LOG.md R122 L1645 (5 boot failures + junction farm), L1649 (resolver note), R124 L1676-1686 (push state)
- SHA-256 (this review, independently recomputed): client-bundle.js 2097CE5E570B187F4F163DD09C8FBEE9BF2E04298120B7EA221229423CB86997; shim package.json B4509233321F8D293BE0A1C6679F3AA3400B7C94B3425D13A6E2CB71846FFA6A; shim index.js D385C065BBFAA8A2ABE3A98FE67FBC763A959A1FFB5DB05E9E177337CE3D2273; host-side artifacts RC1≡P9-MC (5 files SAME)
- git: log -5 / status --porcelain (1 untracked) / merge-base --is-ancestor exit 0 / branch -r + single ls-remote (int ref absent; remote master a733e9f) / diff 2c1c200..8cf9fcb -- references (empty)
