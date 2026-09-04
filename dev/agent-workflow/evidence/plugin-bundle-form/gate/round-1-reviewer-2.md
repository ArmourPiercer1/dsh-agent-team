# Gate Round 1 — Reviewer 2 裁决存档（host-contract-chain 焦点：六项声明对照 pristine host 源码逐行核验）

- **Agent ID**: f101165b-f8d4-404c-905d-addf97e2e060
- **Model**: qwen3.8-27b
- **审查范围**: `2f3f61b..a7bee2e`（7 commits，int/plugin-bundle-form）
- **Settled**: 2026-09-05（本地时间，gate round 1）
- **Verdict**: **通过 (PASS)**

---

# 独立盲审 #2 裁决 — task `plugin-bundle-form`（host-contract-chain 焦点）

**裁决：通过 (PASS)**
**一行理由：** 六项指派声明全部对照 pristine host 源码（test-use @ `76fda72979`）逐行核实成立；D5 五世界垂直证据（真实 CLI reconcile @ spec commit `5c4f903`、row-ready health、SHA 字节一致、gentry G1–G4 全绿、console/page errors 双零）支撑端到端 DoD；CORE PATCH BUDGET=0 红线无违反（零 host 修改、仅公开 seam）；无 material findings。

---

## 验证表（声明 / 实际读取的源码 / 结果）

| # | 声明 | 实际读取的源码（file:line，均为 pristine host `references\deepseek-harness-test-use` @ 76fda72979，除非另注） | 结果 |
|---|------|------|------|
| 1 | `dsh plugin add` 对声明 `dsh.bundle.patch` 的 git 依赖自动追加进 `dsh.profile.bundles`，否则 warning；git spec 触发 pnpm prepare + allowBuilds 指引 | `apps/cli/src/plugin.ts` L36-45（`exportsPatch()` 判 `manifest.dsh?.bundle?.patch !== undefined`）、L59-91（`reconcilePlugins`；追加 L67-69；warning 文案 "declares no dsh.bundle — installed as a plain dependency" L71-74，仅新依赖触发）、L154-160（pnpm 失败时的 allowBuilds 指引文本）。佐证：worktree 证据 `d5-setup-2026-09-04T19-58-01-first-add.txt`（`[ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED]` + pnpm 打印的 allowBuilds key + CLI 指引与源码逐字一致）、`d5-setup-2026-09-04T21-11-16.log`（第二次 add exit=0；`dsh.profile.bundles` 自动 = `["@deepseek-ai/dsh-base","@deepseek-ai/dsh-web-app","dsh-agent-team"]`） | **成立** |
| 2 | Profile 加载：per-bundle `dsh.bundle.patch` → `loadOverlayPatches(pkgDir/patch)`；profile 自身 `cordis.patch.yml` 在 bundle 层之后应用；同 id 行整行替换（无字段级合并） | `packages/boot/app-boot/src/profile.ts`（**注意：实际路径在 packages/boot/app-boot，非 brief 所述 apps/web/app-boot**）L44（`PROFILE_PATCH_FILENAME='cordis.patch.yml'`）、L805-844（`loadProfile`：per-bundle `resolveBundleDir` 双锚点 → 缺 `dsh.bundle.patch` 响亮失败 → `patchPath = join(packageDir, declared)` → `loadOverlayPatches` L835-840）；`apps/cli/src/profile-boot.ts` L137-144 + L167（`composeEntries([bundlePatches, profile.patches, homePatches, overlays])` — bundle 层在前、profile 自身层在后）；`vendor/include/src/index.ts` L58+、L121-124（`applyEntryPatches` 非 insert 补丁 = `target[key] = value` 顶层键整替 → `config` 整体替换） | **成立** |
| 3 | 客户端行契约：裸包名行（`exactPackageSpecifier`）、`nearestPackage` 上溯、`clientExportOf` 读 `exports["./client"]`；且 diff 根 `package.json` + `build-client-composition.mjs` 的注册 id 在**两种安装世界**均一致（bundle 世界 key=`dsh-agent-team`；shim 世界 key=`@dsh-agent-team/client`） | `packages/client/modules/src/index.ts`：L192-198（`exactPackageSpecifier`：scoped 恰两段 / 非 scoped 无 `/`）、L201-221（`parseDshClient`，platform 必须为字符串）、L224-234（`clientExportOf` 读 `exports["./client"]` string\|`{default:string}`）、L738-773（`resolveMeta`：无 `./client` 响亮抛 L761-763）、L786-821（`locatePkgJson`，pathLike L788-789）、L823-847（`nearestPackage` 上溯，期望名不匹配时取首个 manifest）、L942-972（`reconcilePackage` → `graphRow(packageName,…)` L962 — 图行 id = 拥有 manifest 的包名，非行名）、L678-724（`compose`）。worktree：根 `package.json`（`dsh.bundle.patch`、`dsh.client={platform:'web'}`、`exports."./client"`→`composition-shim/client-bundle.js`）；`composition-shim/package.json`（name=`@dsh-agent-team/client` + 嵌套 `dsh.client`，由脚本 L574-598 生成）；`cordis.patch.yml` 客户端行（id `dsh-agent-team-client`，name 裸 `dsh-agent-team`）；`scripts/build-client-composition.mjs` L65/L72（`PLUGIN_ID='@dsh-agent-team/client'`、`ROOT_PLUGIN_ID='dsh-agent-team'`）、L543-544（D8 尾：同一 factory 双 `window.__ModuleLoader__.load`）。S8 世界参照（`references\.dsh-test-s8-2026-09-04T12-26-59`）：patch 行 name 为 path-like（`../../s8-client-row/index.js`），shim manifest name=`@dsh-agent-team/client` | **成立（双世界均一致，机制已闭环，见"补充说明 A"）** |
| 4 | Loader 双注册安全：首个 claim 触发懒工厂、未 claim 的 id 容忍、仅重复 id 抛错、`stripClientSuffix` 保证两 id 不撞 | `packages/client/modules/src/client/system.ts`：L113-120（`register`：`stripClientSuffix` 后仅 bootstrap/duplicate 抛 "duplicate factory registration"；无图行存在性检查 → 未 claim id 惰性）、L123-149（`arrive`：已 claim 行无工厂 → "loaded without registering"）、L215-230（`import`：图行命中 → `arriveGraphRow`；未命中 → 工厂回退分支，仅两者皆无才抛 "cannot resolve"）、L173-192（`materialize` 懒物化）；`packages/client/modules/src/client/manifest.ts` L156-158（`stripClientSuffix`：仅剥尾部 `/client` → `dsh-agent-team` 与 `@dsh-agent-team` 恒异）。bundle 世界：行 `dsh-agent-team` 图行命中、claim 该 key，`@dsh-agent-team` 未 claim 惰性；shim 世界：import 剥后 claim `@dsh-agent-team`，`dsh-agent-team` 未 claim 惰性 — 每世界恰 claim 一个、无重复注册可能 | **成立** |
| 5 | 默认工作区链（D9）：fold `member.workspace ?? team.defaultWorkspace ?? ProjectionError`（fail-closed）；dispatcher 泛型 `untyped-error` 无 stack；v1 线无 workspace 参；root.ts pre-put + createAndStartTeam 转发；host.ts `withDefaultWorkspace` + `process.cwd()`；新单测；`process.cwd()` 合理性 | fold：`packages/runtime/projection/fold.ts` L198-215（三级回退，缺省抛 `ProjectionError(PROJECTION_ERROR_CODES.MEMBER_WORKSPACE_UNRESOLVED)`）；错误码在 `packages/runtime/projection/errors.ts`，**不在** `REMOTE_BACKING_ERROR_CODES`（grep `packages/remote/src/handlers/dispatch.ts` 仅 `WORKSPACE_MUTATION_FORBIDDEN`）→ `toRemoteErrorResult` L263-300（不变式 4a/4b/5）：untyped → `INTERNAL_ERROR` "internal error in remote handler" + `{reason:'untyped-error'}`、无 stack（L293-299）。线：`packages/runtime/src/plugin/s6-remote.ts` L275-280（`create(rootSessionId, blueprintId, blueprintRevision?, initialWork?)` 无 workspace 参）、L855-860、L820-914（team.create 处理，fresh bind 继承 `options.defaultWorkspace` L897-903）、L386-393（文档）。转发：`packages/runtime/src/plugin/root.ts` L1055-1088（`createAndStartTeam` 转发至 `bindFresh` L1068-1070）、L1133-1135（handoff pre-put 带 `config.defaultWorkspace`；P9-S8 注释 L1125-1132 明示 D9 失败签名）、L1445-1450、L1536-1574（fixture）。host：`packages/runtime/src/plugin/host.ts` L315-318（`withDefaultWorkspace`：显式优先、派生时拷贝不变更）、L469-471（`rowConfig = withDefaultWorkspace(validatedConfig, process.cwd())`）。单测：`packages/runtime/test/pbf-default-artifact-urls.test.ts`（9 用例：显式优先/缺省派生/非变更/validator 边界）。`process.cwd()` 合理性：grep `process.chdir` 于整个 test-use **仅测试文件命中，生产路径无 chdir** → `dsh web` 的 cwd = 操作者启动目录；显式配置可覆盖且有单测；服务化启动（非用户 cwd）为已文档化边界情况 | **成立；`process.cwd()` 判定合理**（边界情况见非实质观察 #3） |
| 6 | files 完整性：pnpm 按根 `files` 裁剪 git 依赖；boot 闭包需要 `packages/runtime/src/plugin/upstream-resolver.mjs` 入 `files`；对照 D5 setup 输出与最终 `files` vs host.js boot imports，无缺失 boot 期 import | worktree 根 `package.json`：`files=[cordis.patch.yml, packages/client/composition-shim, packages/runtime/dist, packages/runtime/root-binding, packages/runtime/src/plugin/upstream-resolver.mjs]`。闭包核验：`tsconfig.build.json`（`rootDir:"../.."` 仓库根、`outDir:dist` → dist 镜像含传递 workspace 包于 `dist/packages/<pkg>/…`）；`host.ts` L266-282（`resolveUpstreamResolverFile`：dist 上溯 5 层 = `packages/runtime/src/plugin/upstream-resolver.mjs`，**在 files 内**）+ L290-301（`registerUpstreamResolverOnce` 动态 import）；`scripts/place-dist-glue.mjs`（字节拷 `live/agent-bindings.mjs` 入 dist 镜像，**有意不拷** upstream-resolver.mjs — 候选列表已覆盖源路径）；`root-binding/harness/seam.mjs` L33-34（仅 `@deepseek-ai/dsh-storage-domain`+`zod`，root-binding 在 files 内）；`live/agent-bindings.mjs` L135-141（node 内置 + `@deepseek-ai/dsh-session|dsh-agent|dsh-llm|dsh-mcp-client` — host 安装提供，经 profiles/node_modules 父目录回补/解析钩子，非插件 files 职责）；裸 `zod`/`@deepseek-ai/*` 同理。佐证：`d5-assertions-2026-09-04T21-11-16.json`（7 工件 SHA，`bundleBytesContained` 于 serve-check 为 true）；`d5-boot-2026-09-04T21-11-16.log`（row ready health `{"ok":true,…,"toolCount":10}`；dump-config 3 行 = bundle host 行 + bundle 客户端行 + p6t6 file-URL 行；D5-READY）。`packages/tools` 未入 files 为有意（纯测试 harness；最终世界以 profile file-URL 行服务） | **成立（无缺失 boot 期 import）** |

---

## Material findings（实质发现）

**无。** 六项声明全部成立；未发现红线违反（零 host 修改、无 patch-package/postinstall 改写 upstream、仅公开 seam：`dsh.profile.bundles` 声明 + `dsh.bundle.patch` 层 + 客户端行契约 + 远程端口 v1 线）。

---

## 非实质观察

1. **Brief 路径更正**：app-boot profile 加载器实际位于 `packages/boot/app-boot/src/profile.ts`（brief 写 `apps/web/app-boot/...`，test-use 中该路径不存在）；客户端注册表在 `packages/client/modules/src/index.ts`，loader 在 `packages/client/modules/src/client/system.ts`。
2. **补充说明 A — shim 世界 import 机制闭环**（我此前追踪中的矛盾点，现已结构性消解）：浏览器端 entry 名取自 boot 图行 id（包名），**不是** patch 行名 — `packages/client/web/src/boot.ts` L124/L127-131（`manifest.plugins.map(row => row.id)` → `loader.create({name})`）；patch 行名（`../../s8-client-row/index.js`）仅供 node 侧 `ClientModuleRegistry` 定位拥有包。shim 世界 import 路径：`internal.import('@dsh-agent-team/client')` → `stripClientSuffix` → `@dsh-agent-team` → 图行 miss（行 id 为 `@dsh-agent-team/client`）→ **工厂回退分支**（`system.ts` L220-229）→ `factories.has('@dsh-agent-team')` 命中 → 物化。该回退的**确定性**由 prefetch 屏障保证：`boot.ts` L76 + L126 在 entry 创建爆发**之前** `await prefetchImmediateTier()`；S8 boot 图含 9 个 `immediately:true` 行与团队行同处单一 application batch（同 batch 共享一个 combo URL — `arrive(row)` 用 `row.initialUrl`），prefetch 执行 batch 脚本即注册 batch 内**全部**工厂（含 `@dsh-agent-team`）→ 无竞态。与 R122/S8 多轮绿色证据及 D5 world-2 失败签名（"loaded without registering"，bundle 世界行名/注册 key 错配）完全自洽。
3. **`process.cwd()` 默认值边界情况**：服务化/非交互式启动的 host（cwd 非操作者目录）会得到该服务 cwd 作为默认工作区 — 已文档化（`S6RemoteOptions.defaultWorkspace` 文档 L386-393）且可被行配置显式覆盖（`withDefaultWorkspace`，有单测）；v1 线无 workspace 参，成员级 `workspace` 仍可在 projection 内覆盖。属可接受设计取舍，非缺陷。
4. **allowBuilds key 为 commit 特定**（`dsh-agent-team@<full-spec>#<commit>: true`）：每次新鲜安装一次性写入；`pnpm update` 到新 commit 后需刷新 key 否则 prepare 再被拒。`INSTALL.md` §2 与 host CLI 指引（`plugin.ts` L154-160，D5 证据逐字匹配）均已记载。属运维注记。
5. **serve-check 中 `sha256MatchesInstall: false` 属预期**：served combo 为重组字节流，意义在 `bundleBytesContained: true`（已为 true）；组合 200、`unauthenticatedStatus: 200`（401 门控由页面/WS 层承担，与 S8 世界行为一致）。
6. **D5 world-1 预检失败**（"missing install artifact p6t6 harness (tools)"）为证据 kit 自身假设（期望 tools harness 随插件发布），非产品声明；最终世界（21-11-16）以 p6t6 file-URL 行达成 D5-READY，`files` 不发布 `packages/tools` 与最终世界实际服务方式一致。
7. **D8 第二注册在各世界均为惰性**（bundle 世界 `@dsh-agent-team`、shim 世界 `dsh-agent-team`）：loader 对未 claim id 容忍（`system.ts` L113-120 无图行检查；import 仅对缺失/duplicate 抛错）— 与任务 D8 叙述精确一致，且 HMR 场景由 `invalidate`（L240-248）负责工厂失效。

---

## 约束确认

- **无写入**：全程仅 read/grep/Get-ChildItem（只读列目录）；未写任何文件、未创建临时目录、未做任何 git 变更（worktree 仅读取 `.worktrees\PBF`）。
- **port 3180 未触碰**：未启动任何实例、未发出任何 HTTP 请求；3180 相关数据全部来自既有证据文件（D5 21-11-16 世界与 S8 12-26-59 世界的离线捕获）。
- **`references/` 只读**：包括读取 `references\.dsh-test-s8-2026-09-04T12-26-59\profiles\web\cordis.patch.yml` 与 `s8-client-row\package.json`（READ，允许）；P9/s8 证据目录亦仅读取（用于闭合 claim 3/4 的 shim 世界机制）。
- 宿主源码基线确认：`references\deepseek-harness-test-use` @ `76fda72979`（pristine），所有 host 侧 file:line 引自该检出。

**最终裁决：通过 (PASS)。**

---

## 主 Agent 分派注记（裁决后，R129 处理）

- **裁决定性**：通过 = PASS 票（六项契约链声明全部成立，零 material findings；全程只读、零实例、3180 未触碰）。
- **非实质观察处置**：#1 brief 路径更正（`apps/web/app-boot` → `packages/boot/app-boot`）记入 R129 日志（brief 为任务装置非审查对象，不改冻结文档）；#2 shim 世界 import 机制闭环 = 正面补充证据，随归档留存；#3 `process.cwd()` 边界（服务化启动）入风险台账（已文档化 + 显式覆盖 + 有单测）；#4 allowBuilds key commit 特定 = 运维注记（INSTALL.md §2 已载）；#5 serve-check `sha256MatchesInstall:false` 属预期（判据 = `bundleBytesContained`）；#6 world-1 预检失败 = kit 自身假设（非产品声明）；#7 D8 惰性注册与叙述一致。
- **Gate round 1 计票**：R1 通过 + R2 通过 + R3 投机通过（= PASS，未验证项均非核心）→ 3/3 PASS → **GATE PASS**。
