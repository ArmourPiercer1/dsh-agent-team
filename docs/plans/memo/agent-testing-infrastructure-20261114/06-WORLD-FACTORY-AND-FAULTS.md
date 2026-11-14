# 06 — World Factory / Real Host / Fault Injection 契约

[返回索引](README.md) · [Oracle](05-SCRIPTED-MODEL-AND-ORACLE.md) · [缓存](08-BUILD-CACHE-AND-PROVENANCE.md)

## 1. 复用已有测试基础，拒绝第二套 Harness

现有：`tests/paths.mjs` 为测试路径/pin/端口约束源，`tests/deepseek-harness-test-use` 为 gitignored pristine Host，`tests/homes/*` 为 World 的 DSH_HOME。`docs/TEST_METHODS.md` 禁止干扰稳定 `:3080` GUI 实例。这些约束必须保留，不能因为并行化而重写。

新增只应是 World Factory 的 **薄接口** 和可靠清理/故障注入适配器；不应绕过现有 port leasing 或引入另一套 run-id/目录协议。

## 2. 三层生命周期

| 资源 | 共享性 | 版本绑定 | 清理 |
| --- | --- | --- | --- |
| Base: Node/pnpm/系统工具 | 可不可变复用 | 平台、工具版本 | 以缓存失效更新 |
| Host & Product build | 同一已验证身份可只读共享 | Host commit、lockfile、toolchain、合成 merge tree | 只读，按缓存生命周期 |
| World: DSH_HOME/ledger/DB/PTY/端口/工作区 | 每项独立测试新建 | unique world-id、run-id、shard-id | 确认所有权后清理 |

共享宿主 binary ≠ 共享宿主可变状态。尤其不能通过复制已运行的 `DSH_HOME` 来模拟“干净环境”。

## 3. 推荐 World API（示意性 TypeScript 接口）

~~~ts
interface TestWorld {
  readonly worldId: string;
  readonly hostSha: string;
  readonly productTree: string;
  readonly home: string;
  readonly ports: ReadonlyArray<number>;
  start(): Promise<void>;
  awaitReady(): Promise<void>;
  injectFault(fault: FaultSpec): Promise<FaultReceipt>;
  observe(): Promise<WorldObservation>;
  stop(): Promise<void>;
  verifyTeardown(): Promise<void>;
}
~~~

创建失败必须做到**没有半个可运行的世界**；在任何真实工具调用前确认 World owns test directories/ports/process group 且不会访问稳定实例。

## 4. Fault Injection：按状态边界而非固定 sleep

推荐固定故障点：
- Before ReviewRequest durable write；
- After ReviewDecision before execution；
- After dispatch before effect confirmation；
- After real side effect before result durable commit；
- After durable result before Agent acknowledgement；
- Stop 与待处理 approval/Goal handoff 并发；
- SIGKILL 后冷启动；人工恢复与未恢复路径。

E0/E1 使用 barrier/挂起 Promise/可控 clock，测试参考状态机；E2 对真实进程在可观察阶段使用 `SIGKILL`，重建进程后读 durable 状态和副作用 witness。无真实可见 fault boundary 时必须披露，而不能仅称“已做故障注入”。

## 5. Stop / Recovery 红线

- 冷启动默认不自动唤醒 Officer，不因检测到未决 ReviewRequest 就执行之前的轨迹。
- 对 `UNKNOWN_EFFECT` 的旧操作不得盲重放；如果产品契约要求人工裁决/恢复，则测试必须覆盖不恢复及经显式恢复两条路径。
- 生产代码必须遵守已批准的执行状态机；World Factory 的参考模型用于检查，不能成为运行时另一份状态权威。

## 6. 环境能力与移植

Linux OS-confinement/bwrap、PTY、网络出口可见性属于专用 Runner/World 能力；没有该能力时不能用纯 Node Mock 假装 E2 已验证，应报告 `ENV_BLOCKED`/`INSTRUMENT_ERROR`。WSL/Windows 场景可设专门 smoke 或 L3 兼容矩阵，但不得替代 Linux 安全负控。

## 7. 可验收的清理协议

- fresh World unique ID + 工作目录使用 owner-controlled test subtree；
- 启动前确认安全端口、路径、无活动锁冲突；
- 捕获进程组 pid、创建时间与唯一启动 token，teardown 只杀自己创建的资源；
- 正常完成/超时/SIGKILL 都要清理或明确隔离保留，禁止误杀稳定 DSH；
- 改善隔离后应执行“故意串用同一 HOME/端口”的负控，必须拒绝；
- 观察器异常、进程残留或无法确认 teardown 时，测试世界状态为失败/不可判定，不能 PASS。
