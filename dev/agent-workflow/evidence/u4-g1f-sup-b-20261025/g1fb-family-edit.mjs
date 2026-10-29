/**
 * g1fb-family-edit.mjs — FAMILY-OWNED declaration for the governed `edit`
 * (PoC-1 second FS mutation). Registering THIS family through the same
 * generic registry function is the ARC-A "second family = zero center diff"
 * proof: the ONLY artifact added is this file (see README cell p1-zerodiff).
 * @module dev/agent-workflow/evidence/u4-g1f-sup-b-20261025/g1fb-family-edit
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { WORK_ROOT, marker, record } from './g1fb-lib.mjs'

const OUTPUT = {
  type: 'object',
  additionalProperties: false,
  properties: { ok: { type: 'boolean' }, path: { type: 'string' }, replacements: { type: 'number' }, refused: { type: 'string' } },
  required: ['ok', 'path'],
}

export const EDIT_FAMILY = Object.freeze({
  familyId: 'P1-B-EDIT',
  version: 1,
  name: 'edit',
  description: 'G1F governed edit (PoC). Args {file_path, old_string, new_string, tag}. Literal single-pass replace-all. Policy mirrors write: "w/" allow, else DENY.',
  parameters: {
    type: 'object',
    properties: {
      file_path: { type: 'string' },
      old_string: { type: 'string' },
      new_string: { type: 'string' },
      tag: { type: 'string' },
    },
    required: ['file_path', 'old_string', 'new_string'],
  },
  outputSchema: OUTPUT,
  policy(args, deps) {
    if (deps?.flags?.pathGuardEnabled === false) return { lane: 'allow' }
    const p = String(args?.file_path ?? '')
    return { lane: p.startsWith('w/') ? 'allow' : 'deny', key: `edit:${p}` }
  },
  async execute(args, exec) {
    const tag = String(args?.tag ?? 'untagged')
    record({ leg: 'body-start', name: 'edit', tag, callId: String(exec?.rootCallId ?? '') })
    const target = resolve(WORK_ROOT, String(args?.file_path ?? ''))
    if (!target.startsWith(WORK_ROOT + sep)) {
      record({ leg: 'body-abort', name: 'edit', tag, ok: false, error: 'anchor-escape' })
      return { ok: false, path: String(args?.file_path ?? ''), refused: 'anchor-escape' }
    }
    const before = readFileSync(target, 'utf8')
    const count = before.split(String(args?.old_string ?? '')).length - 1
    const after = before.split(String(args?.old_string ?? '')).join(String(args?.new_string ?? ''))
    writeFileSync(target, after)
    marker(`fs-edit-${tag}.written`, `${args?.file_path} replacements=${String(count)}`)
    record({ leg: 'body-end', name: 'edit', tag, ok: true, replacements: count })
    return { ok: true, path: String(args?.file_path), replacements: count }
  },
})
