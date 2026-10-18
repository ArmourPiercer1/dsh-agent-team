# alpha5-int-r3 — 集成轮预演（DECLARATIVE REHEARSAL）

**stack** = master `15481988`（glob 主候选，dormant file；"mount comes with integration round +
runtime_base narrowing"）⊕ `git merge --no-ff 3f78fcce`（srgp #330 候选头：confined-rg search 面）。
merge 干净、零冲突。**本笔是声明式预演：若 #330 最终头变化，以新头重放本 merge 并全量复跑**
（重放命令：`git checkout alpha5-int-r3 && git reset --hard 15481988 && git merge --no-ff <新头>`，
然后本文件"验证"一节逐条重跑）。一切只在本地，**未 push**。

## 挂载翻转（三处，`packages/runtime/src/plugin/live/team-tool-plane.mjs`）

1. **search 行加 `confined: confinedCfg`** — srgp 自己留给集成方的一行（其 README
   "Gap for the integration owner"）：不传则生产 search 仍是 grep(1) 端口，rg 行只在调用方
   自带 provider conf 时存在。形制照抄同文件下一行 shell 行（`confined: confinedCfg`）。
   披露控制保留：**只有 fsInstance、无 provider conf 的世界仍走 grep 端口**（glue7 G1/G1b/G2/G9
   语义不变；新腿里也另建了这个世界做实证）。
2. **glob 行 `shut` → live-anchored**（`createAnchoredGlobBackend`，realm/rootDir/confined/
   templateId/instanceId 全走同一 provider 与 launcher）。**CANDIDATE-A 敞口如实保留、不宣称消解**：
   该候选因**名类泄漏**过不了安全复审——`verify`→launcher 字符串 `chdir` 窗口 + provider 的
   `runtime_base '/'` READ_DIR grant ⇒ 世界外**名字**可浮出（字节从不；复审实测 3/10700）。
   前置安全层 = runtime-base-narrow 轮（G6b 归档腿写明它就是等这一轮配对）；行注释保留该敞口，
   glue7/glob/ 与 G6b 一字未改。**牙不减**：G6 由"恒 shut 的 pin"重 tie 为"live-anchored 且
   世界外字节永不出现"（更强的可测断言）。
3. **shell 行 names=`{bash:'bash'}`**（行配置 `plane.names`，非改 lane 默认）——依据 = 216 格矩阵
   收据页脚 `2 accepted (bash@bash, read@read), 214 refused`：本 lane 唯一被 ACCEPTED 的原生名
   就是 `bash@bash`；`grep`/`glob` 的原生宣称被 REFUSED ⇒ 继续留 GLUE-5 别名。`DEFAULT_PLANE_NAMES`
   一字未动（有腿实测仍为 `team_bash`）。

## 两个集成条件（新腿文件 `packages/runtime/test/a5int-r3-mount-integration.test.ts`，4/4）

- **条件 (a) allowPaths 同形**：glob 行交给 confined provider 的 grant 列表与 search 行
  **逐项相同**（`glob-backend.mjs:837-842` ≡ `search-backend.mjs:746-751`：系统 rx 目录 + rg bin 目录
  + 锚根只读 READ_FILE/READ_DIR），两者均**不含任何写位**；shell 行是唯一带 `writeFile` 的行
  ——这条让"同形"成为有内容的话。两行还同源同一锚根（都取 `fsInstance.rootDir`），不是一个锚两个名。
- **条件 (b) internalLog 不接成员可见 sink**：生产三行**从不传** `internalLog`（该文件里此词
  零出现；backend 的 debug 面默认 OFF），且装配返回面上不含任何 host-side 观测行、
  不含受治世界的绝对路径。

## 验证（本地实测）

| 目标 | 结果 |
| --- | --- |
| `a5int-r3-mount-integration` | **4/4** |
| `alpha5-glue7-plane-backends` | **12/12**（G6 按上注重 tie 后） |
| `alpha5-search-backend` | **42/42**（rg 在本机可解析） |
| `alpha5-glob-backend` / `-adversarial` | **49/49** / **8/8** |
| `alpha5-g1-deny-lane` / `a5w-integration-wiring` / `a5p4-lane-hygiene` / `a5natexe-native-takeover` | **11/11** / **14/14** / **8/8** / **12/12** |
| `p4t6-session-event-scan` | **10/10**，scanner 亲数 **1195**（未入账前 RED 读数=chain 1194 vs 1195），`SCANNED_PATHS_A5INTR3` 一条，tie `1195 - 1194`；两侧旧锚点数字一律不抄 |
| dist 镜像 | `node scripts/place-dist-glue.mjs` place 完成（8 placements），复跑幂等 ⇒ **drift=0**（src 与其 dist 镜像同步变更） |
| `tests/homes` 残留 | **0** |

## 未做 / 阻塞（如实报，不浪漫）

- **③ 全链 kit 本地真跑：本轮未跑**。原因：本 worktree 是新开的，`tests/deepseek-harness-test-use/`
  尚未按 TEST_METHODS 从只读 baseline clone（live kit 要驱动宿主 CLI），且 a5g7-live-kit 派生件
  尚未落盘。这是**环境准备未做**，不是 kit 失败——不得据此声称全链已过。派生计划：以
  `dev/agent-workflow/evidence/alpha5/live/a5live-assembly-row.mjs` + `a5g7` 系列为底，改名
  `a5intr3-live-kit.mjs`，把 `plane.names` 置为 `{grep:'team_grep',glob:'team_glob',bash:'bash'}`，
  并把 a5rbn kit 的 L6（"GLOB ROW IS TYPED-SHUT ON THE WIRE"）在新形下重 tie —— **该 L6 属
  runtime-base-narrow lane 的所有权，需其 owner 或父单授权后改**。
- `a5p5-dormant-audit` 位于 `packages/tools/a5p5-tools/test/`，本轮批量脚本按错误路径找它 ⇒ 未跑，
  下轮补（文件存在，非缺失）。
