#!/usr/bin/env node
/**
 * natexe solo-review 06:43Z ruling, leg ③: the FULL reserved-native × row
 * matrix as an executable, replayable artifact. Every reserved host/native
 * spelling × every plane row (grep/glob/bash via `names`, the read row via
 * `readName`), mounted in isolation against the shipped defaults — each
 * cell records ACCEPTED/REFUSED plus its basis. The law (root ruling): the
 * criterion is the ASSEMBLED face — a pairing is supported only where this
 * install surface assembles a same-name, same-meaning implementation for
 * that row; the coarse permission class is NOT the criterion.
 *
 * Expected matrix (34 refused-with-NATIVE_CLAIM + 2 accepted + the grep/glob
 * self-spellings also refused — GLUE-5 alias law: their rows carry no
 * verified assembled pairing):
 *   bash row  @ 'bash'      ACCEPTED — live-verified confined-shell takeover (natexe kit, both eras)
 *   read row  @ 'read'      ACCEPTED — shipped readName default (GLUE-7 governed reader)
 *   every other cell        REFUSED  — PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED
 * Exit 0 only when all 36 cells land on their recorded verdict and code.
 */
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROW = path.resolve(HERE, '../../../../../packages/runtime/dist/packages/runtime/src/plugin/live/team-tool-plane.mjs')
const { verifyPlaneNames, DEFAULT_PLANE_NAMES: D } = await import(ROW)

const RESERVED = ['bash', 'pwsh', 'read', 'read_image', 'write', 'edit', 'lsp', 'grep', 'glob']
const ROWS = [
  ['grep', (sp) => ({ ...D, grep: sp })],
  ['glob', (sp) => ({ ...D, glob: sp })],
  ['bash', (sp) => ({ ...D, bash: sp })],
  ['read', (sp) => [{ ...D }, sp]],
]
const UNSUPPORTED = 'PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED'
const BASIS = {
  'bash>bash': 'the confined-shell placement under the native bash spelling — same name, same meaning, live-verified on both blueprint eras (natexe live kit)',
  'read>read': 'the shipped readName default — a governed reader over the row fs instance, same name, same meaning (GLUE-7)',
}
const WHY = {
  pwsh: 'a bash body is not a pwsh implementation; the durable exec-approval face speaks the PWSH identity while the lane maps the mount to the BASH class — one call, two verdict identities',
  read: 'the reader row is same-name already; any other row under read is a reader mask over a different row body',
  read_image: 'an image reader is a different implementation (binary/image contract) from the text reader, the shell, or the search rows',
  write: 'a reader (or any non-writer row) is not the host writer; measured: the masked write answers with a read schema and returns file content (measure-native-claims-pre-fix.log)',
  edit: 'an editor is a different implementation than every plane row',
  lsp: 'the lsp surface is a different implementation than every plane row',
  grep: 'the grep row keeps the alias mount (GLUE-5 alias ruling) — no verified assembled same-name pairing on this surface; other rows are not grep at all',
  glob: 'the glob row keeps the alias mount (GLUE-5 alias ruling) — no verified assembled same-name pairing; other rows are not glob at all',
  bash: 'rows other than the confined shell are not bash implementations',
}

let bad = 0
for (const [row, build] of ROWS) {
  for (const sp of RESERVED) {
    const supported = row === 'bash' && sp === 'bash' ? 'bash>bash' : row === 'read' && sp === 'read' ? 'read>read' : null
    const [names, readName] = row === 'read' ? build(sp) : [build(sp), 'read']
    const res = verifyPlaneNames(names, readName)
    const got = res.ok === true ? 'ACCEPTED' : 'REFUSED'
    const want = supported ? 'ACCEPTED' : 'REFUSED'
    const codeOk = supported ? true : res.code === UNSUPPORTED
    const ok = got === want && codeOk
    if (!ok) bad++
    const basis = supported ? BASIS[supported] : WHY[sp]
    console.log(`${ok ? 'ok' : 'MISMATCH'} ${row} @ '${sp}' ${got}${supported ? '' : ` (${res.code})`} — basis: ${basis}`)
  }
}
const cells = RESERVED.length * ROWS.length
console.log(bad === 0 ? `MATRIX GREEN: ${cells} cells, 2 accepted (bash@bash, read@read), ${cells - 2} refused with the named subtype ${UNSUPPORTED}` : `MATRIX RED: ${bad} mismatches`)
process.exit(bad === 0 ? 0 : 1)
