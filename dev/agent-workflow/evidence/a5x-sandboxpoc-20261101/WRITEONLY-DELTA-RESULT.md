# D-FS-02 严格只写不读（write-without-read）补充验证 — 结果报告

- 日期：2026-11-02T17:10Z（UTC）
- 触发：远端审查意见——本轮 PoC 证明的权限机制比要求的完整双轴权限略窄：已证路径掩蔽、特定目录写入限制、单文件暴露，但**尚未证明严格只写不读**。本文件为该缺口的定向补充验证。
- 分支/宿主：`task/a5x-envpoc-20261031`；pristine 0.2.0-rc.2 @ `639ed01539`（run 前 rev-parse 校验）
- 排序：沿用用户裁决——先内核层（纯 Linux OS），成立后再做非常薄 DSH 接缝

## 结论（先行）

**严格只写不读 = 本宿主可表达、可强制兑现（YES）**，机制组合 = **bwrap rw-bind（挂载层放行写路径）× VFS owner 权限位（文件层拒绝读，EACCES）**；内核层 15/15 PASS，接缝层 13/13 绿（原生 bash 工具、ToolDefinition 零改动、PTY 真实输出 + 宿主 FS 侧效应双证）。**拒绝 = 真实 EACCES（VFS 层）**，与 bwrap 的 EROFS（挂载层）/ ENOENT（掩码）三机制可分辨——域内对照实验同域呈现两种拒绝码。

### 机制选型（如实记录，非首选但为可用真实机制）

| 候选机制 | 本宿主状态 | 备注 |
| --- | --- | --- |
| landlock（handled bits 仅 `WRITE_FILE`，拒绝=EACCES，**无元数据改动**） | **ENV_BLOCK** | 正统机制；本 WSL2 宿主 add_rule 全 fd 变体 EBADF（`a5x-dfs02step1-20261102T164041Z` env-probe）；待活跃内核另测 |
| bwrap 单独 | **不可表达** | rw bind ⇒ 可读（ioaxis 轮实测 dialect）；无「只写挂载」类型 |
| **VFS owner 权限位（dir 0300 / file 0200，ext4 原生强制）** | **可用（本轮验证）** | 宿主侧前置条件；confinement 层不改元数据（生产域生命周期须管理位：设置/恢复/审计） |

## 1. STEP1 — 内核层（纯 Linux OS，无 Team/DSH；15/15 PASS）

脚本 `tests/kits/a5x-envpoc/a5x-wr0-step1.sh`；主证据 `a5x-wr0step1-20261102T170527Z/`（PASS）；provenance `...T170457Z`（首跑：OS 效果全对、python `grab()` 解析缺陷——marker 行尾 `──` 误匹配——修正后重跑）。

### 1.1 前置条件与探针

- 前置（宿主侧、spawn 前）：`rootW` chmod **0300**（owner -wx 无 r）、`wf.txt` chmod **0200**（owner -w- 无 r）；`stat` 记录在证据（`300 rootW` / `200 wf.txt`）。
- **探针（新实测事实）**：bwrap 0.11 **能**直接 `--bind` 一个无读位目录（0300）为源路径（exit 0）——bwrap 以 O_PATH 打开源，无需对源目录的读权限 ⇒ 写作用域 = 精确 rootW（无祖先泄漏）。

### 1.2 验收矩阵（真实 OS 效果逐格）

| 腿 | 层 | 命令 | 期望 | 实测 |
| --- | --- | --- | --- | --- |
| H1 | 纯 VFS（无域） | `cat rootW/wf.txt` | 拒（只写不读） | 1 / `cat: …wf.txt: Permission denied`（**EACCES**） |
| H2 | 纯 VFS | `ls -A rootW` | 拒（无列表权） | 2 / `ls: cannot open directory …: Permission denied` |
| H3 | 纯 VFS | `echo … >> rootW/wf.txt` | 成功（写路径） | 0 / 落盘 |
| H4 | 纯 VFS | `echo … > rootW/wf2.txt` | 成功（w+x 建文件） | 0 / 落盘 |
| H5 | 纯 VFS | `stat -c %s rootW/wf.txt` | 成功（stat 仅需 x） | 0 / size=37 |
| D1 | bwrap 域（rw-bind rootW） | 同 H1 | 拒，且 = EACCES 非 EROFS | 1 / `Permission denied` |
| D2 | 域 | 同 H2 | 拒 | 2 / `Permission denied` |
| D3 | 域 | 同 H3 | 成功（**证明挂载层为 rw，非 ro**） | 0 / 落盘 |
| D4 | 域 | `stat -c %s` | 成功 | 0 / size=56（37+19，两次追加全落盘） |
| D5 | 域（域外对照） | `echo z > baseW/sib.txt` | 拒（EROFS = 挂载层） | 2 / `cannot create …: Read-only file system` |
| O | 宿主 FS oracle | teardown（chmod 恢复）后读回 | 三标记全在 | seed + `HOST-APPEND-9042` + `DOMAIN-APPEND-4417` + `wf2=HOST-NEW-5511` |

**关键判别（同域呈现）**：D1/D2 读拒 = **EACCES（VFS 文件层）**；D5 写越界拒 = **EROFS（挂载层）**；ioaxis 轮掩码读拒 = **ENOENT（挂载掩码）**。三种拒绝机制在同一证据集内可分辨。

## 2. STEP2 — 薄 DSH 接缝（13/13 绿）

Kit `tests/kits/a5x-envpoc/a5x-wr0-kit.mjs` + wrapper **v4** `tests/kits/a5x-envpoc/a5x-fork-ioaxis-v4.mjs`；证据 `a5x-pocWR0-20261102T170733/`（首跑全绿）。

### 2.1 v4 词汇增量（additive，零核心改动）

- `io.writeOnlyRoots[]`：confine 影子构造 rw-bind（与 writeRoots 同挂载形，§1.1 探针证明精确 rootW 可行）；
- **fail-closed 前置条件检查**：confine 时 stat 每个 writeOnlyRoot，owner 位必须**恰为 0300**，否则拒 spawn（与 unmapped-session 同一 fail-closed 纪律）——前置条件缺失**不得**静默退化为普通 rw 根。
- ToolDefinition 恒等断言在册（`terminal-bash` / `["terminals","sandboxPolicy","sessionProjections","subprocess"]`）。

### 2.2 单 lane WO（原生 bash 工具，PTY 真实输出）

| 腿 | oracle | 实测（工具输出原文节选） |
| --- | --- | --- |
| 读文件被拒 | EACCES，seed 不可见 | `cat: …rootW/wf.txt: Permission denied` `[exit code 1]` |
| 列表被拒 | EACCES，目录内容不可见 | `ls: cannot open directory '…rootW': Permission denied` `[exit code 2]` |
| 追加成功 | exit 0 + stat 尺寸 | `37` `[exit code 0]`（seed 20 + 追加 17） |
| 新建成功 | 同上行命令链 exit 0 | 同上（&& 链整体成功） |
| 域外写被拒 | EROFS | `bash: …baseW/sib.txt: Read-only file system` `[exit code 1]` |
| FS 侧效应（teardown 后） | 追加/新建落盘、seed 完整 | `TOOL-APPEND-7788` / `wf2=TOOL-NEW-3344` / seed 首行原样 |
| SEAM resolve 被咨询 | `resolve sid=… mapped=gen1` | ✅ |
| SEAM cap io=yes | `CAP applied … io=yes` | ✅ |
| SEAM 前置条件检查 | `precondition … owner=300` | ✅ |
| SEAM 只写 confine | `confine … writeOnlyRoots=["…rootW"]` + argv 前缀 `/usr/bin/bwrap --ro-bind / / …` | ✅ |
| 稳定实例无扰 | :3080 401 → 401 | ✅ |

## 3. 对审查意见的回应（完整双轴权限图景，分层）

| 能力 | 判定（本宿主） | 机制 | 拒绝语义 |
| --- | --- | --- | --- |
| 路径掩蔽（目录/文件暴露式） | 已证（ioaxis 轮） | bwrap tmpfs 掩码 / ro-bind 暴露 | ENOENT |
| 精确目录写入限制 | 已证（ioaxis 轮） | bwrap rw-bind 精确根 | EROFS（越界） |
| **严格只写不读** | **本轮已证** | bwrap rw-bind × VFS 位 0300/0200 | **EACCES（读）** |
| 严格只读不写 | 已证（ioaxis 轮 R 域） | bwrap ro 基线 + 掩码 | EROFS（写）/ ENOENT（掩码读） |
| 任意**读白名单**（allowlist 语义） | **仍非原生能力**（如实维持） | bwrap 下只能 = 显式掩码集（deny-by-mask，需枚举被拒路径）；真 allowlist = landlock（本宿主 ENV_BLOCK） | — |
| 任意读写组合（每路径独立位掩码） | 生产形态 = landlock（本宿主 ENV_BLOCK，待活跃内核） | 本轮组合（bwrap 轴 × VFS 位）已覆盖 写轴精确/只写不读/读掩码/单文件暴露 | — |

**对「任意读写白名单均能被强制兑现」的诚实边界**：写侧（精确根、只写不读、域外 EROFS）在本宿主已全谱兑现；读侧在 bwrap 语义下是 deny-by-mask（显式掩码集）而非默认拒绝的 allowlist——这是 bwrap 的机制边界（上轮已披露），landlock 才是真 allowlist 机制，其状态 = 本宿主 ENV_BLOCK。本轮补充后，**审查点名的「严格只写不读」已证**；「读 allowlist 语义」的兑现依赖 landlock 活跃内核（已登记为待测项，非本宿主可裁决）。

## 4. 限制与如实披露

1. **元数据基**：VFS 位是宿主侧前置条件（deployer 设置；生产域生命周期须管理 设置/恢复/审计——fail-closed 前置检查已证于接缝层）。对比 landlock 的策略基（无元数据改动）——生产首选仍为 landlock（待活跃内核）。
2. **新建文件不受限**：域内新建文件按 umask 生成（可读）；严格继承需 default-ACL 或 landlock（生产扩展点，本轮不测——不过度实验纪律）。
3. 删除/改名在只写不读根内**允许**（目录 w 语义的 POSIX 现实，如实记录）。
4. bwrap 0.11 对 0300 源目录直接 bind 可行（O_PATH，§1.1 探针）——此为本轮新实测事实，收窄了「显式祖先泄漏」的适用范围（只写不读根无需祖先形）。

## 5. 工件清单

- `tests/kits/a5x-envpoc/a5x-wr0-step1.sh` — 内核层脚本（HOST/DOMAIN 腿 + 探针 + teardown oracle + 15 项判定）
- `tests/kits/a5x-envpoc/a5x-fork-ioaxis-v4.mjs` — v4 wrapper（v3 + writeOnlyRoots + fail-closed 前置检查）
- `tests/kits/a5x-envpoc/a5x-wr0-kit.mjs` — 接缝层 runner（单 WO lane、13 项判定）
- 证据：`a5x-wr0step1-20261102T170527Z/`（主）+ `...T170457Z/`（provenance）；`a5x-pocWR0-20261102T170733/`（主）
