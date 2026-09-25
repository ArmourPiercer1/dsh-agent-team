# Review-supplement F1 — the 0.1.7 compatibility gate now constrains this plugin

日期：2026-09-24 · 分支：`task/dsh-017rc1-upgrade`（worktree `.worktrees/dsh-017rc1-upgrade`）
Guide：`docs/plans/active/PR29-review-supplement-fix-guide.md` §1（finding F1，merge blocker）
Host pin：`46a7f68b0922371ce7144b668b90e377d8e799f4`（DSH 0.1.7-rc.1，PR #5073；test-use pristine）

## 1. Finding（review 结论，复述）

U8 实宿主 git-install 的"0.1.7 版本兼容门通过"是**构造性通过**：插件根 manifest
（`package.json`）**没有声明任何 `peerDependencies`**，而 0.1.7 的兼容性评估器对
缺失 peers 的 manifest 返回 `undefined`（"Missing DSH peers impose no constraint"）
→ 门对 `dsh-agent-team` 从未真正校验过任何东西。若插件与 0.1.7 宿主不兼容，
该门不会拦截。

## 2. 评估器事实（0.1.7 @ 46a7f68b09 源码核实，非 grep 转述）

来源：`tests/deepseek-harness-test-use/packages/boot/app-boot/src/plugin-compatibility.ts`

- `evaluatePluginCompatibility(manifest: object, exemptions: Record<string, readonly string[]> = {}, runtimeVersion = getDshRuntimeVersion()): PluginCompatibility | undefined`
- 无 `peerDependencies` → `undefined`（无约束，不报错）。
- 只检查 `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` 前缀的 peer；`workspace:^`/`workspace:~`/`*` → 解析为运行版本。
- 判定：`semver.satisfies(runtimeVersion, range, { includePrerelease: true })`；不满足 →
  `{ name, version, runtimeVersion, peers, exempted }`。
- 豁免键 = `` `${name}@${version}` `` → 精确运行版本数组；`pluginCompatibilityWarning(issue)`
  在 "not active"/"active" 两种文案中点名该键。
- `getDshRuntimeVersion()` 读 `../package.json`（相对构建产物 `lib/`）→ 本测试树 = **`0.1.7-rc.1`**。
- 调用面（`packages/boot/plugin-manager/src/operations.ts`）：
  - install **preflight**（`namedSpecManifest`）：`path:` spec 直接读 `<path>/package.json`；
    `registry:` spec 经 `pnpm view … peerDependencies --json`；**git spec 在 preflight 阶段
    返回 undefined（跳过 lookup）**，交给安装后检查。
  - **安装后检查**（`index.ts` 对已安装目录）：读安装落盘的 manifest —— git install 即
    本仓库根 `package.json`（clone 内原文件）。
  → 两个入口读的都是**同一份根 `package.json` 的 `peerDependencies`**；不存在替代声明位
    （无 `dsh.plugin.json` 类文件被评估器读取）。

## 3. 修复

| 文件 | 变更 |
| --- | --- |
| `package.json` | 新增 `peerDependencies: { "@deepseek-ai/dsh": "0.1.7-rc.1" }`（**精确 RC 版本，评审裁决：不用 range/`*`/0.1.5 兼容面**） |
| `.npmrc`（新） | `auto-install-peers=false` —— peer 是**宿主侧契约声明**，不是本 workspace 的运行时依赖；禁止 pnpm 把它装进本地 `node_modules`（装进来会引入整个 0.1.7 宿主包图进插件开发环境） |
| `pnpm-lock.yaml` | 见 §4（必须提交，frozen install 依赖） |
| `packages/testkit/test/plugin-dsh-compat.test.ts`（新，7 测试） | 用**宿主自己的构建产物评估器**（test-use `packages/boot/app-boot/lib/index.js`，动态 import，非再实现）锁正/反/空/豁免行为 |
| `tests/paths.d.mts`（新） | `tests/paths.mjs` 的 NodeNext 伴生声明（`.mjs` → `.d.mts` 配对）；compat 测试是首个以 TS 严格模式 import 该模块的测试，TS7016 必需。导出面与运行时模块逐一对应 |
| `packages/testkit/test/p4t6-session-event-scan.test.ts` | 单写者 pin 747→748（+1 可扫描文件 = `plugin-dsh-compat.test.ts`；本测试既有惯例，含本分支 mini-mcp.d.mts 先例） |

## 4. lockfile 再解析（必须提交的 7732 行 diff 的性质）

pnpm 11 把 workspace 根项目的 `peerDependencies` 记入 lockfile（frozen install 对
"specifiers in the lockfile don't match specifiers in package.json" 是硬失败，
`auto-install-peers=false` 不能豁免该记录）。声明 peer 后 pnpm 全图再解析：

- **版本多重集 diff = 恰好 +1**（`@deepseek-ai/dsh` umbrella 自身 0.1.7-rc.1 进入图）；
  全部既有包版本不变（逐 `version:` 行多重集对比），integrity 内容哈希集合 348→793
  的新增全部来自 umbrella 拉入的宿主树（同版本 tarball，registry 不可变）。
- 其余 diff = **peer 后缀实例化变化**（同一 `name@version` 获得不同 peer-context
  哈希键，如 `dsh-client-test-runtime@0.1.7-rc.1(32bb…)` → `(846f…)`）。
- 试过的抑制手段均无效：`dedupe-peer-dependents=false`（同 diff）；把 peer 满足给
  workspace 包（不存在 `@deepseek-ai/dsh` workspace 包，伪造 shim 触红线，否）。
- 结论：该 diff **语义中性**（零版本漂移、零内容漂移），是声明 peer 的 pnpm 侧必然后果；
  提交理由 = 让 `pnpm install --frozen-lockfile` 在本声明下可复现（G2 闸）。

## 5. peer 实例化变化的下游适配（可证明不可避免，随 F1 提交）

新 lockfile 下 `dsh-client-test-runtime` 解析到**更完整**的 peer 实例化（846f 变体，
siblings 含全套 `@deepseek-ai/*` client 包），`dsh-client-ui-layout` 的类型由此进入
程序 → 其对 `@deepseek-ai/dsh-client-ui-slots` 的 `declare module` **模块增强**生效 →
`GlobalStandardProps` 新增必填成员 `usePanelInfo: UsePanelInfo`
（`SnapshotSelectorHook<PanelInfo>`，`PanelInfo = { activePanelId: MainPanelId | null }`）。

旧实例化（32bb）下该增强不在程序内 → 7 个 client spec fixture 此前不携带该 prop。
完整实例化**更接近真实宿主**（宿主 app 提供 usePanelInfo）；src 层
（`TeamView.tsx` 等）零改动通过 typecheck（组件按参数收 props，不做字面量）。

适配 = 7 个 spec 的 `viewProps`/`entryProps` fixture 各 +1 行：
`usePanelInfo: (sel) => sel({ activePanelId: null })`（常量快照选择器，Team 组件从不读）。
涉及文件（均 fixture 函数内，模式一致）：
`d2-team-mode-entry` / `d3-ordinary-mode-entry` / `f9u-control-surface-probe` /
`new-team-entry` / `team-legacy` / `team-roots-zero-state` / `team-view`（`.client.spec.tsx`）。
这是 guide 范围条款允许的"与 3 finding 直接相关、可证明不可避免的编译适配"——
因果链 = F1 声明 peer → lockfile 再解析 → 实例化变化 → 类型面变化；无 F1 则不存在。

## 6. 门的行为验证（focused test，宿主自己的评估器）

`packages/testkit/test/plugin-dsh-compat.test.ts`（7/7，`focused-tests.log`）：

1. `getDshRuntimeVersion() === '0.1.7-rc.1'`（构建产物读自身 package.json）。
2. 根 manifest 的 `@deepseek-ai/dsh*` peers **恰好** `[['@deepseek-ai/dsh','0.1.7-rc.1']]`。
3. 正向：`evaluatePluginCompatibility(manifest, {}, '0.1.7-rc.1') === undefined`（接受）。
4. 反向：运行版本 0.1.5-rc.2 → issue `{peers:{'@deepseek-ai/dsh':'0.1.7-rc.1'}, exempted:false}`；
   `pluginCompatibilityWarning` 文案含 `` `dsh-agent-team@…` `` 键 + "not active"。
5. 反向：运行版本 0.1.7-rc.2 → 不满足（**精确 RC 的严格性**，rc.2 升版必须显式改 peer）。
6. 空面（文档化修复前状态）：无 peer 的 manifest 在两个运行版本下均 `undefined`
   —— 即 F1 finding 的"无约束"机制本身，留档防回归误读。
7. 豁免机制（文档化，**本插件从不申请**）：`name@version` 键 + 精确运行版本数组 →
   `exempted:true`；H1 实宿主冒烟证明真实安装无任何 `compatibility.json` grant。

## 7. 实宿主验证

见 `real-host-smoke.md` H1：fresh world git-install 本分支（含新 peer）→
preflight 接受、无 incompatible warning、无 allow-version 豁免、无 compatibility.json
grant，且安装日志可证明 peer 被读取（门从"无约束"变为"已校验 0.1.7-rc.1 ✓"）。
