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

## 证据层级 v2（root 1805 独审 BLOCK 整改后；v1 口径作废，勿再引用）
- **v1 撤回两条**：旧 S3「等价 df 失败路径」说法**不成立**——缺 pin 的抛出被 `main().catch` 吞掉，
  dieFatal/teardown 从未执行；旧 S3b 传参相同、**从未真正构造 stale**。二者降级为：
  S3 仅证明「下游未捕获得败路径非破坏（main().catch 层）」；kit 的 dieFatal/stale 支在 fixture 中
  **不可达**（钉死 tgz sha 不可伪造），**已退役**——freshness/lock/teardown 的真实覆盖移到 launcher 腿。
- **v2 实测评语**：`kit` 模式 18/18 PASS（rc=0）；`launcher` 模式 28/28 PASS（rc=0）；
  最终 manifest：deleted=0 / changed=0 / badAdds=0。
- 覆盖：import+非法CLI argv（kit inert 解析；launcher catchable throw；均零触盘、零 exit 宿主）；
  14 行 --world 矩阵；guard 单元（严格 registered/registered+SEP 边界、前缀陷阱 w-1/w-10、
  悬空 symlink、祖先前置换指兄弟、目录替换 identity 漂移 dev/ino/ctimeMs/size 四元、
  `.worktrees` 段真实 home 拒绝、无登记即拒）；launcher 腿：禁端口、provenance 墙（无 shim）、
  **外锁场景 = 拒绝且外锁字节级不动**（v1 会删它）、取得前失败零清理、
  **真实初始化失败 teardown**（取得自有锁→boot 撞 mock tripwire→fatal→shutdown 只清自己的锁；
  DshInstance tripwire 全程不响）。
- **仍未测/不存在等价性**：真 df 故障注入（入口无 df 面，S4 静态证明；注入无对象）；
  真 Host 与产品判据（冻结）；RSJ 原始 v1 入口（已删，只有本 spec，**不得称已修**）。
- fixture 独占：`mkdtemp`（fixtures/fixture-XXXX），本 run 独建独用，不预删任何传入路径，
  run 后原样留存供巡检；git shim 仅存在于 fixture 的 PATH 前缀，不触真实 git 行为断言。
- 命令与 RC：`node sentinel.mjs <fixtures-parent> <entry> <guard> --entry kit|launcher`；
  kit rc=0、launcher rc=0（rc=0 仅当全场景过且零越界删除/变更）。历史：v1 run1 崩溃、run2 FAIL(自身判定)、
  run3 rc=0 但覆盖口径错误（上文已撤回）。

## 覆盖 vs 仍缺（诚实清单）
- 覆盖：上表 4 源的 law 接入 + 场景证明（空参/import/非法 world/失败路径/guard 单元）。
- 仍缺：① 原始 v1 源码不可核（只能以保留源码+现场 damage 为准，f85 恢复线负责还原）；
  ② 哨兵未跑真 Host（按 16:05 裁决）——修后 kit 的真 C2 由根在放行后择窗执行；
  ③ int 树 bin.js 等由 f85 恢复中，本 lane 不声明其完整性；④ 跨进程"同 owner 上下文停止"
  目前是靠 harness 句柄纪律 + launcher 实现（无数字 PID kill），非 OS 级强制。
