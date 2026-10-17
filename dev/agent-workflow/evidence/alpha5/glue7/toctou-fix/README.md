# GLUE-7 · TOCTOU ①(c) 修复与对抗复跑

安全审 VERDICT（`a5g7rev-20261017T212702`，`glue7-review/VERDICT.md` ①(c) FAIL）的
修复笔 + 同形攻击复跑。修复语义见 `../README.md` §4b（审计行）；本目录 = 复跑驱动与证据。

## 文件

* `re-run-toctou.mjs` — reviewer 同形攻击驱动（独立 `/bin/bash` rename→symlink 换入
  循环，打 **compiled DIST 镜像** = 生产加载面）：
  * S1-S4 正控非回归（read 真字节 / grep dir 真命中 / grep file fd-view remap 呈现
    byte-identical / final-symlink 仍 typed 拒）
  * C1 read ×20000、C2 grep-file ×400、C3 grep-dir ×400（reviewer 同参）+
    C4 glob walk ×200（新行同标准出生；rg 跟随命令行 symlink 目录=实测，前置拒层
    在此是承重的）+ C4 干净态正控
* `re-run-prefix-RED.txt` — **RED-first 回执**：pre-fix 镜像（`git show 2ae6e70c` 的
  dist）上 C1 泄露 @iter35、C2 泄露 @iter1（reviewer 报 23/1，同类复现；泄露概率
  ~0.1%/iter，多次录制取含双泄露的一次）
* `re-run-output.txt` — 修后 **GREEN 8/8**：read 0/20000、grep-file 0/400、
  grep-dir 0/400、glob 0/200，**正控全部真执行**（判据 ②：没把 read/search 关掉、
  没全退 IO_POLICY_UNSUPPORTED）

## 修复落点（代码行）

`packages/runtime/src/plugin/live/plane-effect-backends.mjs`：

* read 行 = `open(O_RDONLY|O_NOFOLLOW)` + `verifyOpenedHandle`（open-at-exec.ts 既有
  律）+ 从已验 handle 读字节 + cap 在已验 identity 上执行
* grep 行 file-arg 腿 = 同 open+verify，子进程只收继承 fd（`/proc/self/fd/3` =
  spawn stdio 槽位，子端编号实测），argv 零路径字符串；输出 remap 回锚定拼写
* grep 行 dir 腿 = 保持字符串（grep -r 不跟命令行/树内 symlink，0/400 两次独立复现）；
  **不豁免**：无 OpenAtPort 前无公开接口封死递归走的 mid-component swap，披露为残差
* glob 行（新行同标准出生）= walk 根 O_DIRECTORY|O_NOFOLLOW open + verify 前置拒 +
  Landlock allowPaths（仅治理根）内核兜底；magic-link-cwd 形态在 launcher 链不可用
  （父 fd 不跨 launcher，实测空走），未强行

复用件全部既有：`verifyOpenedHandle`/`isBeneath`（controlled-fs 公开 index）、
Landlock confine provider（reviewed 面）、node 常量。**零新架构、零新权限。**
