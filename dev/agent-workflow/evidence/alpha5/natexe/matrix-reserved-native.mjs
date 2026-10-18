#!/usr/bin/env node
/**
 * natexe solo-review 06:43Z ruling, leg ③ (REPLAYED at the exhaustion round:
 * the reserved list is now the FULL pinned-host-release registry — 51 exact
 * names imported live from the shipped module + the mcp__ prefix family —
 * replacing the first 9-name cut that left web_search/skill/todo_write/
 * present/send_message mountable): the FULL reserved-native × row
 * matrix as an executable, replayable artifact. Every reserved host/native
 * spelling × every plane row (grep/glob/bash via `names`, the read row via
 * `readName`), mounted in isolation against the shipped defaults — each
 * cell records ACCEPTED/REFUSED plus its basis. The law (root ruling): the
 * criterion is the ASSEMBLED face — a pairing is supported only where this
 * install surface assembles a same-name, same-meaning implementation for
 * that row; the coarse permission class is NOT the criterion.
 *
 * Expected matrix at the current registry (214 refused-with-NATIVE_CLAIM +
 * 2 accepted = 216 cells: 53 exact names + 1 prefix probe, each x 4 rows;
 * the grep/glob self-spellings are also refused — GLUE-5 alias law: their
 * rows carry no verified assembled pairing):
 *   bash row  @ 'bash'      ACCEPTED — live-verified confined-shell takeover (natexe kit, both eras)
 *   read row  @ 'read'      ACCEPTED — shipped readName default (GLUE-7 governed reader)
 *   every other cell        REFUSED  — PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED
 * Exit 0 only when every cell lands on its recorded verdict and code.
 */
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROW = path.resolve(HERE, '../../../../../packages/runtime/dist/packages/runtime/src/plugin/live/team-tool-plane.mjs')
const { verifyPlaneNames, DEFAULT_PLANE_NAMES: D, PLANE_RESERVED_NATIVE, PLANE_RESERVED_NATIVE_PREFIXES } = await import(ROW)

const RESERVED = [...PLANE_RESERVED_NATIVE, ...PLANE_RESERVED_NATIVE_PREFIXES.map((pf) => `${pf}host__tool`)]
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
  mcp__host__tool: 'the dynamic mcp__ family by prefix — mounting a plane row under an mcp tool name masks a dynamic mcp placement with the same verified-abstain face',
}
const FALLBACK_WHY = 'host native registry of the pinned release (PLANE_RESERVED_NATIVE) — the row carries no same-name, same-meaning implementation; mounting here is the own-mask + verified-abstain impostor face'

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
    const basis = supported ? BASIS[supported] : (WHY[sp] ?? FALLBACK_WHY)
    console.log(`${ok ? 'ok' : 'MISMATCH'} ${row} @ '${sp}' ${got}${supported ? '' : ` (${res.code})`} — basis: ${basis}`)
  }
}
const cells = RESERVED.length * ROWS.length
console.log(bad === 0 ? `MATRIX GREEN: ${cells} cells (${PLANE_RESERVED_NATIVE.length} exact reserved names + ${PLANE_RESERVED_NATIVE_PREFIXES.length} prefix probe x 4 rows), 2 accepted (bash@bash, read@read), ${cells - 2} refused with the named subtype ${UNSUPPORTED}` : `MATRIX RED: ${bad} mismatches`)
process.exit(bad === 0 ? 0 : 1)
