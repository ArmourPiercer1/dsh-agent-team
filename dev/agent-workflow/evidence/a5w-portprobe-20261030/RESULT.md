# a5w-portprobe — 交付实录（dated 2026-10-30T22:28Z，真实 UTC）

分支 `task/a5w-portprobe-20261030`，base `origin/master` @ `3e7fd25e0ba32004f427a235c7691fdc4fdfec37`。
本文件是本 lane 的自足索引；改动面（`git show --stat`）：

```
tests/characterization/lib/util.mjs        | 98 ++++++++++++++---  ← 修复本体
tests/world-factory/port-probe.test.mjs    | (new) NC-1..NC-5
tests/world-factory/world-factory.test.mjs | 36 ++++--            ← band-saturation 前置条件（见 foreign-band-listeners.md）
tests/world-factory/README.md              | 11 ++++             ← NC 在册登记 + 两条本机端口实测事实
dev/agent-workflow/evidence/a5w-portprobe-20261030/               ← 本目录
```

## 1. 修复（一句话）

`portInUse(port, timeoutMs = 1500)`：connect 应答→TRUE、connect 报错→FALSE 两条不变；
**connect 超时不再判占用**，改由模块私有 `bindProbeInUse` 一次性 bind 探针裁决
（EADDRINUSE→TRUE，bind 成功→close→FALSE；其它 bind 错误或 bind 超时→fail-closed TRUE）。
导出签名与文件内其余导出逐字节不变。披露三条（残余窗口 / fail-closed / ms 级真绑定）在函数头注释里。

## 2. 负控（新档 `tests/world-factory/port-probe.test.mjs`，跑法 = 仓库在册 `node --test`）

| leg | 断言 | 实录（22:27:49Z，post-fix-regression.log RUN B；单跑另见 22:2xZ） |
| --- | --- | --- |
| NC-1 | 真监听（进程内 bind）必须 IN USE，且走快路径 | `port=3491 inUse=true elapsed=2ms`（close 后同端口 `false`） |
| NC-2 | 确无监听的带内端口必须 FREE 且在 `timeoutMs+2s` 内出答案；黑洞形态下额外断言"等了整个 timeoutMs ⇒ 答案来自 bind 决胜" | `port=3492 shape=black-holed connect-census=clean portInUse=false elapsed=1504ms` + trail `3491:refused/ECONNREFUSED 3492:timed-out` |
| NC-3 | mock 带 acquire→release ×3：三个**不同**端口、readLease held→free、释放后可再租 | `NC-3 leased [3491,3492,3493]` |
| NC-4 | 无租约的外部 bind 仍须 `EXTERNAL_BIND`，且不留我方 claim；撤监听后同端口立刻可租 | `refused port=13080 as EXTERNAL_BIND`，`readLease→free` |
| NC-5 | connect 预算为 0 时两侧都必须答对，且空闲端口不得 fail-closed（钉住 bind 看门狗 `Math.max(timeoutMs,1000)` 下限） | `port=3494 listener: inUse=true elapsed=10ms \| closed: inUse=false elapsed=0ms` |

NC-2 的环境是**会翻脸的**：同一带内端口集，22:19 前后实测 59/60 黑洞，22:2x 某轮全部快速 RST
（该轮 NC-2 落 `rst-answering` 分支并如实打印）。因此 NC-2 的环境条件断言只在该轮真的黑洞时生效，
黑洞路径的确定性钉住由 **NC-5**（与环境无关）承担；两条都不放宽"必须 FREE"。

## 3. 回归（全绿）

| 套件 | 结果 |
| --- | --- |
| `node --test tests/world-factory/world-factory.test.mjs`（C1 45 leg，含 `DSH_U5_LEASE_PAUSE_*` 跨进程竞态） | **45/45 pass，EXIT=0**，110.8 s（22:25:58Z→22:27:49Z） |
| ↳ `port lease T1: cross-process race …` | ✔ 5047 ms（修复前该 leg 在 180 s spawnSync 超时上死） |
| ↳ `port bands: host leasing falls through …` | ✔ 99.2 s（见 foreign-band-listeners.md 的前置条件处置） |
| ↳ `port lease: exclusive …` / `port lease T1: token-guarded release` | ✔ 41.8 ms / ✔ 1505 ms |
| ↳ `C1 dry-run uses supervisor path …` | ✔ 4441 ms（修复前 EXTERNAL_BIND 于 3500） |
| `registries.test.mjs` | 12/12 pass |
| `binding-digests.test.mjs` | 14/14 pass |
| `u6-arc-d.test.mjs` | 8/8 pass |
| `port-probe.test.mjs`（本 lane 新增） | 5/5 pass |
| `npx vitest run packages/testkit/test/p4t6-session-event-scan.test.ts` | 20/20 pass（新档在 `tests/` 下 ⇒ 不在 p4t6 扫描域，无需 booking；`npx eslint` 亦以 "File ignored because of a matching ignore pattern" 自证 tests/ 不在 lint 域） |

修复前基线（同 base、同盒、未改代码）：`tests 45 / pass 40 / fail 5`，EXIT=1
（`pre-fix-world-factory-c1.log`，22:04:27Z→22:09:27Z）。

中间态一份保留不删：`post-fix-world-factory-c1.log`（22:11:10Z→22:12:36Z）= 只有 util.mjs 修好、
leg 前置条件未修时的 `44/45`，失败 leg 正是 `port … 13030 answers TCP with no live lease holder`；
它同时留下了 EXTERNAL_BIND 文案与实际成因不符的证据。

未跑（越权，如实报告）：`tests/characterization/run.mjs` 及任何 C2/C3 runner（`u5-canary-runner.mjs`、
`u5-parallel-supervisor.mjs`、`u7-0-census-runner.mjs`、`stub-runner.mjs`、`kits/**`）——它们引用同一个
`portInUse`，但都是真 boot harness，boot 归协调者；这些调用点只是 `portInUse` 的消费者，语义在修复后
只会更少误判（FALSE→TRUE 的方向未变，只有超时分支变了）。

## 4. 门

- **EF-05**：N/A —— 未触碰 MATRIX/BACKLOG/`dev/engineering/*`。新增可扫描文件为零（`tests/` 不在 p4t6 扫描域，RUN C 自证）。
- **EF-06**：注释与 README 里引用的路径均在本树存在：
  `dev/agent-workflow/evidence/a5w-portprobe-20261030/rca1-portprobe-verification.md`、
  同目录 `foreign-band-listeners.md`、`tests/world-factory/lib/port-lease.mjs`。
  RCA-1 正本不在 master（在 `task/a5w-bootwave-20261030` @ `48c06b353c`），两处引用都按"分支 + 本树复核件"写法给出，不留悬空路径。
- 禁项复核：未放宽任何断言、未删测试、未跑 boot、未调大任何超时数值（`timeoutMs` 默认 1500 原样保留；
  新加的 `Math.max(timeoutMs, 1000)` 是 bind 决胜腿的**下限**，不是把探测超时改大）。

## 5. 如实披露（协调者需要裁决/知悉的三条）

> 协调者裁定（22:36Z，收到于本 lane 报告之后）：(a) **保留** band-saturation 前提改写，不回转；
> (b) NC 落 `tests/world-factory/` + README C1 登记 = 正确落位；(c) 端口预热/黑洞记为机器事实入 RCA 素材；
> (d) 批准修 `EXTERNAL_BIND` 文案（本分支第二笔 commit，见 §6）。禁其他扩面。

1. **改了一条在册 leg 的前置条件**：`world-factory.test.mjs` 的 band-saturation leg 原假设"带内每个端口都归我"，
   本盒被 Windows 侧监听者（13030-13032）证伪。处置=把 `EXTERNAL_BIND` 记为 foreign 并计入
   `mine+foreign===段长` 断言 + diagnostic 打印；leg 的两条律一字未动；干净机器上行为与原来逐字节相同。
   这**不是**把测试改成迁就实现——是被实测环境事实逼出来的前置条件修正，理由与数据在 `foreign-band-listeners.md`。
   若协调者认为该 leg 应保持原样并记 ENV，请说一声，我按裁决改回。
2. **新档落点与简报建议不同**：建议的 `tests/characterization/` 下没有任何 `*.test.mjs`，其 runner 是
   `node tests/characterization/run.mjs`（真 boot harness，禁跑）。`node --test` 的在册落点是
   `tests/world-factory/`（port-lease 的在册测试都在那里），故新档为 `tests/world-factory/port-probe.test.mjs`，
   并已登记进该目录 README 的 C1 表。
3. **`EXTERNAL_BIND` 文案**：原句断言了一个探针并不总知道的形态（见 §6，已按协调者裁定在本分支第二笔
   commit 修掉）。

## 6. follow-up（协调者裁定 (d)，dated 2026-10-30T22:43Z）

`tests/world-factory/lib/port-lease.mjs` 的 `EXTERNAL_BIND` 原文案
`port N answers TCP with no live lease holder — refusing (foreign listener)`
断言了"有人应答"，而真实情形包含"无人应答（connect 不确定）+ bind 决胜腿证明占不到"——RCA-1 本身就是这一类。
改为不预判形态的诚实句，**代码名 `EXTERNAL_BIND` 不动**：

```
port N is not cleanly acquirable: no live lease holder and the probe cannot prove it free
(a listener answered the connect probe, or that probe was inconclusive and the bind tie-breaker could not bind it) — refusing
```

改前全仓 grep `answers TCP`：代码侧唯一命中就是这一行；其余命中全部在历史证据日志
（`evidence/u5-fixt-20261026/red/scratch/**`、本目录的 pre/post 日志）里，历史证据不追改。
消费方一律按 `error.code` 断言 —— `lease-race.mjs:152`、`world-factory.test.mjs:283/311`、
`port-probe.test.mjs` NC-4 —— **没有任何测试按措辞断言**，因此无测试需同步修改（commit 正文照实点名"零测试改动"）。
`acquirePortLease` 的 JSDoc 拒绝码清单同步改为两形态并注记"代码名先于 bind 决胜腿，保留"。

复跑实录（`post-wording-fix-verification.log`，22:41:02Z→22:43:02Z）：
`world-factory.test.mjs` **45/45 pass EXIT=0**（113.8 s）、`port-probe.test.mjs` **5/5 pass EXIT=0**；
NC-2 本轮仍是黑洞形态（`port=3492 shape=black-holed elapsed=1505ms`，verdict from the bind tie-breaker），
NC-4 仍按 code 拒绝。渲染后的实际文案以真实无租约监听者（13085）现场取证，见同一日志末尾。

## §7 E-1 清理披露（dated 2026-10-30T22:57Z，协调者执行，R504 独立复核意见）
R504 复核（PASS @462f2d8b4）发现本 lane 改动前红跑（C1 dryclm 腿在取得租约前死于旧探针误判）留下两个 DSH_HOME 残留 tests/homes/u5dryclm-20261030T21-59-11Z / ...T22-04-27Z 与 .artifacts/tmp/dryrun-leases-{zXHR6H,SM3FKk}（gitignored，含 .u5-created.json 无宿主日志，无 .u5-ownership.json）。修复后绿跑（45/45）该腿自清理。残留已于 2026-10-30T22:57Z 手工 rm -rf 清除，tests/homes 现空。E-2（world-factory.test.mjs 头注"ZERO ports bound"措辞过时）、E-3（不确定路径最坏时延 timeoutMs+max(timeoutMs,1000)≈3s，boot 预算按最坏值）、E-4（C1 与本 boot 波次串行律）登记为合并后跟进。
