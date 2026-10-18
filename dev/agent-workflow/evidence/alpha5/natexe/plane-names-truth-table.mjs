#!/usr/bin/env node
/**
 * natexe 独审必办-2 (artifact round): the PLANE_NAMES truth table as a real,
 * committed artifact. The supplement reported an 11-row table (`3 accepted,
 * 8 refused with the typed code PLANE_NAMES_INVALID`) measured through an
 * ad-hoc run; this file re-materializes EXACTLY those rows and cases — the
 * wording and expectations are UNCHANGED (根令: 补交工件, 别改口径) — against
 * the shipped build gate `verifyPlaneNames` (Gate 0b, team-tool-plane.mjs).
 * Exit 0 only when every row lands on its recorded verdict.
 * 06:43Z ruling note: the verdicts (3 accepted / 8 refused) are unchanged;
 * three refused rows now carry the named subtype code
 * PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED (bash-under-read, grep-claims-bash,
 * bash-claims-write) instead of the generic PLANE_NAMES_INVALID — the codes
 * are printed per row so the receipt shows the split honestly.
 */
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROW = path.resolve(HERE, '../../../../../packages/runtime/dist/packages/runtime/src/plugin/live/team-tool-plane.mjs')
const { verifyPlaneNames, DEFAULT_PLANE_NAMES: D } = await import(ROW)

// The 11 rows, verbatim from the supplement measurement (04:34Z round):
const CASES = [
  ['defaults', D, 'read', 'accepted'],
  ['takeover bash', { ...D, bash: 'bash' }, 'read', 'accepted'],
  ['A1 clash', { ...D, bash: 'team_grep' }, 'read', 'refused'],
  ['A2 impersonate read', { ...D, bash: 'read' }, 'read', 'refused'],
  ['A3 empty', { ...D, bash: '' }, 'read', 'refused'],
  ['A4 proto', { ...D, bash: '__proto__' }, 'read', 'refused'],
  ['foreign key', { ...D, foo: 'x' }, 'read', 'refused'],
  ['grep claims bash', { ...D, grep: 'bash', bash: 'team_bash' }, 'read', 'refused'],
  ['bash claims write', { ...D, bash: 'write' }, 'read', 'refused'],
  ['custom alias', { ...D, bash: 'myshell' }, 'read', 'accepted'],
  ['readName clash', D, 'team_grep', 'refused'],
]

let bad = 0
for (const [id, names, readName, expect] of CASES) {
  const res = verifyPlaneNames(names, readName)
  const got = res.ok === true ? 'accepted' : 'refused'
  const detail = got === 'refused' ? `${res.code} — ${String(res.message ?? '').slice(0, 100)}` : 'ok'
  if (got !== expect) bad++
  console.log(`${got === expect ? 'ok' : 'MISMATCH'} ${id} ${got} ${detail}`)
}
const refusedCodes = [...new Set(CASES.map((c) => verifyPlaneNames(c[1], c[2])).filter((r) => r.ok !== true).map((r) => r.code))]
console.log(bad === 0 ? `TRUTH TABLE GREEN: 11 rows, 3 accepted / 8 refused (refused codes: ${refusedCodes.join(' + ')} — the 06:43Z named-subtype split)` : `TRUTH TABLE RED: ${bad} mismatches`)
process.exit(bad === 0 ? 0 : 1)
