# alpha5-int-a5b — 三候选合并集成树（integrator writer）

> **CORRECTION (root 20:01Z):** 「四红项全绿」标题不实，更正为：a5ie 合并树复跑=**24/30**。RED-A/S3/E1=翻转型计数钉（修复证明）；**T5=生产 provider/feed 装配缺 + 生产 team-tool-plane.mjs:365-367 挂载行未传 backends = 当前交付缺口**，各 kit 显式注 fixture / read 分腿 ≠ 实际用户入口。真实装配归 GLUE-7（生产胶水单 writer）；验收=严格发布清单新目录+正常 Team 创建入口下真实 member read/search/shell 成功、deny 负控 backend0/副作用0、非team Δ=[]；mock 仅替 LLM。


- **分支/树**：`alpha5-int-a5b`，base=真 master `fe829038`（fetch 亲验），一次性 worktree `.worktrees/a5-int-a5b`。
  **不改任何原分支、不动 master**；本支留父/root 代推（本会话无 push 凭据，未尝试）。
- **合并序（--no-ff，逐笔合并提交在册）**：
  1. `origin/alpha5-glue6-fix@a85f1fee` → merge `f94e8168`（唯一冲突=router-log 相邻条目并集；p4t6 自动合入且 1168→1169 即终，首并无需 re-tie）
  2. `origin/alpha5-pb-binding-feed@2ac05670` → merge `79268a1e`（冲突=router-log 并集 + p4t6 五 hunk：命名并集+总和并集+按名在册并集；**链真实 re-tie**：glue6 保 `1169-1168`，pbr2 改钉 `1170-1169` 并写 int tie 注，标题同链改写）
  3. `origin/alpha5-g1-denyfix@10460fe1` → merge `084e6757`（冲突=router-log 并集 + p4t6 同形五 hunk；**g1 re-tie `1171-1170`** + int tie 注；`team-tool-plane.mjs` src+dist **自动合入**，亲验 GLUE-6 render 块与 G1 `nativeOf` 块共存互不遮蔽：render=`ContentBlock[]` 投影在 `:88-127`，`nativeOf` 单点映射在 `:200`、两快速路径全走原生命名空间 `:233/:249`）
  4. 构建注记空笔 `762a86f8`（drift 门以 HEAD 为题，commit 自带构建）。
- **dist 镜像整树重生成**：`pnpm -r build` EXIT=0（node_modules 用 workspace 内 store `.pnpm-store-wt`）→ `git status --porcelain` **0 差异**（committed 面=真 build 产物）→ `pnpm check:artifacts:head` **verdict=ok compared=1732 drift=0** @ `762a86f8`。

## 与 master@28d31f2a（#315 G1 squash）的内容等价证明（parent 指令）

**#315 已经由 PR squash 落地 master `28d31f2a`；本支的 merge ③ 腿为内容等价证明**：
- `packages/runtime/test/alpha5-g1-deny-lane.test.ts`：**sha256 逐字节同** master。
- `packages/runtime/src/plugin/live/team-tool-plane.mjs`：G1 `nativeOf` 块与 master **逐字节同**；
  本支多出的 37 行全部 = GLUE-6 render-contract 块（#313 内容，master 未含）。
- `dev/agent-workflow/evidence/alpha5/glue6/g1/**`：与 master 无 diff。
- `dist` 镜像 plane 行 sha 本支 `480597aa…` vs master `bc5d19f3…`：差 = GLUE-6 render 镜像（本支=master 面 ∪ GLUE-6 面）。
- 本支相对 master 的完整 delta（`git diff origin/master..HEAD`，88 文件）= #313+#314 内容 + p4t6 链 re-tie + 证据/日志，无其它。

## 严格安装面复跑（按 INSTALL-ENTRY README 判据；世界 `a5int-*`，宿主 pristine 0.2.0-rc.2 @ 639ed01539 porcelain 0 前后）

kit 复制件 = `a5int-g6-install-kit.mjs` / `a5int-pb-kit.mjs` / `g1/a5int-g1-deny-kit.mjs` / `a5int-ie-install-kit.mjs`
+ 行件，`sed` 纯前缀改名（`diff <(sed … 原件) 复制件` 空 = **判据字节零改**）+ `int-a5b/package.json` 身份哨兵
（复制件缺哨兵致首抓 gatered boot 拒组 = 仪器自身缺陷，iter-1 存证 `runs/ITERATION-1-kit-copy-missing-sentinel/`，
哨兵语义与 install-entry/g1 哨兵逐字同）。

1. **RED-A 严格面 boot GREEN（GLUE-6 修后）**= `runs/green-2026-10-17T19-25-15Z` **15/15**：严格面（`files:["dist"]` 展开）**1730 文件、in-face resolver+seam=true**、依赖闭包 BFS 54 包、load graph 1636 模块 foreign=0 errors=[]、boot marker + observer `applied:true`。
2. **render 契约两 result 合法 block**= 同跑 L1/L2：live `team_bash`+`team_grep` 两 result 均 `wireType=array blockTypes=[text]`，全文无 `content.some`；L3 端到端 member final 带回 `verdicts=template-deny-lane,IO_POLICY_UNSUPPORTED`。
3. **binding-feed read 正控真执行（TOKEN 回传）**= `runs/2026-10-17T19-25-53Z` **22+3=25/25**：同一 `read` 无 feed 逐字原文拒（double Body 恒 0）；placed+realm 配对+feed 验证 bind（`team-trusted-extension`）后**真执行，夹具字节+`TOKEN-SEEN A5PBR2TOK-…` 经真宿主结果组装合法回传**；drift 拒/移回不复活/显式 re-bind 复跑/跨 realm typed 拒全绿。
4. **search/shell 正常执行正控（补计划项）**= `g1/runs/green-2026-10-17T19-26-03Z` **16/16**：
   - search 成功臂（生产 dist 行经公开 `backends` seam 注 fixture backend）：`team_grep` 回 `A5G1_GREP_HIT`+`a5p5-meta`、execCount 1、fs sentinel 已写（K2）；
   - shell 成功臂：单元套件 `alpha5-g1-deny-lane.test.ts` SUCCESS ARM 腿（`bash · exit=0` 合法呈现 + execCount 1，双类，合并树上 solo 11/11 绿）；
   - **如实标：生产 live 面 backend 装配行仍缺**——生产 plane 行挂载不传 `backends`，默认 shut 效果面 ⇒ live 落点恒 `IO_POLICY_UNSUPPORTED`。seam 精确到：`team-tool-plane.mjs:365-367`（`searchBackend/shellBackend = input.backends? … ?? shut`）的**生产挂载行缺 `backends` 入参**（registered GLUE-4 follow-up，pb-CONTRACT §6）。未以 read 替代。
5. **G1 绿形（deny 先于 backend 零副作用）**= 同跑 K1：`code=template-deny-lane` 且 execCount 0、sentinel 不存在、无 backend marker；K4 default-deny 先于 shut backend；K5 11 向量 **Δ=[]**（4 翻转/7 恒等）；live 轴 a5int-g6 G1 腿 `denyLaneSeen=true`、install-entry 复跑 T6 由红转绿。
6. **非 team standard/minimal Δ=[]**= a5ie 复跑 `runs/2026-10-17T19-36-06Z`：`Z-standard`/`Z-minimal` **PASS**（registryΔ=[] ∧ wireΔ=[] ∧ 零 `team_` 别名），T10 对照之对照 PASS。

## INSTALL-ENTRY 全量 30 判据在合并树上的逐腿口径（`runs/a5ie-rerun-console.log`）

**24/30；6 FAIL 逐条定性，零新红**：
- `RED-A` **翻转型**：判据文本钉"严格面必须 boot 失败"；合并树实测 `failLine=NONE(sees bootstrap)` = **RED-A 已被修复**（正形由 a5int-g6 15/15 承载）。
- `S3` **翻转型**：判据钉"render 返回 String 必崩"；合并树 render=ContentBlock[] ⇒ 探针不成立 = **缺口已闭合**（正形=L1/L2 合法块）。
- `E1` **计数钉移动**：aux 展开 `files=1734`（=1730+2 sibling+2 skills；预修面 1732 的算术已过时）。面内容逐项在册（a5p5=44、glue 全 true、sibling 全 true），E2/E3/E4 全绿。
- `T5` **残留缺口（与 recorded run 同因，未修不声称）**：生产面 `read` 仍 `BINDING_UNVERIFIED`——**provider 侧 feed 装配行仍缺**（pbr2 已备 `bindingFeed/realmId` 入参，生产 glue 尚未把放置记录喂入；§6 正控由 a5int-pb 25/25 在行级承载）。
- `T7` **形状移动（非回归）**：kit 的 member 脚本调 `team_grep` 缺 `output_mode` → 现在 `refused-schema missing-field` **先于** backend 落点（g1 轮 README §8 披露过的同类 kit 脚本过时）；链走到 schema 门=更靠前一道门。search 成功臂真证据=a5int-g1 K2 + SUCCESS ARM 套件。
- `T8` 派生红（引用行依赖 T5/T7 旧形状；`backToLeader=true` 且 bash=template-deny-lane 已在 final 内）。
- 全绿关键腿：T1-T4/T9/T10（真委托+ledger+零挂载）、S1/S1b/S2、N3/N4/N4b（负控仍红一验）、C1/C2。

## 门

- **root vitest 全树双抓**：`runs/census-capture-1/2.log` 恒等 **565 files / 7112 legs**（=基线 562/7086 +3 文件/+26 腿 = 三个并入套件 5+10+11 全绿）；红 **9 条与已发布基线身份集逐名同**（p6t3-mediation×5、p6t3-restart×2、p6t6×1、t2×1；`diff f1.txt f2.txt` 空），**新增红 0**。
- **p4t6 台账链（int tie）**：`1166 →1168 (GLUE-5) →1169 (GLUE-6) →1170 (binding-feed) →1171 (G1)`；tie 条款逐段在册并带 int tie 注；scanner 直读 `filesScanned=1171 files=1171 quarantineHits=15`，套件 10/10 绿。
- `check:artifacts:head` drift=0 @ HEAD；构建后工作树 0 差异。
- **收口三件套**：世界 `a5int-*`/`a5g*` 全 swept（kit teardown + `tests/homes/` 扫净）；`:3080` 仅只读探针前后 401→401 从未 POST；test-use `639ed01539` porcelain 0 前后；端口 3183/3184/3185 族自证 free→用→free，未触他支、未 push。

模型：qwen3.8-flash-next。
