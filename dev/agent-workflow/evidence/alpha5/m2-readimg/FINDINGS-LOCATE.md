# M2-READIMG-01 — 定位包（read_image / 矩阵行 M-05）

- Owner: M2-READIMG-01（唯一 owner）
- 日期: 2026-10-23（UTC）
- 宿主: `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84`（0.2.0-rc.2，`git status --porcelain` 行数=0，本轮实测）
- 工作树: `.worktrees/a5-m1-kernel`，分支 `feat/a5-m1-center-kernel` @ `7a3540937e`（本轮开始时宿主树零字节；CORE PATCH BUDGET=0 保持）
- 读法基线参照: `packages/fs/tool-fs/src/read.ts:78-84`（read 的注册与 required 面）

## 1. 宿主注册点（亲读逐条，path:line）

结论先行：**宿主已注册 `read_image`（Host 原生注册状态=已注册，条件挂载）**。矩阵 ③"Host 原生注册状态未亲读"由此转为亲读事实（非本卡改行，交 owner 落笔）。

- 定义+注册: `packages/fs/tool-fs/src/read-image.ts:208-209`
  `export function applyReadImageTool(ctx)` → `ctx.tools.register(defineTool({ name: 'read_image' …`（`:210`）。
- 挂载门: `packages/fs/tool-fs/src/index.ts:70-71`
  `ctx.inject(['attachments'], (imageCtx) => { applyReadImageTool(imageCtx) })` —— **工具仅在 `attachments` 服务挂载时存在**（index.ts:53 注释同义）；import=`:14`。
- 生产 default 路线（base bundle）:
  - `packages/bundle/base/cordis.patch.yml:138-139` → `attachment-local`（`@deepseek-ai/dsh-attachment-local`）
  - `packages/bundle/base/cordis.patch.yml:281-282` → `tool-fs`（`@deepseek-ai/dsh-tool-fs`）
  → base bundle 同时满足 `attachments` 门 ⇒ **默认生产装配下 read_image 在注册面上**。
- 官方目录佐证（pin639）: `docs/tool-catalog.md:31`（行=工具/依赖/事件面）与 `docs/tool-catalog.md:1012-1031`（schema JSON，`required: ["file_path"]`，Source 指 `packages/fs/tool-fs/src/index.ts`）。

## 2. 真实 schema（全部 required 字段+类型）

### parameters（`read-image.ts:213-215`）
| 字段 | 类型 | required |
|---|---|---|
| `file_path` | string | **是（唯一 required）** |

- 空串拒: `:240` `file_path must be a non-empty string`。
- 无 offset/limit/format 等任何其他参数 ⇒ 与 read（`read.ts:81-84`，required 仅 `file_path:string`）同形。

### output schema（`read-image.ts:216-225` + `IMAGE_VALUE_SCHEMA :62-82`）
- 顶层: `{ path: string(required), image: object(required, :65) }`，`additionalProperties:false`。
- `image` 内 required: `attachmentId:string(:67)`、`mediaType:enum(image/png|image/jpeg|image/webp|image/gif)(:68)`、`bytes:integer(:69)`、`width:integer(:70)`、`height:integer(:71)`。
- 可选: `name:string(:72)`；`originalDimensions:{width:integer(required),height:integer(required)}(:73-80)`（仅在存储做了降采样时出现，`:94-98` 注释）。

### 模型可见结果面（render）
- `render → 2 个 content block`（`:192-197`）：文本信封 `<path>…</path><type>image</type><content>mediaType WxH px, N bytes[降采样句]</content>`（`:168-185`）+ `{type:'image', attachment: ImageAttachmentRef}`。
- `presentationMeta = { path }`（`:234`）；attachment 引用**不**二次持久化（`:226-233` 注释：单一事实）。
- 副作用面: `ctx.emit('fs/observed', …, {kind:'present', version})`（`:321`）；`saveImage` 先持久化后返回（`:269-273`）。

## 3. 格式/大小限制（逐条亲读）

- 接受格式: PNG/JPEG/WebP/GIF。扩展名表 `:25-31`；无扩展名走魔数嗅探 `sniffImageMediaType :54-60`（PNG/JPEG/GIF87a/89a/RIFF+WEBP 签名，`:33-34`）。
- 读字节帽: `byteCap = min(attachments.imageLimits.maxImageBytes, maxMessageImageBytes)`（`:262`）→ `ctx.fs.readBytes(target, signal, byteCap)`（`:263`）；超限=FsError `FS_TOO_LARGE`，原文两条：stat 短路 `packages/fs/fs-local/src/fsio.ts:421`（`cannot read "<p>": <n> bytes exceeds the <cap>-byte limit`）与流中 `fsio.ts:434`。
- 部署 mediaTypes 集: `attachment-local/src/index.ts:184`（frozen 四值）；不符=`cannot read "<p>": <mt> images are not accepted by this deployment`（`read-image.ts:136`）。
- 默认限额常量（`attachment-local/src/index.ts`）：
  - `DEFAULT_MAX_IMAGE_BYTES = 20*1024*1024`（`:34`）
  - `DEFAULT_MAX_IMAGES_PER_MESSAGE = 20`（`:36`）
  - `DEFAULT_MAX_MESSAGE_IMAGE_BYTES = 200*1024*1024`（`:38`）
  - `DEFAULT_MAX_IMAGE_PIXELS = 64_000_000`（`:40`）
  - `DEFAULT_MAX_IMAGE_DIMENSION = 8192`（`:42`）
  - 可配置 z-schema `:150-154`；解码维度/pixels 判定在 `attachment-local/src/store.ts:62`（detectImage）与 `:104`（字节帽）。

## 4. 错误面（typed 文本原文 + path:line）

工具层拒绝均为 `throw new Error(<固定文本>)`（文本即 typed 面；FsError/AttachmentError 带 code）：

| 场景 | 文本（节选原文） | 位置 | 检查序 |
|---|---|---|---|
| 空路径 | `file_path must be a non-empty string` | `:240` | 最先，零 IO |
| 扩展名声明非图 | `cannot read "<p>": the <ext> extension does not declare a supported image format; read_image accepts PNG/JPEG/WebP/GIF files, including extension-less files in those formats` | `:249` | **fs IO 之前**（`:242-245` 注释：refusal 零泄露） |
| 无附件服务 | `…no attachment service is mounted` | `:253` | IO 前 |
| 部署不收该类型 | `…<mt> images are not accepted by this deployment` | `:136`（调用 `:255/:268`） | IO 前(有扩展名)/读后(无扩展名) |
| 路由模型不声明 image | `cannot read "<p>" as an image: model "<m>" does not declare image input; switch to an image-capable model to read images`；路由不可解= `…the current model route could not be resolved` | `:129` / `:125`（`assertImageCapableRoute :119-131`，调用 `:256`） | fs resolve 之前 |
| 文件不存在 | `cannot read "<p>": not found`（code `FS_NOT_FOUND`） | `read-target.ts:28` | resolve 后 |
| 非常规文件 | `cannot read "<p>": not a regular file`（code `FS_NOT_REGULAR_FILE`） | `read-target.ts:31` | resolve 后 |
| 字节非支持图像 | `…the file content is not a supported image format; read_image accepts PNG/JPEG/WebP/GIF` | `:266` | 读后、save 前 |
| 边超限 | `…at least one image side exceeds the <N>px limit; downscale…`（`IMAGE_DIMENSION_TOO_LARGE`） | `:279-283` | save 中（拒入持久历史） |
| 像素总量超限 | `…exceeds the <N>-pixel decoded-size limit…`（`IMAGE_TOO_MANY_PIXELS`） | `:285-289` | save 中 |
| 字节存储超限 | `…cannot be stored within the deployment's byte limits…`（`IMAGE_TOO_LARGE`） | `:291-295` | save 中 |
| 16-bit PNG 转换失败 | `…the 16-bit PNG could not be converted…`（`ATTACHMENT_WRITE_FAILED`+文本匹配） | `:297-302` | save 中 |
| 字节不解码（无扩展名嗅探路径） | `…the bytes do not decode as a supported PNG/JPEG/WebP/GIF image; the file may be truncated or corrupt`（`INVALID_IMAGE`） | `:303-308` | save 中 |
| 签名/字节不符 | 嗅探路径 `…the file signature claims <mt>, but the bytes decode as a different image format…`（`:310-315`）；声明扩展名路径 `…the <ext> extension declares <mt>, but the bytes use a different image format; rename…`（`:316-319`）（`IMAGE_TYPE_MISMATCH`） | save 中 |

**检查序保证（`:242-245` 注释）**：所有预读门在任何 filesystem I/O 之前——"a refusal never leaks partial reads or attachment writes"（宿主自带保证；负控按其断言）。

## 5. 路径越界语义（重要发现，如实）

- `resolveRegularReadTarget`（`read-target.ts:19-34`）= `ctx.fs.resolve` + `stat` 常规文件检查；**tool-fs 层不含根约束**。
- `fs-sandbox`（`packages/fs/fs-sandbox/src/index.ts`）的 containment（`FS_SANDBOX_DENIED`，`workspace-write` 重规范化+`writableRoots` 检查，`:121-143`）**只罩变更面**（`writeText/editText`，`:107`）；**读面 `readBytes` 不经 `checkedTarget`** ——即 `read_image` 的路径越界拒绝**完全委托给所挂载 `ctx.fs` 后端**。
- `LocalFileSystem`（`packages/fs/fs-local/src/index.ts:63` 注释）按 `Config.cwd` 解析相对路径，对绝对路径不做 root containment ⇒ **宿主原生装配下无 Team 治理意义的越界拒绝**。Team 治理面（ControlledFs READ-slice）现**未接 read_image**（无 plane 挂载，见 §6）⇒ 越界拒绝 = **NOT_VERIFIED/未接线**，不自造替身。

## 6. plane 侧名字出现（逐字证据，只读）

- `packages/runtime/src/plugin/live/team-tool-plane.mjs`
  - `:403-404`：`export const PLANE_RESERVED_NATIVE = Object.freeze([ 'read', 'read_image', 'write', 'edit', …` —— **`read_image` 在册=预留原生拼写**。
  - `:465-478`：`PLANE_SUPPORTED_NATIVE_TAKEOVERS` 表**无 read_image 条目**（bash=['bash'], read=['read'], grep/glob=[], jobs 三件）。
  - `:493-495`：`verifyPlaneNames` 对 reserved 拼写且不在支持表 ⇒ `PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED` typed 拒（`:327-337` 注释原文点名 "reserved pairing (write/edit/**read_image**/lsp/pwsh…)"）⇒ **任何 plane 行以 `read_image` 名挂载都被装配前拒绝**。
  - `:587` 与 `:601`：guard 车道以 `['read','read_image']` 作**粗粒度读效应类名**（deny-lane/default-deny 覆盖枚举），是治理在册，**不是挂载**。
- `packages/runtime/src/plugin/live/agent-bindings.mjs`：`grep -c read_image` = **0**（零出现）。
- `packages/runtime/src/plugin/live/pa-mount-registry.mjs`：`grep -c read_image` = **0**（零出现）。

结论：矩阵 ③"plane 无专门挂载"复验成立且更强——plane 侧唯一角色是**保留名拒挂 + 效应类覆盖枚举**。

## 7. S0 原文（read_image 设计需求历史正本）

`docs/plans/memo/alpha5-tool-io-governance/S0-SELECTION-MATRIX.md:53`（M-05 行）逐字：
> | M-05 | `read_image`（A） | 同 M-01 + 附件/渲染存储保持授权身份（设计 §3.1） | 同 M-01 | 附件落未授权渲染路径；以缩略图绕过 read 授权 | 未开腿 | PR0/1/2/3 | 无 PoC 证据（03-fs 未测清单明文含 read_image） | 全链 | `NOT_VERIFIED` → strict Profile 拒绝至 PR3 验收 |

## 8. 现态断言（诚实法）

- 宿主原生注册/IO/限制/错误面=本轮亲读（pin639，源码级）。
- 首次真实执行（fixture 级正负控）=**待 owner 核排他清单后实跑**（NOT_VERIFIED 直到 C1 落盘）。
- 治理面（ControlledFs/审批链对 read_image 的 IO 中介）=无实现未接线（plane 拒挂+agent-bindings 零出现）。
- 附件持久化/渲染路径授权身份（S0 危险面"缩略图绕过 read 授权"）=未测。
