# GLUE-6 — install-surface self-sufficiency + the render contract (alpha5-glue6-fix)

Round: **GLUE-6 fix writer** (install-surface self-sufficiency + render contract).
Base = master `230022598dc96a377e25039bb55a27776a682552`; fix commit `3b1b515f`; this
kit + README ride the same branch. **CORE PATCH BUDGET unchanged (0)** — every stroke is
in this repo's own files, its committed dist mirror, and public host seams.

REQUIREMENT INPUT (still RED, untouched): the INSTALL-ENTRY evidence round
(`feat/alpha5-install-entry-evidence` @ `6a0f8e19`, run
`../install-entry/runs/2026-10-17T17-06-56Z`) recorded two shipped-artifact defects. This
round reproduces BOTH on this base, fixes them, and keeps the historical capture as
history under [`history/`](history/) (byte-for-byte copies + sha256 in
[`history/MANIFEST.json`](history/MANIFEST.json); that branch was never written to). The
third gap that capture recorded — the Tool-Binding feed (pb §6 positive control) — is the
P-B line's, **not** this round's, and is not claimed here.

## 1. 交付表（五栏）

| # | 文件 | 是什么 / 入口 | tests-only? | root build & committed dist? | 用户现在可用 + 剩余阻塞 |
|---|------|--------------|-------------|------------------------------|------------------------|
| 1 | `packages/runtime/src/plugin/host.ts` (EDIT) | the shipped plugin ENTRY. Two runtime `.mjs` loads are re-anchored to the **package face**: `registerUpstreamResolverOnce()` now tries `./upstream-resolver.mjs` first, `defaultSeamUrlCandidates()` puts `../../root-binding/harness/seam.mjs` first; out-of-face specifiers stay as later candidates, and the fail-closed registration names the in-face file | no — production entry | YES: compiled into `packages/runtime/dist/packages/runtime/src/plugin/host.js{,.map}` + `.d.ts{,.map}`, drift gate green | YES — a strict `files:["dist"]` unfolding boots (measured: 1730 files, boot GREEN, zero `ERR_MODULE_NOT_FOUND`) |
| 2 | `packages/runtime/src/plugin/upstream-resolver.mjs` (EDIT) | the `module.register` resolve hook. Repo-root derivation no longer counts `dirname()` levels (it only recognized the SOURCE layout and silently deadened its own fallback when loaded from the mirror); it matches a closed **layout-suffix pair** and yields both `tests/` and `references/` candidates per root | no — runtime file, now mirrored | YES — new PLACEMENTS entry (byte-copy) puts it at `packages/runtime/dist/packages/runtime/src/plugin/upstream-resolver.mjs` | YES — and it now actually functions when loaded from the mirror (before: candidate list pointed outside the face) |
| 3 | `packages/runtime/src/plugin/live/team-tool-plane.mjs` (EDIT) | the R1 placement assembly entry: `PLANE_PRESENTATION_FACE.render` now projects the closed `{ text }` envelope onto exactly ONE `{type:'text',text}` block (host law, both lanes) | no — production live row | YES — existing PLACEMENTS entry; the mirror copy is in this commit | YES — the live trio returns legal `ContentBlock[]`; the lane verdict reaches the model |
| 4 | `scripts/place-dist-glue.mjs` (EDIT) | the mirror plumbing: PLACEMENTS `+2` (resolver, seam) = 5 placements total; header paragraph replaced (the old text called the out-of-face `.mjs` "deliberate" on the assumption a source checkout is always present) | no — build plumbing | YES (it IS the build step; `check:artifacts` compares it) | — |
| 5 | `packages/runtime/root-binding/harness/seam.mjs` → `packages/runtime/dist/…/root-binding/harness/seam.mjs` | the default storage seam, byte-identical mirror (no content change to the source) | no | YES — new PLACEMENTS entry | YES |
| 6 | tests: `packages/runtime/test/a5g6-install-face-render.test.ts` (NEW, 5 legs), `packages/runtime/test/pbf-default-artifact-urls.test.ts` (seam order re-pinned), `packages/testkit/test/p4t6-session-event-scan.test.ts` (ledger `1168 → 1169`) | the unit regression legs: both mirrors exist inside dist and hash-identical to source, seam candidate 0 resolves inside the mirror, and the DIST plane module's trio definitions render legal blocks | tests-only | n/a (test files are not shipped; the scanner ledger books the new file) | — |
| 7 | this kit: `a5g6-install-kit.mjs` + `a5g6-observer-row.mjs` + one-field `package.json` identity sentinel + `history/` | three-posture install-surface proof (below) | evidence only | no | — |

## 2. 修复 ① — RED-A：严格 install face 不自足

- **症状（先复现）**：把 `files:["dist"]` 声明的那一面真展开（`git archive HEAD --
  packages/runtime/dist packages/runtime/package.json` = **1728 files** @ base），装上依赖
  闭包后启动宿主：宿主 web 服务照常起来（boot marker 在），插件 bootstrap 死在
  `[dsh-agent-team] bootstrap FAILED: Error [ERR_MODULE_NOT_FOUND]: Cannot find module
  '<EXP>/packages/runtime/src/plugin/upstream-resolver.mjs' imported from data:`，
  `hostExit.code = 0`。形状与 INSTALL-ENTRY 的历史捕获逐字同形。
- **根因**：entry 在运行时按相对 specifier 动态加载两个 `.mjs`（`module.register` 的
  resolve hook；默认 storage seam），而 tsc 永不 emit `.mjs`，所以两者都住在 published
  face 之外；旧 `place-dist-glue.mjs` 头注释把这说成"故意的"，前提是"源码 checkout 永远
  在旁边"。另外 `upstream-resolver.mjs` 自己用固定层数 `dirname()` 反推 repo root，从镜像
  里加载时算出的路径面外，fallback 形同自废。
- **修法（选项 (a)，披露：没有选 (b)）**：把两个运行时依赖**折进 tracked、committed 的
  install face**——沿用现成的 PLACEMENTS byte-copy 机制（无需新机制、无需引用 manifest
  spec），entry 的候选顺序改成 **package-face-first**（面外 specifier 保留为后续候选，
  fail-closed 时注册的是面内文件名）。选项 (b)（扩正式 install manifest）需要引用宿主
  manifest 规范并改变发布面语义，本轮不引入。
- **回归**：`red-install` posture 在 base 字节上 10/10（含 E1 面内文件数、E3 面内缺失＝
  gap 本身、E4 用 `module.resolve` hook 实测 7 行生产 import 图：base 恰且仅有
  `upstream-resolver.mjs` + `seam.mjs` 两行 `ERR_MODULE_NOT_FOUND`、foreign=0）；
  `green` posture 在修复后的 HEAD 上 strict 面 boot GREEN、`errors=[]`、foreign=0；
  单元腿 `a5g6-install-face-render.test.ts` 面内存在 + sha256 与源码同。原始 RED-A 日志
  作为**历史证据**保留在 `history/`，未被替换或改写。

## 3. 修复 ② — render contract：`render` 返回 String

- **症状（先复现，live）**：aux 面（1732 files，含两个面外 sibling，等价于整仓 git 安装）
  在 base 字节上跑通 governed world：plane 正常挂载（observer 记到
  `a5-plane: placed [team_grep,team_glob,team_bash]`），member 的 own-layer trio 真的被
  调用，而模型收到的 tool result content 是
  `Error: content.some is not a function` —— 宿主 result assembly 自己炸了，两次调用
  全灭，lane 判决根本到不了模型（synth 层看不见这一腿，必须是 live 宿主腿）。
- **根因**：`PLANE_PRESENTATION_FACE.render` 返回 `String(value?.text)`，而宿主法宣
  `render(args, value): ContentBlock[]`（pinned 宿主
  `packages/core/tools/src/index.ts:217`，消费点 `createSuccessResult`
  `…/index.ts:1839`）：返回值原样成为 result 的 `content`，下游一律按数组走
  （`packages/llm/llm/src/content.ts:126-127` `contentHasImage` → `content.some(…)`）。
  所以这不是"呈现风格选择"而是契约违反：String 能过 JSON 快照，死在装配。
- **修法**：按宿主原生 idiom（`packages/shell/tool-bash/src/index.ts:471`）投影成
  `[{ type:'text', text }]`，两条 lane（refusal / presented）同一个封闭
  `{text}` envelope；output schema 不变。
- **回归**：同一 live 腿在修复后的 strict 面上：两次 own-layer 调用的 result content
  都是合法 `ContentBlock[]`（`wireType=array`，block type 全 `text`），全文无
  `content.some`；模型拿到的是 lane 判决文本
  `a5p5-refused kind=backend-failed code=IO_POLICY_UNSUPPORTED detail=…`；chain 完整
  （leader `team_delegate`+`team_collect`，member final 把自己收到的判决 code 原样带回
  leader transcript）。

## 4. 三轮 kit 记录

`node a5g6-install-kit.mjs --posture <red-install|red-render|green> [--surface
strict|aux] --worktree <tree> --testuse <pristine test-use>`；criteria 明细写进各自
`criteria.json`，逐条 PASS/FAIL 行也 tee 在 `runs/<posture>-console.log`。

| posture | face | 断言的核心 | 结果 | run dir |
|---------|------|-----------|------|---------|
| `red-install` | strict（`files:["dist"]` 的真面），base 字节 | RED-A 复现：boot marker 在 + bootstrap 失败行点名面内 runtime 文件；load graph 只有那两行缺面内文件 | **10/10**（5s） | `runs/red-install-2026-10-17T17-55-26Z` |
| `red-render` | aux（tracked siblings 补在外面），base 字节 | RED-② 复现：live governed trio 的 tool result 就是宿主装配崩溃 `content.some is not a function` | **12/12**（31s） | `runs/red-render-2026-10-17T17-55-31Z` |
| `green` | strict，修复后的 HEAD | 面自足（in-face 两文件、foreign=0、`errors=[]`）+ boot GREEN + observer applied + render 契约 live 成立 + chain 端到端 | **15/15**（43s） | `runs/green-2026-10-17T17-56-03Z` |

Rigor notes（不是装饰）：**A0** 先证明钉住的宿主（0.2.0-rc.2 @ `639ed01539`）自己起来了，
否则任何"缺模块"都可能是 rig 塌了；**A1** 要求失败行必须点名 `upstream-resolver.mjs` /
`root-binding/harness/seam.mjs`，不接受任意 `ERR_MODULE_NOT_FOUND`；**E2** 把展开目录的
依赖闭包 BFS 到 deps+peers+optionals（54 包，38 个从 pnpm store 补，6 个异平台可选原生
记录后跳过），使"面外零解析"成为可核事实；**E4** 用 `module.resolve` hook 计数真实
import 图；**H3a/H3b** 前后各一次 `:3080` 只读 GET（401）+ test-use `porcelain=0`；
**C1/C2** 世界清理与 run 目录泄漏检查。

`green` 记录里的 `head=3b1b515f31` 是**带修复那一笔**（install face 就在那笔里）；本目录的
证据笔在 face 之外（`dev/agent-workflow/evidence/**` 不属于两个 install surface），故
`check:artifacts-at-head` 在最终 HEAD 上 drift=0 就是"该提交自带其构建产物"的证明，
不必为证据笔重跑 face。

## 5. 披露（含本轮发现、但未在本轮修的缺口）

- **修法选择披露**：RED-A 用了 **(a)** 折进 install face，**不是 (b)** 扩正式 install
  manifest（(b) 需引用宿主 manifest 规范并改变发布面语义）。
- 根 `package.json` 的 `files` 里那两个 sibling 条目（`packages/runtime/src/plugin/…`、
  `packages/runtime/root-binding/…`）现在**冗余但无害**（面内已有同字节副本），故意保留
  以缩小改动面；根 skills/`files` 的异常（strict 运行时面仍会 warn
  "bundled team skills are NOT registered"）属根 manifest 项，不是这一面能修的。
- `session-reader`（legacy inspect 的另一条动态加载）**不属于**这一类缺陷：已核，其候选
  0 在镜像内解析。
- **GAP PROBE G1（记录，未修，非本轮范围）**：member 模板 deny 了 bash 类、也没有给
  grep/glob 任何 lane 覆盖，按语义这两次 own-layer 调用应在 deny lane 被挡
  （`code=template-deny-lane`）；实测两次都走到 backend 面
  （`code=IO_POLICY_UNSUPPORTED`），`denyLaneSeen=false`。原因是
  `createLaneDecide`（`team-tool-plane.mjs:205-226`）的 `bashNames`/`fileNames` 装的是
  挂载后的**别名**，而 lane 的 effect 声明说的是**原生类名**
  （`packages/tools/a5p5-tools/src/effects-schema.ts:77` `toolName = parsed.tool`），
  两条 lane 快速路径对 plane 工具恒不命中。已上报 parent 排期；本轮只保证"判决能送到模型
  手里"这一契约，不偷偷扩范围。
- p4t6 scanner 排除 `dist/`，所以两条新镜像**不需要**记账；新增的测试文件**需要**，
  已记（链 `1168 → 1169`，实测 scanner `files=1169`）。

## 6. 门禁

- `pnpm exec tsc -p packages/runtime/tsconfig.json --noEmit` EXIT 0；
  `place-dist-glue` 5 placements；`check:artifacts` drift 0（1732 compared）。
- eslint：**file-aware fingerprint 与 base 相同** —— 触碰的 5 个文件里只有
  `host.ts` 带 2 条 base 就存在的 finding（`no-empty`、`TemplatePermissionPolicy`
  unused，行内容与 base 逐字同），新文件 0 findings。
- root vitest census（双捕获，红集身份比对）= **563 files / 7091 legs ×2，红集 9 条 =
  已发布基线身份集逐字同（cap1==cap2），本轮新增红 0**；+1 file/+5 legs 恰为本轮新单元
  套件。明细与两条被丢弃捕获的披露见 [`runs/CENSUS.md`](runs/CENSUS.md)（第一对捕获在本
  worktree 尚未 `pnpm -r run build` 时多出一条 `a4p7-merge-gate` 组成 smoke 红，原因是
  gitignored 的 `packages/client/dist` 缺失＝环境缺口而非行为变化；补齐全量 build 后该套
  35/35 绿，且那次 build 对 tracked 字节**零改动**——committed 面就是真 build 的产物）。
- 端口/世界卫生：全程 `:3183`（宿主）+ `:3491`（mock），`:3080` 只读 GET 前后各一次
  （401，未动）；世界 `tests/homes/a5g6-<posture>-<stamp>` 全部 swept；
  `tests/deepseek-harness-test-use` `git status --porcelain` 前后皆空。
