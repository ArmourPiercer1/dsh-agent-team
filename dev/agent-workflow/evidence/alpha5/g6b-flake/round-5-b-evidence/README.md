# g6b round-5 — #337 B 路线第一步：取证（不改产品码；零关键字启发式）

本轮**只读源码写入点 + 用 round-4 的现场**。诚实标注边界：**24 腿逐条 stderr 原文语料未采集**
（采集需在套件里挂 `internalLog` 落盘，剩余预算不支持；采集配方写在文末"下一手可直接执行"）。
下面的判定全部给出**写入点行号**，不以内容猜测。

## 一、来源进程/写入点判定（写入点行号，非内容猜测）

| 通道 | 写入点 | 结论 |
| --- | --- | --- |
| launcher 控制记录 | `packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py:504` — `open(os.path.join(out_dir,"exit.json"),"w")`，内容 `{"pid":…,"rc":…}`（文档 :32-34：`After fork THIS process closes 0/1/2/3 (zero hot handles on the payload pipes), waits, and records {"pid":…,"rc":…} in <out-dir>/exit.json`） | 控制记录走**文件**，不走管道 |
| launcher 自身 stderr | 全文件 `grep -n "sys.stderr"` = **零命中**（该 launcher 从不向 fd 2 写字节） | **launcher 不是那 24 腿"话"的来源** |
| launcher 握手/`emit()` | `landlock-prelauncher.py:124-126` `def emit(obj, rc=0): print(json.dumps(obj…)); sys.exit(rc)`；文档 :30-31 握手形 `{"stream":true,"pid":<payload pid>}` | 控制帧打在 **fd 1**（与 payload stdout 同一管道），stderr 无关 |
| payload（rg）诊断 | 行的读取侧 `packages/runtime/src/plugin/live/glob-backend.mjs` 的 `child.stderr.on('data', …)`；provider 直接把子进程 stderr 作为 Readable 暴露（`packages/runtime/sandbox-provider/provider.ts:151`/`:176`，`guard(child.stderr)` @ `:335`） | 那 24 腿的字节 = **payload rg 自己的诊断** |

## 二、真实退出状态与两通道交叉（rg 律 0=有匹配 / 1=无匹配 / 2=真错）

- **wire 上没有 payload 的 rc**：`landlock-prelauncher.py` 的 DEFAULT EXIT LAW（文档 :36-38）
  = "the process itself exits 0 whatever the payload did — the constant-completion law"；
  `:510` 注释：payload 自己的码"stays inside exit.json as bookkeeping"。⇒ 行层读到的
  `exit.code` 恒为 launcher 的 0，`provider.ts:179` 也如此声明：**"`code` is the LAUNCHER's e[xit code]"**。
- 结构化结束状态**已在场但不在 wire**：`<out-dir>/exit.json` 的 `rc` 字段（:504 写）。
  行层当前**完全没有读它**（`glob-backend.mjs:983` 只用 `exit?.code`）。
- opt-in 通道已存在：launcher 有 `--exit-passthrough`（文档 :38-39，**DEFAULT OFF**）；
  provider 侧 `exitPassthrough?: boolean`（`provider.ts:103`，装配点 `:617`）；
  `exited` 的来源是 `child.once('exit', …)`（`provider.ts:337`）——即"父死信号"，不保证 stdio 读尽。
  （#336 `104b4991…fee982d2` 一支正是让**申请了的行**拿到 payload 退出码。）

## 三、分类矩阵（按已证事实填；样例原文格 = 本轮未采集，标 NOT-CAPTURED）

| 来源 \ rg 码 | rc=0（有匹配） | rc=1（无匹配） | rc=2（真错） | 出现腿 |
| --- | --- | --- | --- | --- |
| launcher 控制记录（exit.json，文件） | 在场（rc=0） | 在场（rc=1） | 在场（rc=2） | 全部 51 腿都在场；**行层未消费** |
| launcher 写 payload stderr | **不存在**（全文件零 `sys.stderr`） | 不存在 | 不存在 | 0 腿 |
| payload rg 诊断（stderr） | **可能出现 note 族**（round-4 实测：P1 basic/P2 hidden/P3 ignore/P4 VCS 等正常走查在"两流收口"后 stderr 非空） | 可能出现 | 必然出现（无效 glob 等） | 24 腿 = 行层 SPEECH 臂在收口后触发；**逐条原文 NOT-CAPTURED** |

round-4 一手现场（当时抓取的唯一字段，逐字）：
`{"ok":false,"failure":{"class":"undetermined","code":"walker-error","family":"a5glb-refused/walker-error","detail":"the walker process reported an error on its diagnostic stream`（截断于此，raw 词未落盘）。

## 四、两问直答（不设计修法）

**(甲) transport 是否把自家控制记录与 payload stderr 混流？——就 stderr 而言：不混。**
launcher 的控制记录写文件（:504），且该 launcher 全文没有一次 `sys.stderr` 写入；provider 把子进程
stderr 原样作为 Readable 暴露（provider.ts:151/176/335）。**但控制帧与 payload stdout 是同一条管道**
（`emit()` 的 `print()` @ :124-126 与握手 :30-31，都在 fd 1 上，fork 后才关 0/1/2/3）——若将来要在
stdout 侧分离"控制帧/payload 字节"，可行性落点是**握手只走一条独立 fd**（`declaredFds` 已有
`purpose` 概念，provider.ts:87），而不是在共享 stdout 上做前缀识别（零字符串猜测路线 = 通道分离，非内容识别）。

**(乙) 既然 stderr 不混流：那 24 腿的"话"就落在 rg 语义上（0/1/2 里的 note/warn 与 2 类）**，
而"非空 stderr 即 ERROR"的原契约条文位置 = **`packages/runtime/src/plugin/live/glob-backend.mjs:994`**
（`if (stderrText.length > 0) {`，其上的 `code` 取自 `:983`，`:984` 取 stderr 文本；注释在 :995-1006
说明它是"walker 是否说话"的判别器）。该契约之所以用 stderr 当判别器，是因为**wire 上没有 payload rc**
（DEFAULT EXIT LAW :36-38 + provider.ts:179 明确 `code` 是 launcher 的）。
**结构化结束状态已在场可用**：`<out-dir>/exit.json` 的 `rc`（:504 写；:510 注明它才是 payload 的码），
另有 opt-in `--exit-passthrough`（默认 OFF）/ `request.exitPassthrough`（provider.ts:103，装配 :617）。
⇒ 判据级的事实是：**"非空 stderr 即 ERROR"是 rc 缺席下的代理判据**；rg 的 1（无匹配）与 note 族
在 rc 缺席时被它一并判成 ERROR，round-4 的 24/51 正是这一条。

## 五、下一手可直接执行（本轮未做的采集，配方给全）
1. 在套件内以 `internalLog: (l) => lines.push(l)` 构 backend（glue7 已有同法先例：
   `alpha5-glue7-plane-backends.test.ts` 的 `loud` 腿），跑 P1/P2/P3/P4 与 `[unclosed` 各 ≥20 次；
2. 每次同时读该次 world 的 `exit.json` rc，落 `round-5-b-evidence/corpus.jsonl`（字段：leg, pattern,
   exit.json.rc, wire.exit.code, stderrBytes, stderrRedacted）；
3. redact 规则沿用 kit 既有 token 规则，其余逐字；
4. 产出真实矩阵填充（替换本文件第三节 NOT-CAPTURED 格）。
