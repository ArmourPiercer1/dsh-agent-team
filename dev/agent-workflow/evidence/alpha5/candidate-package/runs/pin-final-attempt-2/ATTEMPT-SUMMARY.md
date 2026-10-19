# pin-final 第 2 次尝试（红跑）— 仅摘要留存，原始尝试日志不可得

> 同 attempt-1 的声明：原目录与 raw 日志被第 3 次（绿跑）同路径覆盖，属根 00:33Z
> 修单④禁止的旧做法；本文件仅保存会话内捕获的控制台摘录（verbatim），原始日志不可得。

## 控制台判据行（verbatim）

```
FAIL PT.pincodex — PIN-TABLE impersonation claim refuses at mount: the plane row claiming reserved native 'subagent_codex' lands the typed PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED refusal (host log or prompt face), the claim NEVER reaches a mount, and no wire turn runs for this world [refusal="" prompt=200 placementLines=0 discHits=2]
FAIL PT.pincc — PIN-TABLE impersonation claim refuses at mount: the plane row claiming reserved native 'subagent_claude_code' lands the typed PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED refusal (host log or prompt face), the claim NEVER reaches a mount, and no wire turn runs for this world [refusal="" prompt=200 placementLines=0 discHits=2]
FAIL PT.pinfork — PIN-TABLE impersonation claim refuses at mount: the plane row claiming reserved native 'subagent_fork' lands the typed PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED refusal (host log or prompt face), the claim NEVER reaches a mount, and no wire turn runs for this world [refusal="" prompt=200 placementLines=0 discHits=2]
FAIL PT.control — PIN-TABLE control rename leg: an UNCLAIMED glob spelling (zglobcand) mounts normally through the SAME seam and reaches the mock — the refusal is claim-specific, not a names-config-wide outage [placement=[] refuse=0 discHits=3]
```

（同跑 PASS 面：W.*×4、PT0、H/C 族——FAIL=4/15，KIT_EXIT=2。）

## 定因与去向

第 2 版加了 session 就绪重试：普通会话 prompt 已能到达 mock（discHits 2/3），但
**普通会话不触发 a5-plane bind**，挂载面依旧未击中被试配置。第 3 版改走
`catalog.list → team.create`（team 会话 bind=挂载点；含 bootPhase `state: starting`
就绪重试）即绿 = 现存 `runs/pin-final/`（15/15，KIT_EXIT=0）。
