# M2-READIMG-01 — 三件共享文件 diff 提案（CENTER 单 writer 落笔；本卡不触碰这些文件）

- 日期 2026-10-23（UTC）。锚 = `feat/a5-m1-center-kernel` HEAD `c978eb2fc` 亲读。
- 本卡臂已落地（lane-owned，5 新文件见 §D）：`governed-families/image.mjs`（B-IMAGE 前置接管臂）+ `image-attachment.mjs`（SERVICE adapter）+ 两份相邻 `.d.mts` + 正式测试 `a5m2-readimg-arm-c2c3.test.ts`（17 legs 全绿 @pin639，runs/2026-10-23T07-28-55Z-arm/）。
- 臂的 DI 口形状（装配必须满足）：`createGovernedReadImageArm({definitionIdentity, providerId, realmId, namespaceRoot, resolveNamespaceRoot?, readPort:{stat,readFile(maxBytes,signal)}, attachments:<image-attachment handle>, trustedIdentities, observe})`；`createImageAttachmentAdapter({store:<ctx.get('attachments') 公开口 {saveImage,readImage,imageLimits}，注意绑 receiver>, observe})`。
- 关键生产事实（装配侧必须知道）：store 方法**必须 bind 到服务实例**（裸提取 ⇒ `this.compression` undefined，实测首次失败原文 `Cannot read properties of undefined (reading 'run')`）；`readImage` 答 `{ref,data}` 对（非裸字节）；store 确定性拒绝文本示例 `Image exceeds the configured per-side pixel limit.`。

## A. `team-tool-plane.mjs`

**A1 — `PLANE_SUPPORTED_NATIVE_TAKEOVERS`（:465-478）增行**（jobs 行之后、闭合括号之前）：

```js
  // M2-READIMG-01 (B-IMAGE, branch feat/a5-m1-center-kernel): read_image
  // mounts ONLY at its reserved native spelling under the closed
  // `imageEnabled` consumption key (same law family as `jobsEnabled`:
  // absent = NO row, byte-for-byte zero flip; non-boolean = config defect,
  // mount refused, never silently defaulted). The same-name, same-meaning
  // implementation this ledger records is ASSEMBLED:
  // createGovernedReadImageArm (governed-families/image.mjs) over the
  // assembly's controlled read slice + the SERVICE attachment adapter
  // (governed-families/image-attachment.mjs) over the host attachment
  // store's public face @639ed01539. It closes the measured row-7 gap ON
  // THE GOVERNED PATH: cross-root/symlink-alias targets refuse TYPED before
  // any content read (the native face delegates that decision to
  // ctx.fs.readBytes with no root fence — the native face stays as measured;
  // strict profiles keep read_image undenyable except through this row).
  image: Object.freeze(['read_image']),
```

**A2 — Gate 0c 法新键 `imageEnabled`（:769-783 jobsEnabled 同型，紧随其后）**：

```js
  // Gate 0c (image variant, M2-READIMG-01): `planeCfg.imageEnabled` is the
  // closed key for the read_image takeover row. Absent/false = NO row at
  // all (zero flip); non-boolean = config defect refused at the gate.
  const imageEnabledRaw = input.plane?.imageEnabled
  if (imageEnabledRaw !== undefined && typeof imageEnabledRaw !== 'boolean') {
    return {
      ok: false,
      code: 'PLANE_IMAGE_ENABLED_INVALID',
      message: `planeCfg.imageEnabled must be a boolean when present — got ${JSON.stringify(imageEnabledRaw) ?? String(imageEnabledRaw)} (a non-boolean gate is a config defect: the mount is refused rather than silently defaulting)`,
    }
  }
  const imageEnabled = imageEnabledRaw === true
```

（把 `imageEnabled` 随现有 `globEnabled/jobsEnabled` 同款返回对象下发到 assembly 闭包——与 jobsEnabled 现通路一致。）

**A3 — `verifyPlaneNames`（:481-495）不动**：read_image 走 jobs 同路——固定原生拼写、不进可配 `names` 图、Gate 0b 无需增行（`names` 闭集仍 grep/glob/bash + readName）。**披露**：`PLANE_RESERVED_NATIVE` 已含 `'read_image'`（:403-404），本 A1 行使 `read_image` 拼写在 takeover-ledger 语义下有名分；行本体不接 `names` 图，无 Gate 0b 面。

**A4 — 装配行（readExecutor :1654-1663 同区，`baseDefs` :1723-1782 追加行同型）**：

```js
  const readImageArm = imageEnabled && fsInstance !== null && typeof fsInstance.rootDir === 'string'
    && input.attachments !== undefined && input.attachments !== null
    ? createGovernedReadImageArm({
      definitionIdentity: /* 与 read 行同款 bind-time identity 来源（definitionIdentityOf(被遮蔽的 owned definition)） */,
      providerId, realmId,
      namespaceRoot: fsInstance.rootDir,
      readPort: /* FS-PROC: fsInstance 的受控读切片 {stat, readFile(maxBytes,signal)}——read 行底座同一来源 */,
      attachments: createImageAttachmentAdapter({
        store: { saveImage: store.saveImage.bind(store), readImage: store.readImage.bind(store), imageLimits: store.imageLimits },
        observe: logBackend('a5m2-readimg-service'),
      }),
      trustedIdentities,
      observe: logBackend('a5m2-readimg'),
    })
    : null
```

`baseDefs` 追加 def（read 行 def :1725-1782 同型）：`name: 'read_image'`（固定原生拼写，同 jobs 三件套法，不读 names 图）；`parameters` = pin639 公开 schema 等价 + **顶层 `additionalProperties:false`**（`{ file_path: { type:'string', description:'Path to the image file, resolved against your admitted file root.' }, required:['file_path'], additionalProperties:false }`——P 层收紧顶层隐开面，实测宿主不声明、多余键被静默忽略的在册事实由本行关闭）；`execute` = 臂三态直译：`classify→(A 消费)→prepare→execute` 由 A/plane 既有生命周期驱动（A 生命周期 §1：classify 出的 effects 全量送 Guard/PA；批准后 ticket 消费——与 read 行 decide-then-execute 的差异在 read_image 行要走 A 全链，装配处按 M0-A 生命周期接线，本提案不发明第二套）；成功 `value` 已是宿主 output schema 等价 `{path, image{attachmentId,mediaType,bytes,width,height,name?}}`，展示面复用 output schema `render`（单事实=store 回执）；拒绝 = tagged object ⇒ **verbatim 文本 throw**（read 行 S2 传输法同款）。
`readImageArm === null` ⇒ 无行、无 import 效应（零翻转），`DRAINING` 绑 mount dispose（`readImageArm.drain()` 挂到 read 行同一 drain 点）。

**A5 — 条件不可用接线**：mount 时 `ctx.get('attachments')` 缺失（宿主未挂 store）⇒ `input.attachments` undefined ⇒ `readImageArm===null` ⇒ 行不装配 ⇒ 原生名也不可达（strict Profile 已 default-deny）——typed 条件不可用由**行缺失**承载，与 C1"缺 store 不豁免"一致；行存在但 store mid-life 死 ⇒ 臂 typed `P_IMAGE_STORE_UNAVAILABLE` + `sideEffectPossible:true`（已测）。

## B. `agent-bindings.mjs`（`planeCfg` 消费点 :2568-2590 jobsEnabled 同位）

```js
        // M2-READIMG-01: the read_image takeover row's SERVICE port rides the
        // SAME host attachment store public face the native tool injects
        // (ctx.get('attachments')); methods are RECEIVER-BOUND at extraction
        // (measured: bare extraction breaks this.compression). Absent store
        // (host conditional) = port absent = the plane assembles NO row.
        const a5ImageStoreService = ctx.get?.('attachments')
        const a5ImagePlaneInputs = planeCfg.imageEnabled === true && a5ImageStoreService !== undefined
          ? {
            attachments: {
              saveImage: a5ImageStoreService.saveImage.bind(a5ImageStoreService),
              readImage: a5ImageStoreService.readImage.bind(a5ImageStoreService),
              imageLimits: a5ImageStoreService.imageLimits,
            },
          }
          : {}
```

——把 `...a5ImagePlaneInputs` 并入既有 plane 装配输入对象（`planeCfg` → plane input 的现有单点）；`imageEnabled` 键由 TeamBlueprint/plan 的 plane 配置段透传（`planeCfg.imageEnabled` 透传点与 `jobsEnabled` 完全同路，无新键机制）。**ownNames/placement 增列**：read_image 行进 `a5PlaneOwnNames` 的路径与 read 行同（allDefs→ownNames 现机制），mask 由既有 placementFeed 遮蔽宿主原生名——该遮蔽效果本身 = Host 腿断言项（本卡不实证，如实列）。

## C. `scripts/place-dist-glue.mjs`（`PLACEMENTS` 数组，:46 起）

```js
  // M2-READIMG-01 B-IMAGE governed arm (byte-copied like every glue row: tsc
  // never emits .mjs). image.mjs imports plane-effect-backends.mjs (already
  // placed) + domain tool-governance (compiled by tsc into dist) — no new
  // transitive .mjs beyond the two rows below.
  {
    src: 'packages/runtime/src/plugin/live/governed-families/image.mjs',
    dist: 'packages/runtime/dist/packages/runtime/src/plugin/live/governed-families/image.mjs',
  },
  {
    src: 'packages/runtime/src/plugin/live/governed-families/image-attachment.mjs',
    dist: 'packages/runtime/dist/packages/runtime/src/plugin/live/governed-families/image-attachment.mjs',
  },
```

（todo 臂的 `governed-families/todo.mjs` 由 todo owner 各自提案；若 CENTER 偏好目录级 placement，一并裁。）

## D. 本卡新增 scannable 清单（booking 由 CENTER 实测后落，本卡不 bump 计数）

1. `packages/runtime/src/plugin/live/governed-families/image.mjs`
2. `packages/runtime/src/plugin/live/governed-families/image-attachment.mjs`
3. `packages/runtime/src/plugin/live/governed-families/image.d.mts`（相邻类型面，plane-effect-backends.d.mts 先例）
4. `packages/runtime/src/plugin/live/governed-families/image-attachment.d.mts`
5. `packages/runtime/test/a5m2-readimg-arm-c2c3.test.ts`（17 legs）
零新 denylist 词汇（文件内 Team 词为 vNext 闭集词）；证据全在 `dev/**`（扫描集外）。

## E. 验收链更新（臂落地后）

已完成（本卡）：臂+adapter+17 腿（含 **row-7 对照腿**：宿主原生面越界读成功复现 ⇒ 接管臂同目标 typed 拒零 IO，原文在 `runs/2026-10-23T07-28-55Z-arm/vitest-run.stdout` 的 ✓ 行）。
待 CENTER：A/B/C 合入 ⇒ 本卡补**装配整合测**（placement/ownNames/零翻转字节等值 + imageEnabled 三态：absent/off 零行、非布尔 typed 拒）。
待 Host owner：Host 腿（真实 Guard/Control/PA 全链 + attach-vision session-log ride + render 面 + 原生名遮蔽生效实证）。
