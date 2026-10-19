# pin-final 第 1 次尝试（红跑）— 仅摘要留存，原始尝试日志不可得

> 恢复结论：本目录**不是**原始 run 目录。原 `runs/pin-final/` 第 1 次尝试的目录与 raw 日志在
> 修正 kit 后被同路径重跑覆盖（该做法已被根 00:33Z 修单④禁止：此后红跑目录只增不覆，
> 重跑一律新时间戳）。此处逐字保存当时会话内捕获的**控制台摘录**（判据行原文），
> 原始 `instance-*.raw.log`/`*.partial.json` 不可得。

## 控制台判据行（verbatim）

```
FAIL PT.pincodex — PIN-TABLE impersonation claim refuses at mount: the plane row claiming reserved native 'subagent_codex' lands the typed PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED refusal (host log or prompt face), the claim NEVER reaches a mount, and no wire turn runs for this world [refusal="" prompt=200 placementLines=0 discHits=0]
FAIL PT.pincc — PIN-TABLE impersonation claim refuses at mount: the plane row claiming reserved native 'subagent_claude_code' lands the typed PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED refusal (host log or prompt face), the claim NEVER reaches a mount, and no wire turn runs for this world [refusal="" prompt=200 placementLines=0 discHits=0]
FAIL PT.pinfork — PIN-TABLE impersonation claim refuses at mount: the plane row claiming reserved native 'subagent_fork' lands the typed PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED refusal (host log or prompt face), the claim NEVER reaches a mount, and no wire turn runs for this world [refusal="" prompt=200 placementLines=0 discHits=0]
FAIL PT.control — PIN-TABLE control rename leg: an UNCLAIMED glob spelling (zglobcand) mounts normally through the SAME seam and reaches the mock — the refusal is claim-specific, not a names-config-wide outage [placement=[] refuse=0 discHits=0]
```

（同跑 PASS 面：W.*×4 三零重装、PT0 registry 69/68、H/C 族——FAIL=4/15，KIT_EXIT=2。）

## 当次诊断线索（会话内检查记录，原件不可得）

- prompt 响应体为 `{"result":{"ok":false,"error":{"code":"session/not-found","message":"session \"cand-pincodex-root\" not found"}}}`；
- 各 `instance-*.raw.log` 仅 ~437 B（plugin registered + remote mount，无 bind/placement 行）。

## 定因（后续修正依据）

探针发到了**普通 root 会话**的 `session/prompt`；a5-plane 挂载发生在 **team 会话 bind**
（agent-bindings `createTeamToolPlaneAssembly` 调用点），普通会话无 governed 绑定 →
从未触挂载；且 bootPhase 建的会话为异步注册，单发即 session/not-found。
