#!/usr/bin/env node
/**
 * poc3-fd-recycling-leg.mjs — the PoC3-E recycling leg in ITS OWN process
 * (root order #349, round C). WHY a child: the nine-root census runs every
 * test file as worker_threads in ONE process, and the fd table is
 * PROCESS-WIDE - so the in-process "wait until the OS hands my number back"
 * is starvable by law (deterministic repro:
 * dev/agent-workflow/evidence/alpha5/jobs-isolation/runs/fd-recycling/
 * repro-starvation.mjs - a long-lived holder makes every held-open attempt
 * land above the number; POSIX lowest-free allocation cannot be rushed).
 * A fresh child owns a FRESH fd table with exactly one opener (this script):
 * after the lane closes its read, the next openSync here is THE lowest free
 * number by law - recycling becomes OBSERVED deterministically, with no
 * holder to wait out and no law weakened. The claim is byte-for-byte the
 * original one: naive raw trust of the recycled number silently misreads
 * the NEW owner's bytes; the lane refuses the same stale descriptor.
 *
 * Imports the SAME committed dist surfaces production uses (the check-
 * artifacts law keeps these fresh); fixtures are the poc3-harness shapes
 * verbatim (REALM/MemberRef/grant fields), built through the frozen
 * parsers - invalid fixture data cannot enter this leg by construction.
 *
 * stdout (last line): one JSON result. exit 0 only when EVERY arm observed
 * the law; any miss exits 1 with the failing stage named (never silently
 * "assumed").
 */
import { createHash } from 'node:crypto'
import { closeSync, openSync, readSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseOperationGrant, parseRequestedEffectSet, parseResourceRef } from '../../dist/packages/domain/tool-governance/src/index.js'
import { createControlledFsLane } from '../../dist/packages/runtime/controlled-fs/src/index.js'

const REALM = 'realm-1' // poc3-harness REALM, verbatim
const MEM_A = Object.freeze({ teamSessionId: 'ts-1', instanceId: 'member-a' })
const sha256 = (text) => `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`

const world = process.argv[2]
const fail = (stage, detail) => {
  process.stdout.write(`${JSON.stringify({ ok: false, stage, ...detail })}\n`)
  process.exit(1)
}
if (typeof world !== 'string' || world === '') fail('argv', {})
const ctrl = join(world, 'controlled')
const victimPath = join(world, 'outside', 'recycled-victim.txt')

const refParsed = parseResourceRef({
  realmId: REALM,
  kind: 'absolute-path',
  canonicalLocator: join(ctrl, 'public', 'a.txt'),
  rights: ['read'],
})
if (!refParsed.ok) fail('ref-parse', { problems: refParsed.problems })
const ref = refParsed.value
const effectsParsed = parseRequestedEffectSet([{ kind: 'read', resource: ref }])
if (!effectsParsed.ok) fail('effects-parse', { problems: effectsParsed.problems })
const grantParsed = parseOperationGrant({
  grantId: 'grant-leg-e',
  member: MEM_A,
  callId: 'call-leg-e',
  realmId: REALM,
  bindingId: 'binding-1',
  bindingRevision: 1,
  authorityGeneration: 1,
  parametersFingerprint: sha256('params-leg-e'),
  effects: effectsParsed.value,
  singleUse: true,
  issuedAt: 0,
  expiresAt: null,
})
if (!grantParsed.ok) fail('grant-parse', { problems: grantParsed.problems })
const grant = grantParsed.value

let captured = -1
const lane = createControlledFsLane({
  instances: [{ fs: 'ctl', rootDir: ctrl, realmId: REALM, kind: 'absolute-path' }],
  visibility: () => 'visible', // this leg only ever reads member-a's public path
  currentAuthorityGeneration: 1,
  consumed: () => false,
  hooks: {
    onFdOpened: (info) => {
      if (String(info.locator).endsWith('/public/a.txt')) captured = info.fd
    },
  },
})

writeFileSync(victimPath, 'RECYCLED-BYTES\n')
try {
  await lane.fs.readText(grant, ref, { offset: 0, limit: null })
  if (captured < 0) fail('capture', { captured })
  // THE deterministic step: a single-threaded fresh table; the lane's read
  // has closed its fd; nothing else in this process opens files. POSIX
  // lowest-free hands the SAME number back on the very next open - the law
  // is exercised, not waited for. If this ever mismatched, the leg would
  // exit 1 naming the stage: recycling stays OBSERVED, never assumed.
  const recycled = openSync(victimPath, 'r')
  if (recycled !== captured) fail('acquire', { captured, recycled })
  // NAIVE hazard: raw continued use of the old number reads the NEW owner.
  const buf = Buffer.alloc(64)
  const n = readSync(recycled, buf, 0, 64, null)
  const naiveBytes = buf.toString('utf8', 0, n)
  if (naiveBytes !== 'RECYCLED-BYTES\n') fail('naive-read', { naiveBytes })
  // GUARDED: the same stale descriptor through the lane is refused, and the
  // refusal body never carries the new owner's bytes.
  const stale = { fs: 'ctl', path: 'public/a.txt', fd: captured }
  const guardRes = await lane.fs.readDescriptor(grant, stale, { offset: 0, limit: null })
  const cfClass = guardRes?.error?.details?.['cfClass']
  const cfReason = guardRes?.error?.details?.['cfReason']
  const guardJson = JSON.stringify(guardRes)
  const leak = guardJson.includes('RECYCLED-BYTES')
  closeSync(recycled)
  if (guardRes.ok !== false || cfClass !== 'denied' || cfReason !== 'fd-recycled' || leak) {
    fail('guard', { ok: guardRes.ok, cfClass, cfReason, leak })
  }
  process.stdout.write(`${JSON.stringify({ ok: true, captured, recycled, naiveBytes, guardOk: guardRes.ok, cfClass, cfReason, leak })}\n`)
} finally {
  rmSync(victimPath, { force: true })
}
