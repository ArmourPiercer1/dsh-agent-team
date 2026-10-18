# a5glob-off-install — `planeCfg.globEnabled: false` 装面关断验收（真装真跑）

角色：装面关断验收员（qwen-only）。任务：在**真实安装面**（宿主公共包面装包 → 插件 boot 路径装配）上验收 #342 的
`teamToolPlane.globEnabled:false` 关断键 —— 四工具矩阵、零带外 spawn、无 fallback、缺省零变化，加 #344 差异复验。
纪律：不改产品码、不 push、:3080 只读探测（禁触其数据）、世界命名 `tests/homes/a5glob-off-*`、用毕精确名清理。

- 验收基线（①-④）：master `46e48218e48314662586ff053ca3825e2889a6bb`（#342），双源实测
  （`git ls-remote origin refs/heads/master` 在固定源码 worktree 内与主检出内各测一次，均等于该 SHA；源码 = 该 SHA 的
  detached worktree `.worktrees/a5glob-off-src-20261018T214327Z`，无拼贴）。
- 差异验收（root 22:03Z 令）：master `ca7ab2abcfa0d91650bbb2994395a7bd9c065b59`（#344），源码 worktree
  `.worktrees/a5glob-off-delta-src-20261018T222000Z`。
- 宿主：`tests/deepseek-harness-test-use` @ `639ed01539`（pristine，跑前/跑后 porcelain 均 0）；打包 rg `1.18.0`（`ripgrep 15.0.0 (rev 3a612f88b8)`）；
  Landlock ABI 4 可用；安装 launcher 字节 `sha256 1264ea584e3438d6…`（26 992 B，`--exit-passthrough` 在体，`--abi-probe` 实测 `abi-available/4`）。
- 端口族：3182/3183/3184（基线三世界）+ 3185/3186/3182/3183（差异四世界）+ mock 3493；全部跑前自证空闲、跑后自证释放（T3）。
  `:3080` 仅 GET 探测，跑前跑后同值 `401 → 401`（H0/H3），未触其数据。

## 判定（≤4 行）

1. **② 矩阵 通**：off 形装面上 `team_glob` 落 `IO_POLICY_UNSUPPORTED` typed 拒（原文见下），`team_grep` 真命中 / `team_bash` 真跑 exit=0 + 越界负控 exit=1 / `read` 真读 —— 三行与缺省同形。
2. **零 spawn + 无 fallback 通**：带外账本（provider `plans/plan-*.json` + `out/plan-*/exit.json`，按 argv 自证归因）off 侧 glob-walker plan=0，同世界 shell plan=2 / rg-search plan=1 均在；seed 名在 off 世界 wire 与日志 **0 命中**；rename（`zglob`）侧同关。
3. **① 真装 + 缺省零变化 + 卫生 通**：三零（miss/extra/sha≠=0，rootSha `b18fcfee908c4923…`）；同配置缺键世界 glob 真跑（两 seed 全列，glob law 未加 exit 面）；`left=[]`、端口释放、:3080 未动。
4. **⇒ 装面关断可用**；唯一红是钉条件红 `H1b`（master 在本轮跑中前移，原文见「红」章），非产品行为红；#344 差异三腿全通（见末章）。

---

## ① 真装（基线世界 `off` / `default` / `rename` + 安装探针）

装法（宿主自己的公共包面，无 file: 路径、无手工装配单元）：

```
DSH_HOME=<world> node tests/deepseek-harness-test-use/apps/cli/lib/bin.js \
  plugin --profile web add github:ArmourPiercer1/dsh-agent-team#46e48218e48314662586ff053ca3825e2889a6bb
```

| 量 | 值 |
| --- | --- |
| installed / declared face | `1773 / 1773`（files:=1771 + pack-always 2：`README.md`,`package.json`，I3e 单列不折入） |
| 三零 | missing=0 · extra=0 · sha≠=0（逐文件与 `git archive <sha>` 镜像比字节） |
| rootSha | `b18fcfee908c4923fd1f15a9d0ba1a4249f3697d76f6d6831562453c30b88023`（三世界与探针一致） |
| 关断键在装配树 | I5 `--dump-config`：team 行 + `plane` + `globEnabled: false` 原样到组合树 |
| 关断门在跑的那面上 | I-SHIP：已装 dist 字节里 `globEnabled` 命中 14 次、`a5-glob-config-disabled` 命中 1 次（不止 git 源码） |
| launcher 字节 | 安装面**不含** pre-launcher（I8 披露缺口，非绕过）；部署输入字节 = 该 commit blob（`commit==src=true`） |

世界装配全走插件 boot：`profile-layer-<mode>.yml` 插 bundle 行 + preset 行，`team.create` 起 leader/member；kit 不 `import`
任何产品模块参与执行（`kit-as-run.mjs` 为本轮所用 kit 快照）。

## ② 关断形装面四工具矩阵（`a5glob-off-off-*`，同场缺省对照 `a5glob-off-default-*`）

off 形 = 完整配置 + `teamToolPlane.globEnabled: false`；对照 = **逐字节同配置仅去掉该键**（C5：两层 YAML 差一味）。

| 工具 | off 形实测（原文摘录） | 判据 | 结果 |
| --- | --- | --- | --- |
| `team_glob` | `a5p5-refused kind=backend-failed code=IO_POLICY_UNSUPPORTED detail=the production effect-face adapter for this backend is the registered GLUE-4 follow-up (pb-CONTRACT §6); the gated surface is live, the effect body stays refused — never faked` | typed 拒（detail 句从**已装 dist 字节**读出比对）+ 零带外 spawn | 通 M1/M2/M7/M8 |
| `team_grep` | `search · content · 1 matches` + seed token 行 + `a5p5-meta {"kind":"search",…}` | 真命中，形状与关断前同 | 通 M3/C4 |
| `team_bash` | `bash · exit=0` + token + `a5p5-meta {"kind":"shell","exitCode":0…}`；越界腿 `bash · exit=1` + `cat: ../outside/secret.txt: Permission denied` | 真跑（写盘 fs 复核）+ 真拒（marker 不在 wire 任一字节） | 通 M4/M5/C6 |
| `read` | `line one\nA5GLOBOFF-GREP-TOK lives here\n` | 真读（接管名未动） | 通 M6 |

零 rg spawn 的**带外**测法（不信进程内计数器、不信日志）：provider 每次受限 spawn 必留
`<scratch>/plans/plan-<id>.json`（内含精确 argv）+ `<out>/plan-<id>/exit.json`。三行的 scratch 根各不相同（shell 行=治理根；
search 行=其兄弟目录；glob 行**未配置** → provider 以 `''` 解析成宿主进程 cwd 相对路径，实测落 `<HOME>/workspace/plans/`）。
故 kit 不猜路径：**全世界树走查**这些记录并按各自 argv 归因（含 `--files` 的 rg = glob walker；无 `--files` 的 rg = search 行；
`/bin/sh` = shell 行）。

- M2（off）：`rg-glob-walker` plan=**0**，`{shell:2, rg-search:1}` 在位 —— 零是「这行关着」，不是「测不到」（M2b 同场正控）。
- C2（对照）：同一次全树走查**找到** `workspace/plans/plan-*.json`，argv = 打包 rg + `--files --glob=*.txt --sort=modified …`，exit 记录在位。
- M7 进程表旁证（非主证）：50 ms `/proc` 采样器整生命周期未见带 `--files` 的 rg（`rgGlobWalker=0`），同世界 launcher 目击 8 次（采样器确实在看）。
- M8/C3 日志行配对：off 世界 `anchored-glob` 见证行 0 条而 search/shell 见证 4 条；对照世界出现
  `a5glb-glob: anchored-glob ran … pid=404 files=2 capped=false`。
- M0b：挂载线来自生产 entry 自己的观测流（只读观测行 `/__a5ie/facts`）：`a5-plane: placed [team_grep,team_glob,team_bash,read,…]` —— 关断不改挂载。

## ③ 无 fallback（装面形态）

- M9：glob 夹具唯一 seed 名（`zzgloboff-alpha.txt` / `zzgloboff-beta.txt`）在 off 世界 **wire 0 命中、日志 0 命中**（逐 seed 计数）；
  对照世界同两枚名**确实出现在 glob 结果里**（C1）—— 这条检法本身是被正控证过灵敏的。
- M10：拒答不是截断的答案 —— glob 落点无结果行、无 `files_with_matches` meta。
- 改名复证（`a5glob-off-rename-*`，`names.glob: zglob` + 关断）：R1 落点 typed 拒原文同形、R2 无 zglob 名泄漏、R3 全树账本无 glob-walker plan（类门先于任何后端装配取胜）。

## ④ 回归 + 卫生

- 缺省形世界（对照）跑 a5ie-r5 形最小集：装三零 + glob 正控（真列两 seed，且 glob 完成面**未**被加 exit=/exitCode —— 零默认改动在装面复证）+ bash 正/负控（C6：`exit=1` + 内核拒原文 + marker 不上 wire）。
- H3：`:3080` `401 → 401`；test-use porcelain 跑后 0。
- T1：`a5glob-off-*` 世界 + 安装世界精确名前缀扫尽 `left=[]`；T2：原始实例日志脱敏后删除 `rawLeft=[]`；T3：端口自证释放。
- T4（book）：pnpm store 在世界集之外，由操作员按精确名删除（见「足迹」）。

---

## #344 差异验收（root 22:03Z 令；master `ca7ab2ab`，= 基线 SHA 的直接子 commit）

差异面 = C-16 钉名增量，三腿 + 字节证（`runs/<delta-stamp>/`）：

| 腿 | 内容 | 结果 |
| --- | --- | --- |
| X0 | `ca7ab2ab^ == 46e48218`、`rev-list --count` = 1（差异集恰为 #344，无夹带） | 通 |
| X-byte-chain | 出厂 dist 模块 baseline→new head 统一 diff **65 行改动，0 行**触及 `globEnabled / globDisabledShut / createShutBackend / IO_POLICY_UNSUPPORTED / a5-glob-config-disabled`；两头的 glob-off 行集逐行同序（`delta-plane-dist.diff` + `delta-glob-chain-lines.json`） | 通（同 blob 消费链未变的字节证） |
| X-byte-names | 三名在新头全部在 `PLANE_RESERVED_NATIVE`；字节记录并**不抹平**：`subagent_codex` / `subagent_claude_code` 是 #344 新增，`subagent_fork` 基线已钉；注册表 53 → 69 | 通 |
| (a) X-boot | 新头真装（同 rootSha 面 `91984080a41ea694…`，三零）后，观测流仍 `a5-plane: placed [team_grep,team_glob,team_bash,read]`，且 `team_bash` 真跑（exit=0 + 写盘在位）—— 钉名表变大不影响挂载 | 通 |
| (b) X-glob | 一腿实测 `team_glob`（`globEnabled:false`）落 typed 拒，且落点与基线 run 记录的 off 世界落点**字节相同**（`sameBytesAsBaseline=true`）；X-glob-spawn：该世界带外账本无 glob-walker plan、shell plan 在位 | 通（引用字节证 + 一腿实测） |
| (c) X-refuse ×3 | `names.glob` 分别冒名 `subagent_codex` / `subagent_claude_code` / `subagent_fork`：装面 typed 拒（观测流原文：`a5-plane: mount-REFUSED for session-a5glob-off-team-2026-10-18T22-35-04Z (PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED)`，三世界同形，`polledMs=3` 即见），且 `placedLine=false` / `wirePlaneRows=[]` / 该世界 `planKinds={}`（零受限 spawn） | 通 |

## 红（原文，不降判据）

基线 run `runs/2026-10-18T22-07-01Z`（49/50 +3 booked）唯一红 —— 钉条件红，非行为红：

```
FAIL H1b — INSTALL SPEC = live master, measured from TWO SOURCES (git ls-remote inside the pinned source worktree AND inside the main checkout), both equal to the graded SHA, and the pinned source worktree HEAD IS that SHA (nothing spliced in) [ls-remote[src]=ca7ab2abcfa0d91650bbb2994395a7bd9c065b59 ls-remote[main]=ca7ab2abcfa0d91650bbb2994395a7bd9c065b59 srcHEAD=46e48218e48314662586ff053ca3825e2889a6bb]
```

差异判定期 run `runs/2026-10-18T22-35-04Z`（36/37 +2 booked）同一条红，原文：

```
FAIL H1b — INSTALL SPEC = live master, measured from TWO SOURCES (git ls-remote inside the pinned source worktree AND inside the main checkout), both equal to the graded SHA, and the pinned source worktree HEAD IS that SHA (nothing spliced in) [ls-remote[src]=52d73534f92e69efe12c72c347d435f66f3f85fe ls-remote[main]=52d73534f92e69efe12c72c347d435f66f3f85fe srcHEAD=ca7ab2abcfa0d91650bbb2994395a7bd9c065b59]
```

同一判据在差异轮仍按原样记分；新增的 `H1d` 腿正面陈述实况：`graded=ca7ab2ab liveNow=52d73534 ancestorOfLive=true
commitsOnTop=1 specPinnedToGradedSha=true` —— 被安装/被跑的面仍是命令点名的 `ca7ab2ab`（I3a-I3d 三零 + rootSha
`91984080a41ea694…` 逐文件字节证）。

原因与处置：本轮开跑前 master 已合 #344（root 22:03Z 同步），live master 前移至 `ca7ab2ab`；安装规格硬钉被验收 SHA
`46e48218`（I3a-I3d 逐文件字节证即该 SHA 的面），故被验收的面未受影响。判据**未放宽**：H1b 保持原样并按其自身条款
记红；差异轮在新头上重新满足同一 H1b（live==graded 时绿），并以新增 H1d 腿正面陈述钉条件
（graded SHA 是当前 live master 的祖先 + 安装规格仍硬钉被验收 SHA），不改旧判据。

## 尝试账（attempt ledger；红与错都留痕）

| run 目录 | 用图 | 结果 | 红因 / 处置 |
| --- | --- | --- | --- |
| `runs/2026-10-18T21-49-48Z` | 只做 `off` 的骨架校验 | KIT_EXIT=2 | 全部落点腿红：kit 侧 `chain.member` 取到 leader 末次请求（leader 历史亦含 TASK_A）。修：成员轮筛选加 `!markerHits.includes(..._L0)`。（r5 同款坑，此处复现并修死） |
| `runs/2026-10-18T21-51-34Z` | 首次全量三世界 | 48/49 +3，红 `C2` | kit 侧路径假设错：按 `<root>.a5g7-glob-scratch` 找 glob 行账本 —— 该名属未挂载的同名兄弟实现；live glob 行的 provider scratch 未配置 → 以 `''` 解析（落 `<HOME>/workspace/plans/`）。修：改为**全树走查 + argv 自证归因**，判据不降。 |
| `runs/2026-10-18T21-58-09Z` | 走查版校验 | FATAL（KIT_EXIT=1） | collector 返回引用未定义变量 `countsWithExit`（kit bug）；世界未起，无验收意义。修后重跑。 |
| `runs/2026-10-18T22-01-38Z` | 走查版全量 | 48/50 +3，红 `M2b`,`C2` | kit 侧截断陷阱：argv 先截 160 字符再归因 → 打包 rg 全路径（~175 字符）被截成 `…/ripgrep-linux`，两行 rg 全被判为 `other`。**M2b 同场正控把这条抓了出来**（这正是设正控的意义）。修：按**原始 argv** 归因，证据侧才截断。 |
| `runs/2026-10-18T22-07-01Z` | **①-④ 判定期** | **49/50 +3 booked**，仅 `H1b` 红（master 前移） | 见上「红」章。kit 快照 `kit-as-run.mjs`，全程转录 `RECORDED-TRANSCRIPT.log`。 |
| `runs/2026-10-18T22-12-57Z`, `…T22-14-00Z`（终端转录未落文件，逐腿以 `leg-ledger.jsonl` 为准） | 差异 kit 校验（`--only doff`） | FATAL ×2 | ①`rowConfig('off')` 残引（差异 kit 模式名已换 `doff`）；②误把 discovery 正跑改成容错支 → 蓝图 deny 表为空、梯子永不完成。两处均修。 |
| `runs/2026-10-18T22-29-33Z` | 差异 kit 首跑 | FATAL | 容错支放在 `team.create` 之后（守卫先触发）；且拒绝形未经正常前门 → 挂载从未被尝试。修：所有形同走 discovery + `team.create`，拒答证据轮询观测流与实例日志。 |
| `runs/2026-10-18T22-32-09Z` | 差异全量 | 33/37，红 `H1b` + 三 `X-refuse` | 同上新原因：master 再前移至 `52d73534`（H1b 按其条款记红）；三 `X-refuse` 红 = 驱动不足（未触发挂载），非产品面结论。修后为判定跑。 |
| `runs/2026-10-18T22-35-04Z` | **#344 差异判定期** | **36/37 +2 booked**，仅 `H1b` 红（同因：live master 跑中再前移至 `52d73534`） | 三 `X-refuse` 全绿（原文见「差异验收」章）；kit 快照 `kit-as-run.mjs` + 全程转录 `RECORDED-TRANSCRIPT.log` |

注：前两次 run 的终端转录写到 per-call `/tmp`（沙箱不跨调用共享），未随证据留存；每轮的逐腿持久记录是各 run 目录内
`leg-ledger.jsonl` + `criteria.json`，判定期两跑的完整终端转录以 `RECORDED-TRANSCRIPT.log` 留存。

## 证据导读

| 文件 | 用途 |
| --- | --- |
| `code/a5glob-off-kit.mjs` / 判定期快照 `runs/2026-10-18T22-07-01Z/kit-as-run.mjs` | ①-④ 判定 kit（含修订）；`code/a5glob-off-kit@v4.mjs` 为判定跑同一字节快照 |
| `code/a5glob-delta-kit.mjs`（判定期快照 `runs/2026-10-18T22-35-04Z/kit-as-run.mjs`） | 差异 kit |
| `code/delta-kit-derivation.diff` | 差异 kit 相对 v4 骨架的**全部**改动面（骨架 → 差异 kit 的统一 diff；前两步派生以内联 heredoc 施作未留脚本，此 diff 即其可复核替代；第三步留 `code/derive-delta-3-refuse-drive.py`） |
| `code/KIT-VERSIONS.md` | kit 变体与各 run 的对应（哪一跑用哪一版、修了什么） |
| `code/a5ie-r5-kit-reference.mjs` | 复用的 a5ie-r5 装面骨架（`git show c44f51e4:…`，未造新轮子） |
| `runs/*/install-manifest.json` | 三零 + rootSha + 逐文件 sha256 + face 清单 |
| `runs/*/installed-gate-witness.json` | 已装 dist 字节的关断门命中数 |
| `runs/*/launcher-deployment.json`, `dump-config-install-probe.txt` | launcher 字节证 / 装配树含键证 |
| `runs/*/instance-<mode>.log`, `wire-digests-<mode>.jsonl` | 实例日志（脱敏）与 wire 摘要 |
| `runs/*/confined-ledger-<mode>.json` | 带外受限账本（全树走查 + argv 归因；`byRowDefaultPath` 为各行缺省路径的原始读数） |
| `runs/*/proc-sampler-<mode>.json` | 进程表旁证采样器（50 ms） |
| `runs/*/observer-facts-<mode>.json` | 只读观测行读到的挂载线 / 名称面 |
| `runs/*/landings.json`, `criteria.json`, `leg-ledger.jsonl` | 落点原文 / 判据全表 / 逐腿流水 |
| `runs/<delta>/delta-plane-dist.diff`, `delta-glob-chain-lines.json`, `delta-reserved-names.json` | #344 字节差三证 |

## 足迹与清理（用毕精确名）

- 已按精确名清除（本回合收尾，`git worktree remove` + 目录按名删除）：`.worktrees/a5glob-off-src-20261018T214327Z`、
  `.worktrees/a5glob-off-delta-src-20261018T222000Z`、`tests/homes/.a5glob-off-store`；复核见 `code/KIT-VERSIONS.md` 末段。
- 世界：`tests/homes/a5glob-off-*` 由 T1 每跑前缀扫尽；复核 `ls tests/homes | grep a5glob-off` 为空。
- 主检出：HEAD 未动（`6259cf4b`），产品码零改动；本工作唯一新增 = `dev/agent-workflow/evidence/alpha5/glob-off-install/`（未跟踪目录）。
- `:3080`：仅 GET 探测，前后 `401`；其 DSH_HOME 与数据未触。
