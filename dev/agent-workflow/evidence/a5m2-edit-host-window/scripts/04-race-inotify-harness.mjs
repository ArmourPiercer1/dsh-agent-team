/**
 * A5M2 EDIT/SRE host-window prep — 04 RACE ×2 INOTIFY HARNESS (WRITTEN, NOT RUN).
 *
 * 两件 P2 卡命名的 UNVERIFIED race（作者侧 counting-getter 已钉检查序，真实
 * 时序未证；本 harness 即其窗口内顺跑设计）。端口 3185，世界 README §3 race 行。
 *
 * 观察原理：对世界根目录开 inotify（IN_CREATE | IN_MOVED_TO | IN_ATTRIB |
 * IN_MODIFY 事件流 + 单调时间戳），与调用终态/行终态三方对表。事件流是唯一
 * 不依赖被验代码自述的证据源——**事件为零才是零创建，事件在场才是真副作用**。
 */
import { watch, existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

/** 起观察器：返回事件收集器与停表函数。窗口 owner 在发起调用【之前】start。 */
export function startInotify ({ watchRoot }) {
  const events = []
  const t0 = process.hrtime.bigint()
  const watcher = watch(watchRoot, { persistent: false }, (eventType, filename) => {
    events.push({
      tMs: Number((process.hrtime.bigint() - t0) / 1_000_000n),
      eventType,
      file: String(filename ?? ''),
    })
  })
  return {
    events,
    stop: () => watcher.close(),
    /** 与 cancel 注入点/行终态对表用 */
    createsOf: (file) => events.filter((e) => (e.eventType === 'rename' || e.eventType === 'change') && e.file === file),
  }
}

/**
 * R-A：cancel 落在 post-bind/pre-create 之间 → **零创建**（无新文件、无
 * 半途 temp、无 O_EXCL 成功）。注入：leader allow 后、execute 消费前的
 * client abort（kit 通道的 cancel/abort 形）。
 */
export function assertRA_cancel_post_bind_pre_create ({ inotify, targetName, cancelAck, errorText, finalRowState, freshPath }) {
  if (cancelAck !== true) throw new Error('R-A: cancel must be acknowledged before the race window closes')
  // 1) 真 FS 证据源：目录事件里【不得】有该名的 create。
  if (inotify.createsOf(targetName).length !== 0) throw new Error('R-A: inotify saw a CREATE — the post-bind recheck FAILED to stop the open')
  // 2) 终态文件不存在（事件零 + 存在性零，双源）。
  if (existsSync(freshPath)) throw new Error('R-A: the target exists — zero-creation law broken')
  // 3) 调用以 typed cancel 终了（非成功措辞、非 untyped hang）。
  if (!/[Cc]ancel/.test(errorText)) throw new Error('R-A: expected a typed cancellation refusal')
  if (finalRowState !== 'CONSUMED') throw new Error('R-A: the consume fact stands (approval was spent before the cancel — honest, unchanged)')
}

/**
 * R-B：cancel 落在 create 之后 → **真副作用在场**：inotify 必有 CREATE；
 * 文件在场且字节完整；cancel 报告为 IN-FLIGHT/undetermined +
 * sideEffectPossible=true（取消不能倒带已发生的 O_EXCL 成功）。
 */
export function assertRB_cancel_post_create ({ inotify, targetName, content, errorText, freshPath }) {
  const creates = inotify.createsOf(targetName)
  if (creates.length === 0) throw new Error('R-B: inotify saw NO create — window missed (rerun with larger file_text to widen it; do NOT downgrade the claim)')
  if (!existsSync(freshPath)) throw new Error('R-B: create event without a surviving file (unlink?) — investigate, do not sign')
  if (readFileSync(freshPath, 'utf8') !== content) throw new Error('R-B: created bytes incomplete — torn write past the cancel point')
  if (!/[Cc]ancel/.test(errorText)) throw new Error('R-B: expected a cancellation report')
  if (!/side-effect-possible=true|sideEffectPossible.{0,3}true/.test(errorText)) throw new Error('R-B: the post-create cancel must report the side effect as POSSIBLE (undetermined)')
  void createHash
}

/**
 * 窗口内跑法（只钉步序）：
 *   1. startInotify → 2. 发起调用（R-A：SRE create 短 file_text；R-B：长
 *      file_text 加宽窗口）→ 3. 按通道注入 cancel（R-A 于 row 出现后即刻、
 *      R-B 于收到首个 in-flight 心跳后）→ 4. 终态三方对表（本文件断言）→
 *      5. stop() + 事件流全量 append 到本 evidence 目录 race-<UTCts>.jsonl。
 * 两条各跑 ≥3 次取稳定结论；任一次 R-A 见到 CREATE 或 R-B 交不出
 * side-effect-possible 措辞，即为未闭发现，按 blocker 格式上报，不粉饰。
 */
