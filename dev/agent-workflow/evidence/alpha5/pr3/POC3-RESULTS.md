# PoC3 — ControlledFs 真实 FS 负控探针结果（A5-PR3 Lane B，2026-10-16）

基线=base `db5cb5f7`；实现=`packages/runtime/controlled-fs/`（DORMANT，lane-local）；
世界=`tests/homes/a5p3-<UTC>/`（真实目录/符号链接/rename，teardown 删除，见
`GREEN-lane-vitest.txt` 尾行 `left-over count = 0`）；全部文件内容 SYNTHETIC。
原文转录：`RED-lane-vitest.txt`（实现前 4 文件全红）与 `GREEN-lane-vitest.txt`（37/37+tsc 0）。

每腿 = NAIVE 对照（原始 OS 行为，证明探针有齿）+ GUARDED 腿（lane 行为）。

| 腿 | NAIVE（OS 实证=缺口） | GUARDED（lane 行为） | verdict |
| --- | --- | --- | --- |
| A 符号链接逃逸 | 锚内 `escape/alias-out.txt`→锚外，裸读成功泄 `OUTSIDE-SECRET` | `lstat` 段走查到符号链接 ⇒ typed `denied/symlink-alias`，**open-issued=0**（账本），体内无秘密 | **PASS** |
| B 目录竞态 | realpath 预检干净后，`stage/` 被 rename+换成指锚外符号链接，按原路径串重开 = 静默泄漏（naive 实测泄 `OTHER-SECRET`） | open 后、读字节前 exec-time 重读（`/proc/self/fd` realpath 出锚）⇒ typed `denied/exec-time-escape`，close，零披露 | **PASS** |
| B2 树内 inode 换 | —（同路径 rename 替换，OS 无从报错） | `fstat (dev,ino)` ≠ 快照 ⇒ **undetermined**/`exec-time-identity-drift`，`sideEffectUnknown` 不为 true（读未 effect），零披露 | **PASS** |
| C 隐藏文件读取 | OS 不隐藏任何东西（裸读成功）——隐藏是中介律不是 fs 巧合 | 有效 grant 在场仍 `hidden/hidden-read` + 非空诊断行（账本+error 双处）+ open-issued=0；`stat`=`{exists:false,withheld:true}`（withheld≠absent）；属主成员正控正常读 | **PASS** |
| D 跨成员路径不可见 | 裸跨成员读 `private/secret.txt` 成功 | member-b：list 省略 private（列表隐身）；显式 read=`hidden`+诊断；open-issued=0；体内无 `PRIVATE-SECRET` | **PASS** |
| E 关闭后 fd 续用 | 捕获 fd=K→lane 关闭→新 open 复用 K（实测相等）→裸 `readSync(K)` **静默读到新属主** `RECYCLED-BYTES` | 呈现 fd 永非授权：无 lane 在册记录 + `/proc` 无此 fd ⇒ `denied/fd-closed`；`/proc` 有主 ⇒ `denied/fd-recycled`；两者体内均无新属主字节；lane 跨调用零驻留 fd | **PASS** |

## PoC-3 判定（限定本阶段，plan §6 三分法）

- **`openat2`/目录 FD 与 DSH public FS target/finalize/error 的兼容** = 本 lane 未接
  native helper，不可宣称。node 面回退（段走查 + `O_NOFOLLOW` + open 后 `/proc`+`fstat`
  重读）实证可覆盖：逃逸/别名 = open 前拒绝（open-issued=0）；**check→open 竞态 = open 后
  零披露但 OS 已发生 foreign-open**（B 腿账本 `open-issued`+`exec-refused` 双证），故对
  **任意不可信可变树**严格档 = `IO_POLICY_UNSUPPORTED`（undetermined 三分即此诚实表达）；
  对**固定受信数据树**（无第三方建别名/换 inode 能力）本 Profile 成立。
- 方向性结论：进程内 Trusted Controlled FS 承载 read/write/list/stat 的**策略中介 + 零披露
  + 三分错误**成立；**内核级"foreign-open 都不发生"需 `OpenAtPort`（openat2
  RESOLVE_BENEATH/RESOLVE_IN_ROOT + NO_MAGICLINKS）native helper**——接缝已立，未伪称已证。
  PR8 不得据此宣称该 Profile 全机 Supported。

## 证据通道

1. 决策账本（append-only，`LedgerEntry`）：`refused:<class>:<reason>` 严格先于 open；
   `open-issued` 仅在成功 open 后记账 ⇒ 测试断言 `open-issued(denied path)=0` 是 OS 级
   行为断言而非日志口径。
2. 真实 syscall：`lstat` 段走查、`O_NOFOLLOW` open、`/proc/self/fd` readlink、`fstat`、
   真实 rename/symlink 竞态注入（`onAfterPreCheckBeforeOpen` 探针缝=fixture 的确定性
   "攻击者窗口"，产品形态里该窗口属于环境）。
3. 世界生命周期：`createPoc3World()` 建于 `tests/homes/a5p3-*`（TEST_METHODS §7），
   teardown 删除并断言不存在；GREEN 尾行 `left-over count = 0`。
