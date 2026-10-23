# C1-RECEIPT-R1 — a5m2-image-row-c1 收件回执（2026-10-23T11:2xZ，新主开发 = 唯一 shared writer；root 准精确提交正式 C1 并核原命令实际 RC）

## 1. 完整 SHA（origin/feat/a5-m2-integration 已推）
| SHA（完整） | 内容 |
|---|---|
| `0d5255a49f0135dff59385cb41e4755bb26f37a6` | C1 spec 唯一新增（869 行，kernel→int 逐字节 cp） |
| `cc2e151ca094660339943588c3659bc5bb1549e4` | TS 修复（卡③指纹腿 4×TS2345，本文件既有 cast 惯例，断言零弱化） |
| `8b66ba02ebff5188aae44e6c9ad9813ded0332c7` | todo scoped 捕获修复（根窄审中） |
| `54902a8c41d88c4c3e2e0ca5aa2861f9165958ef` | write 同源 scoped 捕获修复（根裁既定装配） |

spec blob：`0d5255a49` 处 = git blob `825d989e784930b1e2f1036340cd2638615f652d`；`cc2e151ca` 处 = `7ebdaa91b0b34e7359e2bc6be36b24c4d8938cae`。
kernel 工作树 spec sha256（= int@cc2e151ca 内容，cmp 已验）：`98140f338fb47ec9b7158f99028f1b519074a357d40b67c8a4f4a7101582f723`。
验证树 = `.worktrees/a5-m1-kernel` @ `c978eb2fc7141b33cce9de50fb8dceae47934b91`（有 node_modules；int 面无 node_modules 不跑测）。

## 2. 定点真 RC（pipefail；日志同目录）
- `pnpm exec vitest run packages/runtime/test/a5m2-image-row-c1.test.ts` → **REAL_RC=0，12/12**（`c1-pinpoint-vitest.log`）。会话内更早一次同命令（0d5255a49 内容）亦 RC=0。
- `pnpm --filter @dsh-agent-team/runtime run typecheck` → **TS_RC=0**（`c1-pinpoint-typecheck.log`）。
- `pnpm exec eslint packages/runtime/test/a5m2-image-row-c1.test.ts` → **ESLINT_RC=0**（`c1-pinpoint-eslint.log` 记录 exit）。

## 3. TS 修复的诚实中间态（0d5255a49 内容上）
vitest RC=0 但 runtime typecheck 报 **4×TS2345**（`test/a5m2-image-row-c1.test.ts` 行 841/842/849/850：`Record<string, unknown> | undefined` 传入要求非 undefined 的 `fpOf`/`targetOf` helper）。cc2e151ca 采用本文件既有 `world.legInputs[i] as {...}` 读取侧 cast 惯例（见 byteCap/callId 腿），在既有 `legInputs.length===2` 断言后一次绑定两条目——**断言与语义零变化**（vitest 12/12 复验）。码名 PLANE_CFG_INVALID/PLANE_CONFIG_INCOMPLETE 不统一（根裁，未动）。

## 4. 三卡覆盖轻审（根裁口径）
九腿 + 三卡面全在（L553–L869）：卡① render 两 block 含 `{type:'image'}`（L806）；卡③ 全参指纹 `./good.png` vs `good.png` 两不同 `sha256:` 指纹 over 同一 canonicalTarget（L828）；卡②/③ 身份腿 `arm.definitionIdentity === placementFeed('read_image').definitionIdentity === family key === binding fixture`，且断言 `/^def#\d+$/`（真 WeakMap 代数形制，非手拼 sha: 串）（L854）。身份经 `definitionIdentityOf(placedDef)` 于 createArm 工厂与 placementFeed 对**同一 def 对象**调用。

## 5. 受审产品面（声明核真）
spec 全部 import（src 面 15 文件：governed-families/image* 4、controlled-fs 3、pa-control-bridge、control/types、pa-mount-registry、team-tool-plane、tool-dispatch×2、tool-admission）逐文件 sha256 与 int@`0bda4ab24…` **字节一致**；三笔提交的产品改动仅 agent-bindings.mjs（src+dist mirror），不在 spec import 面内。"未改产品"成立。

## 6. census 事实移交（不判归属——独占 CI owner 职权）
本轮新增可扫路径**有且仅有一件**：`packages/runtime/test/a5m2-image-row-c1.test.ts`（blob 见 §1）。todo/write 修复只改已计文件（agent-bindings src；dist 在扫描外）。p4t6 在 kernel 实测 `expected 1255 to be 1245`；**本回执不将该 delta 归入任何既有红**——按根裁，由 CI owner 以精确 SHA manifest（本节 blob + 其自有 4 路径队列）核期望收集数并正式 re-anchor；不删测试、不改基线、不忽略失败、不重复全套。本 writer 未触碰 census 数字。
