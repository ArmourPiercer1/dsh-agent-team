# host-assets-20261116 — 沙箱原生资产改由「已发布的 pin 包」供给

> 状态：draft PR（`task/host-assets-20261116`，基于 `origin/master`）。
> 裁决：owner，2026-11-16。CORE PATCH BUDGET = 0（未改 upstream / host 源树，未 patch，未加仓库依赖）。
> 上游事实：DSH 基线 `0.2.0-rc.2 @ 639ed015397290b3745d163aafe02ffee4aa3f84`，`linux-x64` / glibc。

## 1. 缺陷（实测，非推测）

`bin/glibc/system.node` 与 `bin/landlock-run` 是 gitignored 原生资产（`native/system/.gitignore` 的
`packages/*/bin/`）。现有 manifest 只 pin 了**一台机器构建出的字节**，而 hosted census runner
**无法**从本地树携带这两个文件，且它自己的构建产物与 pin 不同：

| 来源 | `bin/glibc/system.node` sha256 | 证据 |
| --- | --- | --- |
| 提交的 pin（manifest `entries`） | `54a9c25c05186c17520f6b7a5ced5f005752c08044c3eb76524cd517287600bc`（17360 B, `0o755`） | 本 memo 的权威 |
| hosted runner 自己的构建 | `dfa6d586…`（长度未测） | census 作业输出：`M7A-STEP verdict=DISCLOSED_REFUSAL reason=HOST_ASSET_UNPROVISIONABLE arms=0` + `detail=bin/glibc/system.node sha256=dfa6d586… (this tree) != 54a9c25c… (pinned manifest)` |
| 本环境主 checkout 的运行时树（2026-11-16 复核） | `75450f9225f5005410a0a719b590f84ab33e3df80c0285095797e153404b70bd`（17352 B） | `sha256sum tests/deepseek-harness-test-use/native/system/packages/linux-x64/bin/glibc/system.node` |

`bin/landlock-run` 在三处一致：`a752bc72f111fcc573c3e61fb90fa544541dac0ca498d2e279e1630d7c659b31`（38552 B）。
差异只在 addon（`system.node`），且第三行说明**本机主 checkout 也已漂移**——不是"CI 特有问题"。

此前 M7-A 步骤用 `M7A_ALLOW_UNPROVISIONABLE_HOST=1`（只在该 workflow 设置）接受**唯一**一种非验证结果：
`DESTINATION_DIGEST_MISMATCH` → `M7A-STEP verdict=DISCLOSED_REFUSAL reason=HOST_ASSET_UNPROVISIONABLE arms=0`。
那等于承认 L2 上真实安全链从未被验证。

## 2. 裁决与路线（owner 已定，不再重开）

**固定发布产物是标准，runner 的构建不是。** 同一组字节已经发布在
`@deepseek-ai/node-addon-system-linux-x64@0.1.2`；owner 已核对**发布包内字节 = pin 字节**。
因此本 PR 增加**第二条传输**（package transport），而非放宽 pin：

- **不移动 sha256 pin** 去迁就任何 runner 构建；
- 只接受**精确版本**（无 range、无 `latest`、无 `*`、无部分版本）；
- tarball **只取 npm registry 的发布 tarball**，不 `pnpm install` 该包，不把包加进仓库依赖；
- 先验证、后落地；失败即**无部分安装**（typed code + 零残留）。

## 3. 被 pin 的发布产物（2026-11-16 实测）

| 项 | 值 |
| --- | --- |
| 包 | `@deepseek-ai/node-addon-system-linux-x64` |
| 精确版本 | `0.1.2` |
| tarball | 25758 B |
| tarball sha256 | `77fb771bee2133c3ffd1f96c7b9435ddb1ccaee72b6814f6f4391343a611cc20` |
| registry `dist.integrity`（sha512 SRI） | `sha512-S2aPVHvYCpNCppCFyNlooMYuTB7ucK5lvD9oXQQ42v5Z2s5AoaiCdjz9r2l+ED2rI5oS1x0cUZmKjJH2dxV0pg==` |
| `package/bin/glibc/system.node` | `54a9c25c…`，17360 B（= pin） |
| `package/bin/landlock-run` | `a752bc72…`，38552 B（= pin） |
| 额外兄弟文件 | `package/bin/musl/system.node`，17960 B，sha256 `fb39a23ed7c414b48d6a8ee35b02016400997b0eb15926b1fd53946c7403f1d2` |

两个值得写下来的细节：

1. **tar 里 mode 是 `0o644`，pin 的 mode 是 `0o755`**。安装时**不能**用归档 mode，必须用 manifest 的 mode
   （这是与本地复制传输共享的既有纪律：pin 包含 mode）。
2. 真实 tarball 的 `bin/` 里还有 `musl/system.node`。若只按 `files` 表判"bin/ 下多余文件"，真实 tarball 会被
   自己拒绝。manifest 因此新增 `siblings` 表把这一个兄弟文件也 pin 住；"多余文件"的定义 =
   `bin/` 下既不在 `files` 也不在 `siblings` 的文件。**整棵 `bin/` 仍被完整解释**，这是加强而非放宽。

## 4. manifest：只加 `packages`，`entries` 字节不变

`tests/world-factory/lib/host-sandbox-assets-manifest.json`：

- `entries`：**逐字节未改**（旧传输与所有旧断言继续以同一张表为准）；
- 新增 `packages`：以同一 baseline 键 `0.2.0-rc.2@639ed015…` 索引，平台 `linux-x64`，记录
  `package` / `version` / `registry` / `distIntegrity` / `tarballSha256` / `tarballBytes` / `launcher` /
  `files`（与 `entries.files` **深度相等**）/ `siblings`；
- `provenance` 增加 `packageMeasuredAt` / `packageMeasuredFrom` / `packageVerifyCommand`，`transport`
  字符串如实描述**两条**传输。

`packagePlatformEntry()` 在装载时强制 `packages.files` 与 `entries.files` 深度相等、launcher 相等，
否则 `PACKAGE_PIN_DIVERGES_FROM_HOST_PIN`——发布包不能定义"第二标准"。

## 5. 验证链（顺序即拒绝顺序）

1. **spec**：必须是 `name@version` 且 name 是 pin 的包名、version 是 pin 的精确版本。
   `latest`/range/部分版本 → `PACKAGE_SPEC_NOT_EXACT`；不同精确版本 → `PACKAGE_VERSION_UNPINNED`；
   缺版本 → `PACKAGE_SPEC_INVALID`。**全部在网络之前**。
2. **目标预检**：`bin/` 或任一目标文件是符号链接 → `DESTINATION_IS_SYMLINK`（在**任何写之前**；
   不跟随链接安装）。node_modules 风格的目录链接被单独覆盖。
3. **metadata**：`GET {registry}/{name}/{version}`；HTTP 非 200 / 网络失败 → `REGISTRY_METADATA_UNAVAILABLE`；
   JSON 不可读 → `REGISTRY_METADATA_UNREADABLE`；name/version 不符 → `REGISTRY_NAME_MISMATCH` /
   `REGISTRY_VERSION_MISMATCH`；`dist.integrity` 缺失 → `REGISTRY_INTEGRITY_MISSING`；
   与 pin 不一致 → `REGISTRY_INTEGRITY_UNKNOWN`；`dist.tarball` 非 https → `REGISTRY_TARBALL_URL_INVALID`。
4. **tarball**：只从 `dist.tarball` 取；sha512 ≠ `dist.integrity` → `TARBALL_INTEGRITY_MISMATCH`；
   再对 manifest 的 `tarballSha256` / `tarballBytes` → `TARBALL_DIGEST_MISMATCH` / `TARBALL_LENGTH_MISMATCH`。
   **registry 的意见不是标准，提交的 pin 才是**：两者都要过。
5. **解包**：临时目录（`.artifacts/tmp/host-assets-pkg-*`）；归档路径不安全 → `PACKAGE_ARCHIVE_PATH_UNSAFE`
   （`..`、绝对路径、反斜杠、盘符、NUL）；条目越界 → `PACKAGE_ARCHIVE_ENTRY_UNSAFE`；解包失败 →
   `PACKAGE_EXTRACT_FAILED`。解包**只写**临时目录。
6. **逐文件**：`bin/` 下多余文件 → `PACKAGE_EXTRA_BIN_FILE`；缺文件 → `PACKAGE_FILE_MISSING`；
   长度 ≠ pin → `PACKAGE_FILE_LENGTH_MISMATCH`；sha256 ≠ pin → `PACKAGE_FILE_DIGEST_MISMATCH`。
7. **发布**：备份既有字节（供回滚），写 `.u7-sbx-staging` 暂存，`chmod` 成 pin 的 mode，rename，
   **再读一次** digest + mode。任何一步失败 → 回滚备份，返回 typed error，无部分安装。
8. **receipt**：`u7-sbx-host-asset-receipt/1` JSON，记录 package spec / version / tarball sha256 /
   `distIntegrity` / 每文件 sha256（含 `preExistingSha256`）/ host sha / 平台 / libc / UTC /
   **manifest digest（canonical JSON 的 sha256）** / receipt 路径。默认
   `.artifacts/tmp/host-assets/provision-receipt.json`；env `DSH_TEAM_SANDBOX_ASSET_RECEIPT`（路径）、
   `DSH_TEAM_SANDBOX_ASSET_RECEIPT_DIR`（目录）、`DSH_TEAM_SANDBOX_ASSET_REGISTRY`（registry 覆盖，仅测试用）。

旧传输（本地复制）**原样保留**：仍拒绝 `DESTINATION_DIGEST_MISMATCH`（不覆盖别人的字节），
package transport 才是**有意替换** runner 构建的那条路径（这正是它的用途）。

## 6. CLI 与 CI 接线

```bash
node scripts/provision-host-assets.mjs --from-package @deepseek-ai/node-addon-system-linux-x64@0.1.2
# 成功 stdout 一行：HOST-ASSETS-PROVISIONED package=… version=… tarballSha256=… distIntegrity=… files=… host=… manifestDigest=… utc=… receipt=…
# 失败 stderr 一行：HOST-ASSETS-REFUSED code=… detail=…；exit 1
# --runtime-tree <path> / --receipt <path> / --manifest / --help
```

`.github/workflows/census-runtime.yml`：

- 新步骤 **Host sandbox assets — provision the PINNED published package**，位置在 census + transcript
  re-grade **之后**、M7-A 步骤**之前**（census 的 argv、两次 capture、population 不变）；步骤注释写明
  实测摘要、裁决理由（固定发布产物、保留既有 sha256 pin、不让 runner 构建定义标准）；
- M7-A 步骤**删除** `M7A_ALLOW_UNPROVISIONABLE_HOST: '1'`。拒绝码路径仍留在
  `lib/m7a-step-verdict.mjs`（默认关闭）并有测试，但**任何 workflow 都不再设置它**（T38 逐 workflow 检查，
  只忽略整行注释）→ CI 上不可达，任何拒绝都是红。

`dev/ci/eb3-ci-manifest.json` 的 `ci-census` 层新增同 argv 的 leg
（`cmd: ["node","scripts/provision-host-assets.mjs"]`，`check: ["--from-package","…@0.1.2"]`），
`why` 记录实测摘要与裁决；M7-A leg 的 `why` 更新为"豁免已删除、必须 VERIFIED"。whole-argv 纪律与
M7-A 腿相同：workflow 行的整条尾随 argv 必须**恰好等于** `cmd + check`。

## 7. 拒绝矩阵（每条都有断言 + 零残留）

| # | 控制 | 期望 code | 拒绝点 |
| --- | --- | --- | --- |
| a | tarball 字节被篡改（registry 仍声称 pin） | `TARBALL_INTEGRITY_MISMATCH` | 取到 tarball 后、解包前 |
| a' | tarball 字节被篡改且 registry "认可"它（sha256 pin 仍不认） | `TARBALL_DIGEST_MISMATCH` | 同上 |
| b | 解包出的 `system.node` 被篡改（等长改字节） | `PACKAGE_FILE_DIGEST_MISMATCH` | 逐文件校验 |
| c | `@0.1.1` | `PACKAGE_VERSION_UNPINNED` | 网络前 |
| c' | `@latest` / range / `0.1` / `*` | `PACKAGE_SPEC_NOT_EXACT` | 网络前 |
| c'' | 缺版本 / 缺包名 | `PACKAGE_SPEC_INVALID` | 网络前 |
| d | metadata 无 `dist.integrity` | `REGISTRY_INTEGRITY_MISSING` | 取 tarball 前 |
| d' | metadata 的 integrity 不是 pin（即便格式合法） | `REGISTRY_INTEGRITY_UNKNOWN` | 取 tarball 前 |
| e | 目标 `bin/` 是 node_modules 风格符号链接 | `DESTINATION_IS_SYMLINK` | 任何写之前；链接目标保持空 |
| e' | 目标 launcher 文件本身是符号链接 | `DESTINATION_IS_SYMLINK` | 同上；链接目标字节不变 |
| f | tarball 的 `bin/` 多出未 pin 文件 | `PACKAGE_EXTRA_BIN_FILE` | 逐文件校验 |
| g | pin 长度与实际不符 | `PACKAGE_FILE_LENGTH_MISMATCH` | 逐文件校验 |
| h | `packages.files` 与 `entries.files` 不一致 | `PACKAGE_PIN_DIVERGES_FROM_HOST_PIN` | 装载 pin 时 |

否定控制的实际输出（verbatim，`.artifacts/tmp/host-assets-negatives/output.txt`）见 §9；
其中 a/b/c/d/e/f 均打印 `installed=none staging=0`。

## 8. 正向控制（真实网络、真实 registry、真实 tarball）

对一个**预置了 runner 构建形态**的临时 host 树执行：

```bash
node scripts/provision-host-assets.mjs \
  --from-package @deepseek-ai/node-addon-system-linux-x64@0.1.2 \
  --runtime-tree .artifacts/tmp/host-assets-positive \
  --receipt .artifacts/tmp/host-assets-positive/receipt.json
```

结果（实测）：

```
HOST-ASSETS-PROVISIONED package=@deepseek-ai/node-addon-system-linux-x64 version=0.1.2 \
 tarballSha256=77fb771bee2133c3ffd1f96c7b9435ddb1ccaee72b6814f6f4391343a611cc20 \
 distIntegrity=sha512-S2aPVHvYCpNCppCFyNlooMYuTB7ucK5lvD9oXQQ42v5Z2s5AoaiCdjz9r2l+ED2rI5oS1x0cUZmKjJH2dxV0pg== \
 files=2 host=639ed015397290b3745d163aafe02ffee4aa3f84 \
 manifestDigest=c99555f717b5dfc83f06bf4f9313e2ec020b1ebfad905b643e95077a2e304850 \
 utc=2026-11-16T03:41:56.699Z receipt=.artifacts/tmp/host-assets-positive/receipt.json
```

安装后：`bin/landlock-run` = `a752bc72…`（38552 B, `0755`）、`bin/glibc/system.node` = `54a9c25c…`
（17360 B, `0755`），receipt `schema=u7-sbx-host-asset-receipt/1`、`action=provisioned-from-package`。

## 9. 证据

| 内容 | 位置 |
| --- | --- |
| 测试（T1–T39，本 memo 新增 T28–T39） | `tests/world-factory/host-sandbox-assets.test.mjs` |
| 传输实现 | `tests/world-factory/lib/host-sandbox-assets.mjs`（`// ─── package transport`） |
| manifest | `tests/world-factory/lib/host-sandbox-assets-manifest.json` |
| CLI | `scripts/provision-host-assets.mjs` |
| CI | `.github/workflows/census-runtime.yml`、`dev/ci/eb3-ci-manifest.json` |
| 否定控制输出 | `.artifacts/tmp/host-assets-negatives/output.txt`（gitignored 本地产物；结论已抄录下节） |

否定控制 verbatim（节选，逐行来自上述输出文件）：

```
CONTROL-REFUSED control=a-tampered-tarball expected=TARBALL_INTEGRITY_MISMATCH code=TARBALL_INTEGRITY_MISMATCH installed=none staging=0 detail="… sha512 … != the registry's published sha512-S2aPVHvY… — the bytes are not the artifact the registry attests, nothing was extracted and nothing was installed"
CONTROL-REFUSED control=b-tampered-extracted-addon expected=PACKAGE_FILE_DIGEST_MISMATCH code=PACKAGE_FILE_DIGEST_MISMATCH installed=none staging=0 detail="… bin/glibc/system.node: sha256 3b250377…, the pinned manifest says 54a9c25c… — nothing was installed"
CONTROL-REFUSED control=c-wrong-version-spec=@deepseek-ai/node-addon-system-linux-x64@0.1.1 expected=PACKAGE_VERSION_UNPINNED code=PACKAGE_VERSION_UNPINNED installed=none staging=0
CONTROL-REFUSED control=c-wrong-version-spec=@deepseek-ai/node-addon-system-linux-x64@latest expected=PACKAGE_SPEC_NOT_EXACT code=PACKAGE_SPEC_NOT_EXACT installed=none staging=0
CONTROL-REFUSED control=d-no-dist-integrity expected=REGISTRY_INTEGRITY_MISSING code=REGISTRY_INTEGRITY_MISSING installed=none staging=0
CONTROL-REFUSED control=d-unknown-dist-integrity expected=REGISTRY_INTEGRITY_UNKNOWN code=REGISTRY_INTEGRITY_UNKNOWN installed=none staging=0
CONTROL-REFUSED control=e-symlinked-destination expected=DESTINATION_IS_SYMLINK code=DESTINATION_IS_SYMLINK installed=none staging=0
CONTROL-LINK-TARGET control=e-symlinked-destination entries=empty (nothing written through the link)
CONTROL-REFUSED control=f-extra-bin-file expected=PACKAGE_EXTRA_BIN_FILE code=PACKAGE_EXTRA_BIN_FILE installed=none staging=0
NEGATIVE-CONTROLS controls=6 failures=0
```

## 10. 绿的 L2 现在证明什么 / 仍不证明什么

**证明**：M7-A 记录 `M7A-STEP verdict=VERIFIED arms=5`；沙箱资产来自固定发布产物而非 runner 构建；
安装前经过 registry integrity + 提交的 tarball sha256 + 逐文件 sha256/长度 + mode 六重校验；
真实 boot 发生在冷 runner 上（此前只能本地发生）；census 的 population、argv、两次 capture 未变。

**仍不证明**：

- 进程/PTY/网络观测面（M7-B）——五条臂覆盖的是文件效果与 bash 可达性，不是完整观测；
- npm registry 的可用性与供应链（传输依赖 registry 返回已发布 tarball；离线 runner 会
  `REGISTRY_METADATA_UNAVAILABLE` 并红，这是有意 fail closed）；
- 该 pin 包本身的构建可复现性——本 PR 只保证"发布字节 = pin 字节"，不保证"发布字节可由源码重建"；
- 归档格式兼容性：实测 tarball 为 plain ustar（`package/` 前缀、无 PAX）；若 registry 日后重新打包为 PAX，
  解包会以 typed error **拒绝**（fail closed），需要时更新 extractor 而不是放宽校验；
- 本机主 checkout 的 `system.node` 仍与 pin 不同（§1 第三行）；本 PR 不修改运行时树。

## 11. 回滚

- 资产：删除两个 gitignored 文件即回未供给态
  （`rm tests/deepseek-harness-test-use/native/system/packages/linux-x64/bin/landlock-run tests/deepseek-harness-test-use/native/system/packages/linux-x64/bin/glibc/system.node`）；
- CI：删除 workflow 中该步骤即可回到"无资产"，但**不要**恢复 M7A 豁免；若必须临时恢复，须在新 memo
  写明理由与期限（owner 决策是删除）。
- 代码：revert 本 PR 的 commit；`entries` 未被改动，旧传输与旧 pin 仍自洽。
