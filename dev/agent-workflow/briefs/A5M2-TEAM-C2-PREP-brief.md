# A5M2-B-TEAM — Host-C2 工装包 源码级准备（PREP，非窗口执行）

状态：**准备（PREP）**。本文件与配套 kit 源码只做**源码级准备**：不 boot、不安装、
不碰 mount/adapter 产品文件（Team 最终源已签收 `15485936a`，接线未测定档不变）。
配套 kit 源码：`dev/agent-workflow/evidence/alpha5/live/a5m2-team-c2-kit.mjs`
（纯数据 + 纯校验，无 Host 调用）。

## 0. 形之来源（对照已证形，不另起形）

- live assembly kit 已证形：`dev/agent-workflow/evidence/alpha5/live/`
  （`a5live-assembly-row.mjs` = row/inject/apply 三段式，`a5live-fixtures.mjs` =
  fixture 构造，`run-live-assembly.mjs` = runner；`record({leg, ok, …})` 逐腿留痕）。
  B-TEAM C2 kit 沿用同三段式与同留痕形，**不改** assembly 文件。
- 已证 C2/G6 世界运行证据：`dev/agent-workflow/evidence/alpha5/live/runs/`。
- 行 config 的 13 键由中心矩阵登记形决定；本 prep 只固定**键的语义**（下表），
  中心落地时按矩阵形填名。凡本文未确名的键写作 `[matrix-owner]`，不臆造键名。

## 1. 行 config（13 键语义；含 rev-2 常量的生产读取路径）

| # | 键（语义） | 本族取值 | 来源 |
|---|---|---|---|
| 1 | familyId | `B-TEAM` | `team-adapters.mjs` `A5_B_TEAM_FAMILY_ID` |
| 2 | adapterRevision | **2**（根 01:0x 源迁移） | 唯一常量 `team-adapters.mjs:196` |
| 3 | adapterRevision 的**生产读取路径** | `packages/runtime/dist/packages/runtime/src/plugin/live/governed-families/team-adapters.mjs`（Host 实读 dist；当前在 :202 答 `2`） | dist 为 src 的 byte-identical 镜像，`check:artifacts:head` verdict=ok |
| 4 | providerIdentity | 挂载 `providerId`（行内声明） | `familyRegistrations` entry |
| 5 | reuse-install lock | 中心现 lock `7faee42f8830…`（形引用，值以中心矩阵为准） | 中心矩阵（本 tree 无该值，未臆造） |
| 6 | world | `tests/homes/a5m2-team-c2`（工作区内，DSH_HOME 纪律） | TEST_METHODS §7 |
| 7 | port | `3180` 族内分配（与 :3080 稳定实例隔离） | TEST_METHODS §2 |
| 8 | readiness 屏障 | `team.listRoots` **v3 只读** 探针，ready 前不得进 C 腿 | 复用已证只读形 |
| 9 | 验收面（criteria 集） | 见 §2 | 已签 B-TEAM 源 |
| 10 | durable 批准消费腿 | 见 §3 之 C-DUR-1 | 根 04:0x |
| 11 | 证据目录 | `dev/agent-workflow/evidence/a5m2-team-c2/runs/<utc>/` | 已证形 |
| 12 | 预算/上限 | 见 §4 | 空间纪律 |
| 13 | `[matrix-owner]` 登记/裁决字段 | 待中心矩阵填名 | 中心 |

## 2. C-criteria 验收面（全部对着已签源，不新增语义）

- **C-SET**：B-TEAM governed family 的**十记录闭集**（tools 74–82 + 86，`A5_B_TEAM_TOOL_NAMES`）
  全部 ACTIVE 且 row 可查；Leader 面向的**十三 team 工具族**中未入本族的三条
  仍走原生（本 kit 不声称覆盖它们）。
- **C-LEAF（list-members）**：`team_list_members` 的 minted target manifest 为
  **12 叶**，含 `rosterMemberIds`（stringArray）与 `rosterFingerprint`（string），
  且 `rosterMemberIds` 取 roster 行**自身 instanceId**，fingerprint 为该 id 集摘要
  （id 集是身份，摘要仅补充——不以计数冒充身份）。
- **C-REV**：Host 实读路径（§1 键 3）答 **2**；claim 的 `family.adapterRevision`
  与挂载发布的 familyRegistration entry 同一常量；**旧 rev-1 批准不得被翻译**，
  在既有版本比较处直接不过（本 kit 只记录，不改源）。
- **C-ADDRESS**：不可达成员的 inspect 走原生 VALUE（`null` 叶 / 原生拒），
  读异常/缺事实**不得**被造为空叶后仍 mint 批准目标。
- **C-NO-VALUE-HID**：caller/root 拒绝经 adapter.execute 的 settled 通道以
  **返回对象**形出现（非 catch 取异常）；零 facts / 零 PA entry / 零 port entry。
- **C-DRAIN / C-EDGE**：一次消费、replay 拒、edge 拦 stale。
- **C-READINESS**：`team.listRoots` v3 只读探针通过后，才允许进入上面各 C 腿。

## 3. durable 批准消费：哪条腿闭合 "67/67 不替旧 durable 批准消费"

- 事实定档：lane 侧 67/67（本族 specs/battery）是**接线级**证据，**不替代**旧 durable
  批准的消费验证；旧批准（rev-1 组合）在 durable 存续时的拒，须由 **Host 腿**闭合。
- 闭合腿：**C-DUR-1** —— 在真实 world 内先以**当前 rev-2** 建立批准并消费一次
  （正向基线），再以**携带旧 rev-1 的 durable plan/批准**（源迁移前留下的形）
  重放同一调用，断言：PA 判定为版本不符而拒（既有码）、lane 零进入、无新账本写入。
  只有 C-DUR-1 通过，才可称"旧 durable 批准消费已验"；此前层级仍为 **接线未测**。
- 反例防护：C-DUR-1 不接受"两次都拒"的 mock 互证——正向基线必须真通过。

## 4. 预算 / 范围 / 端口 / world 命名（空间纪律）

- 预算形：沿用 ~10GB 共享世界形（一份安装 + 一份 DSH_HOME 世界）；**不新增安装、
  不新建 clone/world/Host**，不删除既有世界；单次运行日志与 fixture 只落
  `dev/agent-workflow/evidence/a5m2-team-c2/`。
- 范围：只跑 B-TEAM 本族 C 腿；他族族腿不在本 kit（避与他 lane 撞）。
- 端口：`3180` 族内取一段固定值并在证据内记名；**绝不触碰 :3080 稳定实例**。
- world：`tests/homes/a5m2-team-c2`（工作区内；命名/清理按 TEST_METHODS §7）。
- 执行前置（本 prep **不做**）：boot/安装须待根包 / 范围 / 预算裁决后由窗口执行。

## 5. 本 prep 明确不做

不 boot、不安装、不改 mount/adapter/bridge 产品文件、不新增 Host getter/账本、
不写矩阵（中心职责）、不声称任何 Host 级结论。
