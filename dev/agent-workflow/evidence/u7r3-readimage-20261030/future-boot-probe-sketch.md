# future-boot-probe-sketch — u7r3 read_image（若 Q1/Q2 的 boot 级事实需 live 证明）

本轮零 boot；以下腿只在未来 C-pool 轮被协调者开启时生效。全部走 TEST_METHODS 约束：宿主 = `tests/deepseek-harness-test-use`（clone --local --no-hardlinks，detached `639ed01539…`，porcelain 必须保持空），DSH_HOME = 工作区内 `tests/homes/<world>`，端口 3180 族，严禁 :3080/~/.dsh。骨架先例 = `dev/agent-workflow/evidence/u7r3-wfpoc-20261031/`（kit 驱动、非 participant 座、transcript 落证据）。

## 腿 A — M-05 正腿 boot 验收（C2 形）

目标：真 Host attachment store（sharp 解码链）+ 真 Control bridge（非 C1 stand-in 控制腿）+ ask 模板下，治理 read_image 恰一次真实 commit。

环境（exact）：
- 基线 = `P:tests/paths.mjs` 当前 pin（本轮 = `639ed01539…` / 0.2.0-rc.2）；产品树 = 当时 master tip。
- kit = `tests/kits/rc2-real-host-smoke`（或其后续代际），preset 挂 `tool-fs`（当前 :739，原生面在场用以后置断言），蓝图 capabilities：`teamToolPlane` 启用 + fsInstance（治理 root）+ permissions：`ask: [{ tool: 'read_image', resource: { kind: 'subtree', path: <root> } }]`，模板 `default: 'ask'`（腿 A2 变体：`default: 'deny'` 复现 I-12/A-4 的 typed 拒绝）。
- 模型必须声明 image modality（route gate：H:read-image.ts:256 / P:image-executor 的 imageRoute 用 `llm.resolveModelInfo`）；用 kit 的 mock/ws 模型即可，不需要真视觉模型。
- 世界目录放一张真实小 PNG（< cap）。

断言（全 transcript 落证据）：
1. 模型可见 read_image 定义 = 治理行（placement-feed 行含 `read_image`：agent-bindings `a5g7: placement-feed rows=[…]`，:2842-2843）→ 腿 B。
2. 调用 → `admission-requires-approval` + 耐久 Control 请求行出现（真 bridge，非 stand-in）→ leader/user 批准 → `governance` 审计 `admission-grant-minted`/`admission-approved-grant-issued` → 工具输出两区块（信封文本 + `{type:'image',attachment}`）。
3. 真 store 目录出现恰好一个新附件对象（内容 sha == 归一化字节；一次且仅一次）；重放/取消语义 = I-9 的 boot 版。
4. 拒批腿：deny 决定 → 零附件写 + 世界目录零新对象 + typed `APPROVAL_DENIED`。
5. 尺寸超限腿：放一张超 store 像素法的图 → typed `IMAGE_DIMENSION_TOO_LARGE`/`IMAGE_TOO_MANY_PIXELS` 且零 commit（store 法透传 boot 版）。

## 腿 B — 原生遮蔽呈现（Q2 的 boot 级事实）

问题：booted 治理世界中同名对（preset/host-plane 原生 read_image vs plane agent 层治理行）最终呈现 = shadow 还是 `PLANE_PLACEMENT_CONFLICT`？两分支都 fail-closed，无风险面，属呈现事实。

断言：
1. 世界启动成功（preset realm 有原生 read_image，plane 在 agent 层注册同名）→ 若 boot 正常：对该 agent `tools.schemas()`/模型 surface 恰好一份 read_image，描述/render = 治理行文本 → SHADOW 成立（分层法 H:core/tools/src/index.ts:1202-1207 的 boot 确证）。
2. 若 boot 抛 `PLANE_PLACEMENT_CONFLICT` → 记录 exact message/realm，说明该 host 代际把 preset 行落进了与 agent 层同 scope 的层——同样是 fail-closed 事实，矩阵 ② 补注。
3. 对照：preset = minimal（无 tool-fs）世界 + 治理 plane → 只有一份且为治理行；无 plane 世界 → 只有一份原生（passthrough 确证）。

## 腿 C（可选）— deny-default 蓝图正腿不可达 boot 复现

A2 变体断言：typed `IO_POLICY_UNSUPPORTED … (domain-ref)`，零 Control 行、零文件读取、零附件写。

## 运行记录要求

每腿 transcript 头部打印：kit/产品树 HEAD、test-use checkout 路径 + HEAD + porcelain（应空）、DSH_HOME 路径、`date -u`。证据目录 = 本目录或后续轮新目录；home 清理按 TEST_METHODS §7。
