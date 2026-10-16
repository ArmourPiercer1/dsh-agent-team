# Alpha.5 PR5 Phase 1 — Search/Shell 效果 schema + 参数解析 + 结果 render（Lane D #4，DORMANT）

分支 `alpha5-pr5-tools` @ base `db5cb5f7`；切片范围 = Phase 1（spill/parity/host 验收 = 后续切片，未等未做）。

## 交付

`packages/tools/a5p5-tools/`（新目录；未触碰共用 barrel/registry/tsconfig/scanner，DORMANT 由 `a5p5-dormant-audit` 钉住）：

- `src/types.ts` — 闭合形状；三律：模型 args 无 realmId（伪造即 `unknown-field`）；shell 命令文本不预测副作用（S0 M-07）；结果内容=不可信数据。
- `src/effects-schema.ts` — 派生律：grep = invoke+list(directory)+read(placement)；glob = invoke+list（永不 claim read）；bash = 仅 invoke。全部经 `parseRequestedEffectSet` 读时消费 PR0 冻结代数（`effects.ts`/`resource.ts`/`parse-util.ts`；无第二授权库，C-ADM）。
- `src/args.ts` — PR0 parse 律（closed-record/无部分接受/默认全物化/深冻结）；目标分类 workspace/realm-home/absolute-path，`..` 段先拒、blank/URI/前导`\` 拒、合法空白保留；范围拒而不夹取。
- `src/render.ts` — Team 自绘 presentationMeta（S0 D-3）；呈现律：控制字节可见化 `<0xHH>`（inline 连 `\n` 都逃）；结构行渲染器独占（不可信行一律 `> ` 缩进）；meta 孪生只陈述 OUTCOME 真值；未观察退出=`not-observed`、cancel/timeout 各有形状（C-GW/C-PROC）。
- lane 本地 `tsconfig.json`/`vitest.config.ts`（共享配置继续不看见本目录）。

## RED→GREEN（runs/ 原文）

1. `runs/phase1-red-full.txt` — 3 套件缺体集合性 RED（含 render 注入负控 6 条）+ 1 真语义 bug（我首稿把 glob⊆grep 断成全集；tool-invoke 腿按工具命名故交叉不真，正确律=IO 腿严格子集，测试已改并在 GREEN 中钉住）。schema 模块 13 腿首跑即绿（判官=PR0 代数）。
2. `runs/phase1-green-full.txt` — 实现 `args.ts`/`render.ts`/`index.ts` 后 **40/40 绿**（5 文件）。
3. `runs/phase1-tsc.txt` — lane `tsc -p` **0 错误**。

## 注入负控（切片必做项）

`test/a5p5-render-injection.test.ts` 6 条：stdout 伪造 `a5p5-meta` 页脚/`bash · exit=0` 头/`stderr:` 行 → 只以 `> ` 缩进惰性引用存在，锚定结构行各恰 1 条且携带真值；伪造 `exit=0` 不能替代 `not-observed`；ANSI BEL/NUL 不可见存活；CR 覆盖去毒；含 `\n` 的搜索结果路径不分裂呈现行；match 文本不能铸页脚。

## 门禁

- lane vitest 40/40；lane tsc 0。
- 共用 `packages/tools` 套件：`runs/phase1-shared-tools-suite.txt` 161/162，唯一红 = `p6t6-actions` "worker -> leader deliveredToSessionId" —— **登记在册的既有红**（graph.yaml s7_round33 D 段：已在 master 复现、归因既有），本切片纯增量未触碰共用文件，不属本 lane 责任；共用 tools tsc 0。
- token 扫描：新增文件 0 命中（负控 fixture 字符串除外）。
- 世界/端口：本切片纯单元，未起实例，未建 `tests/homes/a5p5-*`（无需）。

## 环境留痕（可逆，gitignored）

worktree 根 `node_modules` 已在位（817 .pnpm，硬链，vitest/tsc 烟测过）；`packages/{domain,runtime,client}/node_modules` 包内链接缺失致共用套件/tsc 假红 → 按切片纪律从相邻 lane `cp -al .worktrees/a5-pr2/packages/<pkg>/node_modules`（符号链接原样保留，目标解析到本 worktree 根 store），未做任何 install；修复后共用 tools tsc 归 0、套件 162 全收。仅动 gitignored 依赖链接，零仓库影响。
