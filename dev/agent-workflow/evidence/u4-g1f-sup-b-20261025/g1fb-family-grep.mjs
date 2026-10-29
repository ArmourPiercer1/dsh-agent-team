/**
 * g1fb-family-grep.mjs — FAMILY-OWNED declaration for the governed search row
 * (PoC-2 shared lifecycle, ASK lane representative: ask → approve → one-shot
 * consume → replay refused). Real external effect: a REAL grep process run
 * over a real tree (master's confined-rg law uses host PUBLIC rg helpers —
 * @deepseek-ai/dsh-tool-fs-search is a bare-specifier host import unavailable
 * to this world-side plugin; the mechanism proof is the process + matches).
 * @module dev/agent-workflow/evidence/u4-g1f-sup-b-20261025/g1fb-family-grep
 */
import { spawnSync } from 'node:child_process'
import { resolve, sep } from 'node:path'
import { WORK_ROOT, marker, record } from './g1fb-lib.mjs'

const OUTPUT = {
  type: 'object',
  additionalProperties: false,
  properties: { ok: { type: 'boolean' }, matches: { type: 'number' }, refused: { type: 'string' } },
  required: ['ok', 'matches'],
}

export const GREP_FAMILY = Object.freeze({
  familyId: 'P2-B-SEARCH',
  version: 1,
  name: 'grep',
  description: 'G1F governed grep (PoC). Args {pattern, path, tag}. Policy: subtree "search/" = ASK (approval + one-shot grant), else DENY.',
  parameters: {
    type: 'object',
    properties: { pattern: { type: 'string' }, path: { type: 'string' }, tag: { type: 'string' } },
    required: ['pattern', 'path'],
  },
  outputSchema: OUTPUT,
  policy(args) {
    const p = String(args?.path ?? '')
    return { lane: p.startsWith('search/') ? 'ask' : 'deny', key: `grep:${String(args?.pattern ?? '')}@${p}` }
  },
  async execute(args, exec) {
    const tag = String(args?.tag ?? 'untagged')
    record({ leg: 'body-start', name: 'grep', tag, callId: String(exec?.rootCallId ?? '') })
    const dir = resolve(WORK_ROOT, String(args?.path ?? ''))
    if (!dir.startsWith(WORK_ROOT + sep)) {
      record({ leg: 'body-abort', name: 'grep', tag, error: 'anchor-escape' })
      return { ok: false, matches: 0, refused: 'anchor-escape' }
    }
    const r = spawnSync('/bin/grep', ['-rn', '--', String(args?.pattern ?? ''), dir], { encoding: 'utf8', timeout: 20_000 })
    const lines = String(r.stdout ?? '').split('\n').filter((l) => l.trim() !== '').length
    marker(`grep-${tag}.count`, `exit=${String(r.status)} matches=${String(lines)}`)
    record({ leg: 'body-end', name: 'grep', tag, ok: r.status === 0 || r.status === 1, matches: lines, exit: r.status })
    return { ok: true, matches: lines }
  },
})
