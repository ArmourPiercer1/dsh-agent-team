/**
 * g1fb-family-write.mjs — FAMILY-OWNED declaration for the governed `write`
 * (PoC-1, B-WRITE shape modeled on #360 governed-families/write.mjs: closed
 * {file_path, content}, pure policy, post-admit execution; the reviewed
 * controlled-fs post-consume closures are NOT importable from this PoC world
 * — the body here is the minimal direct write, its LAW (deny before body,
 * zero file effect) is what the PoC proves). This file is the ONLY thing
 * added for this family.
 * @module dev/agent-workflow/evidence/u4-g1f-sup-b-20261025/g1fb-family-write
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { WORK_ROOT, marker, record } from './g1fb-lib.mjs'

const OUTPUT = {
  type: 'object',
  additionalProperties: false,
  properties: { ok: { type: 'boolean' }, path: { type: 'string' }, bytes: { type: 'number' }, refused: { type: 'string' } },
  required: ['ok', 'path'],
}

export const WRITE_FAMILY = Object.freeze({
  familyId: 'P1-B-WRITE',
  version: 1,
  name: 'write',
  description: 'G1F governed write (PoC). Args {file_path, content, tag}. Relative paths resolve under the mount root; policy: subtree "w/" allow, everything else DENY (template default-deny).',
  parameters: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'relative target path' },
      content: { type: 'string', description: 'exact file content' },
      tag: { type: 'string', description: 'case tag (oracle)' },
    },
    required: ['file_path', 'content'],
  },
  outputSchema: OUTPUT,
  /** Declarative policy (the family SUBMITS it; the ledger engine decides).
   *  PLANT switch: pathGuardEnabled=false models the ABSENCE of the path
   *  lane — the deny-path write then reaches the body (sensitivity plant). */
  policy(args, deps) {
    if (deps?.flags?.pathGuardEnabled === false) return { lane: 'allow' }
    const p = String(args?.file_path ?? '')
    return { lane: p.startsWith('w/') ? 'allow' : 'deny', key: `write:${p}` }
  },
  async execute(args, exec) {
    const tag = String(args?.tag ?? 'untagged')
    record({ leg: 'body-start', name: 'write', tag, callId: String(exec?.rootCallId ?? '') })
    const target = resolve(WORK_ROOT, String(args?.file_path ?? ''))
    if (!target.startsWith(WORK_ROOT + sep)) {
      record({ leg: 'body-abort', name: 'write', tag, ok: false, error: 'anchor-escape' })
      return { ok: false, path: String(args?.file_path ?? ''), refused: 'anchor-escape' }
    }
    const content = String(args?.content ?? '')
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content)
    marker(`fs-write-${tag}.written`, `${args?.file_path} ${content.length}`)
    record({ leg: 'body-end', name: 'write', tag, ok: true, path: String(args?.file_path), bytes: content.length })
    return { ok: true, path: String(args?.file_path), bytes: content.length }
  },
})
