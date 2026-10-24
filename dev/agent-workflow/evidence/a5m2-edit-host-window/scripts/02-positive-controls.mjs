/**
 * A5M2 EDIT/SRE host-window prep — 02 POSITIVE CONTROLS (WRITTEN, NOT RUN).
 *
 * 载体 = tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs 的同款
 * 真调用形（实核锚点：bootHost spawn `HOST_BIN web --port <p> --no-open` +
 * env DSH_HOME=:695-:734；批准 = remoteCall 'team.resolveControl' 契约 v4
 * :1175；稳定实例零触探针 :1203 —— 本窗口只用规划端口 3183，预探针先跑）。
 * 窗口 owner 用该 kit 的 boot/驱动形起 Host，把下面的断言函数按序接上。
 *
 * 每条正控的共享前置：member 模板 permissions.default='ask'（真实 ControlService
 * 批准链）；blueprint 成员 allow 列 edit + str_replace_editor；世界按 README §3。
 */
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'

const sha = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`

// ── P1 edit str_replace 正控：真 allow → 真字节 → 全值行 ─────────────────
export function assertP1_edit_replace ({ row, target, before, oldStr, newStr, after, consumptions, logAppends }) {
  // 耐久行 = B-EDIT 全值（exact-locator walk）：
  if (row.reviewPayload.familyId !== 'B-EDIT') throw new Error('P1: family')
  const tm = row.reviewPayload.targetManifest
  if (tm.canonicalTarget !== target) throw new Error('P1: exact-locator target')
  if (tm.oldFingerprint !== sha(Buffer.from(oldStr)) || tm.newFingerprint !== sha(Buffer.from(newStr))) throw new Error('P1: fingerprints')
  if (!String(tm.readEffectLaw).includes('另需 read effect')) throw new Error('P1: M-02 原句')
  // 真效果 = 重读字节（不是回执的话）：
  if (readFileSync(target, 'utf8') !== after) throw new Error('P1: bytes on disk')
  // effects 三元组（invoke+read+write 同 exact locator）：
  const ej = JSON.stringify(row.reviewPayload)
  for (const k of ['"read"', '"write"', target]) if (!ej.includes(k)) throw new Error(`P1: effect ${k}`)
  if (consumptions !== 1) throw new Error('P1: one consume')
  if (logAppends !== 0) throw new Error('P1: zero session-log appends')
}

// ── P2 SRE str_replace 正控 ───────────────────────────────────────────
export function assertP2_sre_replace ({ row, target, after, modelText, consumptions }) {
  if (row.reviewPayload.familyId !== 'B-SRE') throw new Error('P2: family')
  const tm = row.reviewPayload.targetManifest
  if (tm.sreVariant !== 'str_replace' || tm.creationPossible !== false) throw new Error('P2: variant/creationPossible')
  if (!String(tm.neverCreatesLaw).includes('never creates')) throw new Error('P2: bound law literal')
  if (readFileSync(target, 'utf8') !== after) throw new Error('P2: bytes')
  if (modelText !== `The file ${target} has been edited successfully.`) throw new Error('P2: native text face')
  if (consumptions !== 1) throw new Error('P2: one consume')
}

// ── P3 SRE view 正控（read-only 组；字节 mtime 不动）─────────────────────
export function assertP3_sre_view ({ row, target, mtimeBefore, mtimeAfter, modelText }) {
  const tm = row.reviewPayload.targetManifest
  if (tm.sreVariant !== 'view') throw new Error('P3: variant')
  const ej = JSON.stringify(row.reviewPayload.effects ?? row.reviewPayload)
  if (!ej.includes('"read"')) throw new Error('P3: read effect present')
  if (ej.includes('"write"')) throw new Error('P3: view asked NO write')
  if (mtimeBefore !== mtimeAfter) throw new Error('P3: mtime untouched (pure read)')
  if (!modelText.includes('with line numbers')) throw new Error('P3: native numbered view text')
  void statSync
}

// ── P4 SRE create 正控（write-only 组；新文件 + 指纹）────────────────────
export function assertP4_sre_create ({ row, freshPath, content, modelText }) {
  const tm = row.reviewPayload.targetManifest
  if (tm.sreVariant !== 'create' || tm.creationPossible !== true) throw new Error('P4: the only creationPossible-true group')
  if (!String(tm.createFileLaw).includes('O_EXCL')) throw new Error('P4: delegated create law')
  const ej = JSON.stringify(row.reviewPayload.effects ?? row.reviewPayload)
  if (!ej.includes('"write"') || ej.includes('"read"')) throw new Error('P4: write-only, NO read')
  if (readFileSync(freshPath, 'utf8') !== content) throw new Error('P4: created bytes')
  if (tm.fileTextFingerprint !== sha(Buffer.from(content))) throw new Error('P4: content fingerprint at full value')
  if (modelText !== `New file created successfully at: ${freshPath}`) throw new Error('P4: native create text')
}
