# manifest-example/ — evidence-manifest/1 worked example（实算实例）

规则正本 = [`../EVIDENCE-OFFLOAD-RULES-20261031.md`](../EVIDENCE-OFFLOAD-RULES-20261031.md)（v1.0，USER-RULING-20261031 §5 原则批准的初版）。

本目录三件：

| 文件 | 性质 |
| --- | --- |
| `evidence-manifest.json` | **真实实例**：既有 tracked 目录 `dev/agent-workflow/evidence/u7r3-pilot-c2-20261029` 的全量 manifest（27 artifacts / 4 runs / 1,005,739 bytes），哈希 = `sha256sum` 实算，基线 commit `89d96a13d3219aa52b3492beb42d30a1ba59daf7`。 |
| `generate-example.mjs` | 实例生成器（示例专用，硬编码该目录与分类表）；**不是**生产工具——生产工具为规划中的 `scripts/evidence-verify.mjs`（规则 §6，本 lane 只交付合同 sketch）。对证据树只读。 |
| `README.md` | 本文件：复现与独立校验方法。 |

## 复现（字节级，除 `createdAt` 外）

```bash
node dev/agent-workflow/gates/manifest-example/generate-example.mjs
```

## 独立校验（不经生成器，直接 sha256sum 对照）

```bash
cd "$(git rev-parse --show-toplevel)"
node -e 'const m=require("./dev/agent-workflow/gates/manifest-example/evidence-manifest.json");for(const a of m.artifacts)console.log(a.sha256+"  "+a.path)' > /tmp/ev.sha
sha256sum -c /tmp/ev.sha   # 期望：27 行全部 OK
```

## 实例要点（供快速核对规则条文）

- 4 个 RUN 全部如实记录 `overallVerdict=FAIL`（索引忠实 run record 原文）；`hostSha` 全为 `639ed015397290b3745d163aafe02ffee4aa3f84`。
- 保留分级：`git-forever` 18（R1–R5：run records / oracles / digests+evidence JSON / boot 账本 / composed-profile 快照）；`offload-eligible` 5（stdout 日志 + `setup-failure.json`）；**`restricted` 4**——4 份 `instance-port*.log` 被真实敏感扫描命中（`boot-token-url`），manifest 只记 pattern/偏移/长度、不含命中值（规则 EO-4）。
- `backend.kind="none"`、全部 `location.state="in-git"`：迁移前的合法初态演示（本 lane 不部署、不迁移）。
- 去重实证：两份 oracle（`c2/arc-a`、`c2-r2/arc-a`）SHA-256 相同（`95faa895…`），内容寻址下并为一式原件。

**为什么实例不在证据目录内**：本 lane 不动既有证据目录（规则 §0）；新 RUN 起 manifest 才按 EO-6 随目录交付。
