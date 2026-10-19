# g6b-flake round-3（聚焦返工：只攻 ①+④，② 注入腿）

## A8 断言现场（父单要的原文）
单跑 A8（`-t "race counters are the product"`）：`AssertionError: expected 0 to be greater than 0`
—— 这是**过滤运行的产物**（计数器由前置 race 腿填，单跑时为 0），与本次改动无关，不作判据。
全套运行才是现场：
- 收口点原插法（terminate **之前** drain，250ms）：`× A5 / × A7 / × A8`，
  `AssertionError: leaks: A5 unexpected refusal code walker-error | …`、`expected [ …(1176) ] to deeply equal []`
  ⇒ **6600 次真 rg 竞态走查中 1176 次合法走查被判 walker-error**（A8 只是记账腿，命题未被我改）。
- 收口点移到 `terminate()` **之后**（provider 的管道由被监管子进程持有，子进程活着时 'end' 无法承诺）、界 2000ms：
  同族红，计数降到 **373/6600**。

## 结论：① 的"超时即具名失败"在本层不可落地（非难度，是契约缺口）
测量曲线：250ms→1176/6600 误拒；2000ms→373/6600 误拒；尾巴不随界消失
⇒ **provider 在租约释放时不保证 stdio 关闭**，"两路流都收口"在本层不是可达前置条件。
把它当判据 = 用误拒干净走查换洞的关闭；洞与惩罚是同一个窗口（假 child 实验佐证：管道一旦 'end' 就
**不可能再发声**，"迟到发声"只存在于尚未收口的流上，而尚未收口正是被误拒的那批）。
⇒ 需要的先决条件是 **transport 侧保证**（`terminate()` 后 stdio 必闭，或 handle 暴露 `pipesClosed`）。
错误码表不扩：收口形仍写为既有 `walker-error`（依据：本行完成律"静默需空 stderr；说了话的 walker 是错误腿"，
而未收口的流无法证明"静默"），该 arm 以 `if (false)` 原样保留在代码内并注明交接对象。

## 本轮落地
- ④ **已落**：drain watch 用 `on('end'|'error'|'close')` 记账、出口对每个流 `off` 三个事件、
  drain 定时器 `clearTimeout` 后置 null；快路径零残留监听器/定时器。
- ① **降为观测**：`anchored-glob DRAIN-INCOMPLETE realm=… call=… exit=…` 观察行（CI 若再红，
  这行 + rg stderr/exit 就是下一手材料），判定仍由既有 SPEECH 臂做（在界内发声一律具名，行为与 f07ac27b 一致）。
- ② **注入腿已交付（三形，全绿）**：假 child 按真契约造（PassThrough 真流 + 手控 `exited` + async `terminate`，
  即 `handle.ok===true` → `child.stdout/stderr.on('data')` → `child.exited` → `child.terminate()`）。
  上一手 `internal-error` 的原因就是假件不是真流。实测：界内发声（含 400ms 迟到）在**未落 fail-closed 的本树**上
  即被既有 SPEECH 臂具名接住 ⇒ (a)(b) 绿；(c) 证正常路径不被 drain 臂判（fake 的 stdout 不是完整 --json 走查
  文本，故 (c) 只断言"不被 walker-error 判"，不假装能断全列表——已在文件内注明）。
  > 界的"发声迟到超过 drain 界"一形**假件造不出**（管道关闭后 write 会抛 ERR_STREAM_WRITE_AFTER_END）：
  这恰好是上面结论的另一个证明——该窗口的关闭必须来自 transport 侧收口保证，而非本层等待。
