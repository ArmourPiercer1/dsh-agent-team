# A2C-5 — RED → GREEN 对照

## RED（pre-fix @ b96faf3 = INT_W1 product state；log: `red-run.log`）

命令：`npx vitest run packages/runtime/test/a2c5-read-fingerprint.test.ts`
前置：tracked tree pristine（`git stash push` → "No local changes to save"——无 tracked 编辑可 stash；probe 文件为 untracked，按协议留盘）。文件 LOADS 干净（无 import 错误）。

```
Test Files  1 failed (1)
     Tests  3 failed | 7 passed (10)
```

| Test | RED 结果 | pre-fix 事实（失败签名） |
|---|---|---|
| T1 omitted ≠ explicit-2000 identity | **FAIL** | `expected 'sha256:841a4401…' not to be 'sha256:841a4401…'`——两调用同一 fingerprint（伪等价存在；omitted 被铸造为 `limit: 2000` 投影，非 `limit: null`） |
| T6 one-shot（omitted allow → explicit-2000 attempt） | **FAIL** | `expected true to be false`（`DIR_A.cross.allowed`）——explicit-2000 attempt **消费了** omitted identity 的 one-shot allow（同 correlation 下 scope key 相同 = 跨 identity 消费） |
| T7 one-shot（explicit-2000 allow → omitted attempt，对称方向） | **FAIL** | `expected true to be false`（`DIR_B.cross.allowed`）——对称跨 identity 消费 |
| T2 omitted deterministic | pass | （invariant 腿：两侧恒真） |
| T3 explicit-2000 deterministic + identity 不变（字节级 digest） | pass | 同上 |
| T4 explicit 100 vs 200 不同 | pass | 同上 |
| T5 resource/offset 改变仍不同 | pass | 同上 |
| T8 offset 语义不变（omitted ≡ explicit 1） | pass | 同上 |
| T9 resolver/guard opaque 消费 | pass | 同上 |
| T10 非法显式 limit/offset 仍 fail closed | pass | 同上 |

## GREEN（post-fix，同命令）

```
✓ packages/runtime/test/a2c5-read-fingerprint.test.ts (10 tests)
✓ packages/runtime/test/a2-canonical-operation.test.ts (31 tests)
Test Files  2 passed (2)   Tests  41 passed (41)
```

| Test | GREEN 结果 | 证明 |
|---|---|---|
| T1 | pass | omitted 投影 = `{ tool, resourceKey, offset: 1, limit: null }`（字节级 digest pin）；与 explicit-2000（`limit: 2000` 投影，digest 不变）**不同**——§8.4 "omitted vs explicit 2000 fingerprint different" |
| T2/T3 | pass | §8.4 "omitted limit deterministic" / "explicit same limit deterministic" + explicit-2000 pre-A2C-5 identity 逐字节不变（`sha256:841a4401…` 保持 = 旧 explicit 投影 digest） |
| T4/T5 | pass | §8.4 "explicit 100 vs 200 different" / "resource / offset 改变仍不同" |
| T6 | pass | §8.4 "allow-once for omitted call 不能被 explicit-2000 call 消费"：cross attempt = `no-request`（fail closed，零写入零消费）；omitted allow **存活**并恰好授权一次（第二次 = `allow-consumed`） |
| T7 | pass | 对称方向同样不跨 identity 消费 |
| T8 | pass | offset 语义不变（recon 裁决：pinned `parseReadArgs` omitted → 1） |
| T9 | pass | static resolver（rule scope = tool + opaque resource key）+ control guard（opaque `'sha256:…'` 字符串）对新 identity 零结构改动消费 |
| T10 | pass | `read-limit-invalid` / `read-offset-invalid` 闭集 reason 逐字保留（镜像 upstream 校验未动） |

## H1/H4/H5 不回归（focused gate，`focused-gate.log`）

`npx vitest run` 10 suites（a2c5/a2/a3/a4a/a5a/a2c1/a2c4/h1a/h4/h5）= **270/270 pass**：
- H1：`h1a-pre-execute-endcap` 49/49（end-cap 单调性原样）；
- H4：`h4-rule-identity` 10/10 + `a3-permission-resolver` 28/28（fresh canonicalize per decision、rule identity 不变）；
- H5：`h5-bash-effects` 25/25（shell fingerprint effect-identity 未触碰——A2C-1 区零改动）；
- A2C-1：`a2c1-pwsh-permission` 28/28（shell 区零改动）；
- A4/A5：`a4a-control-exact-scope` 28/28 + `a5a-pre-execute` 50/50 + `a2c4-external-lastmile` 11/11（guard exact-scope / adapter / last-mile 结构未动，fingerprint opaque 消费成立）。
