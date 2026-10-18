# g6b round-4 — 修法 (1)「行层 'end' 收口」实测：洞在，但收口在本层会撞既有 SPEECH 臂

**按根令实施**：`spawn` 时并挂 `once('end'|'close'|'error')`（stdout+stderr），`terminate()` **之后**
`await Promise.race([streamsCollected, sleep(250ms)])`，cap 到 → 既有 `undetermined/walker-error` 臂收口
（错误码不扩、零公开面、死臂已删）。监听 `off` 配对 + `clearTimeout`。

**实测结果（本机，同一台机器跑诊断探针）**
- 诊断探针复跑（真 confined launcher，Node 层）：`probe3_streamarm.mjs 400 20 bare` → **5/400 = 1.25%** 漏读；
  同探针 `endwait` → **0/400**。机制与"end 收口在 Node 层有效"这两点**独立复现成立**。
- **但把同一形装进行层后：`alpha5-glob-backend` 51 腿中 24 腿红**，红点是**既有 SPEECH 臂**（不是我的 cap 臂）：
  `AssertionError: P1 basic: {"ok":false,"failure":{"class":"undetermined","code":"walker-error","detail":"the walker process reported an error on its diagnostic stream…"}}`
  （P1 basic / P2 hidden / P3 ignore / P4 VCS 等**正常走查**全落 walker-error）。
- 因果：忠实收集两路流之后，**正常走查的 stderr 也不再是空**——rg/launcher 在健康走查上同样会留言，
  而这些话原先因"到得比 verdict 晚"而未被看见。本行冻结律是"stderr 非空即 ERROR 腿"，
  于是收口把良性留言一并判成具名失败。
- ⇒ 在 plane/行层关闭该洞，前置条件是**对 walker 诊断流分类**（致命错词 vs 良性留言），
  或 transport 侧区分（exit-note vs error words）。分类语义是判据级改动，我不单方发明。
- 全链出现率（真 rg + confined provider，全链，非 Node 层）：**0/500**（加压 2 个并发 vitest 根时同 0），
  1500 连亦 0；已把该循环留在 `alpha5-glob-backend.test.ts` 内作为回归网（判据 = 0 例空 success）。
  旧事实保留：加压 0/20、直调 0/300——本轮全链数字是其后续，不是改写。

**本轮落地（现头）**：行层回到 36de5e58 行为（观测形，洞未关闭）；留下 500 连回归网 +
⑤ 清理计数腿（如实注明只测 Timer 句柄增长，监听配对由代码形状审计，未假称实测）；
注入腿按 ④ 删除（不留不 conformant 假件），p4t6 记账同步撤到 1197 具名钉链（10/10）。
