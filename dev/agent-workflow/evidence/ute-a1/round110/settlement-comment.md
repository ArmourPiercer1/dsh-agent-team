[dated settlement, 2026-11-25T04:10:00Z]

Settlement for `c096f9857f12f7080cccddeec2f4cb87246bd92f` (round 110 — the rc.5 test population: matrix + three observation-only adaptations). Parent: `fc170f929` (round-109 correction) → `c096f9857` (this commit). Fast-forward push `fc170f929..c096f9857`; no history rewrite, no merge, **PR #822 stays DRAFT**.

**Why this round exists.** Review `20261125-0058` Stage B, first item: the rc.5 matrix must cover the broader Vitest / node:test population, not only the four D drivers. This round builds that population from code and measures it honestly.

**Population, from code.** The catalog's 785 entries (733 collected, 38 uncollected, 14 excluded); its 771 non-excluded files were classified by host-value imports of bare `@deepseek-ai/*`, `tests/paths.mjs` pins, the host loader and `TEAM_TEST_HOST` reads: **93 carry a host signal, 678 are host-free** and are not counted as rc.5 coverage. Three populations are kept apart — host-generic (boots/imports the SELECTED host), rc.2-subject (pins the legacy host as its subject), rc.5-pinned (imports `NEXT_HOST` directly).

**Measured on rc.5: 759 tests / 737 pass / 21 fail / 1 skip.**

- `ute-vnext-a1` 251 / 232 / 18 / 1 skip (rc.2: 251 / 248 / 0 / 3)
- UTE G1 exact CI argv **89/89**; next-host/settlement/closure lane **184/184**
- leg-declared node suites under the selector 232 pass / 3 fail

Every red is dispositioned:

- **18** = all `vnext-b-probe-ladder` arms. `vnext-b-probe-ladder.test.mjs:273` mounts `ToolRuntime { mode: 'both' }`; rc.5 `packages/core/tools/lib/index.js:407` declares `mode: z.never()`. The `before` hook rejects → **deterministic failure in ~0.5 s**, and the historical "hang" is that rejection with no per-test timeout: with `--test-timeout=45000` the bundled leg completes (251/232/18/1). **No gate timeout was changed and no suite was skipped.** The adaptation surface (executor service instead of `mode`, batch dispatch, `PtcExecutor.requirePtcTransport()` for the run_code arms) is an open arm design, deliberately not rewritten inside a matrix round.
- **1** = `a5sf-fs-contract` FSB-IMG-1b, which measures the **rc.2** tool package (`:297`) → rc.2-subject, N/A.
- **2** = `m7a-real-slice-host-state`, which boots the **rc.2 census** slice in a child process → rc.2-subject, N/A.

**Three test-side rc.5 drifts adapted, observation only (no assertion weakened):**

1. `packages/runtime/test/vnext-admission.test.mjs` ADM-96/97: fabricated `exec` frames now carry `signal: new AbortController().signal`; rc.5's MCP client calls `AbortSignal.any` (`mcp-client/lib/index.js:496`) and rejects a missing signal (`ERR_INVALID_ARG_TYPE`). `admission` → **163 / 162 pass / 0 fail / 1 skip on BOTH hosts**.
2. `tests/world-factory/a5sf-harness.test.mjs:243`: the candidate-pin arm compares against the **selected** pin (`selectedHostPin`) and keeps the "40-hex literal must not be copied" law, instead of comparing to the rc.2 constant → **10/10 both hosts**.
3. `tests/world-factory/a5sf-native-route-c.test.mjs`: host modules resolve through `resolveSelectedHostModule` (the rc.2 `createRequire` had put two `dsh-scope` namespaces in one process → `scopeOf` undefined → `a5sf-realm-row.mjs:782`), the rc.5 executor is mounted as its exported `{ name, inject, apply }` plugin (the bare class skips `inject` → `tool-executor-native/lib/index.js:10`), and dispatch uses the **existing** `executeToolDispatch(..., { hostMode })` helper. → **8/8 both hosts**, so route C is now measured on rc.5.

**Blueprint fence.** The ADM-96/97 adaptation shifted the two pre-existing v5 fixture literals by +12 lines; the baseline (`dev/agent-workflow/evidence/a4-pr7/ci-gate/blueprint-fence-baseline-606a0be7.txt`) was re-recorded **from the gate's own report** with a dated comment. No blueprint document was authored, edited or resolved. The first gate run at the pre-commit head was RED on that leg; the re-run and the final-head run are green.

**Gates at this head (all pasted in `RC5-TEST-MATRIX.md` §8):** `dispatch-tests --run --leg ute-vnext-a1` 251/248/0/3 (digest `sha256:edd4f1c4…` unchanged); `test-catalog` 785/733/38/14 findings=0 (digest `sha256:da8a452d…` unchanged — no new scannable file, no p4t6 delta); `ute-cut-closure --check` `cut(0/148)`; `ute-p0-assets --check` `cut(148/148)`; `docs-sync --check` docs=193 findings=0; `place-dist-glue` 35 byte-identical; `eb3-ci-required` workflows=11 findings=0; bound vitest 238/238; UTE G1 89/89; `EB3-RUN-MANIFEST` records=600 strict=0 incomplete=11 findings=0; **`ci-pr-gate --full --census-captures 2` PASS 10/10 at `c096f9857` (283.9 s, census `599f/7424l` twice, identical identity sets)**.

**Disclosed gap, unchanged:** 40 vitest suites that load host code cannot be graded on rc.5 through the selector — Vite resolves the repo install before Node's loader (measured: a probe imported `@deepseek-ai/dsh-scope` `0.2.0-rc.2` under `TEAM_TEST_HOST=next` + host-loader). A `resolve.alias` would be a second selection mechanism, so those 40 stay rc.2-only and are **not** counted as rc.5 coverage.

**Levels: no row moves.** No PRODUCT-PROVEN row is added; the four D drivers were not re-run and their round-109 verdicts stand (Candidate Gate remains NON-REQUIRED by owner ruling).
