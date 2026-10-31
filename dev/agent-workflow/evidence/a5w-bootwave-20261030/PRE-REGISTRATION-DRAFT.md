# 预登记草稿（DRAFT）— lane=a5w-bootwave-20261030，池 **C2** 申请 **3 starts**

> **本文件不是 C 册正文。** 按预登记律，池级"已用"行与合并由协调者执行；本 lane 只提交本草稿 + 收据目录，
> `dev/agent-workflow/gates/BOOT-BUDGET-20261031C.md` 正文**一字未改**（`git diff` 可直接验证）。
> 可直接整段粘贴进 C 册"预登记"节的位置。

- **registeredAt**：见同目录 `PRE-REGISTRATION.json` 的 `registeredAt`（写作时刻 `date -u`，R-CLOCK-1）。
- **lane / 分支 / worktree**：`a5w-bootwave-20261030` · `task/a5w-bootwave-20261030` · `.worktrees/a5w-bootwave`（1 task=1 branch=1 worktree=1 writer，§8.3）。
- **基线**：本分支基线 = `bff1bf206cd2ec9b388824fefe8c609eeb0c477a`（PR #495）。登记时 `origin/master` 已推进到
  `772cf04bed359a0b07441d052aeb37a6e11a63cf`（PR #496 oracle1 证据 + tool-obligation pin），与本 lane 改动面**零重叠**
  （`git diff --name-only` 核过：不含 `registries.test.mjs` / `suites/` / C 册 / MATRIX / BACKLOG）。本 lane 守"单 commit"律，
  在自己的基线上做**一次** commit，未 forward-merge；协调者若在 boot 前 forward-merge master，绑定 sha 就是**新 HEAD**（§3 自动覆盖）。
  boot 头 = 登记 commit 之后本分支的 HEAD（见 §3 绑定律）。
- **Host**：pristine `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84`（= `tests/paths.mjs` `TEST_USE_BASELINE_SHA`；主 checkout 的树，经 `findTestRepoRoot` 的**只读**回退解析，base assert + spawn only），登记时刻 tracked porcelain = 0 行。
- **本 lane 已花掉的真实 Host 启动 = 0**（全程装配 + dry-run + 预算门拒启；见 `DRY-RUN.txt`、`BUDGET-REFUSAL-SMOKE.txt`）。

---

## 1. 目标与格（单 World · 双腿 · 一次 boot）

被测对象 = **两个受治理 Family 在同一 Team 会话内同时上生产面**：`read_image`（fs family 的图像臂，L3 正向 + 两条拒绝臂）与
`ask_user_question`（UI family f4 公开应答面复跑）。套件 = `tests/world-factory/suites/140-u7r3-bootwave.mjs`，
suite 名 `u7r3-bootwave`，9 格，`totalRequests=160`（请求预算），drive 自杀线 8.5 min（runner 硬 watchdog 19 min）。

| cell | 腿 | PASS 需要的具名见证（沉默=FAIL；未抵达=NOT_REACHED） |
| --- | --- | --- |
| `ri:placement-one-row` | R | imgov 腿**活模型请求** `body.tools[]` 中 `read_image` 恰一行、描述为受治理行文本（`fs-family/src/image-row.mjs`，绝非原生 "Read a PNG/JPEG/WebP/GIF file…"），且 mount 期 placement 行（`a5g7: placement-feed rows=[…]` / `a5-plane: placed […]`）点名 `read_image` |
| `ri:ask-approved-ran` | R | 耐久 Control 行（`control-request-recorded`）→ `team.resolveControl` v4 allow → `control-decision-recorded` + `control-allow-consumed` → 审计 `a5p2prod: admission-grant-minted` / `admission-approved-grant-issued`（`packages/runtime/tool-admission/admission-kernel.ts:307,578`，经 `packages/runtime/src/plugin/live/team-tool-plane.mjs:859` 的 `onObserve` 落宿主日志）→ 宿主日志 `governed-image RAN bytes=… mediaType=image/png path=…` **恰一行** |
| `ri:attachment-commit-one` | R | 盘上 `<home>/attachments/v1/objects/<sha[0:2]>/<sha>` **恰一**对象（store census 时间序列），文件名 = 内容 sha，且与模型侧 attachment/base64 的 sha256 相等 |
| `ri:tool-output-two-blocks` | R | 模型看到的 tool_result 内块 = 文本信封（`<path>…</path><type>image</type><content>…</content>`）+ **一**个 image 块；线内**无** base64 冒充 attachmentId、无第二 image 块 |
| `ri:answered-deny-zero-effect` | R | 同 World 第二次调用答 **deny** → `governed-image pa-refused code=APPROVAL_DENIED`；store census 在 deny 之后的每个采样点零新增对象；governed workspace 相对 boot 前普查零新文件；mock 转录无该调用的 tool_result 成功体 |
| `ri:store-law-zero-commit` | R | 尺寸超限腿（8192×7817 = 64,036,864 px > 64,000,000，单边 ≤8192，磁盘仅 62,326 B → 只可能撞像素法）→ `governed-image store-law-refused code=IMAGE_…`，零 commit（采样序列不增） |
| `ui:ask-approved-ran` | U | f4 公开面全套：WS `/api/remote.mux` `$events` waterfall → `POST /api/$events/result`（200 + `"ok":true`）→ `governed-ask RAN` → 人工答案标签回到模型看到的 tool_result |
| `ui:live-root-law` | U | **记录格**（L2 as-is：家族端口绑定不带 Agent，assertLiveRoot 不参与）；有 lane-refusal/`DELEGATED_CALLER`/`CALLER_NOT_LIVE` 见证则 PASS，否则 NOT_REACHED——不烧预算、永不洗 PASS |
| `bw:leak-check` | 装配 | runner `evaluateLeak`：World 拆除回执 + 端口释放 + homes 零残留（未建 World 时该格如实 PASS 并写明理由） |

**装配钉死的判定律**（在任何 Control 行出现之前写死，逐行落记录）：`read_image` 行按创建序 = **allow / deny / allow**；
`ask_user_question` = **allow**；其它一律 **deny 并披露**。审批者是 runner 自己，走公开 `/team-remote` 的
`team.getLedgerPage` + `team.resolveControl` v4，无内部 seam。

**模型**：目录条目 `deepseek-flash`（`llm.resolveModelInfo().inputModalities` 含 `image` 的图像能力条目）；
未目录化 id 会退化为 text-only → `IMAGE_MODEL_NOT_CAPABLE`，那是装配错，不是产品结论。

## 2. 每个 start 的腿清单（硬约束：`--max-host-starts 3`，逐 spawn 记入 jsonl）

| start | 用途 | 允许驱动的腿 | 前置条件 |
| --- | --- | --- | --- |
| **bw1** | 主跑（1 start） | 全部 9 格（R 腿三调用 + U 腿一问 + leak） | 本草稿被协调者并入 C 册且登记 commit push 确认（RULING-B：登记→push→确认 origin→才可 spawn） |
| **bw2** | **同类失败修复重试**（1 start） | **仅** bw1 中失败的同格 + `bw:leak-check`；不得"顺便看看"其它臂 | 同类失败的 RCA 摘要（套件已把 `rcaClass/rcaSummary/rcaEvidence` 写进 RUN Record 的 `bootwaveRca.failingCells`）**先落证据目录**，修复 commit 已并入本分支（forward-merge，**永不 rebase**，§8.5.7），并在新 HEAD 重新绑定 sha（§3） |
| **bw3** | **ENV 备用**（1 start，可能永不动用） | 同 bw1 | 仅当出现 ENV_BLOCK 级 NOT_REACHED：TEST_METHODS §9 合取成立（品牌化沙箱探针答 unusable **且** 宿主给出 typed 拒绝行），且在新 HEAD 重新绑定。ENV_BLOCK **永不**记 PASS |

同类失败 ×2 → **停线**（见 §5），bw3 不得被用来"再试一次同样的东西"。

## 3. 绑定律（协调者在 spawn 时填确切产品树 sha）

套件自带 `preRegistrationVerdict` 闸（`BINDING-LAW-UNIT.txt` 为离线五例回执）：

```
BOOTWAVE_PRE_REG_SHA=$(git rev-parse HEAD)   # = 登记 commit 之后本分支的 HEAD，逐字 40 hex
```

- 未导出 / 短 sha / 与本 checkout HEAD 不等 → 8 条腿格全记 **FAIL，rcaClass=`SOURCE_SHA_MISMATCH`**，`bw:leak-check` 由 cleanup 如实记 PASS（"no World was ever created"），**零 spawn、零 host start 记账**。
- 证据绑定之后只能 forward-merge；HEAD 移动 = 重新登记（新 registeredAt + 新 sha），不得改绑旧登记。
- RUN Record 的 `bootwavePreRegistration` 记 `{pin, headSha, ok, reason}`；`bindings.teamSha` / `bindings.hostTreeSha` / `bindings.oracleArtifactPath` / `bindings.worldOracleDigest` 由 runner 自己记（BUDGET-REFUSAL-SMOKE.txt 里已见其字段实名）。

## 4. spawn 命令（协调者执行；`--run-record` 为强制项，见 §8 的 uif4 纪律教训）

```bash
cd .worktrees/a5w-bootwave
BOOTWAVE_PRE_REG_SHA=$(git rev-parse HEAD) node tests/world-factory/u5-canary-runner.mjs \
  --suite u7r3-bootwave --line bw1 \
  --evidence dev/agent-workflow/evidence/a5w-bootwave-20261030/c2 \
  --run-record dev/agent-workflow/evidence/a5w-bootwave-20261030/c2/run-bw1.json \
  --budget-ledger dev/agent-workflow/evidence/a5w-bootwave-20261030/c2/host-starts.jsonl \
  --max-host-starts 3
```

- 账本 = 同目录 `c2/host-starts.jsonl`（登记时**空文件** = 0 starts）；每 spawn 一行，硬上限 3。
- 宿主日志落 `c2/logs/<worldId>/`（该目录已放 `.gitignore`，原始日志不入 git；套件另写 `<runId>.bootwave-evidence.json` 结构化收据）。
- 世界 = `tests/homes/<worldId>`（工作区内，gitignored），用毕拆除；端口走工厂租约带（host `[[3181,3199],[13000,13049]]` / mock `[[3491,3500],[13050,13099]]`，`preferred: []` first-free）；**:3080 与真实 `~/.dsh` 只读不变式照旧**（登记探针：:3080 无 token = 401）。

## 5. 停线律（C 册控制 2 + 控制 3，本 lane 的具体化）

1. **同类失败停线**：`bootwaveRca.sameClassFailureStopLineInput` 就是为此准备的输入（每格 `rcaClass` 列表）。同一 `rcaClass` 出现两次（跨 start）→ 立即停线：不再动用任何 start（含 bw3），RUN Record + RCA + 本目录收据原样提交并回报协调者。
2. **禁探索律**：本套件不调用任何未被证明存在的接口。图像 store、ask 应答面、placement feed、admission 审计四组见证词都已在产品码里逐行核对坐标（§8 表）。任何"再 boot 一次看看会不会不一样"= 违规。
3. ENV_BLOCK / NOT_REACHED 不得洗为 PASS；合成/夹具必须标注（§8 夹具法）。

## 6. 效率门（C 册控制 4 的本 lane 口径）

每个 start 必须至少闭合 **1 个有效格**——有效 = 有具名见证的 PASS，或带可归因 `rcaClass` + `rcaSummary` + `rcaEvidence` 的 FAIL（这类 FAIL 也推进知识）。
一个 start 若 0 有效格（全部 drive-abort / 无见证 / 无 RUN Record）→ 该 start 在回执中记 **空转（wasted）**，本 lane 立刻停耗预算并把 RUN Record + 日志交协调者复核，得到放行后才可续。
预算 jsonl 的行数与 RUN Record 数必须一致（uif4 的 `--run-record` 缺口不得重演）。

## 7. 池级记账（lane-only 行）

C2 池级"已用"表行由协调者统一记（本 lane 不知同池兄弟 lane 实耗，不代改共享行）：**本 lane 申请计入 C2 +3（ bw1/bw2/bw3 额度）**，
实耗以 `c2/host-starts.jsonl` 行数字为准，由协调者在启动后追加"已用"行；bw3 未动用则按实耗记。

## 8. 披露（全部为不利或需知情项）

1. **`registries.test.mjs` 偏离**（唯一被改的既有文件）：新 suite 必须同时补两处 pin（预算 `['u7r3-bootwave', 160]` + `SUITE_CASES` 键列表），否则收集器 RED。先例 = `80eef96e5`（130-u7r3-b49-lockseam 同法）。改法与回执见 `REGISTRIES-PIN.txt`（12/12 绿，且该测试在本 worktree 收集到本套件 = 模块可加载的旁证）。
2. **#489 `waitReady` 教训已保留**：应答客户端用**有界轮询**（bounded poll）等 ready 帧，绝不对 `$events` 空闲帧做无限 `nextFrame()` await——uif4 start#1 正是被无期限 await 拖到 hard watchdog 中止（`evidence/u7r3-uif4-20261030/c2/RCA-start1-abort.md`）。本套件的 `waitReady(12_000)` + `pumpAnswers()` 每圈都跑，永不阻塞整条 drive。
3. **夹具法（全在盘上，产品码零改动）**：三张 PNG 由套件自造（4×4 RGB / 8×8 灰 / 8192×7817 灰）；超限图磁盘仅 62,326 B，**只可能**因像素法（64,036,864 > 64,000,000）被拒，单边 8192 不越单边法，20 MiB 字节法也不越——dry 的 fixture law 行把四个数一起钉住。审批决策序在首行出现前写死。
4. **p4t6 扫描豁免（未新增 booking）**：`suites/` 不在扫描范围（扫描根只有 `packages/<dir>`），台账仍平（1393 = base 983 + Σ 410），且提交在册的 p4t6 测试本身在本 worktree 跑绿（20/20）。两 faces 见 `P4T6-SCAN-EXEMPTION.txt`（脚本 `p4t6-scope-proof.mjs` 一并入册可复跑）。
5. **坐标核对表（写入时刻逐项核过，非记忆）**：

   | 见证 | 坐标 |
   | --- | --- |
   | `governed-image pre-gate-refused/lane-denied/pa-refused/port-refused/store-law-refused/RAN` | `packages/tools/fs-family/src/image-executor.mjs` |
   | `admission-grant-minted` / `admission-approved-grant-issued` / `admission-requires-approval` | `packages/runtime/tool-admission/admission-kernel.ts:307/578/450` → 宿主日志前缀 `a5p2prod: ` 见 `packages/runtime/src/plugin/live/team-tool-plane.mjs:859` |
   | placement 行 | `agent-bindings.mjs:2842`（`a5g7: placement-feed rows=[…]`）、`team-tool-plane.mjs:2067`（`a5-plane: placed […]`）；两种措辞都收 |
   | 工具线形状 | DeepSeek Messages：`tools:[{name, description, input_schema}]`（`llm-deepseek/src/wire-types.ts:34`），故描述可读 = 治理行判定可成立 |
   | attachment store | `<DSH_HOME>/attachments/v1/objects/<sha[0:2]>/<sha>`；20 MiB / 64,000,000 px / 单边 8192，`detectImage` **先**查 maxPixels |

   与任务书写不一致的坐标（已按实况采用，逐条点名）：
   - **(a) 端口不钉死**：书写暗示固定端口，实况 = 工厂从 `HOST_PORT_BANDS`/`MOCK_PORT_BANDS` 以 `preferred: []` 取 first-free 租约；dry 的端口行只做"候选端口空闲"探针。
   - **(b) 无共享 baseline 路径**：`/srv/workspace/dsh-stable-3-0.2.0-rc.2/…` 在本环境不存在；本 worktree 无自己的 test-use 克隆，runner 用 `findTestRepoRoot` 的**文档化只读回退**指向主 checkout 的树（HEAD 与 pin 一致、porcelain 0，已探针）。
   - **(c) launcher sha 有两个**（不同树，都对）：宿主预检探针 = host 树 `a752bc72f111…`；本 lane 装配钉的 confinement `trustRoot` = **产品树** `1264ea584e3438d6`（`packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py`）。
   - **(d) grant 审计词不在宿主日志的"天然"位置**：审计行由产品 admission kernel 发，经平面 `onObserve` 加 `a5p2prod: ` 前缀落宿主 stdout——已按此核词，未采用任何未核到的措辞。
   - **(e) leg C（ leg U 的第二臂）非必做**：`ui:live-root-law` 按 L2 实况为记录格（NOT_REACHED 不烧预算）。
   - **(f) `registries.test.mjs` 必改**（见本节第 1 条），书写里未列。
   - **(g) 基线漂移**：登记时 `origin/master` = `772cf04be`（#496）已领先本 lane 基线 `bff1bf206c`（#495）；改动面零重叠，本 lane 未 forward-merge（单 commit 律）。fmerge 后 pin 随新 HEAD。
6. **零启动声明的边界**：本 lane 证明的是**装配 + 校验 + 预检全绿**（`DRY-RUN.txt`，exit 0：宿主基线断言、品牌化沙箱 `provision:false` 探针、:3080 只读探针、世界物化、profile patch 发射、confinedProvider 配对法、宿主自己的 blueprint 强校验器 over anchor+main、组装法、夹具法、无 spawn 断言、拆除）。patch 层在真实 boot 里由 `startHost` 发射；dry 是把同一 `emitPatchLayer` 写进世界目录再校验，**这一点已在 dry 输出里自称**。真实 boot 仍未做，且本 lane 无权做。

## 9. 收据目录（本 commit 内）

| 文件 | 内容 |
| --- | --- |
| `PRE-REGISTRATION-DRAFT.md` | 本文件（协调者可整段搬进 C 册） |
| `PRE-REGISTRATION.json` | 同信息的机读面（precedent `80eef96e5` 字段形状） |
| `DRY-RUN.txt` | `node tests/world-factory/suites/140-u7r3-bootwave.mjs --dry` 完整输出（exit 0，零 spawn） |
| `REGISTRIES-PIN.txt` | `node --test tests/world-factory/registries.test.mjs` = 12/12 + 两 pin 的 diff |
| `P4T6-SCAN-EXEMPTION.txt` + `p4t6-scope-proof.mjs` | 扫描范围两 face 回执 + 可复跑脚本 |
| `BUDGET-REFUSAL-SMOKE.txt` | 预算门拒启 smoke：9 格 REFUSED、`worlds=none`、`thisRunCount=0`、oracle 闭包摘要 |
| `BINDING-LAW-UNIT.txt` | 绑定律五例离线回执 |
| `c2/host-starts.jsonl` | **空** = 0 starts（boot 时逐 spawn 追加） |
| `c2/logs/.gitignore` | 原始宿主日志不入 git |
| `c2/pre-boot-probes.txt` | 登记时刻探针：:3080=401、host 树 HEAD/porcelain、沙箱 `backend=full usable=true`、端口空闲、`~/.dsh` 未触、spawn=0 |
