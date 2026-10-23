# M2-READIMG-01 — C1/C2/C3 实跑记录（fixture 面）

- 文件: `packages/runtime/test/a5m2-readimg-c1.test.ts`（进根 vitest 正式收集系统：`vitest.config.ts` include `packages/*/test/**/*.test.ts` 既有覆盖，未动配置；census 身份按真实规则登记，不迁 evidence 躲登记）。
- 日期: 2026-10-23（UTC）。宿主 pin639 @`639ed01539`，测试前后 `git -C tests/deepseek-harness-test-use status --porcelain` 均 0 行（宿主树零写入）。
- 驱动面 = 生产注册面（tool-fs barrel 经 `ctx.inject(['attachments'])` 门，pin639 预构建 lib 只读）；世界 = `tests/homes/m2-readimg-<UTC-stamp>/`（§7 临时世界，afterAll 删除，此处登记路径模式）。

## 实跑与检查（stdout/rc 原件在同目录 runs/）

| 命令 | 结果 | 原件 |
|---|---|---|
| `pnpm exec vitest run packages/runtime/test/a5m2-readimg-c1.test.ts`（首跑，旧版 10 腿） | 2 failed/8 passed，rc=1（首次真实失败见下） | runs/2026-10-23T06-54*（stdout/rc） |
| 修复后重跑（11 腿） | 11 passed，rc=0，900ms | runs/2026-10-23T06-54-*/vitest-run.stdout+rc |
| `pnpm --filter @dsh-agent-team/runtime run typecheck` | rc=0（仅 `$ tsc -p tsconfig.json`） | runs/…/typecheck.stdout+rc（修复后） |
| `pnpm exec eslint packages/runtime/test/a5m2-readimg-c1.test.ts` | rc=0（零输出） | runs/…/eslint-focused.stdout+rc |
| `pnpm exec vitest run … --reporter=json`（最终 12 腿版） | **12 legs / 12 passed，rc=0** | runs/2026-10-23T07-02-58Z-focused/（stdout、rc、vitest-report.json、census-identities.txt） |
| census 双捕获（`node scripts/ci-pr-gate.mjs --only census --census-captures 2`） | 见下节 | 同目录 `census-two-captures-*.log` |

## 首次真实失败（原文保留，诚实法）

1. `expected 'Error: unknown tool "read_image"' to contain 'no attachment service is mounted'`（store mid-life dispose 臂）→ 生产真相：inject-作用域注册随 store dispose **整体退注册**；execute-time re-check 文本是 direct-caller 面，bundle 生产路线不可达。臂改为钉住生产真相并在测试内披露。
2. `expected 'Error: Unsupported or malformed image data.' to contain 'but the bytes use a different image format'` → rename/convert 臂需要"另一种真实图像"的字节（.jpg 披 PNG 字节已验证命中）；声明扩展名 + 不可解码字节走 **decoder 原文本**（`read-image.ts:274-275` 非 AttachmentError 直抛）——INVALID_IMAGE 映射只罩无扩展名嗅探路径。两臂分立保留（⑦入册）。

## 12 titled legs（census 登记名，全 [passed]）

正本 = `census-identities.txt`（file > full name 逐行）。计数 **N=12**：
C1×3（positive / no-store 条件不可用 / dispose-mid-life 条件不可用）、C2×6（attachment 回读字节恒等 / 扩展名非图零 IO 拒 / 扩展说谎 / 声明+不可解码 / route 非 image 零 IO / 字节帽 / 维度帽——计 7？以 census-identities.txt 12 行逐字为准：positive, nostore, disposed, fetch, ext, lie, malformed, route, bytecap, dimcap, cancel, cross-additional）、C3×1、cross-check×1。
（9 titled reds 容差集不动；本文件零新增红。）

## cross-check（parent 令：顶层 additionalProperties）

**宿主 read_image 顶层 parameters 不声明 `additionalProperties:false`**：
- 定义面：`read-image.ts:213-215` parameters 糖块无顶层 `additionalProperties`；发布 wire schema 原文同（`docs/tool-catalog.md:1012-1031`，pin639）。**与 todo 被抓的"顶层不声明"同形** → 入 ⑦。
- 实测（@639ed01539，runs/2026-10-23T07-02-58Z-focused/…cross 臂钉为回归网）：缺 required ⇒ typed `invalid arguments: missing required property "file_path"`（dispatcher 强制 required）；**多余顶层键（content/offset）不拒、被忽略、零效果**——本工具无写通道，效果恒=F(唯一 exact file)+1 个由读字节派生的 store 对象，值不回显。P 层接管行在 admission 拒未知顶层键（TAKEOVER-PROPOSAL §1.1）。

## 矩阵行草案终版（read_image (M-05) ⑥/⑦/⑧，交 parent 落笔）

- **⑥** = 宿主原生面：源码亲读 @pin639（path:line 全量=EV/alpha5/m2-readimg/FINDINGS-LOCATE.md）+ **fixture C1/C2/C3 生产注册面 12 legs @639ed01539 全绿 rc=0**（run=EV/alpha5/m2-readimg/runs/2026-10-23T07-02-58Z-focused/；census 双捕获 EV/alpha5/m2-readimg/census-two-captures-*.log）；适用性=dep-diff(宿主依赖面 tool-fs+attachment-local+fs-local 于 pin639=baseline 本身)=0 漂移（宿主树 porcelain 0 实测）；治理面行依赖集未成形（接管未装配）。
- **⑦** = **主缺口（读面越界）**：`read-image.ts:263`→`ctx.fs.readBytes` 不经 fs-sandbox containment（写面专属 `fs-sandbox/index.ts:107/:121-143`）⇒ 越界拒绝委托所挂后端，LocalFileSystem 无根约束；Team 治理面对 read_image 无实现未接线（`PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED` @plane:493 拒名挂、takeover 表无条目、agent-bindings/pa-mount-registry 零出现）；**授权身份未测**（S0 危险面：附件落未授权渲染路径/缩略图绕过 read 授权）；**顶层 parameters 不声明 additionalProperties:false**（catalog:1012-1031；实测=required 强制、未知键不拒零效果；P 层接管收紧）；**声明扩展+不可解码字节面 decoder 原文直出**（INVALID_IMAGE 映射只罩嗅探路径）。补口方案=EV/alpha5/m2-readimg/TAKEOVER-PROPOSAL.md。
- **⑧** = `NOT_WIRED` + 未闭合项：读面越界补口未装配（提案待 parent 合）、授权身份未测、attach-vision 的 session-log 持久腿未测（Host 腿）、审批 ask-lane 一次性消费未测（Host 腿）、C3 读中途竞态窗未证（fixture 仅证 pre-aborted 臂）、接管名遮蔽宿主原生未实证；**下一格**=parent 合 TAKEOVER-PROPOSAL §2 diff → 本卡补 takeover executor 单测+装配整合测 → Host owner 排 Host 腿 → 行级按 scope 升格。V@B=no。

## 修复轮（2026-10-23 07:0x-07:1x Z，父令"在你自己文件内修好"）

文件内修复（零 eslint-disable、零 @ts-ignore、零 lint 基线件触碰）：
- (77) `new URL` 双重身份：改 `findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))`——接缝处全程 string，不再构造 URL 对象；
- (79) 守卫形状重写：`findTestRepoRoot` 返回 `string | null`（`tests/paths.mjs` 有正式 `tests/paths.d.mts` 类型面，正式 import，删 @ts-ignore），`=== null` 守卫后直用，无 never；
- (162/168/176) 基类为预构建运行时类（any 面）⇒ 删 `override`，方法签名自带类型；
- `no-explicit-any`：全部显式 `any` 换**结构化接口**（LooseCtx/LooseFiber/ContentBlock/ExecResult…）+ `unknown` 窄化；动态 import 面靠推断，零显式 token。

| 命令（父令①） | 结果 |
|---|---|
| `pnpm --filter @dsh-agent-team/runtime run typecheck` | **rc=0**（`$ tsc -p tsconfig.json` 零输出；runs/…/typecheck.stdout+rc） |
| `pnpm exec eslint packages/runtime/test/a5m2-readimg-c1.test.ts` | **rc=0 零输出**（runs/…/eslint-focused.stdout+rc） |
| `pnpm exec vitest run <本文件>` @tree c978eb2fc（父方落地中复跑） | **12 passed / 12, rc=0, 785ms** |
| census 双捕获 `--only census --census-captures 2` @head f9ec0e4ed | captured **608f/7807l 两次一致**；verdict=fail（见下归因）；EV 同目录 census-two-captures-2026-10-23T07-03-22Z.log |

## p4t6 扫描台账红归因（诚实拆分：5 条 NEW RED 里我的份额）

census NEW REDS 5 条：`a4p7-merge-gate`×2（scratch-worktree 实跑件，随落地中树漂移，非我）、`a5-current-contract` production-path 腿×1（state-freshness/父方域，非我）、`p4t6 coverage`×1（账本总数红）、+1 条见 census-comparison JSON。
**p4t6 机制**：账本钉死扫描总数（标题字面值=上次实测），"unbooked new path turns this sum RED rather than moving it silently, which is the whole design of this pin"（该文件 :243-247 原文）。CENTER 的 A5-M2 批量记账原文：**"The read_image spec … is NOT in this commit (its typecheck is red in its own file), so it is deliberately not booked here."**——当时成立；现 typecheck 已绿，应记。
归因（scanner 亲测 1237 vs 已记 1232，差 5 = 未记账扫描路径）：`packages/runtime/test/a5m2-readimg-c1.test.ts`（**本卡，1 条**）+ `governed-families/todo.mjs` + `governed-write-row.mjs` + `web-gateway/src/destination-envelope.ts` + `web-gateway/src/types.ts`（**其他 owner 落地中文件，非本卡，本卡不代记不代改**）。
p4t6 是共享账本文件，不在本卡独占清单 ⇒ 记账条目草案交 CENTER 落笔：

> 草案（并入 A5-M2 账本块或紧随其后，数字须 CENTER 在最终树上重锚）："…and M2-READIMG-01 (this card, typecheck now GREEN in its own file, resolving the A5-M2 note) adds its ONE scannable file packages/runtime/test/a5m2-readimg-c1.test.ts (the 12-leg read_image native production registration face C1/C2/C3 fixture over the pristine pin639 prebuilt libs: registration/conditional-unavailability, byte-exact attachment identity, pre-IO refusals with zero-IO witnesses, read-time caps, pre-abort cancellation, and the measured no-top-level-additionalProperties cross-check pinned as regression net; zero new denylist vocabulary, evidence under dev/** outside the scan), taking the scanned total on THIS tree to <CENTER 重锚值> - MEASURED by the pre-booking scanner run on the final tree; no chain value copied"。FOR-FINAL-INTEGRATION-RE-CHECK：与 A5-M1 十二路径同理，最终整合树须重扫。

## census 登记项（父令②：明处重录用）

- 新身份 **N=12**（全 [passed]，零新增红；正本 `census-identities.txt`，`file > full name` 逐字）。describe 全名 = `a5m2-readimg C1/C2/C3 — read_image native production registration face (pristine pin639 prebuilt libs)`。
- 语料脚注（本卡落地时实测，父方重录以最终树为准）：基线文档 558 files / 7010 legs / 9 titled reds；当前树实测 608f/7807l（含全部 owner 落地中文件，非本卡独有增量）；9 titled reds 容差集不动。
