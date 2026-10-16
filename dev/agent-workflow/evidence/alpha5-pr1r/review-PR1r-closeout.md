# review-PR1r-closeout.md — #257 合并后收口复核（reviewer ≠writer，qwen3.8-flash-next）

- 对象 = **master@`452a04c0`**（squash，单 parent `db5cb5f7`；tree 与 `d5890103`+`ad3bc5e6` 逐文件等值，仅差我上轮审查件——已核）。
- 本件回答父方两问（逐字），结论三值见末节。上一件 review-PR1r-fix.md 的 ①–⑨ 不重列。

## ① "我方是否因定义变更**触发**了已开始调用的 abort？"

**答：是（竞态情形下，触发属实）；分类正确不豁免该语义事实。**

- 事实链（全部 pinned 宿主源 @639ed01539 + 合并树代码行）：
  - lane 的 raise 无 body 状态门槛：`pending-calls.ts:148-157`——对一切 `state==='watched'` 记录 raise；`watched` 覆盖**门→result settled 边全程**（settle 仅发生于 `install.ts:746` 的 `tools/result`），Body 运行中记录仍是 `watched` ⇒ `tools/change` 落在 Body 运行期时，**lane 自己抬起了正被运行调用持有的信号**。
  - raise 能到达运行中 Body：`index.ts:1928 fuseToolSignals` 为动态融合（fusion 后才抬的 wrapper abort 同样触发融合信号），且 `:1576 exec.signal = signal`——Body 拿到的正是融合信号 ⇒ mid-body raise 与调用方取消**同一传播面**。
  - 我方**无法**在 raise 前区分"未开始/已开始"：`bodyInvoked` 在 `:1580`（`resolveExecution` 之后）才置位，属宿主内部态，公开面无读点、无 body-start 事件；`tools/change` 无参数（`:203-206`）。即"只取消未执行"在本 pin 的公开 seam 上**不可实现为硬门**——唯一能穿进末段的把手（信号）天然同时是运行中调用的取消把手。
- 实际门与其负控（已核，均在合并树/证据内）：目标性门 = `install.ts:967-971` 逐记录 `(scope,name,identity)` 复读探针（他人移动/邻名/不可读规则）——负控 = lane 测试隔离双腿 + `RW-ISOLATION-NEIGHBOUR-TOOL`；生效门 = 宿主 `:1572` 先于 `:1578` 的 before-dispatch 拒（未执行者 body=0，`RW-AFTER-DOOR-BODY-ZERO`）；竞态归置 = `ABORTED` 类 `dispatcher-call-terminated-after-body-start`（宿主注释 `:1560-1562`："Cancellation never abandons the body: a started promise reaches quiescence before its outcome becomes ABORTED"，值保留）——负控 = `RW-ABORT-INSIDE-BODY-IS-TERMINATION`（v1=1/code=ABORTED/cancelledBeforeBody=0）。**范围未擅自扩大**：非 drain 工具（teardown 测试+`RW-TEARDOWN-NO-LEAK`）、caller 信号转发不摘（`armWrapperSignal` + 宿主 `:1569` 重融合）。
- **最小缺口（须入 seam-record，当前记录未明说——本轮必改点 1）**：末段不仅缺"resolve 前的拒绝点"，还缺**"本调用 Body 已开始"的公开可观察性**；因缺它，(ii) 的取消在竞态中必然同时构成对运行中调用的取消请求（其后果受宿主既有终止语义约束：不弃约、值保留、事后 ABORTED）。候选修法（按优先）：
  1. 上游在 `:1580` 处发布 per-call `tools/pre-body`（或暴露 bodyInvoked 读点）⇒ lane 在 `onRegistryChange` 跳过已开始记录 = 严格 (ii)；
  2. 上游 resolution-pinned Definition（原 PoC-1 选项 2）⇒ 竞态整体消失；
  3. 用户裁决把 (ii) 明确为"取消=发起宿主既有取消请求，竞态落宿主终止类"⇒ 现实现即符合，但须以裁决文本记录，而非以分类文本隐含。
- 定性：**严格执行用户"仅取消未执行"语义 = 未达成（且公开 seam 不可达成）**；实现未借机扩大范围；记录缺一条明示。属"明确最小缺口与候选修法"分支，非新增 BLOCK 级机制缺陷。

## ② 静默通道的"实际门"与同步投递证据

- **装配期可证否**：能证的只有"订阅本身"——`on` 缺失/订阅抛错 ⇒ typed `IO_POLICY_UNSUPPORTED` 点名通道 + 已装四缝回滚（`install.ts` tools/change try/catch→`assemblyFailed`；证据：lane 测试②双腿、真 registry `RW-NO-CHANGE-CHANNEL-UNSUPPORTED`、glue 拒装配=不 publish）。**订阅成功但永不投递在装配期不可证**（如实披露，不许诺）。
- **运行期 alarm 后的实际降级（是真门，不是仅 alarm）**：同一 settled 边在发 `dispatcher-call-executed-unvalidated`（alarm）的同时**撤销该名字的验证**（`install.ts:755-770` verified=false），此后该名字每次调用被 Guard 以 `definition-drift` 拒绝、直至显式 re-bind（`RW-CHANGE-INERT-LOUD verifiedAfter=false` + 既有拒绝律）。即每颗"移动过的定义"在静默通道下**至多漏一个未验证 Body**，该 Body 被响亮上报、其名字随即封禁；通道保持 `armed`（不谎称 proven），下一颗调用重新自检。
- **正常 pinned host 同步投递证据（送达+生效原文）**：runner 用**真宿主 registry 进程内**（p00-fixture）。`runs/B3-after-door-GREEN.json` arm `guarded-after-body-zero`：`changeChannel:"proven"`；laneEvents 顺序 `dispatcher-surface-revalidated → dispatcher-change-abort-issued → … → dispatcher-result-observed`（事件在 `register()` 栈内同步送达、先于门释放生效）；`v1=0 v2=0 code=ABORTED_BEFORE_DISPATCH`（生效原文）；我上轮在 d5890103 独立复跑逐字节同形。
- **alarm≠fail-closed 口径确认**：`install.ts:763` alarm 原文 "…is not a closed world — it is one that has not been shown to be"；s12 (h) "disclosed, not covered over"；无任何文本把 alarm 或事后撤销说成该配置的 fail-closed 保障。确认无回潮。

## 结论三值

**需后续修复 PR（小而精确，不回退 master，不上报更大缺口）**：
1. **必改**：seam-record + s12 增补 ① 的最小缺口三条事实（abort 竞态可达运行中 Body / body-start 无公开观察点 / (ii) 与严格语义的残余差）+ "what upstream would have to provide" 增补 body-start 读点/事件候选；s12 (h) 的"closed by the ruled mechanism"措辞在同处限定为"未执行取消已达成，竞态披露"。
2. **待用户裁决（二选一）**：裁决澄清 (ii)=取消请求语义（现实现即合规），或保留严格语义并把候选修法 1 提 upstream seam request。
3. **可选加固（非必改）**：首颗 executed-unvalidated alarm ⇒ 通道级降级（如全名拒待 re-bind）；现名字级封顶已成立。

除上述记录/裁决项外，合并内容机制面维持 PASS 结论不回退。
