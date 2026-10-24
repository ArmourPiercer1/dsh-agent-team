# m2-web — M2-WEB-01 (Alpha.5 M2 首批, web 族) 证据目录

Owner: M2-WEB-01 (web 族唯一 owner)。目录为本卡独占。

## 内容

- `m2w-c1-runner.mjs` — C1 fixture runner（plain-node，p00/p09 runner 先例；非新测试平台）。
  两相十腿：N 相 = 生产 provider（`web-fetch-http`/`web-search-deepseek`，test-use 预构建 lib 直挂）
  fail-closed 负控；P 相 = 离线 provider 桩（seam 公开注册面 `ctx.web.registerFetchProvider/
  registerSearchProvider`，@639ed01539 `packages/web/web/src/index.ts:103/:114`）下的成功路径 +
  两层对象（搜索目标 ≠ 结果 URL）。
- `runs/<UTC>/` — 每次实跑的 `stdout.log`/`stderr.log`/`result.json`（含 typed 码原文、计数器、
  监听释放记录、边界披露）。

## 实跑命令

```bash
STAMP=$(date -u +%Y-%m-%dT%H-%M-%SZ)
RUNDIR="dev/agent-workflow/evidence/alpha5/m2-web/runs/$STAMP"; mkdir -p "$RUNDIR"
M2W_RUN_DIR="$RUNDIR" node dev/agent-workflow/evidence/alpha5/m2-web/m2w-c1-runner.mjs \
  > "$RUNDIR/stdout.log" 2> "$RUNDIR/stderr.log"; echo "RUNNER_EXIT=$?"
```

Exit：0=全腿过；1=断言失败；2=环境。幂等（finally 关监听 + 重写 result.json）。

## 已落定运行

- `runs/2026-10-23T06-59-48Z/` — **12/12 PASS，RUNNER_EXIT=0**（承重运行；含 P3/P4
  "未知顶层键不拒且照常执行"当前形态实证腿，BASE.C1 家族 cross-check，todo 先例）。
- `runs/2026-10-23T06-51-19Z/` — 10/10 PASS，RUNNER_EXIT=0（P3/P4 加入前的承重运行）。
- `runs/2026-10-23T06-50-21Z/`、`runs/2026-10-23T06-51-07Z/` — **首次真实失败原文保留**：
  P1 挂我的观测钩子（`net.Socket.prototype.connect` 钩未识别 undici 的数组形 apply-style 调用，
  `argTypes:"array"` → 误 destroy → `Error: fetch failed`），非生产代码缺陷；修复=钩子按数组展开解析。

## 生产 vs 测试替身（披露）

- **钉死生产代码**（test-use @`639ed01539`，porcelain 空，零写入）：`dsh-web` seam、`tool-web`
  （web_fetch/web_search schema+注册）、`web-fetch-http`（生产 fetch provider：policy/network）、
  `web-search-deepseek`（生产 search provider：credential fail-closed）。
- **Team 桩/夹具**：P 相 offline stub providers（经 seam 公开注册面注册、id `m2w-offline-stub`、
  seam 自身 selection config 钉定）、127.0.0.1:3187 合成页服务器、TCP/fetch 钩子。

## 零连接证据边界（根裁 2026-10-23 修订 2，原文照此执行）

- loopback 目标：fixture 服务端 access-log +0/+1 = **实证**。
- 非 loopback（`10.255.255.1`、结果 URL `m2w-result.invalid`）：断言 = **typed 拒绝（实测）+
  校验前置（静态：`policy.ts:31-36/47-52`、`network.ts` 字面 IP 无 DNS、验证先于连接）**；
  进程内 TCP connect 钩 + global-fetch tripwire 计数为**辅助观测**。**不写"外部零连接实证"**。
- 观测面限制：钩子在进程内；undici 内部 DNS（`systemLookup` 为 destructure import）不可钩；
  无 sandbox 级系统调用观测。不可解析目标不设腿（真实 DNS 查询本身=网络行为，外网无授权=ENV_BLOCK）。

## 端口/环境纪律

只绑 `127.0.0.1:3187`（避开 Host 腿固定端口 3183/3184；**:3080 永不触碰**）；proxy env 进程内剥离并
记录；`DEEPSEEK_API_KEY` 仅记录存在性后即进程内删除（挂载前），无真实凭据可外带。
机制性 side effect：`p00-fixture.ensureResolvable()` 在 worktree 根 gitignored
`node_modules/@deepseek-ai/` 建 5 个 junction（cordis/dsh-scope/dsh-system-prompt/dsh-tools/dsh-llm
→ test-use），为 alpha5-adapter-p0 家族既有机制。

## 共享件复用（零复制纪律）

ledger/tripwire/envHeader/stripProxyEnv/libUrl ← `../../alpha5-adapter-p0/09-web-jobs-mcp/p09-shared.mjs`；
makeFixture/tag ← `../../alpha5-adapter-p0/00-baseline/p00-fixture.mjs`（只读 import，正本唯一）。

## ENV_BLOCK（无授权，不跑；交 CENTER 排唯一 Host owner）

1. 真实外网 `web_fetch`（目的地认证）。
2. 真实 search provider（DeepSeek/Exa/Perplexity）端点认证。
3. web preset 真实 Host 装配复跑。
4. `*.invalid` 类真实 DNS 解析腿（DNS 查询=网络行为）。

## 后续（按根裁路线）

新功能必要测试进**正式测试系统**：C1 classify/manifest 腿（B-WEB effects 闭集
`tool-invoke/connect@network-destination/domain-ref`，`tool-governance/src/effects.ts:43`、
`resource.ts:72`）+ 伪造/未知目的地/不可解析 target typed 拒 = 正式位
`packages/runtime/test/a5m2w-web-c1.test.ts`（登记项已报 CENTER：census +1 文件、registered legs +N、
p4t6 exact-count pin +1）。P 层 provider 装配提案见 COORDINATION/交付消息（B-WEB：owner=CONNECTOR，
接真实已安装 Host provider；`interfaces.ts:196 ProviderGateway` 为 E 面）。本目录 runner 保持
fixture 级证据身份，不冒充生产接线验收。

## 批次 2（2026-10-23 07:2xZ 放行；根 07:18 纪律 = 正负控落装配后生产路径）

新增交付（全部 = 本卡独占路径，共享件未动）：

- `packages/runtime/web-gateway/src/{types,destination-envelope,index}.ts` — ProviderGateway
  web 臂实现（委托注入 seam `ctx.web.fetch/search`；目的地只从操作派生；N 臂
  `connect@canonicalLocator` 复核；D 臂 commit 点前读；字面 IP 带 = 传输前
  belt，比 provider 更严、零复制弱化）。
- `packages/runtime/src/plugin/live/web-gateway-assembly.mjs` — 生产装配行
  （GLUE-5 import 边；关闭键 `webEnabledRaw` 默认关、非布尔 typed 拒；缺依赖
  typed 拒；`deepSeekSearchOriginSource()` 镜像 provider 自身来源法
  `config ?? $DEEPSEEK_SEARCH_BASE_URL ?? 包常量`，动态 import 取常量，
  文件内零目的地常量）。
- `packages/runtime/test/a5m2w-web-gateway.test.ts` — 正式测试 **19 腿**
  （G-1..G-5 装配面 + W-1..W-14 网关律）；连同既有
  `a5m2w-web-c1.test.ts`（8 腿）= 27/27 PASS。
- dist 镜像（构建产物，非提交）：`packages/runtime/dist/packages/runtime/web-gateway/src/*`
  （tsc 探针 = 未来 include 一行 `"web-gateway"` 的字节等价输出，`tsc -p` rc=0，
  git 仅新增该目录）+ `dist/.../live/web-gateway-assembly.mjs` 字节拷贝
  （与 place-dist-glue 行为一致；PLACEMENTS 登记 = CENTER）。
- runner **PHASE G**（8 腿）：从 **dist 生产 import 边** 导入装配行，over 真实
  WebRuntime + 真实已安装 provider（deepseek-official/http，config 镜像
  cordis.patch.yml:472-490）。G1 默认关零计数；G2 非布尔/缺依赖 typed 拒；
  G3 belt 负控三层零计数（fetch 钩子/TCP 钩子/accessLog）；G4 真 provider
  policy 负控透传（WEB_BLOCKED_URL verbatim，复用非复制）；G5 未知顶层键
  信封/目的地/载荷三层 typed 拒；G6 冻结契约面无载荷不猜；G7 真搜索 provider
  链 WEB_PROVIDER_CREDENTIAL_MISSING 透传零计数；G8 allow 正控 = **装配真实 +
  端点桩**（披露：桩≠真实外网段）。load-bearing run =
  `runs/2026-10-23T07-26-08Z/`（20/20 EXIT=0）。
- 真 provider/外网正控段 = **ENV_BLOCK 明列**（phases.G.env_block：真外网
  allow-through、真 DEEPSEEK 凭据、真 Host web-preset 复跑），未用 fixture 顶替。

自查（07:2xZ）：`a5m2w-web-gateway + a5m2w-web-c1` 27/27；eslint 本卡全文件
rc=0；typecheck 本卡行 **0**（残留红全部 = 兄弟卡文件：
`a5m2-governed-write-row-c1.test.ts`×3、`../tools/a5p5-tools/src/write-slice.ts`×6）。

## 集中卡五组（根 07:38 批准；2026-10-23 08:0xZ 同轮交付；禁 C2/merge 遵守）

- **组3（主修）**：gateway 退化为封套/目的地校验 + 委派。批准事实（过期/单用/伪
  binding/定义核验/重放）全部移交注入的 `WebGrantAuthority`（formal/runner 用
  **披露的 recorder 桩**接电线，真实权威 = CENTER 的 M1 manifest+可信
  definition provider+唯一 consume 接线）。lane 只留一条确定性检查：
  `payloadFingerprint == canonicalJsonFingerprint(operation)`，**先于 consume**
  （拒不烧授权）。反例对照（dist 编译物实跑）：
  `group3-before-counterexample-2026-10-23.txt`（过期/复用/换payload/伪配对
  **4/4 ok:true，seam 真被打 4 次**）→ `group3-after-fix-2026-10-23.txt`
  （4/4 typed 拒 + 基线正控 ok:true；C3 零 consume）。脚本
  `group3-counterexample-{before,after}.mjs` 可复跑。
- **组4**：亲读 WebRuntime 选择面（web/src/index.ts:137-164：调用时
  resolveProvider；注册表/选定 id 均私有 ⇒ **无"当前实际 provider/config 版本"
  公开读面**，已点名交裁）。`deepSeekSearchOriginSource`（Team 侧 env 镜像）
  **已删**；`boundSearchOriginSource` 三读者全注入（Volatile config slot /
  launchEnvironment / 安装包常量），逐调用求值，零自读全局。
- **组5**：`callWeb(request, { signal })` 贯穿 seam→provider（A-4/G4 身份
  断言）；`close()` 真解除（G-6/G9：stale 句柄 typed 拒 `web-row-closed`，
  consume/传输全零，幂等）；`WEB_BLOCKED_URL/INVALID_URL` 映射改
  `sideEffectUnknown:true`（同码可在后跳拒，root 澄清不夸大 SSRF 遵守）；
  belt/指纹检查置于 consume 前（W-2/G3：拒时 consume +0）。
- **IPv4-mapped 索引修复**：`::ffff:a.b.c.d` 展开后首段在 groups[5]（原查
  groups[0] 永不命中）；W-2 矩阵 +2 条 mapped 拼法（127.0.0.1/10.x 均拒）。
- **typecheck 红（CENTER 转交的提交树 2×TS2352）**：本轮 `as unknown as` 单点
  收口（带为什么注释，a5b3-cancel-leg.test.ts:295 先例），**TYPECHECK_RC=0**
  （pipefail 真码，整包 0 错）；腿数语义不变（web-gateway 25 + web-c1 8 = 33）。
- bridge `28d020b1` 阻断知悉：涉 manifest 完整字段的期望一律"待中心定版"。
- 本轮无新 scannable 文件；p4t6 绿（CENTER booking 后）；audit rc=0（29
  consumers 含本卡 2）；load-bearing run `runs/2026-10-23T07-53-57Z/`（22/22）。
