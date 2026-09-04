# plugin-bundle-form — 任务 brief（task/plugin-bundle-form，execution 1/3）

> 立项依据：R127（SESSION_ROUTER_LOG）。用户新机 `dsh plugin add github:` 安装后无 Team UI；
> 根因 = 仓库根 package.json 无 `dsh.bundle` 声明 → 宿主 reconcile 不挂载（宿主告警
> `declares no dsh.bundle — installed as a plain dependency`）。用户裁决：立项，走完整 gate。

## 0. 目标（Definition of Done）

在一台干净机器上，`pnpm dsh plugin --profile web add github:ArmourPiercer1/dsh-agent-team`
（pnpm ≥10 对 git 依赖 prepare 的拦截按宿主 CLI 自带提示放行后重跑）即可完成安装并挂载：
profile manifest 的 `dsh.profile.bundles` 自动含 `dsh-agent-team`（真实 CLI reconcile 路径，
无人工写 profile 行），`dsh web` 启动后 Team UI 可用（host row S8-READY 等价 + 浏览器
gentry G0–G4 全绿）。

## 1. 宿主契约（已在 test-use @76fda72979 与用户 0.1.3-alpha.1 双版本源码核实）

- `apps/cli/src/plugin.ts`（两版本逐字节一致）：`runPlugin` = init profile →
  `spawnSync('pnpm', args, {cwd: profileDir})` → `reconcilePlugins`：对每个已安装依赖
  `exportsPatch()` = 解析包目录读 package.json，`manifest.dsh?.bundle?.patch !== undefined`
  → 入 `dsh.profile.bundles`；否则告警。pnpm 失败且 spec 为 git 系 → CLI 自带
  allowBuilds 提示（L152-159）。
- `app-boot/src/profile.ts` `loadProfile`（L805-844）：每个 bundle 条目 →
  `resolveBundleDir`（install anchor + profile 目录双锚点）→ 读包 package.json →
  `dsh.bundle.patch` 缺失 fail-loud → `loadOverlayPatches(packageDir/patch)` 入层栈。
- client 面（`packages/client/modules/src/index.ts`，test-use）：
  - client 行 = **bare package name**（`exactPackageSpecifier`：无 `/` 或非 scoped 二段；
    subpath 行「permanently not a client row」）；
  - `locatePkgJson`：loader.internal.resolveSync 解析行 name → 模块 URL →
    `nearestPackage` 自模块上行走，**最近一个声明该 name 的 package.json** 拥有模块
    （中间异名 manifest 跳过）；
  - `dsh.client` 声明必须 `{ platform: string }`（`parseDshClient`）；
  - `clientExportOf`：exports["./client"] 须为 string 或 `{default: string}`，
    `clientPath = join(dirname(pkgPath), clientRel)`；声明 dsh.client 而无 ./client 导出
    → fail-loud；bundle 文件缺失（ENOENT）→ MissingClientBundleError（fail-closed）。
- pnpm ≥10：git 依赖的 lifecycle 脚本（prepare）默认被拦（warn + 打印 allowBuilds key），
  在**消费方**（profile）的 `pnpm-workspace.yaml` 放行后重跑安装才执行。

## 2. 设计决策

### D1 — prepare（构建-on-install）

根 package.json 增加 `"prepare": "pnpm install --ignore-scripts && pnpm build && pnpm build:composition"`。

- git 依赖被 pnpm checkout 到消费方 node_modules；prepare 在包目录内运行
  `pnpm install --ignore-scripts`：包目录含 tracked `pnpm-workspace.yaml`（packages/* glob +
  overrides + allowBuilds）→ pnpm 视其为独立 workspace root，全量安装 9 包 + 全部 devDeps
  （typescript/tsc 等），**且不触发任何子包 lifecycle 脚本** → `pnpm -r run build`
  （tsc 逐包，rootDir=packages/ 的 dist 布局）→ `pnpm build:composition`
  （place-dist-glue byte-copy + client composition shim）。
- dist 在包目录内原地生成 → 安装面文件齐备。
- **`--ignore-scripts` 是探针实证的必要项**（probe1/2/3，evidence 目录
  `.pbf-prepare-probe*.mjs`）：朴素 `prepare = pnpm install && …` 会递归 ——
  嵌套 install 再触发本包 prepare → 17 层深递归后失败（probe2 S1b）；
  `--ignore-scripts` 后 runs=1 且依赖照常 link（probe3 S4）。workspace 根
  `pnpm install` 仅在**非 no-op** 时跑一次 prepare；二次 no-op 不重跑（probe 实证 delta=0）。
- **不**在根 manifest 抬升运行时依赖：依赖上下文中 pnpm 只装根包 declared deps 的场景
  仅发生在 prepare 被拦时（此时无 dist，本就不能挂载；放行后 prepare 全量安装覆盖一切）。
  抬升只会增加解析面。用户机器实测「resolved 41, added 1」佐证 git 依赖只物化根包、
  devDeps 不装 —— 与 prepare 全量安装互补，无缺口。
- 风险（执行中实证）：嵌套 pnpm install 的 store 并发锁、pnpm 11 对 prepare 内再跑
  pnpm 的行为、`pnpm -r` 在依赖目录的 workspace 识别 —— 全部由 D5 测试世界实证收口。

### D2 — 包内 patch 文件（机器无关）

根目录新增 tracked `cordis.patch.yml`（`dsh.bundle.patch` 指向它）：

- host 行：`name: "dsh-agent-team/host"`（subpath specifier；Loader 经根 exports 解析到
  dist host.js）+ config：**不含** glueUrl/seamUrl/defaultWorkspace 等机器相关字段；
  blueprintSource = 默认团队蓝图（my-team-bp-1，含 `---` 首末定界符 —— R125(4) 契约）；
  staticModel = `deepseek-official / deepseek-v4-flash`（DSH base 默认模型，用户可在
  profile 层同 id 行整 config 覆盖，last-write-wins）；
- client 行：`name: "dsh-agent-team"`（bare；Node 半 = 根 exports "." → shim inert
  index.js；浏览器半 = 根 dsh.client + exports "./client" → client-bundle.js）。
- 层语义：bundle 层先于 profile 用户层；用户层同 id 行按「整 config 替换」覆盖
  （dsh-base patch 头注文档化契约）→ INSTALL.md 记载覆盖方法。

### D3 — 根 package.json 形态

```json
{
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "platform": "web" }
  },
  "exports": {
    ".": "./packages/client/composition-shim/index.js",
    "./host": "./packages/runtime/dist/packages/runtime/src/plugin/host.js",
    "./client": "./packages/client/composition-shim/client-bundle.js",
    "./package.json": "./package.json"
  },
  "files": ["cordis.patch.yml", "packages/client/composition-shim",
            "packages/runtime/dist", "packages/runtime/root-binding"],
  "scripts": { "prepare": "pnpm install --ignore-scripts && pnpm build && pnpm build:composition", ... }
}
```

- `.` → shim inert Node 半：client 行（bare）的 Node 侧 import 落点；
- `./host` → dist host.js：host 行（subpath）落点；
- `./client` → client-bundle.js：client 面 `clientExportOf` 直读；
- `./package.json`：`locatePkgJson` 无 Node internals 回退路径需要（`resolve(name/package.json)`）；
- `files`：git 依赖不裁剪（全 checkout），npm publish 场景的发布面文档化。

### D4 — host.ts glueUrl/seamUrl 推导（唯一产品代码改动）

- 校验（`validateTeamPluginConfig`）：`glueUrl` 由必填改**可选**（present 时仍须非空
  string；缺失 → 推导）；`seamUrl` 保持可选。
- 推导（bootstrap，显式配置优先）：
  - glue：`new URL('./live/agent-bindings.mjs', import.meta.url)` —— 单候选两布局同形
    （dist：place-dist-glue 镜像；src：原位 .mjs）；
  - seam：按布局候选（与 `loadLegacyInspect` 既有候选模式一致；候选 = 到 runtime 包根
    的相对路径，root-binding 永不编译、seam 为包根唯一文件）：
    dist 布局 `../../../../../root-binding/harness/seam.mjs`（dist 入口位于
    `dist/packages/runtime/src/plugin`，**五级上**= 包根）；
    src 布局 `../../root-binding/harness/seam.mjs`（src/plugin 两级上= 包根）。
    （brief 初稿 dist 侧写四级 —— 实现期实测 off-by-one，已按五级实现并经
    root-surface-check 对真实 dist 布局验证。）
  - 推导文件不存在 → fail-loud（稳定错误码 + 全部尝试过的路径，TEAM_PLUGIN_GLUE_UNAVAILABLE
    族；不静默降级）。
- 现有验证行（R122/125 世界显式传两 URL）**行为不变**（显式优先）。
- 单测（`packages/runtime/test/pbf-default-artifact-urls.test.ts`，7 例）：推导助手
  （导出纯函数，fake base URL 覆盖 dist/src 两布局）+ 校验器（无 glueUrl/seamUrl 的
  shipped 形态 config 通过；glueUrl present-but-empty 仍 fail；显式 URL 回环回归守卫）。
  真实树文件存在性 + shipped cordis.patch.yml 过真实校验器的断言在 references/
  安装面检查脚本（`.pbf-root-surface-check.mjs`，25 断言全绿）承担 —— 保持 runtime 包
  「测试不直接 import node builtins」的既有约定（node-min.d.ts shim 仅服务 host.ts）。
  p4t6 全仓文件计数 pin 已登记 +1（602→603）。

### D4b — upstream-resolver normal-first 硬化（执行期决策）

git 依赖世界里，插件从自己的 node_modules（registry-pinned `@deepseek-ai/*@0.1.2-rc.1`，
prepare 嵌套 install 物化）解析 `@deepseek-ai/*` 是版本正确路径；原钩子对
`@deepseek-ai/*` **无条件** re-parent 到发现的 DSH checkout —— 在任何发现成功的世界里
都会把 host checkout 的包版本喂给按 0.1.2-rc.1 构建的插件代码（漂移风险）。

重写（`packages/runtime/src/plugin/upstream-resolver.mjs`，plain JS，无 TS tooling）：

- **normal-first**：`@deepseek-ai/*` 先用原始 context 走 nextResolve（安装自己的
  node_modules）；**仅** `ERR_MODULE_NOT_FOUND`（包不在安装解析范围）才回落到
  发现 checkout 的 `apps/cli/lib/__resolver__.js` re-parent；
- **fail-loud 保留**：`ERR_PACKAGE_PATH_NOT_EXPORTED`（包在、subpath 未导出 = API 漂移）
  等一切其他错误码原样上抛 —— 回落不得掩盖版本失配；发现不到 checkout 时同样
  上抛原始 not-found；
- 非 `@deepseek-ai/*` 一律原样透传。
- 两处 dirname off-by-one 的处置：
  - **argv 候选（candidate 1）= 有意保留的死候选**：生产 bin
    `<checkout>/apps/cli/lib/bin.js` 三次 dirname 落 `<checkout>/apps`，其
    `apps/cli/node_modules/@deepseek-ai` 探针永不命中。修复会让用户机器的宿主
    checkout 进入候选集（漂移复活），normal-first 下死候选无害 —— **记录为观察项，
    不修**；
  - **resolver-file 候选（candidates 2/3）= 实测同为死路径**（四次 dirname 落
    `<root>/packages` 而非仓根 —— 已实证：修复前裸作用域探针 S2 必失败，即
    「已验证世界其实一直在纯 passthrough 下运行、re-parent 从未生效」）；
    本任务把计数修到五级（= 候选 2 指向 worktree/主仓的
    `references/deepseek-harness-test-use`）——因为回落是文档化的救援路径，且修复后
    它**仅在本机测试世界可发现**（references/ gitignored，用户 clone/git 安装
    profile 永不暴露候选）= 恰好维持 normal-first 所依赖的零漂移性质。
- 探针证据（references/ 保留脚本，全绿）：
  - `pbf-scope-probe.mjs`（复制到 `packages/runtime/` 内运行后删）：S1 normal-first
    解析落 PBF 自己的 `.pnpm`（非 test-use）+ S3 `ERR_PACKAGE_PATH_NOT_EXPORTED`
    原码穿透 + S4 非上游透传；
  - `pbf-resolver-fallback-probe.mjs`（裸目录运行）：S2 无依赖作用域 → checkout
    回落成功（修复前必失败）。

### D5 — 测试世界（核心证据，真实 CLI reconcile 路径）

全新 DSH_HOME = `references/.dsh-test-pbf-<stamp>`（工作区内；端口 3180 族，
:3180 若被用户实例占用则 3181 并登记 evidence）：

1. 本地 bare 仓 `references/.dsh-test-pbf-<stamp>/repo.git`（自任务树 `git clone --bare`，
   含 task 分支）—— 等价 github: spec 的 git 依赖路径（prepare 被拦语义相同）。
2. test-use 构建产物 CLI：`node apps/cli/lib/bin.js plugin --profile web add
   "git+file:///...repo.git#<branch>"`（DSH_HOME=新世界）：
   - **首跑（blocked）**：pnpm 拦 prepare（告警 + 实打 key）→ CLI exit 与提示捕获留证；
   - 按 pnpm 实打 key 写入 profile `pnpm-workspace.yaml` allowBuilds → **重跑 add**；
   - 断言：profile package.json `dependencies.dsh-agent-team` 存在；
     `dsh.profile.bundles` 自动含 `dsh-agent-team`（reconcile 产物，非手写）；
     包目录内 dist + composition-shim 已生成（prepare 真跑）。
3. boot：`node apps/cli/lib/bin.js web --port <3180族> --no-open`：
   - 启动行 / 401 门 / token 门（R125 判据）；
   - `--dump-config`：dsh-agent-team host 行 + client 行在 composed 树（bundle 层来源）；
   - row health（boot/ready/rootSessionId）+ catalog.list ok（blueprint = 包内默认
     my-team-bp-1，证 layer doc 生效）；
   - serve combo 含 client bundle（client 行经根 dsh.client 面被发现）。
4. 浏览器 gentry G0–G4（R118/R119/R121 回归同判据）：Team tab / 建队 / 对话。
5. 4 件安装面产物 byte-identical（2097CE5E…/D385C065…/B4509233…/D50D3B3F… 前缀，
   对任务树构建 vs 安装面副本）。
6. 停实例、端口释放核验、test-use byte-clean 复核。

### D6 — 五闸与红线（继承 R125 判据）

- 任务树五闸：install EXIT 0（registry-only）/ typecheck+build 9/9 /
  test 根 2402（= 2395 基线 + 本任务 7 例新单测；p6t1-parallel flake 隔离协议不变）/
  lint 0 / smoke:composition。
- 红线：CORE PATCH BUDGET=0（references/ 零写）；test-use pristine @76fda72979；
  `D:\deepseek-harness\` / :3080 零触碰；3180 族端口；零 force-push；
  `D:\AgentDev\deepseek-harness`（用户构建）零写入。

### D7 — 文档与 bookkeeping

- INSTALL.md：新增「§2 快速安装（dsh plugin add，推荐）」节：命令 + pnpm allowBuilds
  放行流程（宿主 CLI 自带提示的逐步走法；key = 打印的完整 `name@spec#commit`，照抄）
  + 层覆盖语义（profile 层同 id 行整 config 替换，last-write-wins）+ 排障
  （prepare 被拦 / 旧版 commit 无 dsh.bundle / 嵌套安装闭包不全 / seam 推导失败）；
  原 §2 构建 + §3 挂载合并为「§3 手动安装（离线 / 后备路径）」（§3.1/§3.2），
  模板加注 glueUrl/seamUrl 现为可选（host 入口自身位置推导，显式优先）。
- README：安装方式双路径注记（§2 快速 / §3 手动）。
- 本任务 bookkeeping：本 brief + 全部日志/证据归 `evidence/plugin-bundle-form/`；
  graph.yaml 任务块；gate 后 STATUS.md/README 同步。

## 3. 非目标

- 不发布 npm 包（github:/git 路径即支持面；`files` 字段仅为发布面文档化）。
- 不改宿主（CORE PATCH BUDGET=0）。
- 不处理 pnpm 11 对用户 profile lockfile 的重写怪象（宿主侧行为，与本任务无关；
  放行 prepare 后的安装路径由 D5 实证）。
- 不改 dsh-base/web-app 等上游 bundle。

## 4. 失败升级

- prepare 在 git 依赖上下文不可行（嵌套 install 失败等）且无替代构建路径 →
  `DEPENDENCY_BLOCKER`（pnpm 行为，非 seam）→ 三次执行内未解 → 阻塞报告用户。
- 宿主 client 面对「根包承载 dsh.client + 子路径 host」组合有未预期拒绝 → 记录宿主
  版本/精确报错 → 若 rc.1 与 0.1.3-alpha.1 行为不一致 → `SPEC_CONFLICT` 候选（宿主公开
  契约漂移），报告用户裁决。
