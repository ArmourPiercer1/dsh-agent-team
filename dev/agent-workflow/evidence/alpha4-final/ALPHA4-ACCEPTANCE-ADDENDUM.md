# Alpha.4 §7.7 人工验收附加清单 —— RULING 5-B（warning-first）与实例重建

**状态：`BLOCKED / NOT_RUN` · 判定人 = 人类项目所有者。**
协调者拥有本清单、环境准备与提醒责任，**永不拥有判定**。既有九步清单与签署表在
`dev/agent-workflow/evidence/alpha4-final/ALPHA3-HUMAN-ACCEPTANCE.md`（文件名沿用 ALPHA3，内容是本阶段的收据）；
本文件**只追加**外部复审点名的四项检查与发布披露，不替代九步中的任何一步。

审阅基线：`master @ 217c8ab6`（W1 `45b30498` · W2 `ed9b0552` · W3 `da499e6c` · W4 `f1e2a3af` · W5 `217c8ab6`）。

---

## A. 准备（每条命令都已被实际执行过）

```bash
cd /home/user/dsh-plugins/dsh-agent-team
export CI=true XDG_CACHE_HOME=$PWD/.tmp-xdg/cache
pnpm install && pnpm run build && pnpm run build:composition && pnpm run check:artifacts:head
# 上一次实测：verdict=ok compared=1508 drift=0

cd dev/agent-workflow/evidence/a4-pr7/human-acceptance
node make-corrupt-world.mjs --copy-only      # 复制验收世界，不写损坏行
node verify-corrupt-world.mjs --expect-count 0
node make-corrupt-world.mjs                  # 注入恰好一条不可归属损坏行（实测落在 sequence 15）
node make-corrupt-world.mjs                  # 再跑一次应报 idempotent，零写入
node verify-corrupt-world.mjs                # 断言 corruptCount=1；不符即 exit 2

cd ../../a4-pr76-acceptance-world
node boot.mjs --detach --port 3181 --mock-port 3492 \
  --world /home/user/dsh-plugins/dsh-agent-team/tests/homes/a4-w5-corrupt-acceptance \
  --repo  /home/user/dsh-plugins/dsh-agent-team
# 打开它打印的 token URL。停止方式 = 停 supervisor 本身（Ctrl-C / 停作业）。
```

**停服方式警告（已实测）**：`boot.mjs --stop` 跨沙箱进程调用不可靠（marker 里的 pid 是命名空间局部的；实测该调用把自己打成 143 而宿主仍在监听）。**要停就停 supervisor 进程本身。** `boot.mjs` 未被修改。

完整口径与逐字实测输出：`dev/agent-workflow/evidence/a4-pr7/human-acceptance/RECIPE.md` 与同目录 `raw/01…12`。
清理：`rm -rf tests/homes/a4-w5-corrupt-acceptance tests/homes/a4-w5-disclosure-probe`。
**红线**：`:3080` 及其 `DSH_HOME` 属于稳定开发实例，本轮全部工作只在 `3180` 族与 `tests/homes/**` 内进行。

---

## B. 四项附加检查

### 1. 损坏记录警告条确实显示（对应自动测试 `packages/runtime/test/a4w1-corrupt-warning.test.ts`）

进入 Team 页面，应看到**固定警告条**（非模态、不可关闭），逐字文案：

- `控制账本存在无法解析的损坏记录（仅提示，不改变执行语义）: 1`
- `记录 #15 — 无法归属到具体成员（团队级提示） · request req-a4w5-human-acceptance-damage`
- DOM 钩子：`data-team-control-corruption-attributable="no"`；不应出现 truncated 行（只有 1 条）

数据侧已由两条读路证明（`ControlService.listControlState()` 与真实 HTTP 上的 v9 `team.listCorruptControlLegs`，
均为 `corruptCount 1 / sequence 15 / disclosesMember false`）。**屏幕上的呈现从未被协调者确认过——这正是本步的意义。**

### 2. 团队运行不受该警告阻断（同一自动测试的第 (b) 条腿）

警告条在屏时，照常做一次委派/跟进。**预期：正常执行**——warning-first 的定义就是它不是门禁。
自动侧的对账量是 `no-request` / `executed` / 消费记录 0。若这里被阻断，属于**语义回归**，立即停下报告。

### 3. 销毁后重建：实例重建，不是历史清理（对应 `packages/runtime/test/a4-w2-rebuild-guarantees.test.ts`）

用**现有 UI/Remote `member.dispose`** 销毁一个成员，再用现有创建功能建新实例。逐项核对：

| 观察点 | 预期 |
| --- | --- |
| 旧实例 | 进入 `DISPOSED` 终态，停止接新任务 |
| 新实例 | 新 `instanceId`、新创建标识；**动态权限覆盖为空**（`latest` 无快照、`history` 为空） |
| 审批历史 | **一条不少**——销毁是实例重建，Team 级账本不删历史 |
| 配额 | 被销毁的实例**仍占 `maxInstances`**，不占 `maxConcurrent`；若总量已满，最省事的恢复是新建一个 TeamSession，而不是去动配额或历史 |

**已知缺口**：Leader 的模型工具集目前只有 `team_archive_member`，**没有** `team_dispose_member`。
所以本步验证的是"**人类操作员能重建**"，不是"Leader 能自行销毁重建"。后者已在 backlog（round-50），不阻塞内部发布。

### 4. 警告不会因重建而错误消失（对应 W2 Case 3 与 W1 的重建存活腿）

做完第 3 步后回看警告条。**预期：仍在，且仍是 `记录 #15`**——损坏事实留在 Team 账本里，
与某个成员是否存在无关。若它消失了，那是 RULING 5-B 要防的"永久且不可见"反过来变成了"以为已修好"。

### 5. 完整性检查失败时的中性提示（对应 `packages/client/test/a4w4-corrupt-warning-ui.client.spec.tsx`）

**这一条我没有已验证的 GUI 触发方法。** 已证实的只有：该提示的代码路径由渲染层测试覆盖（读失败 → `role="status"` 中性提示出现、警告条不出现）。
可试的做法（**未实测**）：Team 页面开着时停掉 supervisor，然后点手动刷新——读请求失败应产生
`审批记录完整性检查暂不可用，无法确认是否存在损坏记录（仅提示，不改变执行语义）— 请刷新重试`。
它**只显示类型化错误码、不显示宿主自由文本**（这是协调者的裁决，理由见 round-53）。
若你试出来了，请把实际现象补回本文件；试不出来就记为"未验证"，别当已通过。

---

## C. 内部 Alpha 发布时必须随附的披露

1. **warning-first 的限制（人类裁决原文）**：*已检测到不可归属的历史审批记录异常。当前版本允许团队继续运行，但不能保证受损历史可被完整重建；可继续进行内部测试。如需恢复一个完全独立的审批 Ledger，请创建新的 TeamSession。*
   **前提同样要写**：内部试用**不**把"不可归属的损坏记录不阻断执行"当作无人值守高风险操作的安全保证。
2. `disclosesMember` 语义：它表示"该行披露了可比较的归属信息（身份**或**操作）"，**不是**"某成员造成了损坏"；只写操作身份的行也会是 `true`。
3. 警告**不是实时监测**：读取只在进入 Team 页面、手动刷新、切换 Team 时发生；会话中途新出现的损坏记录要等下一次读。
4. 无 v9 读面的宿主（pre-v9）**两个面都不渲染**——只有"发起且失败"的检查才产生中性提示。
5. 被销毁的成员**继续占用 `maxInstances`**；`maxConcurrent` 不受影响。
6. Leader 无 `team_dispose_member`；销毁由人经现有 UI/Remote 完成。
7. 已知技术债：**9 个既有失败身份**仍在容忍基线内（`COUNTS` 可动，`SET` 不可动）。
8. `census-runtime` 能跑且最新为绿，但**尚未设为 required 检查**（分支保护目前只要求 `pr-gate`）。该提升已被拒绝三次。
9. 警告面**从未在真实浏览器里被看过**：只有 jsdom 渲染测试，CSS 类只经 `data-*` 钩子断言，无 axe / `aria-live` 检查。

---

## D. 签署表（人逐条签；协调者不签）

| # | 检查 | 结果（PASS / FAIL / NOT_RUN） | 备注 |
| --- | --- | --- | --- |
| 1 | 警告条显示，含数量、`记录 #15`、不可归属措辞 | | |
| 2 | 警告存在时团队运行不受阻 | | |
| 3 | 销毁+重建：新实例独立权限历史、历史未删、配额事实成立 | | |
| 4 | 警告不因重建消失 | | |
| 5 | 读失败中性提示（**触发方法未验证**） | | |
| — | 既有九步（见 `ALPHA3-HUMAN-ACCEPTANCE.md`） | | 本文件不替代 |

**本包不能证明的事**：本包只覆盖 RULING 5-B 的可见性与重建面；权限架构、模型真实通知行为、
Leader 工具在真实会话中的可见性仍由既有九步负责。九步 + 本包都签完，才谈得上 Alpha.4 阶段关闭。
