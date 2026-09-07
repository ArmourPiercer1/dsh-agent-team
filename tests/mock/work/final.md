# work/final.md — 双工作流汇总

## 一、引用的工作产物（确切路径）
- work/alpha.md （绝对路径：D:\AgentDev\dsh-plugins\dsh-agent-team\tests\mock\work\alpha.md）—— W1 将 fixtures/sentinel.txt 逐字写入的产物
- work/summary.md （绝对路径：D:\AgentDev\dsh-plugins\dsh-agent-team\tests\mock\work\summary.md）—— W2 读取 fixtures/seed-note.txt 后总结写入的产物

## 二、sentinel 原文（fixtures/sentinel.txt，逐字）
DTEST-SENTINEL-20260907-7f3a-k9v2 :: the quick brown fox jumps over the lazy dog (0123456789)

校验（W1 报告）：源文件 94 字节（93 字符正文 + 行尾 LF），SHA256 = D895A205C648B02F62C4BA94196E809D957F0B9D71698BEB63896924B1838F67；work/alpha.md 与源文件逐字节一致（match=True）。

## 三、W2 总结要点（work/summary.md，源自 fixtures/seed-note.txt）
1. 部署环境：全新 DSH_HOME（tests/mock/.dsh-home），宿主端口 3181，真实模型 qwen3.8-27b，无 mock。
2. MCP 服务端：插件 MCP facet 服务端名 dtest-mini（端口 3491）；宿主级 MCP 服务端名 dtesthttp（端口 3492）；两者都只提供单个工具 ping。
3. Blueprint：dtest-bp 含 worker 与 collector 两个成员模板，成员配额为 4 个实例。
4. 策略优先级：外部硬策略（externalPolicyFacts）优先级最高，team 审批无法绕过它。
