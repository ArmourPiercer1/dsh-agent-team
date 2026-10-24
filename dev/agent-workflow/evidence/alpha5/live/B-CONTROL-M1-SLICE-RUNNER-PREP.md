# B-Control 最小纵切 runner 备料（2026-10-25；等根具体 GO，**未 boot**）

范围 = 仅"请求→Leader 决议→同 call 消费"纵切（= 既有 kit 的 C1 判据），**不**新增 11-legs、
**不**自动 boot、**不**改 driver。复用已核真实 shape（A `f0a0b9557` 同源的成员操作级 envelope）
与 M1 链，不做任何新猜测。

## 1. 固定产品/驱动输入关系（准确版）

| 输入 | 唯一来源 | 传递方式 |
| --- | --- | --- |
| **产品树** | 根给定**冻结候选 SHA**（含本支收口） | `--worktree <冻结候选检出路径>`（kit 默认=自身所在树，须显式给出以防误跑他树） |
| **Host 输入** | 根给定 **f86 统一 Host**；若与本地基线不同树则显式传，同源则以 `tests/paths.mjs` pin 为准（本检出 = `tests/deepseek-harness-test-use` @ `639ed01539`，0.2.0-rc.2） | `--testuse <f86 路径>`（缺省时 kit 经 `paths.mjs`/父仓 fallback 解析） |
| **driver** | `tests/kits/pr-d-control-real-host/pr-d-control-real-host.mjs` @ 同一冻结候选 SHA，**逐字不改**（改 driver 即破坏已入账输入关系；无 subset flag，见 §3） | 直接 `node` 执行 |
| **成员 envelope** | kit 内置 blueprint：member allow 已含 `request-control`（:1291-1293，deny:[]），与根核 A 正解 `allow:[request-control], deny:[]` 同源同 law；**B 无需也不得再改** | kit 生成（无外部 fixture） |
| **HOME** | kit 自建 fresh world home：`<worktree>/tests/homes/<RUN_STAMP>`（工作区内，TEST_METHODS §7；每次运行全新，自清理除非 `--keep`） | kit 管理；取证轮用 `--keep` 并在回执记确切路径 |

## 2. 预置命令（GO 前不执行）

```bash
node tests/kits/pr-d-control-real-host/pr-d-control-real-host.mjs \
  --worktree <冻结候选worktree> \
  --testuse <f86-host 或省略走 paths.mjs pin> \
  --host-port 3184 \
  --mock-port 3499 \
  --evidence-dir <worktree>/.gate/bctl-c1-<stamp> \
  --keep
```

- 端口按根指定显式化：host **3184**（kit 允许区 3182-3186 内，永不 3080/3180/3181）、
  mock **3499**（显式覆盖 kit 默认 3497-3498 探测）。
- 退出语义（kit header 实录）：`0` = 全判据+hygiene 过；`2` = 判据失败（证据全量在
  evidence-dir）；`1` = 环境/boot/row fatal。原始 RC 一律 tee 存证（记 `tee` 管道 RC 教训）。

## 3. 最小纵切与既载判据的关系（不多不少）

- **纵切 = C1**（kit WIRE_NOTES.C1 原文）：member ask-lane（真实 pre-execute adapter）
  → Leader 模型面工具 `team_list_pending_control` / `team_resolve_control` 决议 →
  同 call 消费；durable 事实经**产品 wire** `team.getLedgerPage` + 只读
  `team_domain.json` 扫描双对账。
- kit 无 criteria subset flag（仅 `--worktree/--testuse/--host-port/--mock-port/
  --evidence-dir/--keep` 六项，:90-97 实录），C2–C5 与 C1 共享同一次 boot 账。
  **选项 R1（默认建议）**：原样跑 kit（零改动、输入关系即已入账关系），回执按
  `summary.json` 逐判据报——**纵切结论只从 C1 取证**，C2–C5 如实标"同 run 随行判据"。
  **选项 R2（严格 C1-only）**：需给 kit 加 subset flag = 改 driver = 破坏固定输入关系，
  除非根 GO 明令，不做。
- 消费/取消/deny 零副作用等其余腿（前呈 ≤11 legs 方案）**冻结不展开**，等纵切 C2 落地后根再裁。

## 4. 回执口径（执行轮）

- FULL SHA（冻结候选）+ f86 host 版本/SHA + 确切 HOME 路径 + evidence-dir 原始 RC +
  `summary.json` 中 C1 各 check 清单 + ledger 双对账件路径。
- 首条允许写 "**C2 运行已测**" 的行 = 仅 C1 覆盖的 `team_request_control` 发起 +
  Leader `team_resolve_control` 决议 + 同 call 消费（其余行维持接线未测）。
- 失败即停：不重试改参（除非根再 GO），现场 `--keep` 保留。
