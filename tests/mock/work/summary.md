# fixtures/seed-note.txt 内容总结

本文件是「DTest 种子笔记（供 collector 工作流 B 使用）」，共 4 条事实：

1. **部署环境**：全新 DSH_HOME（`tests/mock/.dsh-home`），宿主端口 3181，真实模型 qwen3.8-27b，无 mock。
2. **MCP 服务端**：插件 MCP facet 服务端名 `dtest-mini`（端口 3491）；宿主级 MCP 服务端名 `dtesthttp`（端口 3492）；两者都只提供单个工具 `ping`。
3. **Blueprint**：`dtest-bp` 含 `worker` 与 `collector` 两个成员模板，成员配额为 4 个实例。
4. **策略优先级**：外部硬策略（`externalPolicyFacts`）优先级最高，team 审批无法绕过它。
