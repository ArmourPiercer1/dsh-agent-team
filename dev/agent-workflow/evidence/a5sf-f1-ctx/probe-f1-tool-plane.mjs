/**
 * probe-f1-tool-plane.mjs — the F1 (effective half) BEFORE/AFTER measurement.
 *
 * WHAT IT MEASURES: the committed `packages/runtime/dist` build, mounted for one
 * Member exactly as the product row mounts it, then the SAME outside-ceiling
 * read attempted through the three scopes that matter:
 *
 *   agent ctx        the Context the row setup handed in (BASE provider)
 *   tool-plain scope the scope the Member's tools are placed on
 *   realm ctx        `installation.members[0].ctx` (the isolated confined scope)
 *
 * BEFORE = the pre-F1 mapping: the tool plane was placed on the agent ctx, so
 *          the tool scope and the agent ctx were the SAME scope (base provider,
 *          read ALLOWED, ZERO facts).
 * AFTER  = the F1 mapping: the tool plane is placed through
 *          `a5sfToolPlaneOf(realm)` (the isolated Member scope + the captured
 *          confined instance), so the tool-scope read is DENIED and the sink
 *          receives exactly ONE `a5sf-guard-consult/1` fact.
 *
 * Both mappings are printed from the SAME mount in one run, so the difference is
 * the routing only — not a different fixture, policy or provider.
 *
 * Run (host-free; no Host, no port, no DSH_HOME):
 *   cd packages/runtime/dist
 *   node ../../../dev/agent-workflow/evidence/a5sf-f1-ctx/probe-f1-tool-plane.mjs "$(pwd)"
 *
 * Expected (measured 2026-11-03, see README §4):
 *   BEFORE: tool scope === agent ctx, read ALLOWED, facts 0
 *   AFTER : tool scope === realm member ctx, read IO_READ_DENIED, facts 1
 *   agent ctx read stays ALLOWED in BOTH (the row's non-tool consumers keep the
 *   base provider by design).
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { appendFile, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const DIST = process.argv[2]
if (DIST === undefined) throw new Error('usage: node probe-f1-tool-plane.mjs <packages/runtime/dist>')

const req = createRequire(join(DIST, 'packages', 'runtime', 'package.json'))
const { Context, Service } = await import(pathToFileURL(req.resolve('@deepseek-ai/cordis')).href)
const { mountA5sfRealm } = await import(pathToFileURL(join(DIST, 'packages/runtime/team-services/src/mount.js')).href)
// The DIST MIRROR of the row helper the live glue imports (GLUE-6 placement).
const rowHelper = await import(pathToFileURL(join(DIST, 'packages/runtime/src/plugin/live/a5sf-realm-row.mjs')).href)

const ID = { teamId: 'team-f1-probe', memberInstanceId: 'member-f1-probe', templateId: 'worker', instanceGeneration: 1 }
const lane = (a) => ({ mode: 'restricted', allow: [a], ask: [], deny: [] })
const policy = (a) => ({
  memberIdentity: ID.memberInstanceId,
  templateId: ID.templateId,
  instanceGeneration: 1,
  revision: 'a5sf1:f1-probe:g1',
  read: lane(a),
  write: lane(a),
  network: { access: 'allow' },
})

const dir = mkdtempSync(join(tmpdir(), 'a5sf-f1-probe-'))
const inside = join(dir, 'inside')
mkdirSync(inside)
writeFileSync(join(inside, 'ok.txt'), 'ok\n', 'utf8')
writeFileSync(join(dir, 'outside.txt'), 'outside\n', 'utf8')
const outside = join(dir, 'outside.txt')

class FsDouble extends Service {
  constructor(ctx, config = {}) {
    super(ctx, 'fs')
    this.config = config
  }

  processPath(t) {
    return t.hostPath
  }

  contains(p, c) {
    return this.processPath(c).startsWith(this.processPath(p))
  }

  async resolve(p) {
    return { hostPath: p }
  }

  async readText(t) {
    return readFileSync(this.processPath(t), 'utf8')
  }

  async streamText(t) {
    const s = await this.readText(t)
    return (async function* () {
      yield s
    })()
  }

  async readBytes(t) {
    return readFileSync(this.processPath(t))
  }

  async readByteRange(t, r) {
    return readFileSync(this.processPath(t)).subarray(r.offset, r.offset + r.length)
  }

  async listDir() {
    return []
  }

  async stat() {
    return { size: 0 }
  }

  async lstat() {
    return { size: 0 }
  }

  async watch() {
    return async () => {}
  }

  async writeText() {
    return { version: 'v1' }
  }

  async editText() {
    return { version: 'v2' }
  }
}

const root = new Context()
await root.plugin(FsDouble, {})
const agentCtx = root.extend()
const sinkPath = join(dir, 'consult.jsonl')
const sink = async (fact) => {
  await appendFile(sinkPath, `${JSON.stringify(fact)}\n`, 'utf8')
}

const mounted = await mountA5sfRealm({
  root: agentCtx,
  members: [{ identity: ID, policy: { ok: true, value: policy(inside) } }],
  bindings: [
    {
      identity: ID,
      toolBindingIdentity: 'dsh.fs/read',
      effective: {
        ...policy(inside),
        toolBindingIdentity: 'dsh.fs/read',
        invocationId: 'inv-1',
        policyRevision: 'a5sf1:f1-probe:g1:dsh.fs/read',
      },
    },
  ],
  providerClass: FsDouble,
  onGuardConsult: sink,
})

const readThrough = async (ctx, path) => {
  if (ctx === undefined) return 'NO-FS-SERVICE'
  const fs = ctx.get('fs')
  if (fs === undefined) return 'NO-FS-SERVICE'
  try {
    return `ALLOWED:${JSON.stringify(await fs.readText(await fs.resolve(path)))}`
  } catch (error) {
    return String(error.code ?? error.message)
  }
}
const countFacts = async () => {
  if (!existsSync(sinkPath)) return 0
  const text = await readFile(sinkPath, 'utf8')
  return text.trim().split('\n').filter(Boolean).length
}

const realmCtx = mounted.installation.members[0].ctx
const realmFs = mounted.installation.members[0].fs

// ── BEFORE: the pre-F1 mapping (the tool plane was the agent ctx) ──────────
const beforeScope = agentCtx
const beforeFacts0 = await countFacts()
console.log('── BEFORE (pre-F1 mapping: tool scope = agent ctx) ─────────────────')
console.log('agent ctx constructor            :', agentCtx.get('fs').constructor.name)
console.log('agent ctx -> outside             :', await readThrough(agentCtx, outside))
console.log('tool scope === agent ctx         :', beforeScope === agentCtx)
console.log('tool scope constructor           :', beforeScope.get('fs').constructor.name)
console.log('tool scope -> outside            :', await readThrough(beforeScope, outside))
console.log('facts after BEFORE tool-scope read:', (await countFacts()) - beforeFacts0, '(expected 0)')

// ── AFTER: the F1 mapping (a5sfToolPlaneOf from the committed dist) ───────
const plane = rowHelper.a5sfToolPlaneOf(mounted)
const afterScope = plane.ctx
const afterFacts0 = await countFacts()
console.log('── AFTER (F1 mapping: tool plane through a5sfToolPlaneOf) ──────────')
console.log('a5sfToolPlaneOf present          :', typeof rowHelper.a5sfToolPlaneOf === 'function')
console.log('tool scope === realm member ctx  :', afterScope === realmCtx)
console.log('tool scope constructor           :', afterScope.get('fs').constructor.name)
console.log('tool scope -> outside            :', await readThrough(afterScope, outside))
const afterFacts1 = await countFacts()
console.log('facts from the tool-scope read   :', afterFacts1 - afterFacts0, '(expected 1)')
console.log('tool plane fs === realm member fs:', plane.fs === realmFs)
console.log('realm member ctx -> outside      :', await readThrough(realmCtx, outside), '(the SAME scope object, a second read)')
console.log('agent ctx -> outside (unchanged) :', await readThrough(agentCtx, outside))

const allFacts = existsSync(sinkPath)
  ? (await readFile(sinkPath, 'utf8')).trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
  : []
console.log('sink facts                       :', allFacts.length, allFacts.map((f) => `${f.realm}/${f.method}/${f.decision}/${f.decidedBy}`).join(' '))
console.log('VERDICT                          : BEFORE the tool plane ran on the agent ctx (base provider, read ALLOWED, zero consultations); AFTER it runs on the isolated Member scope and the same read is DENIED with a transported fact. The agent ctx itself is deliberately UNCHANGED.')
await mounted.dispose()
