# u7r3 — read_image (M-05) 离线 PoC：五问裁决与路线

日期（real UTC，`date -u` 写时取值）：**2026-10-30T12:22Z**
分支/基线：`task/u7r3-readimage-poc-20261030` @ `1d884efdb8839b0d6efedd969793c8ca3ef15c5b`（= origin/master tip，worktree `.worktrees/u7r3-readimage`）
执行 seat 披露：**qwen3.8-flash-next**（非 participant；本轮零 boot、零 pool、零 :3080/~/.dsh 触碰、零宿主改动）
先例结构 = `dev/agent-workflow/evidence/u7r3-wfpoc-20261031/POC-REPORT.md`（问题→裁决→证据 file:line→决定性提问定路线）。

## 锚点表（可复现性）

| 锚 | 值 |
| --- | --- |
| 产品树（P: 前缀） | 本分支 @ `1d884efd…`（porcelain 仅增 `dev/agent-workflow/evidence/u7r3-readimage-20261030/**`） |
| Host 树（H: 前缀） | `/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use`（主工作树副本）detached @ `639ed015397290b3745d163aafe02ffee4aa3f84`，porcelain 空；pin 唯一来源 `P:tests/paths.mjs:71`（`TEST_USE_BASELINE_SHA`，0.2.0-rc.2） |
| 单测复跑 | `packages/runtime` 下 `vitest run test/u7-9a-fs-mutation-c1.test.ts -t "read_image"` → **13 passed / 24 skipped, exit 0**（transcript：`probe-u7-9a-image-c1-transcript.txt`，12:20:14Z） |
| ask-lane scratch 探针 | 同目录 vitest 运行 → **4 passed**（transcript：`probe-askleg-transcript.txt`，12:22:52Z；scratch 源码存档 `probe-askleg.scratch.test.ts.txt`，运行副本已删） |

引用行号由 `probe-citations.mjs` 逐条机械核验，输出 `probe-citations-output.txt`。

---

## Q1 — Host 原生注册（公开面）：**PASS（静态亲读）**

pinned host 的**公开工具面确实注册 `read_image`**，且注册是**条件式**的：

- H:`packages/fs/tool-fs/src/index.ts:22` `inject = ['tools','fs','systemPrompt']`；**:70-71** `ctx.inject(['attachments'], (imageCtx) => { applyReadImageTool(imageCtx) })` — attachments 在场才注册，execute 体内另有防御性复查（:69 注释；H:`read-image.ts:251-254` `no attachment service is mounted`）。
- 注册名与 schema：H:`packages/fs/tool-fs/src/read-image.ts:210` `name: 'read_image'`；:213-215 公开参数仅 `{file_path}`；:225 `render: imageReadContent`。
- 挂载位置（standalone/host-plane）：H:`packages/bundle/base/cordis.patch.yml:138-139` 挂 `attachment-local`（host plane），:281-282 挂 `tool-fs` → 纯 host 会话 = 原生 read_image 在场。
- web-app 组合：H:`packages/bundle/web-app/cordis.patch.yml:469-470` `- id: tool-fs` + `disabled: true`（关 host-plane 那份）；preset realm 再挂：standard `:26-27`、ptc `:26-27`、cordis `:29-32`；**minimal preset 无 tool-fs** → 该 preset 下 read_image 缺席。
- 官方目录佐证：H:`docs/tool-catalog.md:31`（`dsh-tool-fs` 行含 read_image + `ctx.attachments (image-tool registration)` 注入）与 `:1012` 条目（`{file_path}` schema、"Large images are downscaled automatically"）。

**standalone vs Team-mode 平面组合的区分**：以上是 host bundle/preset 层的注册事实（独立会话即在场）；Team 模式里我方平面**另组装同名治理行**（U7-9a，见 Q2）——原生注册与 plane 行是两个不同层的注册，二者相遇的行为见 Q2。

## Q2 — 平面组合对未挂载/同名名的处理：**PASS（静态亲读；boot 级遮蔽行为另立 boot 探针）**

我方组合（`packages/runtime` assembly + kits + `packages/tools/families/*.mjs`）对工具名有三条已引类型的路：

1. **保留名拒绝（deny，typed）**：`P:packages/runtime/src/plugin/live/team-tool-plane.mjs:296-301` `PLANE_RESERVED_NATIVE` 穷举钉住含 `'read_image'`（:300）；未经同义装配认领的保留名行 → **:407** typed 拒绝 `PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED`（:224-236 法文：Gate-0b）。
2. **同义接管（takeover ledger）**：:371-378 `PLANE_SUPPORTED_NATIVE_TAKEOVERS.read_image = ['read_image']`（U7-9a CA-01 固定原生拼写接管，jobs 先例）；装配方 `P:packages/tools/families/fs.mjs:50-51` `enabled: (cap) => hasRoot(cap)`、`claims: [readName,'write','edit','read_image']`，四行**全有或全无**（:136 `PLANE_FS_FAMILY_INCOMPLETE` fail-closed）。`disabledOwned` 语义（`P:packages/runtime/src/plugin/live/family-assembly.mjs:23-26,57`）：族被禁时名仍归内核（NULL 行门拒），**不回落原生**。
3. **放置 = agent 层注册**：`P:team-tool-plane.mjs:2048,2052` `mount(agentCtx)` → `agentCtx.tools.register(def)`；冲突即 `PLANE_PLACEMENT_CONFLICT` 回滚 fail-closed（unknown attribution fails closed；:1930 `ownNames`/placement 喂给 :2841-2843 placement-feed）。

**passthrough 可推性（离线推断，非 boot 亲验）**：pinned host 的分层法 H:`packages/core/tools/src/index.ts:1202-1207` "The scope's own registrations last, shadowing an inherited name" + :747 同 scope 重名抛错（"register through that agent's `agent.ctx`"）。治理世界（有 fsInstance → 族启用）中 plane 行落 **agent 自己的层** → 遮蔽继承来的原生 read_image；preset realm/host plane 的原生行落在**更远的层** → 不同 scope 不撞名。无治理平面（无 `permissionPolicy`/无 `teamToolPlane` 配置 = 零 delta：`P:agent-bindings.mjs:2648`；或无 fs root → 族不启用）时，原生 read_image 照 host 注册原样在场 = **passthrough-capable**。rc2 kit 实测佐证原生面可达会话：`P:tests/kits/rc2-real-host-smoke/rc2-real-host-smoke.mjs:155` `MANAGED_TOOL_NAMES` 含 `'read_image'`（managed 名不进 deny），kit 头注 :82-84 记录本 kit boot 实测 `HOST_GLOBALS` 含 `read_image`；kit 冒烟 preset 亦挂 tool-fs（:739）。boot 级"同名对最终呈现 shadow 还是 placement-conflict"是运行时事实 → `future-boot-probe-sketch.md` 腿 B（两分支皆 fail-closed，无开放风险面）。

## Q3 — 附件存储公开面：**PASS（无 CORE_SEAM_BLOCKER）**

目标合同两笔写都有**公开** host 接口（无私有绕行需求）：

- **S(attachment-store, create, write)**：`ctx.attachments` = H:`packages/attachment/attachment/src/index.ts:48-49` `declare module Context { attachments: AttachmentStore }`；:53 `abstract class AttachmentStore extends Service`；公开方法 `imageLimits :59`、`validateImage :67`、`saveImages :98`、`admitPromptContent :114`、`saveImage :158`、`readImage :167`、`imageHostPath :175`、`saveFile :188`、`saveFileStream :203`、`readFileStream :219`；公开读取路径 `ctx.get('attachments')`。seam 文档：H:`docs/subsystems/attachment.md`（producer→durable content-addressed ref；session events 携带引用不携字节；`ctx.fileUploads` 绑定浏览器传输）。
- **S(session, attach-vision, write)** = 工具结果里的 `{type:'image', attachment}` ContentBlock（persist-before-event 法：H:`read-image.ts:269-270` 注释），row 的 render 镜像同一形态：`P:packages/tools/fs-family/src/image-row.mjs:78`（两区块 render：文本信封 + 附件引用块，**从不内联 base64**）。
- 我方行消费的正是这条 seam（零私有面）：`P:packages/tools/families/fs.mjs:76` `attachmentsProvider = () => cap.hostService('attachments')` → `P:team-tool-plane.mjs:1601-1604` `hostService = (name) => hostServices.ctx?.get(name)`（mount 时 `ctx = agentCtx`）。

结论：Q3 不存在 CORE_SEAM_BLOCKER——公开 seam 已存在、已文档化、且已被消费。

## Q4 — caps 可执行性：**bytes=PASS（平面内预解码强制）；pixels=store-seam 强制（诚实披露）**

- **bytes cap（平面内，预解码）**：executor 以 `byteCap = min(store.imageLimits.maxImageBytes, maxMessageImageBytes)` 先于读取传给端口（`P:packages/tools/fs-family/src/image-executor.mjs:152`），端口同 fd 计读 `maxBytes+1`（`P:image-read-port.mjs:88,92`），超 cap **整拒不截断**（:223-227 `refused whole, never truncated or stored`；实测腿 I-6 @`P:packages/runtime/test/u7-9a-fs-mutation-c1.test.ts:763`）。读取本体是锚定+`O_NOFOLLOW`+fd 复查的有界端口（image-read-port.mjs 全文件）。
- **pixels/dimensions cap（store-seam）**：我方产品树**无任何图像解码依赖**（`packages/*/package.json` 无 sharp/pngjs/jimp/image-size；lockfile 中 sharp 仅经 host 发布包 `@deepseek-ai/dsh-attachment-local@0.2.0-rc.2` 传入，H:`packages/attachment/attachment-local/package.json:31`）。故像素/尺寸法**无法在平面侧测量**——它由 store 在 `saveImage` 解码时执法（host 原生同构：H:`read-image.ts:273` commit 处映射 `IMAGE_DIMENSION_TOO_LARGE :279` / `IMAGE_TOO_MANY_PIXELS :285` / `IMAGE_TOO_LARGE :291`），我方 executor 把这些 store 法码 typed 透传（`P:image-executor.mjs:246-253`；实测腿 I-7 :772）。诚实句式：**平面执法 = 字节 cap（预解码、整拒）+ store 尺寸法的 typed 映射；平面自测像素需要新依赖，属设计选择而非 seam 阻塞。** 目标合同"容量检查在读取时落实"由字节 cap 满足，像素法与原生同栖 store（B-IMAGE §C2"超cap拒"两臂都有执法点）。

## Q5 — C1 条件不可用臂：**PASS（今日纯平面侧已实现 + 已单测）**

"缺 store → typed 条件不可用，**不豁免**"已实现：`P:image-executor.mjs:127-130` → `refused('admission','attachment-service-unmounted', … 'no attachment service is mounted')`（与原生 :253 句面对齐；行仍挂载、调用落到行上被拒，非绕行、非伪装原生成功）。实测（本轮复跑，13/13）：I-1 门序（:698，扩展名→store→route→媒体，全纯零 I/O）、I-2b 缺 store 句面、I-10（:805）mount 拆除后同样拒绝、零 commit；transcript 内实时行 `governed-image pre-gate-refused code=attachment-service-unmounted`。

---

## 决定性提问与路线（本轮真正买到的东西）

**决定路线的唯一提问：治理 read_image 的正腿（批准→读文件→附件 commit）在今天的封闭 admission 语法下可达吗？**

**答：可达——经 ask 通道；default-deny 模板下结构性不可达（typed 拒绝）。** 证据（scratch ask-lane 探针，真 kernel + 真 plane 装配 + C1 控制腿，4/4）：

- **A-1 / A-3（default:'ask'）**：`admission-requires-approval` → 一枚 ApprovalCase（`rung=leader`，effect-set 指纹同值）法律上覆盖全部三臂（tool-invoke(read_image) + read(file) + domain-ref('attachment-store')）→ 批准腿经 `issueApprovedGrant` 落授 → `governed-image RAN bytes=16`，**store.saved=1**（一次 commit）。
- **A-2（ask + 拒批）**：`APPROVAL_DENIED` typed 拒绝，**store.saved=0**。
- **A-4（default:'deny' + 具名 ask 规则）**：`IO_POLICY_UNSUPPORTED … no rule covers this effect (domain-ref)`——default-deny 下未具名效应不开 ask（I-12 @:824 的同一拒绝，本轮独立复现）；零 commit。

语法事实底座：`EFFECT_KINDS` 闭集含 `domain-ref`（`P:packages/domain/tool-governance/src/effects.ts:43`），但规则投影 `RESOURCE_EFFECT_KINDS`（`P:packages/runtime/tool-admission/admission-kernel.ts:703-707`）从不产出 domain-ref 条目 → **静态 allow 规则在语法上永远无法命名该臂**（永久形：Domain Authority 在 commit 处裁决）；而 expansion 平面 no-match = `no-authority`（`P:packages/domain/authority-envelope/src/authority-envelope.ts:494-508`；A1-4 "absence of authority 正是 Ask 要回答的"）→ default-ask 模板下该臂入 `needsApproval`（`P:packages/runtime/tool-admission/approval-case.ts:179` 起），approval 平面 narrowing 对无规则 = 恒等（planes.ts:158-177）。**含义：治理 read_image 不需要任何 core 改动即可开正腿（ask/批准通道）；default-deny 蓝图下它正确地不可达。**

**路线裁决（非 blocker）：**
- `read_image` 现状 = **WIRED-NOT-ACCEPTED**：U7-9a 同名治理接管已在 master tip 装配 + 13 腿单测绿 + 本轮 ask-lane 探针绿；Q3 无 seam 阻塞、Q4 有执法点、Q5 已实现。
- **首条可开腿 = C2 boot 验收**（开一次真 boot：真 Host attachment store（sharp 解码）+ 真 Control bridge（非 C1 stand-in，见 A5 `a5-m1-control-legs.mjs` 披露）+ 具 ask 规则/ask-default 模板 + image-modality 模型；断言：真实 store 恰一次 commit、原生遮蔽（腿 B）、批准前零字节读取、C2 拒批零写零 commit）。
- 若蓝图全为 deny-default：M-05 正腿按语法**正确地不可达**，矩阵适用性应写"deny-default 下结构性不可达（I-12/A-4 钉死），可达性 = ask 模板配置决策（中心/蓝图层）"。

## 本轮不改动/不裁决的真相

- 未 boot、未触碰 :3080 与 ~/.dsh、未改 host 树（porcelain 全程空）、未改矩阵/计划文件（上方"建议矩阵行措辞"仅为措辞建议）。
- 不裁决蓝图模板 default 该是什么（中心/蓝图决策）；不裁决像素法是否值得引入平面解码依赖（设计决策）。
- boot 级遮蔽/placement 呈现、真 store 解码链、真 Control bridge 全链 = NOT_VERIFIED（无 boot），已在 sketch 命名探针。
- 当前计划无调度中心：本 lane 不自开腿，只定义首条可开腿。

## 建议矩阵行措辞（M-05；仅供协调者裁量，未改矩阵）

③ Host 原生注册：`PASS(静态@639ed01539)` host 条件注册 read_image（tool-fs `ctx.inject(['attachments'])` index.ts:70-71；base:138/281 host-plane；web-app:469 disabled + presets standard:26/ptc:26/cordis:29 realm；minimal 无）。
② 平面挂载：`已装填(master tip)` U7-9a 同名治理接管（reserved :300 + ledger :378 + family claims fs.mjs:51 四行全有全无）。
⑥ PoC：`离线PoC + 单测13/13 @1d884efd + ask腿4/4`（本目录）。
适用性 = `正腿经 ask 通道可达（leader rung，一枚 ApprovalCase 覆盖三臂）；default-deny 下结构性不可达（I-12/A-4）；无 CORE_SEAM_BLOCKER（seam 公开：ctx.attachments + image ContentBlock）；caps：bytes 平面预解码整拒 + pixels store 解码法 typed 透传`。
首条可开腿 = `C2 boot 验收腿`（真 store + 真 Control bridge + ask 模板 + image-modality 模型；含腿 B 原生遮蔽呈现）。

## 本目录文件

| 文件 | 内容 |
| --- | --- |
| POC-REPORT.md | 本文件 |
| future-boot-probe-sketch.md | 腿 A（C2 正腿全链）/ 腿 B（遮蔽呈现）的 exact env + asserts（未来 C-pool 若需 live 证明） |
| probe-citations.mjs / probe-citations-output.txt | 全部 H:/P: 引用行号机械核验（本目录运行） |
| probe-u7-9a-image-c1-transcript.txt | 复跑 `u7-9a-fs-mutation-c1.test.ts -t read_image`：13 passed/24 skipped exit 0 |
| probe-askleg-transcript.txt / probe-askleg.scratch.test.ts.txt | ask-lane 决定性探针 4/4 transcript + scratch 源码存档（live 副本已删，非 committed test） |
| README.md | 索引 + 复现命令 |
