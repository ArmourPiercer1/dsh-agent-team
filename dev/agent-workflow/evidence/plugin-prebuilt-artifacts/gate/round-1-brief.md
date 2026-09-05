# Gate round 1 — plugin-prebuilt-artifacts — reviewer brief（盲审，三 reviewer 同文）

**范围（scope frozen）**：`f11382e..1a5afc6`（int/plugin-prebuilt-artifacts，3 commits：
`5a05ca3` 立项簿记 / `bc3fa05` 产品（1020 预构建产物 + prepare 移除 + 新鲜度闸 + 文档）/
`1a5afc6` 执行 1 簿记（五闸 + D5 世界实证）。1067 文件，+90574/−41。
**Reviewer worktrees**（R129 future-gate 规则：置于 `<repo>/.worktrees/` 下）：
`PBA-REV1` / `PBA-REV2` / `PBA-REV3`，均 detached @ `1a5afc6`。
**盲审约束**：不读 `SESSION_ROUTER_LOG.md` / `graph.yaml` / 任何 task-brief（流程文档）；
evidence 数据文件可作数据参考；裁决必须立足于 diff + 自己复现。
**模型路由**：qiyuan-self/qwen3.8-27b（三 reviewer 同模型，独立上下文）。

## DoD（给 reviewer 的产品判据，无流程信息）

1. 消费者 `pnpm dsh plugin --profile web add github:<repo>`（pnpm ≥10 的 git 依赖安装）
   **首跑成功、profile pnpm-workspace.yaml 零 allowBuilds 条目**。
   声称机制：包零生命周期脚本（无 prepare/preinstall/postinstall/preprepare）+ 安装面产物
   预构建入库 ⇒ pnpm git 依赖构建脚本策略无从拦截。
2. 安装后运行时行为与变更前全等价：bundle 自动注册 / host boot 健康 / client bundle 伺服 /
   浏览器建队垂直端到端。
3. 任何影响安装面产物的源码变更必须与重建产物**同 commit**（新鲜度闸 fail-loud 强制）。
4. 五闸全绿（install / typecheck / test / lint / smoke）。

## 给 reviewer 的复现脚本（摘要；全文见 subagent prompt）

1. `pnpm install` → exit 0
2. `pnpm typecheck` → exit 0（9 包）
3. `pnpm build && pnpm build:composition` → exit 0 + `[check-artifacts-committed] OK`
4. `pnpm test` → ~2404 测试；**已知 p6t1-parallel 负载 flake 协议**（仅该文件失败且其余全绿
   时，隔离复跑 green 即满足；记录两结果）；其他失败 = 真实发现
5. `pnpm lint` → exit 0
6. `pnpm smoke:composition` → exit 0
7. （可选加分项）新鲜世界套件 `pba-setup.mjs` → `pba-boot.mjs boot` → `pba-gentry.mjs`
   → `pba-boot.mjs stop`（port 3180 先验后验；busy 则跳过并注明）

## 裁决格式（四选一，ROUTER_RULES）

- **通过** / **投机通过**（残余风险列明）/ **补充内容**（逐条具体，计 substantive）/ **不通过**

## 红线（reviewer 侧）

不改 tracked 文件；不 push/不建分支；不触碰 `references/deepseek-harness*`、:3080、
`D:\deepseek-harness\`；port 3180 族用完即释放。
