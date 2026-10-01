# Chromium sandbox-ON `about:blank` 对照探针 — 审计（2026-10-01）

单用途探针会话。范围：仅 `about:blank`；单次 `launch`；不弱化 Chromium 沙箱；无 sudo/安装/内核与权限配置改动；未委派；未触碰 `:3080` 与任何 `homes/<world>` DSH_HOME；产品/kit/lockfile 零改动。

## 1. 运行时状态核验（探针后）

| 项 | 探针执行时（临时完全权限） | 恢复核验时（当前） |
| --- | --- | --- |
| DSH file policy | `danger-full-access` | **`workspace-write`** |
| approvalPolicy | `never` | **`ask`** |
| `/proc/1/cmdline` | 无外层 wrapper（宿主 PID 命名空间） | `bwrap --ro-bind / / --dev /dev --unshare-pid --proc /proc --die-with-parent --tmpfs /tmp --bind <workspace> <workspace> -- bash -c …` |
| `/proc/self/status` NoNewPrivs | `0` | **`1`** |
| pid ns inode | `pid:[4026531836]`（初始） | `pid:[4026532716]`（bwrap 新建） |
| Seccomp / CapEff | `0` / `0000000000000000` | `0` / `0000000000000000` |

`workspace-write` + `ask` 已由运行时快照与本会话只读采样（bwrap wrapper 复现、`NoNewPrivs=1`、独立 PID 命名空间）双重确认。

## 2. 两次已存在结果比较（同一 binary / 同一 Playwright / 同一 probe 脚本）

- binary：`tests/homes/.playwright-browsers/chromium_headless_shell-1228/…/chrome-headless-shell`，`Google Chrome for Testing 149.0.7827.55`（revision 1228）；该目录内**无** `chrome-sandbox` setuid helper。
- Playwright：`playwright@1.61.1`（`/home/user/deepseek-harness/node_modules/.pnpm/…`）。
- 脚本：`tests/homes/.playwright-browsers/probe-about-blank.mjs`，原样未修改；`launch({headless:true, chromiumSandbox:true, timeout:30000})` 调用 **1 次**；无 `--no-sandbox` / `--disable-setuid-sandbox` / `--disable-gpu-sandbox` 等弱化 flag；无 `ignoreDefaultArgs`；pipe 传输，无 HTTP/CDP 监听。

| | 受限上下文（`workspace-write`，bwrap 内） | 本次（临时完全权限，无 bwrap） |
| --- | --- | --- |
| 结果文件 | `probe-result-20261001T133832Z.json` | `probe-result-20261001T135149Z-fullaccess.json` |
| `ok` | `false` | `false` |
| FATAL 行 | **已捕获**：`No usable sandbox! If you are running on Ubuntu 23.10+ or another Linux distro that has disabled …`（occurrences=1） | 同一行（文本一致） |
| Playwright 提示 | `Chromium sandboxing failed!` | `Chromium sandboxing failed!` |
| browser pid | `<launched> pid=17` | `<launched> pid=307488` |
| 退出 | `exitCode=null, signal=SIGTRAP` | `exitCode=null, signal=SIGTRAP` |
| node 退出码 | — | `0`（脚本正常写完证据后退出） |
| `page` / `userDataDir` | 未到达 | 未到达（`goto` 未执行） |
| 临时 profile | Playwright 自行回收 | Playwright 自行回收（`finished temporary directories cleanup`） |

两次均由 `launch()` 阶段失败，`about:blank` 页面导航未发生；无残留浏览器/进程。

## 3. 结论（有界记录）

**去除 DSH 外层 wrapper（bwrap）后，该次 `chromiumSandbox: true` 启动仍然失败，因此外层 wrapper 不是该失败的唯一必要解释。**

本条不足以证明任何具体根因：不能据此判定特定 LSM（AppArmor 等）、userns 开关、setuid helper 缺失或内核策略中的任一项。`No usable sandbox!` 文本中附带的发行版/AppArmor/SUID sandbox 说明属 Chromium 自带提示，本轮未做任何判别性验证（未运行 `unshare`、namespace 探测或权限/内核配置读取以外的检查）。

过程更正：本轮中途的即时回报曾把受限上下文那次写成"未捕获 FATAL 行"。复查 `probe-result-20261001T133832Z.json` 后确认**旧受限 probe 确已捕获相同的 `FATAL No usable sandbox` 行**；该误述源于我当时按行长过滤的比较脚本，非证据缺失。旧的未加时间戳文件 `probe-result.json`（13:19 一次早期运行）不含该行，属另一轮记录，未参与本结论。

## 4. 证据文件

新增（本次，全部不与旧文件同名、未覆盖任何既有证据）：

- `tests/homes/.playwright-browsers/probe-result-20261001T135149Z-fullaccess.json`（3465 B）
- `tests/homes/.playwright-browsers/probe-console-20261001T135149Z-fullaccess.log`（1634 B）
- `dev/agent-workflow/evidence/chromium-sandbox-probe-20261001/audit-20261001.md`（本文件）

只读引用（字节数与 mtime 核验未变）：

- `tests/homes/.playwright-browsers/probe-result-20261001T133832Z.json`（3429 B, 13:38）
- `tests/homes/.playwright-browsers/probe-result.json`（4123 B, 13:19）
- `tests/homes/.playwright-browsers/probe-about-blank.mjs`（2966 B, 13:19，未修改）

## 5. 停止点

探针失败即停：无重试、未换 launcher / flag / 位点；Chromium 输出的 `chromiumSandbox: false` 建议**仅记录、未执行**。本审计之后无后续实验执行。
