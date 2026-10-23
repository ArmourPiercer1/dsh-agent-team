# A5 world-safety — entry-safety fix + sentinel (2026-10-23)

## 独占源范围（test-infra owner, 唯一修改者）
| 源 | 角色 | RC (sha256) |
|---|---|---|
| `tests/kits/lib/world-safety.mjs` | 新增：L1 parse-law / L2 register / L3 no-fallback cleanup guard | `6d13d9f2f0cd7c207d0bfae5e8c51a84e94d38bbab25b856f20ce4d51bcf0bb7` |
| `tests/kits/a5m2-todo-c2/a5m2-todo-c2.mjs` | 入口修复：import 不执行 main；缺/非法 --world 不进任何路径；assertWorld realpath 复检；删除无用的 `rmSync` import | base `5b039e9b8af3…`（保留磁盘现字节为基线）→ RC `361331a9eb529228d5da8ea45f94e2d0343a9283cb30031e2ec4aaf8d3087b40` |
| `dev/agent-workflow/evidence/a5-parallel-worlds/launch-world-infra.mjs` | 同一 law 接入（import throw，不 exit 宿主） | `f1a4637d5e6382e34d9dff5c1a36743890fb1078f14ece36d0be369b5fd466bc` |
| `dev/agent-workflow/evidence/a5-world-safety/**` | 哨兵 + 报告 | — |

未动：f85 恢复中的 `.worktrees/a5-m2-int` 任何字节、RSJ 证据 raw、主仓 git、:3080。

## 事故类 vs 修复层（以保留源码为准；v1 已删，不以其为可核源码）
- 保留源码实测：`rmSync` 仅 import 零调用；`dieFatal` 全保留语义（worldRetained:true）；无 df/prune。
  故事故代码在已删的原始 v1 里，**不可按回忆重建**；本修复针对其模式在现入口上封死。
- LAW-1 import 不得执行 main（import = inert 或可捕获 throw，绝不影响导入进程）。
- LAW-2 --world 必填且只接受 `tests/homes/<单一安全名>`；空/`.`/`..`/绝对/嵌套/穿越/homes 根/
  symlink world 一律先拒绝，拒绝时零 fs 触盘。
- LAW-3 任何删除只允许指向"已登记 world 的 realpath"（`assertCleanupTarget`），
  拒 cwd/repo/worktree 根/HOME/fs 根（相等或包含关系），symlink 拒绝跟随；**前置失败无父目录 fallback**。
- LAW-4 停止只用真实任务句柄（harness job handle / 同 owner 进程内 handle）；
  namespace-local PID 仅登记，不跨上下文 kill。端口空 ≠ 进程树 quiescence。

## 哨兵（`sentinel.mjs <fixture> <kit> <guard>`；零 Host，tripwire 桩使任何 boot 尝试当场报错）
19/19 PASS（`sentinel-report.json`，VERDICT PASS — ZERO out-of-bounds deletion）：
S1 import-no-main；S2 14 种非法 --world 全拒且全树零删除/零变更；S3 合法 world 下后续预检失败
→ 除 fixture 内 evidence 目录外零新增、零删除（"df 误空触 teardown 递归"类在现入口无删除面 + 失败无 fallback）；
S4 静态律：入口源无 rmSync/rm -rf/prune/df 调用位；S5 guard 单元：父目录 fallback/仓根/兄弟 world/
未登记 全部拒绝，登记 world 内通过。

## 证据层级（19/19 覆盖的精确边界，勿混级）
- 19/19 实际测试对象 = **修复后的 `tests/kits/a5m2-todo-c2/a5m2-todo-c2.mjs` 入口**（字节复制到 fixture
  独立假仓运行，boot 原语全为 tripwire 桩）+ **guard 模块单元（S5）** + **该入口源码静态律（S4）**。
- **未测**：① `launch-world-infra.mjs`（同 law 接入，仅 `node --check`，未入哨兵场景）；
  ② RSJ 事故原始 v1 入口（已删不可核，**目前只有本 spec，不得称已修**）；③ 真 Host/产品判据（冻结）。
- 「错误 df」场景 = **等价预检失败**（S3：合法 world 下 pin 缺失致下游 dieFatal），
  **不是真实 df 故障注入**——现入口无任何 df/prune/rm 调用位（S4 静态证明），故障注入无对象可注；
  证明的是"失败路径零越界删除 + 无父目录 fallback"这一层，不是"df 故障被正确响应"那一层。
- 哨兵原命令真实 RC：run1 崩溃（guard 首版祖先判定过宽，sentinel 自身未捕获抛出，无报告）；
  run2 verdict=FAIL（S5 同判定 + fixture 证据祖先目录误记 badAdd，非入口缺陷）；
  run3（当前字节）`sentinel-rc=0` = VERDICT PASS（脚本约定 rc0 仅当 19/19 且零越界删除）。

## 覆盖 vs 仍缺（诚实清单）
- 覆盖：上表 4 源的 law 接入 + 场景证明（空参/import/非法 world/失败路径/guard 单元）。
- 仍缺：① 原始 v1 源码不可核（只能以保留源码+现场 damage 为准，f85 恢复线负责还原）；
  ② 哨兵未跑真 Host（按 16:05 裁决）——修后 kit 的真 C2 由根在放行后择窗执行；
  ③ int 树 bin.js 等由 f85 恢复中，本 lane 不声明其完整性；④ 跨进程"同 owner 上下文停止"
  目前是靠 harness 句柄纪律 + launcher 实现（无数字 PID kill），非 OS 级强制。
