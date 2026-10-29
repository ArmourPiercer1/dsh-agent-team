# s1-h0-m1 — S1 H0-M1 fixture（本目录未执行任何实验；`--go` 未跑）

**选型（root 裁定 C 路线）**：Host = 主树 HTU @ `639ed01539…`（=`dsh-v0.2.0-rc.2`），入口 `apps/cli/lib/bin.js`，**不构建、不安装**；挂载 = public profile-patch **一个 plain plugin row**（`id: s1m1-probe` + 相对 `name`，由复制件 `DshInstance.mountRows` 写入；无 preset、无 Team row、无 PR360 装配）；模型 = `mock-deepseek.mjs`（4aaaa7b2 blob `65ed64e6…` 逐字节副本，sha256 `8beade69…` ≠ HEAD 版 `e0b33490…`），loopback + 假 key；观察 = ledger 首裁 + marker + sentinel 读腿 + `/bin/echo` 腿。

**文件**：`probe-plugin.mjs`（唯一工具 `s1_m1_probe`；effect 内注册并返回 disposer，注册失败写 ledger 后 rethrow 可见失败；schema 为 wire 方言 `required:[...]`，经 pin 编译版 `assertSupportedJsonSchema` 静态 ACCEPT，旧 `required:true` 方言 REJECTED）· `m1-run.mjs`（启动器）· `s1m1-session-client.mjs`（`fetchJson/authenticate/apiPrompt` 逐字取自 4aaaa `a5p1-kit.mjs:257/:266/:279`；`apiSessionCreate` 为唯一派生件，指向 `@Remote('create')`，其真实 wire 形状 NOT_OBSERVED）· `instance.mjs`/`util.mjs`（4aaaa7b2 逐字节副本，blob/sha 见 inputs.json）· `mock-deepseek.mjs` · `inputs.json` · README。

**执行命令**：
```bash
node m1-run.mjs                   # 默认 --dry-run：只读前置 + 全量打印，零 spawn、零写 world
node m1-run.mjs --go --port 3180  # 授权实验轮专用：单次真执行（1 Host start、0 重试、30min watchdog）
```

**`--go` 单次执行链**（函数级调用图在 m1-run.mjs 头注释）：validate → preflight → world 骨架（含 mountRows patch）→ mock(:0) → env 净化（删 9 个真实凭据键名，注入假值）→ `DshInstance.start`（唯一一次）→ 401 门禁 → authenticate → `session/create` → `session/prompt`（发一条 prompt，等 200）→ 等 ledger `body-ran` → oracle。`--go` **真的发 prompt 并等结果**，非只起停；无 `body-ran` 行 = FAIL。

**预算**：1 实验 / 1 Host start / 0 重试 / 30min watchdog；失败逐步写 `runs/<world>/steps.jsonl`（RC/错误原文），失败即停，不重试、不 fallback、不清理他人资源。

**收尾（finally，仅 owned）**：`instance.stop()`（kill 自己 spawn 的 Host）→ `mock.close()` → instance 日志红写 launch token（仅留 sha256 `fp=hex8` 指纹；token 只存活于内存）→ 复验自有端口释放 → **保留 world 与全部 raw/marker/ledger/inputs，禁删 world**（root 暂停令）。

**输入面硬校验**：端口整数且 ∈ `3180-3186/3491-3500` 且 ≠3080（4aaaa `paths.mjs:81-93`）；world = `s1-h0-m1-` 前缀单 basename，拒 `..`/绝对路径/已存在/lstat 判 symlink。

**M1 PASS 语义边界**：oracle 以 **ledger** 为准——`s1_m1_probe` `body-ran` **恰 1 次**且 `ran=true`，marker(A1 唯一)/sentinel 内容/echo 输出三项全中，外加 prompt 200、会话建立、401 门禁、mock ≥2 请求、工具结果回环。缺任一项 = FAIL 并保留原始证据。**`s1_m1_other` 只是"未触发的名字"（计数 0），不是辨别力负控——未注册≠负控；真正的换代负控属 M2。** M1 不证明：竞态/`:1578→:1580` 缺失面、lib=639 构建产物（NOT_VERIFIED）、Host 可运行性、launch token、真实 listener/pid、runtime 工具来源差集、`:3080` before/after、lib 运行时加载；不授 Gate、不签 F0、不称 Kernel/CA 验证。
