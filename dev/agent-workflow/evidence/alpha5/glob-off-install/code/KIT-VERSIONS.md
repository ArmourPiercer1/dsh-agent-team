# KIT-VERSIONS — 哪个 run 用了哪一版 kit（每步都留痕）

判定期两跑的字节快照与 `code/` 现文件同哈希（复核值）：

| 文件 | sha256 |
| --- | --- |
| `code/a5glob-off-kit.mjs` = `code/a5glob-off-kit@v4.mjs` = `runs/2026-10-18T22-07-01Z/kit-as-run.mjs` | `9e8ee1cad6dee8a932941e599fa9fdb048bc7a71f087d2b1abbe4e3a70f9816b` |
| `code/a5glob-delta-kit.mjs` = `runs/2026-10-18T22-35-04Z/kit-as-run.mjs` | `1bf9290808ff4fd1149e4ba34ebfb8a18cddc2c74803c81b951b3c0e06130461` |

即：判定期之后 **kit 未再改动**；改动全部发生在两次判定跑之前，且每次都记在下表。

## 基线 kit（①-④）

| 变体 | 用于 run | 相对上一版的改动 | 该跑结果 |
| --- | --- | --- | --- |
| v1 | `21-49-48`（`--only off` 校验） | 首版：从 a5ie-r5 骨架派生（装面/三零/boot 路径/带外账本/清理） | 落点腿全红：`chain.member` 误取 leader 末次请求 |
| v1.1 | `21-51-34`（首次全量） | 成员轮筛选加 `!markerHits.includes(..._L0)` | 48/49，红 `C2`（glob 行账本路径假设错） |
| v2 | `21-58-09` | 账本改「全树走查 + argv 自证归因」（不猜路径） | FATAL：collector 返回引用未定义 `countsWithExit` |
| v3 | `22-01-38` | 修 `countsWithExit` | 48/50，红 `M2b`,`C2`：argv 先截 160 再归因 → 打包 rg 长路径被截，rg 行误判 `other` |
| **v4** | **`22-07-01`（①-④ 判定跑）** | 归因改在**原始 argv** 上做（证据侧才截断），并加 rg/search 行各自的 vocab（`--files` vs `--json/--regexp`）；另加 `M0b` | **49/50 +3 booked**，仅 `H1b` 钉条件红（live master 已前移 `ca7ab2ab`） |

## 差异 kit（#344）

派生方式：以 v4 骨架（`code/a5glob-off-kit@v4.mjs`）为底，改动面全量见 `code/delta-kit-derivation.diff`（507 行统一 diff）。
前两步派生以内联 heredoc 施作、未留脚本文件（此 diff 即其可复核替代）；第三步留 `code/derive-delta-3-refuse-drive.py`。

| 变体 | 用于 run | 改动 | 结果 |
| --- | --- | --- | --- |
| d1 | `22-12-57`, `22-14-00`（`--only doff` 校验，终端转录未落文件） | 常量/模式/token 换 delta 面；`rowConfig` 探针残引 `'off'` → `'doff'`；误改 discovery 正跑为容错支 → 复原 | FATAL ×2（残引；蓝图 deny 表为空致梯子不完成） |
| d2 | `22-29-33`, `22-32-09` | 加 X 族判据（X0/X-byte-chain/X-byte-names/X-boot/X-glob/X-glob-spawn/X-refuse×3/X-scope）+ H1d + `landings.json` 按执行模式键 | `22-29-33` FATAL（容错支位于 `team.create` 之后，守卫先触发）；`22-32-09` 33/37：`H1b` + 三 `X-refuse` 红 —— 拒绝形未走正常前门，挂载从未被尝试（驱动不足，非产品结论） |
| **d3** | **`22-35-04`（#344 判定跑）** | 所有形统一走 discovery barrier + `team.create`；拒答证据轮询实例日志与观测流；X-refuse 判据取任一带 typed code 的见证面 | **36/37 +2 booked**，仅 `H1b` 钉条件红（live master 再前移 `52d73534`）；三 `X-refuse` 全绿 |

## ⑤ 缺省形正控轮（同一 kit 的参数化，root 23:34Z 令）

派生脚本：`derive-round3-default-control.py`（参数化 + shape 账 + H1e）、`derive-round3b-scratch-laws.py`
（`S1`/`S1b` 两腿 + 跨形腿入 shape 账）。**判据本体未动**：新增只增不减，`--only` 未跑的形记 `na:true` 而非绿。

| 变体 | 用于 run | 改动 | 结果 |
| --- | --- | --- | --- |
| v5 | `23-36-12`（`--only default`） | 参数化 `--install-sha/--install-ref/--install-lineage/--world-prefix`；H1b 改对**被点名 ref** 双源测；H1c 加 #337 旁系缺省字节证；新增 H1e（master 关系另记）；`LEG_SHAPE` shape 账 | FATAL：`masterAncestorOfGraded` 标识符笔误（世界未起） |
| v5.1 | `23-36-28` | 修标识符 | 31/33：红 `C5`,`R4` —— 单形跑的**覆盖红**（跨形腿无世界可读），非行为红 |
| **v5.2** | **`23-39-12`（⑤ 判定跑）** | `C5→off` / `R4→rename` 入 shape 账；新增 `S1`（旁系 scratch 装面律 + listing 洁净）与 `S1b`（基线路径差 book） | **32/32 +4 booked +18 shape-N/A，KIT_EXIT=0** |

判定跑 kit 快照 `runs/2026-10-18T23-39-12Z/kit-as-run.mjs` 与 `code/a5glob-off-kit.mjs` 同哈希
`edeebfac7e7c6c1434adbc11ceb8ca41805a99accaa888fe23fcd78b4207a0da`。
注：①-④ 判定跑（`22-07-01`）的字节仍是 `9e8eec…`（存于其自身 `kit-as-run.mjs` 与 `a5glob-off-kit@v4.mjs`），
⑤ 轮的参数化改动**晚于**那一次判定跑，不回写其结论。

## 收尾复核（精确名清理后）

- `git worktree remove .worktrees/a5glob-off-src-20261018T214327Z`、
  `git worktree remove .worktrees/a5glob-off-delta-src-20261018T222000Z`、`rm -rf tests/homes/.a5glob-off-store`
- ⑤ 轮同律：`git worktree remove .worktrees/a5scratchdef-src-20261018T233528Z`、`rm -rf tests/homes/.a5scratchdef-store`
- `ls tests/homes | grep -Ec 'a5glob-off|a5scratchdef'` → `0`；`git worktree list | grep -c a5glob-off` → `0`；
  `git worktree list | grep -c a5scratchdef` → `0`；端口 3182-3186/3493 自证空闲；`:3080` 仍 `401`。
