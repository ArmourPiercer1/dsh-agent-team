# g6b-flake 返工轮（#337 根裁=阻断勿合，四处返工单）— 落地结果如实

**结论先行：本轮只落地 ③（公开面回归恢复）。①④ 尝试后回退，② 未交付。**
分支 HEAD 现为 `f07ac27b` 的正向叠加一笔；`f07ac27b` 本体未改。

## ③ 已落地（本轮唯一净变更）
`git diff origin/master` 曾把 `export const GLOB_MAX_STDERR_BYTES = 8 * 1024` 误改为非导出
（并新增了无外部消费者的 `GLOB_STDERR_DRAIN_MS`）。核 import 面：src/test/dist 三处 `GLOB_MAX_STDERR_BYTES`
引用全部在本模块内（:85 注释 / :195 定义 / :889 :927 使用），无外部 import 者，但**导出面是公开面**，
非意图变更 ⇒ 恢复 `export`。`GLOB_STDERR_DRAIN_MS` 确认无消费者 ⇒ 保持不导出。

## ① 未落地（drain 超时默认成功），失败经过全记
尝试形：消费 race 返回值——`drainClosed = await Promise.race([streamsEnded, timer→false])`，
`false ⇒ return failure('undetermined','walker-error', …)`（错误码表不扩：依据 = 本行冻结完成律
"a walk that ends quietly has an empty stderr; one that spoke is an ERROR leg"——流未收口无法证明"静默"，
故落既有 SPEECH 错误臂；此依据本轮**未及写入 README**，留给下一手）。同时把 `once('end')` 扩为
`on('end'|'error'|'close')` 并在出口 `off` + `clearTimeout`（④）。

两次失败：
1. 我在 **`.mjs`（纯 JS）** 里写了 TS 注解（`Promise<boolean>`、`ReturnType<typeof sleepTimer>`、
   `NodeJS.EventEmitter`、`exit as {…}`）⇒ transform PARSE 失败，三个套件整体载入失败
   （`Test Files 3 failed | 1 skipped`，75 腿全 skipped）。这是纯自伤。
2. 去掉全部注解后仍不绿：`Test Files 3 failed | 1 passed`，**32 腿红**，其中含 adversarial
   `A8 the race counters are the product`。我未能在剩余预算内定位（未拿到首个红的断言现场），
   ⇒ 按"宁缺勿坏"把 `glob-backend.mjs` **全量回退到 f07ac27b**（`git checkout --`），重验绿。

## ② 未交付（确定性注入五形）
写好了 `alpha5-g6b-drain-injection.test.ts`（`vi.mock('../sandbox-provider/index.js')` + 脚本化假 child，
五形：exited 先到/stderr 迟到、data 到而 end 永不到、end 先 exited 后、流 error/close 早收、drain 内收口），
但五形全部落到 `internal-error` ⇒ **我的假 child 不符合 provider 的真实 spawn 契约**，
因此它对竞态**不构成证据**。为不留下伪绿/伪红资产，该文件已删除，设计与该实测发现（假件形状不匹配、
真契约需先对齐 `spawnStreaming` 成功形状及其前置检查）记在此处。
"先对 f07ac27b 贴 RED 实录"因此**未完成**；表上仍只有真 rg 12 连与 300 次直调（均 0 静默）与 0/20 加压。

## 回退后复验
`alpha5-glob-backend` 50/50 · `alpha5-glue7-plane-backends` 12/12（合计 62/62）；dist 镜像已 place。
