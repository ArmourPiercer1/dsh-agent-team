# P8-S5-PRE result — host-load-path characterization (read-only) — 2026-08-31

Investigator: fresh read-only subagent (qiyuan-self/qwen3.8-27b), worktree P8S5 @ 24c4f18 clean, zero writes.

## 1. Exact shipped production plugin load artifact/path

The unmodified upstream host imports the row via plain Node `import()` (`vendor/loader/src/config/tree.ts:156-159`; relative name resolves against profile dir — P1-T5 `verify-report.md:159-162`). The artifact = **`packages/runtime/dist/plugin/host.js`** (built from `src/plugin/host.ts:34,42`; G1 row → `file:///…/packages/runtime/dist/plugin/host.js`, `verify-report.md:147`; `B-pristine-smoke/profile-final.txt:14`). Client half analogous. `dist/` is gitignored (`.gitignore:8`).

## 2. Exact sanctioned build/load mechanism

Build: per-package **`tsc -p tsconfig.build.json`** (root `pnpm build`; pnpm spawn EPERM in sandbox → tsc invoked via pwsh; `verify-report.md:78-79`; `outDir=dist`). Mount: relative file row in `DSH_HOME/profiles/web/cordis.patch.yml` — `- insert: - id: dsh-agent-team, name: '<4-up>/…/packages/runtime/dist/plugin/host.js'` (`profile-final.txt:12-16`; `TEST_METHODS.md:52`). Boot: **`node apps/cli/lib/bin.js web --port 3180 --no-open`** + DSH_HOME + `DSH_CLIENT_COMMIT_HASH=cd5ef814` (`TEST_METHODS.md:26-28`). No node --import in production boot; `plugin.mjs:76-79` ts-loader is harness-only.

## 3. Package exports

**No.** All 8 buildable packages already export `.` → `./dist/index.js` + types = tsc output (`runtime/package.json:9-14`; all verified). The row names the built file directly → no subpath exports needed (`verify-report.md:127-129`: "bare package row cannot name them without upstream exports changes"). Minimal change: none — only dist/ build output.

## 4. Frozen-doc evidence

DevPlan §13.6 (1976-77) "✓ plugin skeleton builds independently" + "✓ plugin can be composed with pristine upstream"; §4.12 (1005-16) "external dsh-agent-team cordis overlay"; Architecture §42 inv.2 (2855) "Team runtime 必须可作为独立外部插件加载". Frozen docs silent on tsc/dist specifics (zero occurrences); the concrete chain = `TEST_METHODS.md:26-28,52` + package.json build scripts (root:12, runtime:19) + `verify-report.md:79,147-156` (P1-T5 proven).

## 5. ARCHITECTURE_DECISION_REQUIRED

**NO.** TEST_METHODS §2/§4, G1 criteria, and the proven P1-T5 chain (tsc dist + relative file row + bin.js boot) already prescribe it; P8-S §19.2 consistent. Remaining freedom (import style inside host.js) is an S5 coding detail.
