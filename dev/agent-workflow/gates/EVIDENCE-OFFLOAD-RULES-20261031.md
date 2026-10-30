# EVIDENCE-OFFLOAD-RULES-20261031 — 证据外仓规则 v1.0（生效初版）

**文档状态**：v1.0 生效（2026-10-31）。裁决依据 = `USER-RULING-20261031` §5「证据外仓：原则批准」（用户 2026-10-31 直接指令，协调者逐字登记于 `task/user-ruling-20261031` 分支 `dev/agent-workflow/gates/USER-RULING-20261031.md`）。原则已获批准，**本文不是待批稿**——本文件即投入使用的初版规则正本。
**修订方式**：amendments additive-dated —— 只允许**追加**带日期的增补小节；不得静默改写既有条文语义（语义变更 = 新版本号 + 顶部 dated banner 说明取代范围，比照 `docs/plans/memo/` 惯例）。
**本文产生 lane / seat 披露**：lane = evidence-offload-rules-v1（branch `task/u7r3-evrules-20261031`，1 task=1 branch=1 worktree=1 writer）；seat = 主 Agent 拉起的独立交付子代理会话，harness 报告模型 = `qwen3.8-flash-next`（ROUTER_RULES §0.2：独立性 = 独立会话，不由模型标识保证；差异如实登记）。
**与既有机制的关系**：本文是 U3 证据外置（`scripts/evidence-store.mjs`、`dev/agent-workflow/evidence/RELOCATED-MANIFEST.tsv` + `RELOCATED-KEEP-SET.txt`，2026-10-25）的**规范化与推广**：U3 已示范「git 索引 + 外部原件 + verify/restore」的骨架；本文把该骨架升级为有 retention 分级、敏感检查门、迁移收据与可复验合同的正式规则。既有 CI 守卫 `scripts/eb3-evidence-guard.mjs`（新增文件尺寸/原始捕获名守卫）继续独立生效，两者叠加不冲突。

---

## 0. 范围与非目标

**本文规定**：证据在 git 索引与外部不可变原件存储之间的分界、索引清单（`evidence-manifest.json`）schema、保留策略分级、可复验的迁移/恢复合同、后端选型裁决、验证工具合同。

**本文（及其 v1.0 交付 lane）不做**：
- 不部署任何存储后端（选型只给裁决与理由，部署是后续有界 lane）；
- 不迁移、不移动、不删除任何既有证据（存量迁移逐批另行启动，每批自带收据）；
- 不重写任何 git 历史（EO-5）；
- 不做任何 merge 决策；
- 全程离线：不上传、不外呼。

---

## 1. 定义

| 术语 | 定义 |
| --- | --- |
| **证据原件（original）** | 一次 RUN 产生的原始字节：Host 日志、transcript、oracle/run record/证据 JSON、原始收据等。 |
| **索引（index）** | git 中保留的、足以替代原件做判断的最小完备元数据（EO-1）。 |
| **外仓（offload store）** | git 之外的不可变原件存储（EO-2），内容寻址或版本化对象存储。 |
| **外置（offload）** | 原件写入外仓的动作。**上传成功 ≠ 迁移完成**（EO-3）。 |
| **迁移（migration）** | 某证据目录满足：manifest 入库 + 全部原件外置 + 抽样 download-verify-restore 通过 + 收据入库。此后该目录原件方可按保留策略（§4）处置。 |
| **恢复演练（restore drill）** | 在全新检出上按 manifest 下载并逐文件哈希校验、恢复出完整原件目录的过程；其输出 = 验证收据（verification receipt）。 |
| **验证收据（receipt）** | 一次 drill / 迁移批次通过后的 JSON 记录（样本、哈希、时间戳、后端标识、工具版本），本身按 R3 类入 git，与批次同仓可查。 |
| **敏感件（restricted artifact）** | 含凭据形态内容（boot token、session cookie、authorization 头、api key）或私有日志内容的原件。 |

---

## 2. 规则条文（EO-1 … EO-7）

### EO-1 · git = 权威索引（minimal-complete）

git 是证据的**权威索引**，且索引必须**最小完备**：仅凭全新检出的 git 内容即可完成三问——

1. **判断结果**：RUN 记录（run record）、判定（verdict/oracle/settlement）内容或其权威摘要在 git 内，或 git 内的逐字节哈希 + 外仓定位足以复验后判断；
2. **验证来源**：source SHA（team SHA）与 Host SHA、composed profile 摘要、World/Oracle 摘要在 git 内（沿用 run record `bindings.*` 现有形态）；
3. **定位原件**：每份证据的 manifest 条目给出 path / SHA-256 / 字节大小 / 存储位置 / 保留分级（§3、§4）。

**判据（可测）**：对任一批次目录，删去全部原件只留 git 侧索引后，一个未参与该 RUN 的审查者应能回答上述三问。答不出 = 索引不完备 = 该批次不得迁移。

### EO-2 · 外部存储 = 不可变原件

外仓必须是**内容寻址或版本化对象存储**，**禁止静默覆盖**：

- 写入键 = 内容哈希（推荐 `blobs/sha256/<首2位>/<64位hex>`，与 `scripts/evidence-store.mjs` 的本地布局同构），或对象存储开启 versioning + Object Lock / WORM；
- 任何对既有键的再次 PUT 要么被后端拒绝（immutable put / If-None-Match / object lock），要么产生新对象——**永不产生"同键新内容"**；
- 工具侧双保险：上传一律 exclusive-create + read-back + 哈希回验（`evidence-store.mjs ingest` 已示范：同哈希存在 = 幂等跳过，不同哈希 = 拒绝）。

### EO-3 · 全新检出可取回；上传 ≠ 迁移

- **取回合同**：全新 `git clone` 后，仅凭 manifest 即可驱动「下载 → 逐文件 SHA-256 校验 → 恢复目录」；该过程必须**可演示**（drill），不是文档承诺。
- **上传成功 ≠ 迁移完成**：原件只有在**抽样 download-verify-restore 通过并出具收据**之后，才允许按保留策略处置（含未来对 git 侧原件副本的 forward-only 移除提交）。
- **抽样下限**（每批次目录）：≥3 份、每个 RUN ≥1 份、且 ≥10% 的外置原件；最大件与最早件必在样本内。抽样种子写入收据（可复现）。
- drill 只写隔离工作目录，目标文件 exclusive-create，**绝不覆盖既有文件**（比照 `sanitize-evidence.mjs` 对路径不相交的强制与 `evidence-store.mjs restore` 的 EXISTS 拒绝）。

### EO-4 · 短期介质与敏感件

- **短期 CI artifact（runner 缓存、临时上传件）永远不得作为唯一长期证据仓库**；它们至多是 R6/R7 原件的运输通道，落仓（外仓 + 收据）才算数。
- **私有日志 / 含令牌数据**：迁移前必须过**敏感内容检查**；受限原件只允许进入**带访问控制**的存储位置（私有桶 + 最小读写 ACL），或在经 `scripts/sanitize-evidence.mjs` 脱敏（copy-not-edit、原件哈希入册，其既有合同）之后按普通外置件处理。**两清都做不到 = 不外置，原件原地冻结。**
- 扫描只记录 pattern / 偏移 / 计数，**绝不把命中值本身写进 manifest 或收据**。
- 已知现实：`dev/agent-workflow/evidence/` 既有 host 日志含 boot token（本文示例目录即命中 4 处，见 §7）。这些**已入库**的敏感件属存量，按 EO-6 节奏另起整改批次；本规则即时约束的是新 RUN——新 RUN 的 host 日志在入库前就应过 `sanitize-evidence.mjs`，raw 原件直接走外置（其哈希仍可入 manifest，凭据形态内容因此不再进 git）。

### EO-5 · 禁止大规模改写 git 历史瘦身

不得为 slimming 重写任何 git 历史（含 filter-repo/BFG 类工具、grafted history）。历史即前科账本：体积问题的解法是**索引留在 git、原件走出 git**（EO-1/EO-2），以及未来批次对 git 侧副本做 **forward-only 移除提交**（每个移除提交引用其批次的验证收据）。`docs/ROUTER_RULES.md` 的 gated 历史不得 force-push 条款在此重申。

### EO-6 · 节奏：新规先行，存量分批

- **新 RUN 立即适用**：自本文生效起，新证据目录交付时**必须随带** `evidence-manifest.json`（§3），R6/R7 原件优先「写外仓 + git 只留索引」路径；外仓未就绪（§5 部署 lane 完成）前，新 RUN 原件照旧入 git，但 manifest 必须随带——先补索引，不动存量。
- **存量以后分批迁移**：以批次（一组证据目录）为单位，每批次 = 盘点 → ingest → drill（EO-3 抽样）→ 收据入库 →（可选、另行裁决的）git 侧副本 forward-only 移除提交。**每批次自带其验证收据**，收据路径 `dev/agent-workflow/evidence/offload-receipts/<batch-id>/`。任何一批的 drill 未过 = 该批原地不动，不影响其他批次。
- 本 v1.0 lane 不启动任何批次。

### EO-7 · 工具合同

外置/校验/演练只经 `scripts/evidence-verify.mjs`（§6）执行；`evidence-store.mjs`（本地 CAS 前身）保留并映射到新合同（其 `verify`/`restore` 即 `check`/`drill --from-git` 的本地特例）。任何 lane 不得以自造一次性脚本绕过 precheck/drill 门（脚本可复用，门不可绕过）。

---

## 3. `evidence-manifest.json` — 索引清单 schema（normative：`evidence-manifest/1`）

位置约定：每个新证据目录 `dev/agent-workflow/evidence/<run-dir>/evidence-manifest.json` 随目录交付；示例实例见 [`manifest-example/evidence-manifest.json`](manifest-example/evidence-manifest.json)（schema 全文 = 附录 A）。

| 字段 | 类型 | 必填 | 语义 |
| --- | --- | --- | --- |
| `schema` | string const | 是 | `"evidence-manifest/1"`；读端遇未知值即拒（fail-closed，不回退宽松解析）。 |
| `manifestId` | string | 是 | 稳定唯一名（通常 = 证据目录名）。 |
| `createdAt` | ISO-8601 | 是 | 生成时刻（重生成允许仅除此字段外字节不变）。 |
| `generator` | object | 是 | `{name,version,note?}`；生产生成器 = `evidence-verify.mjs` 的 `index` 子命令。 |
| `rules` | object | 是 | `{doc,version,authority}` 绑定本规则文档及裁决出处。 |
| `index` | object | 是 | `{repo, commit, indexedPath}`；`commit` = 生成时 HEAD（哈希所对基线）。 |
| `runs[]` | array | 是 | 每 RUN：`runId, suite, runRecord, bindings{teamSha,hostSha}, overallVerdict, startedAt, finishedAt`。绑定从 run record 原文提取（EO-1 第 2 问）。 |
| `backend` | object | 是 | `{kind:"none"\|"minio"\|"s3"\|"file-share", endpoint, bucket, prefix, immutability, note}`；`kind:"none"` = 原件仍在 git（迁移前状态，示例即此态）。 |
| `policy` | object | 是 | `{bulkyThresholdBytes, sampling:{minFiles,minPerRun,minPctOfArtifacts}}`。 |
| `artifacts[]` | array | 是 | 逐原件条目，字段如下。 |
| `artifacts[].path` | string | 是 | **repo-relative posix**，必须位于 `index.indexedPath` 之下（路径逃逸 = 拒）。 |
| `artifacts[].sha256` | hex64 | 是 | 原件 SHA-256。 |
| `artifacts[].sizeBytes` | int | 是 | 原件字节数（第二道独立校验，防哈希撞不出来的错配）。 |
| `artifacts[].class` | enum | 是 | `run-record` / `verdict-artifact` / `settlement-digest` / `boot-ledger` / `profile-snapshot` / `host-log` / `transcript-log` / `raw-receipt` / `uncategorized`（后者 = 人审旗标，不得默默外置）。 |
| `artifacts[].retention` | object | 是 | `{lane:"git-forever"\|"offload-eligible"\|"restricted", policyRow:"R1".."R7"}`；行 = §4 表。 |
| `artifacts[].location` | object | 是 | `{state:"in-git"\|"uploaded-unverified"\|"offload-verified"\|"original-retired", uri, uploadedAt, verifiedAt}`；状态机见 §3.1。 |
| `artifacts[].sensitivity.secretScan` | object | 是 | `{status:"clean"\|"finding"\|"unchecked", checkedWith, count?, sample?[{pattern,offset,length}]}`；`finding` 只存 pattern/偏移，**永不存命中值**（EO-4）。 |

### 3.1 原件位置状态机（单向前进，每次跳转须有凭据）

```
in-git ──upload──▶ uploaded-unverified ──drill 通过+收据──▶ offload-verified ──(另行裁决的 forward-only 移除提交)──▶ original-retired
   ✕ 不得跳跃：uploaded-unverified 状态下原件一律按「仍在 git」对待（EO-3：上传≠迁移）
   ✕ 不得回退静默：状态回退只发生在收据作废（作废须记录），且立即恢复「原件保留」义务
```

---

## 4. 保留策略表（retention policy；`policyRow` 权威定义）

| 行 | 证据类 | 例（示例目录内实文件） | 长期归属 | 保留时长 | 可否外置 |
| --- | --- | --- | --- | --- | --- |
| **R1** | RUN 记录 | `run-record.json`、`u7r3c2j2.u74a-run-record.json` | **git** | 永久 | **永不外置**（判定本体） |
| **R2** | 判定 artifact（oracle/verdict） | `*.oracle.json` | **git** | 永久 | **永不外置** |
| **R3** | 清算/摘要/收据 | `*.digest.json`、`*-evidence.json`、**迁移验证收据本身** | **git** | 永久 | **永不外置** |
| **R4** | Boot 账本/预登记 | `host-starts.jsonl`、`host-starts-PRE-REGISTRATION*.json` | **git** | 永久 | **永不外置**（预算审计凭据） |
| **R5** | 配置/来源绑定快照 | `composed-profile-<sha>.patch.yml` | **git** | 永久 | **永不外置**（来源可验证性，且小） |
| **R6** | Host/transcript 日志 | `instance-port*.log`、`*.stdout.log` | 外仓原件 | ≥12 个月且不短于其被任何在案 Gate 引用期间；到期逐批复评 | **可**（须先过敏感门；示例中 4 份 host log 因 boot token = `restricted`，整改前禁外置） |
| **R7** | 原始收据/大体量机器输出 | `setup-failure.json`；`uncategorized` 默认落此行并带人审旗标 | 外仓原件 | 同 R6 | **可**（仅 ≥`bulkyThresholdBytes`=64 KiB 者为迁移对象；小件留 git——索引经济学） |

跨行规则：**`restricted` 是 lane 旗标不是行**——任何 R6/R7 原件被 `secretScan.status=finding` 命中即整件转 `restricted`，外置冻结至脱敏或访问控制落位（EO-4）。R1–R5 **无论体量永不外置**：外置只搬「大块日志 / transcript / 原始收据」类原件，判定、RUN 记录、清算、账本、绑定快照是 git 侧永远自足的最小完备索引本体。

---

## 5. 后端选型：比较与裁决（g）

按裁决「后端选型由 Agent 按可部署性与恢复能力决定，非科研架构决策」，三选项比较：

| 维度 | A. MinIO 自托管（单节点） | B. S3 兼容（已托管服务/自建网关） | C. `/srv` 简单版本化文件共享 |
| --- | --- | --- | --- |
| 部署负担 | 单二进制/容器 + systemd + 凭据管理；全离线可行 | 零部署但引入外部账号/出口流量/依赖；本环境离线约束下最重 | 零部署（复用 `/srv` 现有共享盘） |
| 完整性/禁静默覆盖 | **协议级**：versioning + Object Lock（WORM），immutable put 可强制 | **协议级**：versioning + Object Lock（同左） | **无强制**：一次 `mv -f`/编辑器保存即静默覆盖，只能靠 chmod/纪律约定 |
| 内容寻址/去重 | 键即内容哈希，天然去重（示例中两份 oracle 同哈希即可证去重收益） | 同左 | 可自建目录约定，但无 API 保证 |
| 访问控制 | bucket/prefix 策略 + 服务账号 | 同左 + 托管 IAM | 仅 FS 属组，粒度粗、无审计 API |
| 恢复演练可行性 | `mc cp` / presigned URL 批量拉取，drill 自动化顺畅 | `aws s3api get-object`，同样顺畅 | `cp` 即可——演练最容易但存储本身最弱 |
| 生态/工具契合 | S3 API ⇒ `evidence-verify.mjs` 一套工具通吃 A/B | 同左 | 需后端适配器（额外代码换更弱的保证，不划算） |
| 主要风险 | 多一个常驻服务要维护（数据盘/备份责任自持） | 网络/账号单点 + 数据出域审批 | 不可变性只有纪律没有强制 → **直接违反 EO-2** |

**裁决（推荐）：A = 自托管 MinIO（单节点）**，bucket `dsh-evidence` 开启 versioning + Object Lock 默认保留（governance mode 起步，trust-on-first-use 根确认后升级 compliance），对象键 = `blobs/sha256/<首2>/<sha256>`，原件 path→key 映射由 manifest 承载。理由压缩：EO-2 的「禁静默覆盖」是硬要求，C 无协议强制直接出局；B 与 A 保证等价，但本环境离线优先、无既有托管 S3 依赖，A 以最小外部依赖拿到同等不可变性/访问控制/去重，且其 S3 API 使 `evidence-verify.mjs` 对后端保持中立——**若组织日后已有运维中的托管 S3，可零工具改动切换（kind: minio→s3），这保留为唯一备选链，不预设立项**。
**边界**：本节只是选型裁决。部署、冒烟、首迁移批次均不在本 lane（§0），待 USER-RULING-20261031 §三.1 的后续有界 lane 执行。C 的允许用途 = drill scratch / 上传前 staging，不得充当长期仓库。

---

## 6. 验证工具计划：`scripts/evidence-verify.mjs`（v1 合同 sketch）

**状态**：本文只交付 CLI 合同 + 失败模式表；实现为后续有界 lane（§8）。既有 `evidence-store.mjs` 在其落地前继续充当本地 CAS 的 verify/restore 工具（EO-7 映射）。

### 6.1 CLI 合同

```
node scripts/evidence-verify.mjs <subcommand> [options]

subcommands:
  index    --dir <evidence-dir> [--out <manifest>]        # 生成/刷新 manifest：枚举+sha256+size+分类+敏感扫描；只读原件
  check    --manifest <m> [--root <dir>]                  # 对 git 工作树逐文件复算哈希/尺寸，对照 manifest；无后端依赖
  precheck --manifest <m>                                 # EO-4 门：敏感扫描+分类完备性；finding/uncategorized ⇒ 阻断上传
  upload   --manifest <m> [--backend minio|s3] [--dry-run] # immutable put（exclusive-create）+ read-back 回验；要求 precheck 凭据
  drill    --manifest <m> [--sample N] [--seed S] [--workdir <tmp>]
                                                          # EO-3 恢复演练：抽样(含最大/最早强制项)下载→逐文件校验→恢复目录；输出收据 JSON
  receipt-verify --receipt <r> [--manifest <m>]           # 收据自验：样本哈希、后端标识、工具版本、manifest 哈希闭合

global: --json | --strict(warning→error) | --only <glob>
exit: 0 干净 | 1 有 findings | 2 拒绝（schema/用法/后端未配置/前置凭据缺失——拒绝≠通过）
invariants: 对证据树只读；写操作只落 --workdir/manifest 输出路径；一切目标写入 exclusive-create；
            敏感 pattern 命中值永不写入任何输出（只写 pattern id/偏移/计数）。
```

### 6.2 失败模式表（固定错误码 = 工具与规则共用的词汇表）

| 码 | 触发 | 处置 |
| --- | --- | --- |
| `MANIFEST_SCHEMA_INVALID` | schema 常量未知/字段缺失/哈希非 hex64 | exit 2；修复 manifest 重跑，不回退宽松解析 |
| `PATH_OUTSIDE_EVIDENCE_ROOT` | 条目 path 越出 `indexedPath` | exit 2；按安全事件复核 |
| `ARTIFACT_MISSING` | git 侧原件不在（状态却为 in-git） | exit 1；批次冻结 |
| `HASH_MISMATCH` / `SIZE_MISMATCH` | 复算与 manifest 不符 | exit 1；冻结 + 点名 lane |
| `DUPLICATE_PATH` | path 重复 | exit 2 |
| `SECRET_UNSCANNED` | upload 无当轮 precheck 凭据 | exit 2（先 precheck） |
| `SENSITIVE_BLOCKED` | restricted/finding 条目出现在 upload 集 | exit 1；该件走 EO-4 脱敏/访问控制路径 |
| `UPLOAD_CONFLICT` | 后端既有键哈希不同（覆盖被协议/工具双拒） | exit 1；**永不自动覆盖**；人工归因 |
| `STORE_URI_UNRESOLVED` | location.uri 无法解析 | exit 1 |
| `DOWNLOAD_FAILED` | drill 拉取失败 | exit 1；批次不得标记迁移 |
| `DRILL_SAMPLE_INSUFFICIENT` | 样本 < `policy.sampling` 下限 | exit 2；不出具收据 |
| `RECEIPT_MISSING` / `RECEIPT_HASH_DIVERGENT` | 移除提交引用缺失/收据与 manifest 哈希不闭合 | exit 1；移除提交作废重做 |
| `BACKEND_NOT_CONFIGURED` | `backend.kind=none` 时 upload/drill 对后端动作 | exit 2（示例目录即合法处于此态——只允许 index/check/precheck） |

---

## 7. Worked example：`u7r3-pilot-c2-20261029`（真实目录实算）

真实实例 = 既有 tracked 目录 `dev/agent-workflow/evidence/u7r3-pilot-c2-20261029` 的完整 manifest，哈希以 `sha256sum` 实算，存于 [`manifest-example/`](manifest-example/)（`evidence-manifest.json` + `generate-example.mjs` 生成器 + `README.md` 复现说明）。要点：

- **27 份原件 / 1,005,739 字节 / 4 个 RUN**（`u6-arc-a`、`u6-jobs`、`u7r3c2a2`、`u7r3c2j2`；overallVerdict 如实记录为 FAIL——索引忠实于 run record 原文，不粉饰）；
- 绑定齐备：4 RUN 的 `hostSha` 全为 `639ed015397290b3745d163aafe02ffee4aa3f84`（0.2.0-rc.2 发布点），team SHA 三个候选值各自在案——EO-1「验证来源」不读原件即可答；
- 保留分级：`git-forever` 18（R1–R5）、`offload-eligible` 5（R6/R7 且过敏感门）、**`restricted` 4**——4 份 `instance-port*.log` 被真实敏感扫描命中（`boot-token-url`，manifest 只记 pattern/偏移/长度，不含值），演示 EO-4 门真实拦下真实数据；
- `backend.kind="none"` + 全部 `location.state="in-git"`：演示迁移前合法初态——新规则下这正是要补 manifest 的那类存量目录；
- 去重实证：两份 oracle 文件（`c2/arc-a` 与 `c2-r2/arc-a`）SHA-256 相同（`95faa895…`），内容寻址键天然合并为一份原件；
- 示例 manifest 存于 `gates/manifest-example/` 而非证据目录内：本 lane 不动既有证据目录（§0）；新 RUN 才按 EO-6 把 manifest 随目录交付。

## 8. 后续工作（不在本 lane 授权内，只登记不启动）

1. MinIO 单节点部署 + `dsh-evidence` bucket（versioning + Object Lock）冒烟（§5 裁决落地）；
2. `scripts/evidence-verify.mjs` 按 §6 合同实现（含回归负控，比照 `sanitize-evidence.mjs` 的测试纪律）；
3. 存量首迁移批次定义（建议首个批次 = boot token 整改 ∪ R6 host-log 试点，二者同形可合批）；
4. 新 RUN 交付门接线（run-kit 收尾自动产出 manifest + precheck）。

---

## 附录 A — JSON Schema（normative for `evidence-manifest/1`）

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "dsh-agent-team/dev/agent-workflow/gates/evidence-manifest-1.schema.json",
  "title": "evidence-manifest/1",
  "type": "object",
  "additionalProperties": false,
  "required": ["schema", "manifestId", "createdAt", "generator", "rules", "index", "runs", "backend", "policy", "artifacts"],
  "properties": {
    "schema": { "const": "evidence-manifest/1" },
    "manifestId": { "type": "string", "minLength": 1 },
    "createdAt": { "type": "string", "format": "date-time" },
    "generator": {
      "type": "object", "required": ["name", "version"],
      "properties": { "name": { "type": "string" }, "version": { "type": "string" }, "note": { "type": "string" } }
    },
    "rules": {
      "type": "object", "required": ["doc", "version", "authority"],
      "properties": { "doc": { "type": "string" }, "version": { "type": "string" }, "authority": { "type": "string" } }
    },
    "index": {
      "type": "object", "required": ["repo", "commit", "indexedPath"],
      "properties": { "repo": { "type": "string" }, "commit": { "type": "string", "pattern": "^[0-9a-f]{40}$" }, "indexedPath": { "type": "string" } }
    },
    "runs": {
      "type": "array", "minItems": 1,
      "items": {
        "type": "object", "required": ["runId", "suite", "runRecord", "bindings", "overallVerdict"],
        "properties": {
          "runId": { "type": "string" }, "suite": { "type": "string" }, "runRecord": { "type": "string" },
          "bindings": { "type": "object", "required": ["teamSha", "hostSha"] },
          "overallVerdict": { "enum": ["PASS", "FAIL", "PARTIAL", null] },
          "startedAt": { "type": ["string", "null"] }, "finishedAt": { "type": ["string", "null"] }
        }
      }
    },
    "backend": {
      "type": "object", "required": ["kind", "prefix", "immutability"],
      "properties": {
        "kind": { "enum": ["none", "minio", "s3", "file-share"] },
        "endpoint": { "type": ["string", "null"] }, "bucket": { "type": ["string", "null"] },
        "prefix": { "type": "string" }, "immutability": { "enum": ["none", "versioning", "versioning+object-lock", "content-addressed"] },
        "note": { "type": "string" }
      }
    },
    "policy": {
      "type": "object", "required": ["bulkyThresholdBytes", "sampling"],
      "properties": {
        "bulkyThresholdBytes": { "type": "integer", "minimum": 0 },
        "sampling": {
          "type": "object", "required": ["minFiles", "minPerRun", "minPctOfArtifacts"],
          "properties": { "minFiles": { "type": "integer", "minimum": 1 }, "minPerRun": { "type": "integer", "minimum": 1 }, "minPctOfArtifacts": { "type": "integer", "minimum": 0, "maximum": 100 } }
        }
      }
    },
    "artifacts": {
      "type": "array", "minItems": 1, "items": {
        "type": "object",
        "required": ["path", "sha256", "sizeBytes", "class", "retention", "location", "sensitivity"],
        "properties": {
          "path": { "type": "string", "pattern": "^dev/agent-workflow/evidence/" },
          "sha256": { "type": "string", "pattern": "^[0-9a-f]{64}$" },
          "sizeBytes": { "type": "integer", "minimum": 0 },
          "class": { "enum": ["run-record", "verdict-artifact", "settlement-digest", "boot-ledger", "profile-snapshot", "host-log", "transcript-log", "raw-receipt", "uncategorized"] },
          "retention": {
            "type": "object", "required": ["lane", "policyRow"],
            "properties": { "lane": { "enum": ["git-forever", "offload-eligible", "restricted"] }, "policyRow": { "enum": ["R1", "R2", "R3", "R4", "R5", "R6", "R7"] } }
          },
          "location": {
            "type": "object", "required": ["state"],
            "properties": {
              "state": { "enum": ["in-git", "uploaded-unverified", "offload-verified", "original-retired"] },
              "uri": { "type": ["string", "null"] }, "uploadedAt": { "type": ["string", "null"] }, "verifiedAt": { "type": ["string", "null"] }
            }
          },
          "sensitivity": {
            "type": "object", "required": ["secretScan"],
            "properties": {
              "secretScan": {
                "type": "object", "required": ["status", "checkedWith"],
                "properties": {
                  "status": { "enum": ["clean", "finding", "unchecked"] },
                  "checkedWith": { "type": "string" }, "count": { "type": "integer", "minimum": 1 },
                  "sample": { "type": "array", "items": { "type": "object", "required": ["pattern", "offset", "length"], "properties": { "pattern": { "type": "string" }, "offset": { "type": "integer" }, "length": { "type": "integer" } } } }
                },
                "allOf": [
                  { "if": { "properties": { "status": { "const": "finding" } } }, "then": { "required": ["count", "sample"] } },
                  { "if": { "properties": { "status": { "const": "clean" } } }, "then": { "not": { "required": ["count"] } } }
                ]
              }
            }
          }
        },
        "allOf": [
          {
            "if": { "properties": { "retention": { "properties": { "lane": { "const": "git-forever" } } } } },
            "then": { "properties": { "location": { "properties": { "state": { "enum": ["in-git"] } } } } }
          }
        ]
      }
    }
  }
}
```

约束注记：`artifacts[].path` 的 pattern 前缀即「路径逃逸」防线（配合 `PATH_OUTSIDE_EVIDENCE_ROOT` 运行期检查）；`secretScan.sample` 结构上无字段可携带命中值——schema 即 EO-4「永不存值」的机器保证；`git-forever` 条目的 `location.state` 被 schema 锁死在 `in-git`（想外置 R1–R5 = schema 不合法，而非运行时才发现）。
