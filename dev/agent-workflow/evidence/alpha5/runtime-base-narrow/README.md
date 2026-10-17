# alpha5-runtime-base-narrow — runtime_base '/' READ_DIR 收窄（bug 修复轮）

定性（根 22:43Z，承 glue7 `runtime-base-probe/README.md` 考证）：provider 给 '/'
全域 READ_DIR（launcher `build_ruleset` 硬编码）= **实现偏离既定边界**，非待裁
新语义。权威原句：architecture.md:77（base = **列举面** interpreter/libraries/
devices + "Do not accidentally expose host home"）、:243（reads-unrestricted =
被批评的旧状态 "does NOT meet"）、:257（"environment base readability
**WITHOUT arbitrary host-home access**"）。本轮 = 最小收窄补丁，不发明新权限
模型；基 = master `382e5fb6`（fetch 亲验）+ 合并 `alpha5-glue7-backend@d9a16061`
的 plane 面（verifyOpenedHandle/remap/glob typed-shut 律全在）。

## 补丁（三处，全走既有机制）

1. **launcher `build_ruleset`**：撤 `odir("/") READ_DIR`；base = 显式列举
   `/usr`(READ_DIR|READ_FILE|EXECUTE)、`/etc`(READ_DIR|READ_FILE)、
   `/proc`(READ_DIR|READ_FILE)——:77 interpreter/libraries 面原句范围；
   devices 词无 FS 规则（`fs_mask()` 不 handle block/char 位，本来即然）。
   `selective` probe leg（镜像生产 base 的量测具）同步撤 '/'，其判定检查全部
   不依赖 '/' READ_DIR（fixtures 走 scratch、base 读走 /etc//usr）——腿语义不变。
   `--fd-close` 独立 ruleset（scratch+/proc，从未含 '/'）未触。
2. **provider.ts 政策面**：`runtime_base: true` 旗标保留（launcher 合同稳定），
   注释钉死其现语义 = 显式列举，非全树。
3. **shell 行动态锚根授**（`createConfinedShellBackend`）：每次调用的锚定
   工作区根（`resolveAnchored(base, cwd)` 产物）**无条件进 plan**——默认面
   带该行历来的完整 rw 集（逐位不变）；assembly 自带 allowPaths 面追加
   READ_DIR-only 项（与撤掉的 '/' 在该面提供的**严格相等**：'/' 从未授
   READ_FILE，零新写道）。REFER/MAKE_SYM 不入：这两位在收窄前同样**从未**
   被任何规则授出（mv/ln 在沙箱内历来 EACCES），正控不依赖它们，加它们=
   扩权，非"保正控"所需。

Landlock 语义注记：路径规则按**最近祖先规则**匹配，撤 '/' 后无规则目录
（/home、/srv、workspace 外的兄弟目录…）一律无 READ_DIR → 枚举 EACCES；
/usr /etc /proc 子树走各自规则、锚根子树走 per-call 授——**逐位不变**。

## ① RED 活证（名字类泄露，round2 witness 形：名字上线、字节从未）

`a5rbn-witness.mjs` 走 **dist 出厂面 plane 行**（fsInstance+confinedProvider，
真宿主真 Landlock ABI v4），pre-fix 字节（launcher @ 382e5fb6）：

- `runs/2026-10-17T22-59-22-535Z`（posture=red，11/11）：`ls /home/*` →
  **`/home/user`** 真名上线；裸 `ls /home` → **`user`**；`ls <outside dir>` →
  两个 marker 名全上；`ls /` → 根全名单。B1：outside **字节**全程不出现
  （读字节律未破——名字类是独立泄露面）。

## ② GREEN（同 kit 同命令，narrowed 字节）

- `runs/2026-10-17T22-58-34-644Z` + 最终形 `runs/2026-10-17T22-59-16-680Z`
  （posture=green，11/11）：`ls /home` EACCES 零名；`ls /home/*` glob 死于
  EACCES-readdir → 字面 ENOENT（无名单）；`ls <outside>` EACCES 零 marker；
  `ls /` EACCES。正控 P1-P6 全活（锚根读/写、越界写 EACCES、base 二进制、
  /etc 读+/usr 枚举、越界字节 kernel-refused）。

## ③ 正控全存活

- **shell 合法腿**：live kit **GREEN 26/26**（`live-kit-run-2.log` +
  `runs/2026-10-17T23-06-13Z/`，STRICT 出厂面真宿主真 Team 真 Landlock）：
  L3（锚内写盘+echo+exit=0）、L4（越界读 kernel EACCES）+ 新增 **L7/L8**
  （同轮真 wire：`ls /home` 与 `ls ../outside` 双双 `Permission denied`，
  **零名字、零 marker、零字节**上线；预修 witness 同命令形态为真名上线）
  同轮全绿。注：C1 文案为复制自 glue7 的原句（"a5g7-*"），过滤面已换
  `a5rbn-` 前缀（`homes=[]` 实证）——文案残留如实注记。
- **LSP /usr 三条不受涉（走位亲核）**：`real-lsp-kit.mjs:224` 的 clangd/tsserver
  行**自带**显式 `/usr` EXECUTE|READ_FILE|READ_DIR + genRoot 授（注释自证
  "runtime_base" 并列），且 runtime_base 的 /usr 条保留 → 两条腿都不依赖
  '/'；`a5lsp2-streaming` 15/15、`a5lsp2-assembly` REAL 腿绿。
- **TOCTOU read/grep 攻击抽查仍 0 泄**：`../glue7/toctou-fix/re-run-toctou.mjs`
  在 narrowed 字节上重跑 **8/8 PASS**（C1 read 20000 iter、C2 grep-file 400、
  C3 grep-dir 400、C4 glob-factory walk 200，全 leaked=false；S1-S4 正控真跑）。
- **三工具正控真执行**：live kit L1(read 真字节)/L2(grep 真命中)/L3(shell 真
  受限跑) + 单测 `a5rbn-runtime-base-narrow` N1-N3/P1-P4（REAL，8/8）。

## ④ glob 面：typed-shut 不动 + 对接点

glob 行保持逐字 typed-shut（live kit L6 pin 不变，另线不接线）。本收窄是其
集成的**前置安全层**：CANDIDATE-A 死因之二（§4b：swap-cwd 落点外目录的
名字枚举走 '/' READ_DIR，3/10700）在 Landlock 面已被拔除——落点若被换到
锚外目录，现一律 EACCES（witness W1b/W2 + 单测 N3 形）。对接点（供
093aaded 独立面或 confined-rg 复接轮）：
1. `createAnchoredGlobBackend` 仍 exported-unwired；其 allowPaths=治理根 only
   的构造不变，现其 backstop 才真实成立。
2. 复接前仍需 glue7 glob/README 未列项（rg 平价表/结果侧逐-entry 锚检/
   ≥5000-iter 与 mid-component race 腿）——本层不替代它们。
3. L6 文案中的 "'/' READ_DIR grant" 泄露构成已闭环，复接轮可引本目录为
   拔除证据。

## ⑤ AUDIT — 行为变更清单（沙箱内逐行，翻转如实表）

| # | 操作（沙箱内子进程） | 收窄前 | 收窄后 | 类 |
|---|---|---|---|---|
| 1 | readdir 无规则目录（`/`、`/home`、`/srv`、锚外兄弟…） | **成功（名单上线）** | **EACCES** | 意图收窄（泄露面） |
| 2 | 对无规则目录的 glob（`ls /home/*`） | 真实展开 | 无展开（字面 ENOENT） | 同类 |
| 3 | `/usr` 子树 readdir/read_file/exec | 成功 | 成功 | 不变 |
| 4 | `/etc`、`/proc` 子树 read/readdir | 成功 | 成功 | 不变 |
| 5 | 锚根（shell 默认面）readdir/read/write/make_reg/truncate/remove | 成功 | 成功（动态授，逐位同） | 不变 |
| 6 | 锚外写（touch 越界） | EACCES | EACCES | 不变 |
| 7 | 锚外读文件字节 | EACCES | EACCES | 不变（字节律） |
| 8 | 提供器 scratch out/err（锚外路径） | 成功 | 成功 | 不变（restrict 前 fd 已开，继承 fd 律） |
| 9 | 任意路径 stat / 存在性探测（如 `test -e /home/x`） | 成功 | 成功 | 不变——Landlock 无 getattr 权，**残余如实**：定向探名仍可，枚举已死 |
| 10 | `>/dev/null`（O_CREAT-on-/dev：MAKE_CHAR 无授） | EACCES | EACCES | 不变（既有，实测同形） |
| 11 | `mv`/rename（REFER 无授）、`ln -s`（MAKE_SYM 无授）、`mkdir`（MAKE_DIR 不在 bits 映射） | EACCES | EACCES | 不变（历来如此，故 REFER/MAKE_SYM 无需入动态授） |
| 12 | LSP 腿 clangd/tsserver（自带 /usr+genRoot 授） | 成功 | 成功 | 不变 |
| 13 | grep/read 行（宿主面 spawn，resolveAnchored 前闸） | 不变 | 不变 | 不经 confine 子 |
| 14 | glob 行 | typed-shut | typed-shut | 不变（不接线） |
| 15 | probe `selective` 腿 | ENFORCE-CONFIRMED | ENFORCE-CONFIRMED | 检查不依赖 '/'（亲核逐条）|
| 16 | probe `denyall`/`badhandled`/`--fd-close` | 原形 | 原形 | 未触 |

**基→头唯一语义变更** = #1/#2（枚举面），恰为泄露面本身。

## ⑥ 门禁

- 新单测 `packages/runtime/test/a5rbn-runtime-base-narrow.test.ts` REAL 8/8；
  p4t6 续钉 1182→**1183**（RED `expected 1183 to be 1182` =
  `p4t6-A5RBN-RETIE-RED.txt`；GREEN 10/10 = `p4t6-A5RBN-RETIE-GREEN.txt`）。
- drift=0（`check:artifacts:head` @ 最终 HEAD，provider.js/mjs 镜像同笔再生；
  其后再跑 `pnpm run build` 全树重产 + 复检 `check-artifacts-at-head` 仍
  drift=0——镜像确定性再生亲证）。
- 双抓恒等 = **9 == 9 == 已发布 9**（`vitest-fulltree-1/2.log`：均
  `9 failed | 7179 passed (7188)`，红名单 diff 逐字恒等：t2×1 /
  p6t3-mediation×5 / p6t3-restart×2 / p6t6×1）。**环境披露两份**：
  ① 首抓（`vitest-fulltree-1.PRE-BUILD.env-disclosure.log` 留存）多出的
  `a4p7-merge-gate` composition-smoke 红 = 新 worktree 未建
  `packages/client/dist`（gitignored 构建态，非提交面），`pnpm -C
  packages/client run build` + 全树 build 后消失，双抓在补齐环境后重做；
  ② 中途一次 `a4pr0a-fact-type-closed-set` **单跑** collection 红系
  stash 诊断与 vitest 并发下的瞬态（同文件在全部全树抓中 9/9 绿），如实留记。
- kit（复用 glue7 kit 面）：`a5rbn-live-kit.mjs` = 原 kit 全腿逐字 + L7/L8
  枚举负控 + 世界前缀 a5rbn-*；recorded run = `live-kit-run-<n>.log` +
  `runs/<stamp>/criteria.json`。
- 红线：CORE 0（本仓文件）；`:3080` 不触；世界 a5rbn-* 自扫；3183/3184
  free→used→free。

## 停点纪律

未触发：收窄全程未需任何新能力/新权限模型（launcher 一行撤除 + per-call
锚根既有 allowPaths 机制显式化；REFER/MAKE_SYM 等候选位亲测"正控不所需"
而**不**加）。
