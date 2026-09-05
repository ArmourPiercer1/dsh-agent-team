# task-brief — plugin-prebuilt-artifacts (PBA, R131 立项, 2026-09-05)

**任务背景**：plugin-bundle-form 推送 origin（master `e832d73`）后，用户在新机（DSH 0.1.3-alpha.1
user build @ `D:\AgentDev\deepseek-harness`，pnpm v11.7.0）运行
`pnpm dsh plugin --profile web add github:ArmourPiercer1/dsh-agent-team`，github: codeload tarball
拉取成功后首跑命中 `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`（prepare 未入 allowBuilds）——此为
`INSTALL.md §2` 已文档化、D5 世界 1 与 gate 审查员 R1 独立消费者实验逐字节复现过的一次性步骤。
用户裁决（2026-09-05）：「我记得似乎直接将编译产物一并推送到 github 可以避免这个 allowBuilds
引起问题。请你解决。」→ **目标 = 消除该一次性步骤，首次 add 直接成功，零 allowBuilds**。

**附带闭环**：用户本次真实 `github:` 运行（codeload tarball 拉取 + prepare 策略拦截语义）与 D5
本地 git 替身（`git+file://`）语义一致 → plugin-bundle-form gate R3 风险台账项 (a)
「github: fetch 路径仅由用户自己运行覆盖」就此关闭（覆盖证据 = 用户报告原文，R131 日志在案）。

## DoD（完成判据）

1. 干净机器上 `pnpm dsh plugin --profile web add github:ArmourPiercer1/dsh-agent-team` **首跑 exit 0**，
   profile `pnpm-workspace.yaml` **无任何 allowBuilds 条目**。
2. 安装后行为与 plugin-bundle-form 终态全等价：bundles 自动注册、boot S8-READY 等价全闸、
   浏览器 gentry G0–G4 全绿、安装面产物 byte-identical（对 PBA 新提交的基线）。
3. 源码↔产物漂移有闸：构建链末尾产物新鲜度闸（三方核对），改了源码不提交重建产物 → 构建失败（fail-loud）。
4. 五闸全绿 + 红线未破 + bookkeeping 落盘。

## 机制依据（为什么可行）

- pnpm ≥10 对 git-hosted 依赖的策略只拦**声明了构建脚本**（prepare/preinstall/postinstall/preprepare…）
  的包——错误消息前提是「needs to execute build scripts」。包**零生命周期脚本** ⇒ 无从拦截。
- plugin-bundle-form 终态根 manifest 唯一生命周期脚本 = `prepare`。其安装时职责 = 原地构建安装面；
  但已实证最终安装面**不依赖** prepare 的嵌套 install：pnpm 按 `files` 裁剪 git 依赖，最终包
  **无嵌套 node_modules**（R1 §7 独立验证）；运行时 import-time 依赖（yaml + glue 的 @deepseek-ai/*）
  由宿主 `healProfilesModuleFallback`（`packages/boot/app-boot/src/profile.ts:557-605`）镜像解析；
  根 manifest 声明的 registry 依赖（zod / @deepseek-ai/* / dsh-client-* / cordis）由 pnpm 作为
  **普通依赖**安装（不受 git 脚本策略约束，D5 五世界在案）。
- 构建**确定性**证据：R1 在自己 worktree 独立复现 5 个 D5 产物逐字节 SHA；D5 五世界（pnpm store
  上下文）与任务树 byte-identical。⇒ 提交的预构建产物 = 可复现构建输出，无环境漂移。

## 设计决策

- **D1（产物入库）**：解除 gitignore 并提交两个安装面路径的预构建产物：
  `packages/runtime/dist/`（现被全局 `dist/` 规则覆盖）+ `packages/client/composition-shim/`
  （现被显式规则覆盖）。用**否定规则（negation）**，其余包 dist 保持忽略。`files` 白名单**不变**
  （cordis.patch.yml / composition-shim / runtime/dist / root-binding / upstream-resolver.mjs 全部入库后齐备）。
  产物体量 ≈ 4.4MB / ~1017 文件（dist）+ 0.8MB / ~5 文件（shim）——一次提交，后续随源码更新。
- **D2（移除 prepare）**：根 `package.json` 删除 `prepare`（唯一生命周期脚本 ⇒ 根包零生命周期脚本
  = 结构性保证 git 依赖不被拦）。保留 `build` / `build:composition`；新增 `setup` =
  `pnpm build && pnpm build:composition`（dev 便利：fresh clone 后 `pnpm install && pnpm setup`
  等价旧 prepare 语义）。INSTALL.md §3 手动路径本就是显式命令链，不依赖 prepare 自动触发 ⇒ 零影响。
- **D3（产物新鲜度闸）**：新增 `scripts/check-artifacts-committed.mjs`，build 后三方核对
  （相对 git index：`git ls-files -s` 为 tracked 基线）：
  - **A** = tracked 但新构建未产出（stale：源码变更使旧产物不再生成，构建不删除残留文件，
    必须靠产出集比对捕获）；
  - **B** = 新构建产出但未 tracked（新文件未提交）；
  - **C** = 产出内容与 index blob 哈希不符（内容漂移，`git hash-object` 逐文件比对）。
  任一命中 → exit 1 + 逐文件清单。**接入**：`build:composition` 末尾追加 + 独立 `check:artifacts` 脚本。
  被 gitignore 覆盖的文件（`*.tsbuildinfo` 等）不入核对集（`ls-files --ignored --exclude-standard`）。
  确定性前提失效时（未来工具链升级引入非确定性构建）→ 闸显式失败（fail-loud），不做静默漂移。
- **D4（文档）**：
  - `INSTALL.md §2` 快速安装 = **单命令**，删除 allowBuilds 步骤；加一句「为什么不需要 allowBuilds」
    （预构建产物入库，git 安装零构建脚本）；旧 commit（≤ `e832d73`）的 allowBuilds key 移入
    §6 故障排查（只影响安装旧 commit 的用户）。
  - `INSTALL.md §3` 手动路径：补 `pnpm setup` 说明（fresh clone = `pnpm install && pnpm setup`）。
  - README：快速安装段同步（如有）。
  - **纪律注**（§2 + README）：任何影响安装面产物的源码变更，必须与重建产物**同 commit** 提交
    （否则 `build:composition` 新鲜度闸失败）。
- **D5（全新世界实证）**：全新 DSH_HOME 世界（`references/.dsh-test-pba-<stamp>`，test-use @
  `76fda72979`），profile `pnpm-workspace.yaml` **无 allowBuilds 条目**（套件启动前结构断言）：
  1. 从任务树 tip 建 bare repo（`git+file://` 指定符；对 pnpm 脚本策略与 `github:` 语义等价——
     用户真实 github: 运行与本地替身均命中同一 ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED 签名）；
  2. **首次** `dsh plugin add` → **期望直接 exit 0**（核心判据：无拦截、无重试、无 allowBuilds 写入；
     套件 fail-loud：失败即任务失败，不做 PBF kit 的自动补 key 重试）；
  3. 结构断言：已安装 `node_modules/dsh-agent-team/package.json` scripts 中无任何
     prepare/preinstall/postinstall/preprepare；
  4. 安装后状态断言：profile manifest `dsh.profile.bundles` 自动含 `dsh-agent-team`；
     4 件安装面产物 byte-identical（对 PBA 新提交基线）；
  5. boot S8-READY 等价全闸 + 浏览器 gentry G0–G4 全绿（`failures: none`）。
- **D6（五闸 + 红线）**：install 0 / typecheck（9 包）/ test 全量 / lint 0 / smoke；红线不变
  （CORE PATCH BUDGET=0、test-use pristine @ `76fda72979`、`D:\deepseek-harness\` + :3080 零触碰、
  3180 族端口全释放、零 force-push）。

## 变更面（预计）

| 文件 | 变更 |
| --- | --- |
| `package.json`（根） | 删 `prepare`；+ `setup`、+ `check:artifacts`；`build:composition` 末尾追加新鲜度闸 |
| `.gitignore` | 2 条否定规则（`!packages/runtime/dist/`、`!packages/client/composition-shim/`）+ 注释 |
| `scripts/check-artifacts-committed.mjs` | 新增（~90 行，纯 node + git CLI） |
| `packages/runtime/dist/**` | 新增入库（预构建产物，~4.4MB / ~1017 文件） |
| `packages/client/composition-shim/**` | 新增入库（生成 shim，~0.8MB / ~5 文件） |
| `docs/INSTALL.md`、`README.md` | D4 同步 |
| bookkeeping | SESSION_ROUTER_LOG / graph.yaml / STATUS.md / evidence/plugin-prebuilt-artifacts/ |

## 明确不做（范围冻结）

- **不**把 dist 镜像裁剪到 import closure（单独 minor 任务，风险台账在案；当前 files 面已被
  plugin-bundle-form R1 审查接受，裁剪属另一变更面）。
- **不改** plugin-bundle-form 契约面：`dsh.bundle` / `dsh.client` / exports / `cordis.patch.yml` /
  `host.ts` 位置推导 / D8 双 id / D9 defaultWorkspace（7 commit 审查范围冻结）。
- **不改** `TEST_METHODS.md` / `ROUTER_RULES.md`（用户裁决可改；reviewer-worktree 放置规则
  已在 R129 提议、待用户裁决）。
- **不推送**（gate 过后向用户申请一次性推送授权；master 本地领先的 R130 簿记 commit 随本次推送携带，
  R124 先例）。

## 协议

1 task = 1 branch（`task/plugin-prebuilt-artifacts`）= 1 worktree（`.worktrees/PBA`）= 1 writer；
执行 ≤3；substantive 补充 ≤2（用户裁决，严于 ROUTER_RULES ≤3）；int → 3 新鲜盲审 → master；
**reviewer worktree 必须置于 `<repo>/.worktrees/` 下**（R129 future-gate 规则）；
模型路由 = qiyuan-self/qwen3.8-27b（含全部审查）。
