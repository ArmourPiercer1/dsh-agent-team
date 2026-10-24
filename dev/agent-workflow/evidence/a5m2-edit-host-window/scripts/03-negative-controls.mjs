/**
 * A5M2 EDIT/SRE host-window prep — 03 NEGATIVE CONTROLS (WRITTEN, NOT RUN).
 *
 * 载体同 02（c1-leader-approval-smoke 的 bootHost/resolveControl/零触探针形）。
 * 端口 = 规划 3184（独立世界 README §3 neg 行）。核心不变量：**deny lane →
 * 零执行字节**；classify 前 typed 拒 → **零行**。所有字节判据用 before/after
 * sha256 + mtime 双测，不靠回执措辞。
 */
import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'

const sha = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`

// ── N1 edit deny → 零 write ─────────────────────────────────────────────
export function assertN1_edit_deny_zero_write ({ row, decision, target, bytesBefore, bytesAfter, mtimeBefore, mtimeAfter, consumptions }) {
  if (decision !== 'deny') throw new Error('N1: deny lane')
  if (row.reviewPayload.familyId !== 'B-EDIT') throw new Error('N1: row exists before the deny (ask lane)')
  if (bytesBefore !== bytesAfter) throw new Error('N1: ZERO write on deny (bytes moved)')
  if (readFileSync(target, 'utf8') !== bytesBefore) throw new Error('N1: disk re-read equals pre-state')
  if (mtimeBefore !== mtimeAfter) throw new Error('N1: ZERO write on deny (mtime moved — no touch-open either)')
  if (consumptions !== 0) throw new Error('N1: a denied row never consumes')
}

// ── N2 SRE deny → 零 echo（view 拒后模型面不得含文件内容）────────────────
export function assertN2_sre_deny_zero_echo ({ modelText, secretLine }) {
  // secretLine = 世界文件里放的一行哨兵（如 `CANARY-<ts>`）；deny 后调用以拒
  // 终了，模型面 = 风险事实 In-BAND 的 refusal message，绝非正文：
  if (modelText.includes(secretLine)) throw new Error('N2: denied view ECHOED file content')
  if (!modelText.includes('cf-class=denied')) throw new Error('N2: the refusal must carry the risk facts in-band')
}

// ── N2b SRE str_replace deny → 零 write（同 N1 判据 + B-SRE 行）─────────
export function assertN2b_sre_deny_zero_write ({ row, target, hashBefore, hashAfter }) {
  if (row.reviewPayload.familyId !== 'B-SRE') throw new Error('N2b: family')
  if (hashBefore !== hashAfter || hashBefore !== sha(readFileSync(target))) throw new Error('N2b: bytes intact under deny')
}

// ── N3 escalation / undeclared 参数 = classify 前 typed 拒 → 零行 ────────
export function assertN3_classify_before_row ({ errorText, rowsCreated }) {
  // 真 runtime 步序复现：成员调 edit（或 SRE）带 undeclared 顶层键
  // （sandbox_permissions / justification…）→ 拒发生在 ANY control row
  // 存在之前（legInputs=0 的 Host 面对应 = pending-approvals 列表为空）。
  if (!/UNKNOWN_PARAMETER/.test(errorText)) throw new Error('N3: typed refusal expected')
  if (!/NOT_ADMITTED|UNKNOWN_PARAMETER|zero/.test(errorText) && errorText.includes('approved')) throw new Error('N3: refusal must not await approval')
  if (rowsCreated !== 0) throw new Error('N3: ZERO control rows for a refused classification')
  // escalation 字段（沙箱/权限类键）同样：typed refuse，无升级道（授权在 Host
  // 审批链，行不自授权）。
}

// ── N4 token replay → 拒（真 registry token 路）─────────────────────────
export function assertN4_token_replay ({ secondErrorText, rowsCreatedSecond }) {
  if (!/exec-token-replay|EXEC_TOKEN/.test(secondErrorText)) throw new Error('N4: replayed exec token must refuse')
  if (rowsCreatedSecond !== 0) throw new Error('N4: replay refuses before any row')
}

// ── N5 create-over-existing（SRE create 输 O_EXCL 竞赛）→ 零字节改动 ────
export function assertN5_create_over_existing ({ errorText, existingHash, hashNow }) {
  if (!/[Ee]xists|EEXIST|cannot overwrite/.test(errorText)) throw new Error('N5: the loser must lose loudly, typed')
  if (existingHash !== hashNow) throw new Error('N5: the loser changed the existing bytes (O_EXCL violated)')
  void existsSync
}
