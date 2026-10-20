# DECISION-TICKET（四联，候真正用户决定；不急询，不阻塞任何 lane）— v1 team.create/initialWork 响应时序

**1. 问题**：v1 `team.create` 内嵌 initialWork 时，响应路径同步等待领队首回合跑完（`root-initial-work.ts:758-770`；`s6-remote.ts:2633/4006-4030`）。这是 §15.4/§15.6 冻结的旧 client compat 时序；但首回合若含"同步委派+治理 ask 停车"，等待长度=人类裁决延迟（实测 300s×2 无界，watchdog r5-watchdog.json）。
**2. 外部可见效果**：ask 世界「建团队」请求成为人质等待（无 typed 拒词/无超时），期间团队其余车道正常（catalog.list 200/32ms）⇒ 客户端超时预算须 ≥300s 才不误判产品挂（本仓 kit 已按此调）；非治理缺口，是响应耦合的可见延迟。
**3. 拟改方案（若用户未来选择改）**：Phase A（admission durable 落账）即返回 + Phase B/C 脱离请求生命周期（配 §15.7 两 factType：`team-root-work-delivered` 稍后落账天然支持）。**须用户决定**（改变所有 v1 create 客户端可见时序，与 §15.4 "RPC返回前投递" 冻结 compat 条款冲突）。替代=维持现状+文档化预算+ask 世界走 async 委派/v2 两阶段（现况实操，零改动）。
**4. 风险**：改=破坏冻结 compat 时序承诺（旧 client「create 返回=工作已投递」预期）；不改=ask 重度世界建团队体验/超时预算长期背 300s 教训；中间形（可观测上界+typed）同样改 response 形状，仍属用户决定。
**依据状态**：当前授权=§15 only（§§2–14 被 :938/:943 supersede；§2.4 phase 形被 §15.7 两 factType 取代）。任何实现前候真正用户决定；本单仅记录。
