/**
 * g1fb-family-bash.mjs — FAMILY-OWNED declaration for the governed process row
 * (PoC-2 shared lifecycle, DENY + ASK-then-REVOKE representatives; PoC-3's
 * background arm: the real job birth + bridge attribution — the master shell
 * row's attribution-producer law). Real external effect: REAL child
 * processes; deny = ZERO process (the command's output file never exists).
 * @module dev/agent-workflow/evidence/u4-g1f-sup-b-20261025/g1fb-family-bash
 */
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { WORK_ROOT, marker, record } from './g1fb-lib.mjs'

const OUTPUT = {
  type: 'object',
  additionalProperties: false,
  properties: { ok: { type: 'boolean' }, exit: { type: 'number' }, job_id: { type: 'string' }, refused: { type: 'string' } },
  required: ['ok'],
}

function laneFor(args) {
  const command = String(args?.command ?? '')
  if (command.includes('denydir/')) return { lane: 'deny' }
  if (command.includes('askdir/')) return { lane: 'ask' }
  if (command.includes('w/')) return { lane: 'allow' }
  return { lane: 'deny' } // template default-deny
}

export const BASH_FAMILY = Object.freeze({
  familyId: 'P2-B-PROCESS',
  version: 1,
  name: 'bash',
  description: 'G1F governed bash (PoC). Args {command, tag, background?}. Policy: command naming "w/" allow, "askdir/" ASK, "denydir/" or anything else DENY.',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string' },
      tag: { type: 'string' },
      background: { type: 'boolean' },
    },
    required: ['command'],
  },
  outputSchema: OUTPUT,
  policy(args) {
    const l = laneFor(args)
    return { ...l, key: `bash:${String(args?.command ?? '')}` }
  },
  async execute(args, exec, deps) {
    const tag = String(args?.tag ?? 'untagged')
    const command = String(args?.command ?? '')
    record({ leg: 'body-start', name: 'bash', tag, background: args?.background === true, callId: String(exec?.rootCallId ?? '') })
    if (command.includes('..') || command.includes('|') || command.includes(';') || command.includes('`') || command.includes('$(')) {
      record({ leg: 'body-abort', name: 'bash', tag, error: 'closed-command-law' })
      return { ok: false, exit: -1, refused: 'closed-command-law' }
    }
    if (args?.background === true) {
      // jobs resolved ONLY for the background arm, fail-safe (cordis throws
      // on non-injected context property access — E2 evidence: eager lookup
      // threw for FOREGROUND calls too).
      let jobs
      try { jobs = deps?.jobs?.() ?? undefined } catch { jobs = undefined }
      if (jobs === undefined) { record({ leg: 'body-abort', name: 'bash', tag, error: 'no-job-registry' }); return { ok: false, refused: 'no-job-registry' } }
      const child = spawn('/bin/sh', ['-c', command], { cwd: WORK_ROOT })
      let buffer = ''
      const done = new Promise((res) => {
        child.stdout.on('data', (d) => { buffer += String(d) })
        child.stderr.on('data', (d) => { buffer += String(d) })
        child.once('close', (code) => {
          res({ status: code === 0 ? 'completed' : 'failed', detail: `exit=${String(code)}` })
        })
        child.once('error', (e) => { res({ status: 'failed', detail: String(e?.message ?? e) }) })
      })
      const id = jobs.start({
        kind: 'bash',
        label: command,
        owner: exec?.agent?.id,
        run: (handle) => {
          // push appends land whole: mirror stdout into the ring as it arrives
          const flush = () => { if (buffer.length > 0) { handle.append(buffer); buffer = '' } }
          flush() // anything already captured before registration
          child.stdout.on('data', flush)
          child.once('close', () => { flush() })
          return {
            done: done.then((o) => o),
            cancel: () => { try { child.kill('SIGKILL') } catch { /* gone */ } },
          }
        },
      })
      // Attribution-producer law: the governed shell lane tells the BRIDGE
      // (its owner fence, not a second ledger) that this job belongs here.
      deps?.bridge?.attribute?.(id, exec?.agent?.id)
      marker(`job-spawn-${tag}.born`, String(id))
      record({ leg: 'body-end', name: 'bash', tag, ok: true, job_id: String(id) })
      return { ok: true, job_id: String(id) }
    }
    mkdirSync(join(WORK_ROOT), { recursive: true })
    const r = spawnSync('/bin/sh', ['-c', command], { encoding: 'utf8', cwd: WORK_ROOT, timeout: 20_000 })
    marker(`bash-${tag}.exit`, `exit=${String(r.status)}`)
    record({ leg: 'body-end', name: 'bash', tag, ok: r.status === 0, exit: r.status })
    return { ok: r.status === 0, exit: r.status ?? -1 }
  },
})
