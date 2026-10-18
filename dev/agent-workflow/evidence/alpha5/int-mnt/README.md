# ALPHA5 集成轮台账（int-mnt）— glob 挂载 + v3/v4 工具正负控终型

分支 `alpha5-int-mnt`，基 = GLUE-8 终态 `8b1dbb5a`；merge `alpha5-glob-backend@ee9b30d5`
（#322 终件：anchored confined-rg glob backend + 行 suite + 对抗 suite）= `46e5649a`；
生产 mount = `34e59098`。

## 1. 挂载与两个集成条件（round-7 原文条件，逐条锁定证据）

**挂载**（`team-tool-plane.mjs` productionBackends.glob）：仅当行配置**同时**给出
governed `fsInstance` 与 `confinedProvider` 时装配 `createAnchoredGlobBackend`
（#322 终件面）；未配置世界逐字节保持 typed-shut 落点（零回归律，preassembly
15/15 + R1 腿实证）；显式 `backends` 行（wiring-kit seam）仍整面优先。

* **条件 (a) allowPaths 同形** = 后端发出的 confined request 携带
  `{ path: anchor.rootReal, accessBits: { readFile: true, readDir: true } }`
  ——锚定 walk root **只读**，与 a5glb request 逐字同形（glob-backend.mjs 的
  request 面；anchor 先于子进程存在，拒绝=无进程无字节）。
  **钉** = `INT-a`（source-law：request 面逐字 + 无 write 位 +
  cwd=anchor.anchorPath + anchor-before-request）。行为面 = a5glb L 组
  （L1 ENFORCED 探针 / L2 真 pid 真 rg 真字节 / L3 收窄层实测）。
* **条件 (b) internalLog 不接成员可见 sink** = 生产装配**根本不传**该选项
  （内部面默认关；从行配置到 sink **无路径**——装配构造点无 internalLog
  字段）。**钉** = `INT-b`（装配源码无 internalLog + observe 只走
  codes+arithmetic 律 + 成员面 r.text 无 INTERNAL 文本）；X10 律（不给 =
  两次逐字节同、什么都不断留）由 a5glb suite 原腿继续钉。

## 2. 行为表（相对挂载前）

| 面 | 挂载前（glue7/GLUE-8 时代） | 挂载后（int-mnt） | 钉 |
| --- | --- | --- | --- |
| 未配置 plane（无 fsInstance/confinedProvider） | typed shut `IO_POLICY_UNSUPPORTED` | **不变**（逐字节） | R1 + v4 preassembly 15/15 |
| 配置齐备 plane 的 `team_glob` | typed shut（G6 旧断言） | **真 confined rg 枚举 governed root**（governed 名上线，外部名零） | G6' + glue7 kit L6' + v4 kit C3' |
| 名级枚举攻击（`../**`/绝对外部/symlink 逃逸） | 行关着无从谈起 | **全拒，零外部名上线**（round5 攻击模板形在接通行上复跑） | INT-c |
| deny 负控 | — | **`template-default-deny` 在 backend 之前落**（零 exec 零副作用）；**实测披露**：file-class 的 any/subtree deny 均不 address glob 的 list effect（any 被 PR0 投影拒；subtree 无 locator 可比） | INT-d（披露如实入台账） |
| 收窄层共存（master@0e59140b allowPaths 重构） | a5glb 收口环境未含收窄层 | **CONTENT 与 NAMES 双 kernel-denied**（listing 零名）；行侧锚定律独立继续承重 | L3'（重钉+实测注） |
| native ask 臂 | durable leader-approval 全链 | **不变**（v4 kit A4.1–A4.4 + C5 20/20 重跑绿） | v4 kit |
| dist 面 | 7 placement（glob-backend.mjs 缺席=运行时 Cannot find module） | `place-dist-glue` 第 7 项 = glob-backend.mjs 入列 | drift 门 |

## 3. 门

双抓恒等（本目录 `vitest-fulltree-int-*.log`）/ drift 0 / p4t6 10/10 续钉（a5glb
四文件入账 + A5RBN 断链修复）/ kit 共存：glue7 24/24（L6 更新为接通面）+
v4 assembled 20/20 + preassembly 15/15 / a5glb 两 suite + plane-backends 16/16。

## 4. 披露与环境

* L6' 负断言判"外部"用 `/workspace/outside/` 路径与 OUTSIDE token——kit 世界的
  probe fixture 有意在 governed root 内放同名 `secret.txt` 文件（round5 探针），
  名字本身不构成外部判据。
* 环境修复（gitignored 面，porcelain 恒 0）：root test-use 构建面残缺 → 从
  a5g8/a5g7 完整构建同基线副本 rsync 补全（kit STRICT expansion 上跳解析到它）；
  int 树 test-use rsync 自 a5g8。
