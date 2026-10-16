# p07-review-REG1 — REG-01 独立真实 Host 定向复验（第二方，非执行者）

- 复验代理：REG-01 定向独立复验代理（qwen3.8-flash-next，powered-by 逐字：`powered by the qwen3.8-flash-next model`；独立会话、未参与实现）
- 日期（宿主时钟）：2026-10-15T23:18Z … 23:26Z
- 条款（guide §4 表）：**REG-01 | 独立真实 Host 复验 | 再现最关键的正/负例、同一锁定 SHA、干净 upstream**
  （`docs/plans/memo/alpha5-tool-io-governance/P0-independent-adapter-poc-implementation-guide.md:214`）
- **范围声明**：本复验 = REG-01 宿主条款。**不重开 fixture 面（FS/SRCH/PROC/PTC/LSP/GOV/BND 各条目的 fixture 级证据一律不重开）；不产生 GO/选型裁决**；选型算法（guide §5）与族 verdict 不因本文件改变。

## 0. 锁定 SHA 与环境核对（亲手）

| 项 | 期望 | 实测 | 判定 |
| --- | --- | --- | --- |
| exp worktree HEAD | `79d6aea72313619d1e167f647133cdb3c114384c` | `79d6aea72313619d1e167f647133cdb3c114384c`（branch `exp/alpha5-poc-20261016`，W 工作树 porcelain 空） | ✅ |
| pinned test-use rev-parse | `639ed01539…` | 完整 `639ed015397290b3745d163aafe02ffee4aa3f84`（0.2.0-rc.2 基线常量逐字等）；会话首、尾各测一次均等 | ✅ |
| pinned test-use porcelain | 0 | 会话首=0、会话尾=0（`git status --porcelain | wc -l` 两次亲手） | ✅ |
| :3080 稳定实例 | 只读、pre==post | 我亲手 `GET http://127.0.0.1:3080/` pre=**401**、post=**401**；两轮 KIT 内部 `pre-stable-probe.json`/`post-probes.json` 亦记 401==401，3180 unreachable；全程零操作 | ✅ |
| 端口 | 3185 only | 两轮 KIT 均 `hostPort=3185`（summary/h6-summary 字段），mock=ephemeral `:0`；`3185FreeAfterTeardown=true`（两轮 post-probes） | ✅ |

## 1. p06-stage2b-kit.mjs 重跑（原样、零改动）

- 命令：`node p06-stage2b-kit.mjs --evidence-dir reg1-p06-2026-10-15T23-18-22`（默认路径参数外零改动）
- 产物：`07-integration/03-stage2b/reg1-p06-2026-10-15T23-18-22/`（run.log、summary.json、i2-*/i3/i4-*/i5-* 全套 + kit-console.log）
- **重跑判定**：`summary.json.verdict=PASS`，criteria **10/10 ok**，`increments={I1:true,I2:true,I3:true,I4:true,I5:true}`，`failed=[]`，hostBaseline=`639ed01539…3f84`，hostPid=41，3185 释放。
- **对照基线 `run-2026-10-15T22-44-01`**（PASS 10/10）：id 集与逐条 ok 全等；detail 归一化（时间戳/pid/instanceId/rpcId/child-session-id 容差）后 **I1/I2b/I2c/I2d/I3/I4a/I5/I5z 全等**；仅两处容差内差异：
  - I2a：`rpcId` 每次运行随机（`a5x-qusv9e5nvp` → `a5x-4knatnl3tl`），结构等；
  - I4b：seed 文件名内嵌 run-stamp（`a5p0-seed-2026-10-15T22-44` → `a5p0-seed-2026-10-15T23-18`），语义（native 正文 + markerLines=2）等。
- 关键语义再现：I3 seed 唯一内容回显（真实 body）；I4a Adapter marker `A5P0_ADAPTER_RAN_<stamp> call=2` + native 特征消失、markerLines=2；I4b 对照成员 native 保留；I5 dispose 后 `Error: unknown tool "read"`（无 native 回退、marker 计数不变）；I5z 链终止。
- 世界 `tests/homes/a5p0-s2b-2026-10-15T23-18-22` KIT teardown 自动删除（run.log `world removed`），复核 tests/homes 无残留（仅存前步 4 个历史世界，未触碰，见 §4-d）。

## 2. h6-kit.mjs 重跑（原样、零改动）

- 命令：`node h6-kit.mjs --evidence-dir reg1-h6-2026-10-15T23-19-12`
- 产物：`07-integration/03-stage2b/reg1-h6-2026-10-15T23-19-12/`（含 h6-summary.json、h6-result.json、hd-control-ledger.json、h6-team_domain.json.copy、ha/hb/hc/hd-* 全套）
- **重跑判定**：`h6-summary.json.verdict=PASS`，criteria **18/18 ok**，`failed=[]`；id 集与基线（`run-h6-2026-10-15T23-15-50`，PASS 18/18）全等、逐条 ok 无翻转；KIT 退出码 `h6-KIT_EXIT=0`。
- 族线再现：H1 boot/401/health；H2a-d team 世界活体；**H-A**（HA-pos/HA-neg/HA-ledger）；**H-B**（ctl/adapter/equiv/neg：native 4==adapter 4 multiset 等）；**H-C**（HC1 surface bash 缺失 / HC2 own-layer 再注册后 typed deny 零 marker / HC3 run_code typed 拒绝）；**H-D**（deny typed + bytesUnchanged / ask 公共通道 4 req 4 allow / one-shot）。
- 世界 `a5p0-h6-2026-10-15T23-19-12` teardown 删除（IMPACT RECORD in run.log）。

### 2a. H-A 线扫分层（反例 (a)，亲手核验）

- `reg1-h6-*/h6-result.json` criteria `HA-neg.detail` 内**两个独立字段**：`wireContentHits=0` 与 `wirePathEchoes=61`；`legs['H-A fs.read-restricted'].counts.wireSecretHits=0` 为内容计数的独立投影。
- 断言各半独立（h6-kit.mjs 源码，只读核证）：`wireSecretHits`（kit:886，唯一内容标记 `SECRET_UNIQUE`）参与 `haNeg` 断言（kit:900-901 `wireSecretHits === 0` = FAIL 门）；`pathEchoHits`（kit:887，路径回显 `'secret.txt'`）仅写入 detail 披露，**不参与任何 FAIL 判定**（kit:882-885 注释明示 "the ONLY leak criterion … never a FAIL"）。
- 判定：内容标记命中=0 与路径回显计数确为两字段、断言角色各自独立 → **再现成立**（路径回显属 tool_use 输入回显，非内容泄漏；基线同构：hits=0/echoes=60 → reg1 hits=0/echoes=61，量级一致）。

### 2b. H-D 一次性消费（反例 (b)，亲手核验）

- `reg1-h6-*/hd-control-ledger.json` 字段：`controlRows.requests`（4 条、requestId 互异）、`controlRows.decisions`（4 条全 `allow`）、`controlRows.consumptions`；我逐 requestId 计数：`{'ctrl-1w2u…':1,'ctrl-05ck…':1,'ctrl-0201…':1,'ctrl-02jc…':1}` → **每请求恰一 `control-allow-consumed`，consumption 集合 == request 集合**。
- 原始账本 `h6-team_domain.json.copy` factType 普查：`control-request-recorded:4 / control-decision-recorded:4 / control-allow-consumed:4`（1:1:1），**无任何 standing-grant/pending-grant 事实类型残留**。
- 佐证（HD-onshot detail）：第二次 EDIT 的 old-text 只能是第一次批准执行后的产物（`editContent=H6EDIT_APPLIED_2_…`，`EDIT_APPLIED_1 line` 已消失）→ 批准不可复用。**再现成立**。

## 3. 宿主 typed 拒绝原文逐字对合

- 选定：**run_code reserved**（PTC-01）。基线 vs reg1（`h6-plugin-results.jsonl` leg=`runcode-register` 的 `error` 字段）逐字节相等：
  `tool name "run_code" is reserved for the PTC mode presentation transport and cannot be registered or shadowed` → **BYTE-IDENTICAL=True**。
- 附加对合（exec fingerprint，HC2）：模板逐字等 `Error: permission denied: exec fingerprint sha256:<HEX> answered deny from the fallback`；仅 fingerprint 十六进制值随注册实例变化（base `7c3a7728…` → reg1 `fa4ced33…`），属预期 per-registration 差异。

## 4. 披露（不影响判定的事实）

a. **世界命名**：指令要求 `a5p0-reg1-<ts>`；KIT 源码硬编码 `a5p0-s2b-<stamp>`/`a5p0-h6-<stamp>` 且禁改工装 → 实际按 KIT 命名，两者均已用毕即删（teardown 留痕），意图（一次性、清理）满足。
b. **`h6-result.json`/`h6-KIT_EXIT`（KIT_DIR 根部副本）被重跑按 KIT 固有行为覆盖**；基线原件双重保全：`run-h6-2026-10-15T23-15-50/h6-result.json`（权威）+ 我的重跑前快照 `reg1-baseline-20261015T231803Z/`。W 的 git 面仅 +3 个 reg1-* untracked 目录 + 该 M（工装自身写出），零产品/工装代码改动。
c. 基线目录 `run-2026-10-15T22-44-01/i5-member-session-events.json` 在 p06 KIT 源码内**无写入方**（notes.md:74 表明系执行者带外抽取件）；KIT 原生对应物 `i5-unknown-read.json`/`i5-session-pages.json` 我已复现且等值。记录为基线证据来源学注记。
d. `tests/homes/` 存留 4 个前步历史世界（a5p0-boot/smoke×2/stage2，21:36–21:46Z），非本复验产物，未触碰；建议执行者按 TEST_METHODS §7 自行处置。
e. bash 正文仍受本宿主沙箱后端环境阻塞（`no sandbox backend is usable`，fail-closed by host）；ask 通道账本不受影响——与基线一致、原样披露。

## 5. REG1 总判定

**REG1 = PASS** —— 最关键正/负例在同一锁定 SHA（W HEAD `79d6aea7…14384c`、host `639ed01539…3f84`、porcelain=0 首尾两测、:3080 只读 401==401、端口仅 3185）上全部再现：p06 **10/10** 与基线判定等（差异仅 rpcId/run-stamp 容差项）；h6 **18/18** 与基线判定等；H-A 分层两字段+独立断言亲验；H-D 每请求恰一 consumed、账本 factType 普查无 standing grant 亲验；run_code typed 拒绝逐字节对合；**无夸大项**（基线各披露项——wirePathEchoes 语义、bash env-block、dyn-tool 观察、own-layer re-light——与重跑事实一致）。

**再次声明：本复验仅覆盖 REG-01 宿主条款；不重开任何 fixture 面条目；不产生、也不隐含任何 GO 裁决。**

## 6. 清理确认

- 两轮世界（`a5p0-s2b-2026-10-15T23-18-22`、`a5p0-h6-2026-10-15T23-19-12`）teardown 删除，`ls tests/homes/` 复核无 reg1/s2b/h6 残留；`:3185` 释放；无遗留进程（post-probes hostExited=true）。
- 产物仅：本文件 + `03-stage2b/reg1-baseline-20261015T231803Z/`、`reg1-p06-2026-10-15T23-18-22/`、`reg1-h6-2026-10-15T23-19-12/`。零 commit/push、零扩权、零第三方外联（mock in-process）。
- test-use 会话尾再测：HEAD=`639ed015397290b3745d163aafe02ffee4aa3f84`（基线常量逐字等）、porcelain=0。
