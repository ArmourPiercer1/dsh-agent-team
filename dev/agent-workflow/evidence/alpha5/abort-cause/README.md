# abort-cause — #340 跟进修复：install 包装层取消原因中继（RED→GREEN 证据）

- Writer: qwen-only writer 轮；worktree `.worktrees/a5-abort-cause`，分支 `a5-abort-cause`。
- **基线双源记**：建 worktree 时 `git ls-remote origin master` = `ca7ab2abcfa0d91650bbb2994395a7bd9c065b59`，`git worktree add` 落 `HEAD=ca7ab2ab`（`git rev-parse HEAD` 同值）；worktree porcelain=0。不 push。
- 修复单：`dev/agent-workflow/evidence/alpha5/c1-swallow-diag/repair-ticket-install-signal-cause.md`；
  三跑对照测量（本目录不重跑其测量，直接引用）：`../c1-swallow-diag/DIAGNOSIS.md` §②③/§④分布表（`entry={"kind":"user"}` vs `gen1={"reason":"inherited-signal","tool":"team_bash"}` 三跑同形；rc=-15@FiredAt+5.4/7.0/7.7/6.2ms 四样本）。

## 根因字节（唯一改动面）

`packages/runtime/tool-dispatch/install.ts` `armWrapperSignal.forward`（原 :886）：
包装层替换信号后以自己的 marker `{reason:'inherited-signal', tool}` 重播 abort，丢弃宿主原
`AgentCancelCause`。GREEN 字节（修复单候选）：

```ts
record.controller.abort(incoming?.reason ?? new DOMException('inherited-signal', 'AbortError'))
```

try/catch 的旧注释「the abort itself never carries the reason object」与 Node≥17.3
`abort(reason)` 语义不符，按修复单一并更正；`armWrapperSignal` 头契约义务 2 补记「转发原因形状」
条款。marker 信息不再保留（修复单：如需保留移入 relayNote——本轮无既有消费者，亲测全仓
`grep inherited-signal` 除本文件/其 dist 镜像外零消费者，故不落 relayNote，最小改动）。
`packages/runtime/dist/**/install.js`（tracked 镜像）经 `pnpm --filter @dsh-agent-team/runtime build`
重建随提交（dist-rebuild.log）。

## RED → 绿实录

测试：`packages/runtime/test/a5r-cause-relay.test.ts`（装配级：`installScopedToolGuard` 安装的门
= `armWrapperSignal` 路径，非直调；row 腿挂在门后、只被**所持信号的 abort** 结算=修复单指定的
「假 exited 永不结算」；消费者断言用 plane 的 `shellCancelled` 闭合法本体，非复刻）。

- RED（修复前字节，最终 9 腿文件）：`RED-unfixed-final.log` — **8 failed | 1 passed (9)**；
  红形 = 行所持信号 reason 实测 `{reason:'inherited-signal', tool:'team_bash'}`（R1 实录
  `expected { kind: 'user' } to be { reason: 'inherited-signal', … }`），R1-R7+R9 全红，
  R8（lane 自有 definition-moved 词）如设计本就绿。
  首轮 8 腿 RED 亦留档：`RED-unfixed.log`（7 failed | 1 passed，R9 加入前）。
- GREEN（修复后字节）：`GREEN-fixed.log` — **9 passed (9)**。
- 复核要点三件（收口诊断员转发，parent 22:1xZ 消息）对齐：
  ① 红断言对象 = 行所持（门后 wrapper）信号的 `reason.kind==='user'`，且断言的是**宿主原因对象
    本体**（`toBe(cause)` 同一性，强于 .kind），路径必经 `armWrapperSignal`（R1 还断言
    `signalWasReplaced=true` 证明所持非 phase 信号=实测 sig-swap 形）；
  ② hook/disposed 两臂各一例（R3/R4，union 全覆盖 + user/parent = 闭合法四臂全数）；
  ③ GREEN 判据含「wire 死亡形不变」负断言 = **R9**：body 启动后 abort → 装配 double 的
    `dispatchToolBody` 后置替换腿（镜像宿主 `@639ed01539 :1583`，即安装面 `tools/lib:3312` 法律，
    DIAGNOSIS §A Q1）仍铸 `code=ABORTED` + `Error: tool call aborted`，`JSON.stringify(result)`
    全串无 `cancelled` 子串；本修复零宿主字节，net-1 替换法律不碰。a5b3/a5g7 回归见下表。

## 边界钉（修复单「边界一句话」+ 根裁决②）

- 不改变 wire 死亡形：宿主 `tools/lib:3312`（测试宿主 `@639ed01539` 语义同源）替换法律零触——
  本目录无一行宿主字节；R9 为负断言。`cancelled:true` 上 wire 仍是 CORE_SEAM_BLOCKER 范畴
  （`../c1-swallow-diag/core-seam-blocker.md`），本单不宣称、不触碰。
- 不新增权限、不动 PTC/审批面：diff 仅 install.ts 中继字节 + 注释、其 dist 镜像、新测试、p4t6 入账。
- timeout 形/deadline 形 reason 语义零动：R5（DOMException 同一性透传 + 闭合法拒铸）、
  R6（无 reason abort 落 AbortError、不落 marker）。lane 自有 abort 词零动：R8
  （`definition-moved: ` 前缀保持，`pending-calls.ts:134` 未改）。

## p4t6 具名入账（现场亲数重 tie，禁抄）

- 入账前现场扫描：`p4t6-RED-unbooked.log` 读 **`expected 1204 to be 1203`**（= master 实测 1203
  + 本文件恰一 scannable 新文件）。
- 入账后：`p4t6-GREEN-anchored.log` 10/10 绿。`SCANNED_PATHS_A5CAUSE`（1 路径）加入两处
  length 总和、逐路径断言清单、`expect(SCANNED_PATHS_A5CAUSE.length).toBe(1204 - 1203)`；
  coverage 标题字面尾数=1204（等值现场读数）。

## 回归表（见各 log）

| 组 | 套件 | 结果 |
|---|---|---|
| tool-dispatch 邻域全套（a5p1×3 + a5p1r×5 + a5p2-composition + a5pbr2-binding-feed + a5natexe）+ a5r（9 腿）+ glue7 + a5b2 + a5b3 + glob 组抽跑×3 + p4t6 | 19 文件（`regression-battery.log`） | **19 passed · 254/254 · EXIT=0**（206.7s） |
| a5g7 观察面（render/install-face：a5g6-install-face-render + a5p5-tools 全套 9 件 + a5r） | 10 文件（`regression-render-face.log`，最终字节重跑） | **10 passed · 90/90** |
| typecheck（`pnpm -r`，最终字节复跑） | 全包 | **EXIT=0**（typecheck-rerun-final.log） |
| eslint（`pnpm lint` 全仓 + 本轮三文件直跑） | 全仓/三文件 | 本轮三文件 **0 问题**（直跑 exit 0）；全仓 129 errors 为 **base 预存**（flagged 文件集 ∩ 本 diff 文件集 = ∅，comm 亲测；eslint.log） |
| drift at-head（`check:artifacts:head`） | 对提交 rev 跑 | **verdict=ok · drift=0 · 1748 files**（「HEAD carries its own build」；check-artifacts-at-head.log） |

## HEAD 实录

| 项 | 值 |
|---|---|
| worktree/branch | `.worktrees/a5-abort-cause` / `a5-abort-cause`（1 task=1 worktree=1 writer；不 push） |
| 基线（双源记） | `git ls-remote origin master` = `ca7ab2abcfa0d91650bbb2994395a7bd9c065b59`；worktree `git rev-parse HEAD` = 同值 |
| 提交 | `1c70641e59a7acb9dd0e28bedf4e091fc60ce455`（amend 后终值见分支 tip；amend 仅追加证据 log 文件，两安装面字节不变，drift at-head 判定树不受影响） |
| porcelain | 0（提交后亲测；launcher scratch `out//plans//tests/homes` 瞬态自清，提交前复核） |

## 世界漂移注记（H1b 协议：上报不拦停）

建 worktree 后、收口前，`git ls-remote origin master` 由 `ca7ab2ab`（本分支基点，双源记见上）
前进到 `52d73534`（#341 台账/覆盖重组轮）。只读核查：`ca7ab2ab..52d73534` 对
`packages/runtime/tool-dispatch/` 与 `packages/testkit/test/p4t6-session-event-scan.test.ts` **零差异**
（diff 空）⇒ 本修复与 p4t6 入账在新 tip 上字节等价成立。本分支基点按 1-worktree-1-writer 纪律保持
ca7ab2ab 不动。

## 装配级复跑注记

修复单回归段「装配面复跑 c1sw-kit：member lane witness 应翻 cancelled=true」属 kit/环境轮
（真安装世界 + landlock + 端口族），且三跑对照测量按指令直接引 DIAGNOSIS 不重跑；本目录交付
= lane 装配级红绿（armWrapperSignal 路径）+ 上表回归。诊断员候命可召回复跑。
