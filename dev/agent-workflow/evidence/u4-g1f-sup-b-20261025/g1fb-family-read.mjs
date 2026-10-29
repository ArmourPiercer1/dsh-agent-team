/**
 * g1fb-family-read.mjs — FAMILY-OWNED declaration for the governed `read`
 * (PoC-2 shared lifecycle, ALLOW lane representative; the master governed read
 * row team-tool-plane.mjs:1726-1780 is the shape reference — its execution
 * rides controlled-fs TS sources, not importable here, so the body is a
 * minimal anchored read; the LANE LAW + one-ledger ride is what is proven).
 * @module dev/agent-workflow/evidence/u4-g1f-sup-b-20261025/g1fb-family-read
 */
import { readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { WORK_ROOT, marker, record } from './g1fb-lib.mjs'

const OUTPUT = {
  type: 'object',
  additionalProperties: false,
  properties: { ok: { type: 'boolean' }, path: { type: 'string' }, chars: { type: 'number' }, refused: { type: 'string' } },
  required: ['ok', 'path'],
}

export const READ_FAMILY = Object.freeze({
  familyId: 'P2-B-READ',
  version: 1,
  name: 'read',
  description: 'G1F governed read (PoC). Args {file_path, tag}. Policy: subtree "data/" allow, else DENY (template default-deny).',
  parameters: {
    type: 'object',
    properties: { file_path: { type: 'string' }, tag: { type: 'string' } },
    required: ['file_path'],
  },
  outputSchema: OUTPUT,
  policy(args) {
    const p = String(args?.file_path ?? '')
    return { lane: p.startsWith('data/') ? 'allow' : 'deny', key: `read:${p}` }
  },
  async execute(args, exec) {
    const tag = String(args?.tag ?? 'untagged')
    record({ leg: 'body-start', name: 'read', tag, callId: String(exec?.rootCallId ?? '') })
    const target = resolve(WORK_ROOT, String(args?.file_path ?? ''))
    if (!target.startsWith(WORK_ROOT + sep)) {
      record({ leg: 'body-abort', name: 'read', tag, error: 'anchor-escape' })
      return { ok: false, path: String(args?.file_path ?? ''), refused: 'anchor-escape' }
    }
    const text = readFileSync(target, 'utf8')
    // Effect oracle: the read RESULT is echoed to a marker file the runner
    // checks independently of the tool return value.
    marker(`read-${tag}.first8`, text.slice(0, 8))
    record({ leg: 'body-end', name: 'read', tag, ok: true, chars: text.length })
    return { ok: true, path: String(args?.file_path), chars: text.length }
  },
})
