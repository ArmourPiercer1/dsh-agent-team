/**
 * a5ptc4c-devprovision.mjs — the kit's TEST-ONLY provision face, explicitly
 * dev-shaped (F-L2-1 closure, root requirement: "测试 kit 的 provision 面如果
 * 保留，必须显式 dev-only 且默认关闭，且不进可安装产物").
 *
 * Three independent guards, each of which alone disables the face:
 *  1. it is a SEPARATE row file — the production assembly's cordis.patch.yml
 *     never references it (install-surface diff: runs/RUN/install-manifest.json);
 *  2. even when mounted, apply() registers NOTHING unless the process env
 *     explicitly says A5PTC4C_DEVKIT=1 (default-off; ledger records the refusal);
 *  3. even when on, it CANNOT register a lane: minting authority stays solely
 *     with the assembler (whoever can write the 0600 lifecycle channel file —
 *     the Team host at member-spawn time). This face only queues member/
 *     outsider registrations by APPENDING to that same channel file — a single
 *     trusted sink, never a second registration path inside the host.
 *
 * Public seams used: ctx.webServer.register (its returned disposer), ctx.on —
 * nothing else. No Core patch.
 */
import { appendFileSync, statSync } from 'node:fs'

// ctx.webServer is only visible when the row declares it (host inject seam).
export const inject = ['webServer']
import { randomUUID } from 'node:crypto'

const DEVKIT_ON = process.env.A5PTC4C_DEVKIT === '1'
const IPC_PATH = process.env.A5PTC4C_IPC ?? ''
const LEDGER = process.env.A5PTC4C_DEVKIT_LEDGER ?? ''
const JOURNAL = []

function record(row) {
  const r = { at: new Date().toISOString(), ...row }
  JOURNAL.push(r)
  if (LEDGER !== '') { try { appendFileSync(LEDGER, JSON.stringify(r) + '\n') } catch { /* best effort */ } }
}

function sendJson(res, code, body) {
  try {
    res.writeHead(code, { 'content-type': 'application/json' })
    res.end(JSON.stringify(body))
  } catch { /* gone */ }
}

export async function apply(ctx) {
  record({ leg: 'devkit-apply', on: DEVKIT_ON, ipc: IPC_PATH, note: DEVKIT_ON ? 'dev shape explicitly enabled' : 'default OFF: registering NOTHING' })
  if (!DEVKIT_ON) return // guard 2: mounted but not enabled → zero faces, zero effect
  if (typeof ctx.webServer?.register !== 'function') return

  const post = (path, handler) => {
    const d = ctx.webServer.register({ kind: 'exact', path, handler: async (req, res) => {
      let body = ''
      for await (const c of req) body += c
      let p = {}
      try { p = JSON.parse(body || '{}') } catch { /* devkit */ }
      await handler(p, res)
    } }, `a5ptc4c devkit ${path}`)
    return typeof d === 'function' ? d : () => { /* gone */ }
  }
  const disposers = []
  disposers.push(post('/__a5ptc4cdev/health', async (_p, res) => sendJson(res, 200, { ok: true, devkit: true, enabled: true, canRegisterLane: false })))
  disposers.push(post('/__a5ptc4cdev/provision', async (p, res) => {
    const role = String(p.role ?? 'member')
    if (role === 'lane') {
      // guard 3: the devkit NEVER opens a minting lane; authority = the file
      // the Team host owns. This is a disclosure, not an accident.
      record({ leg: 'devkit-refused', reason: 'lane role is assembler-only', sessionId: String(p.sessionId ?? '').slice(0, 60) })
      sendJson(res, 403, { ok: false, error: 'devkit cannot register a minting lane; lanes exist only via the assembler-private lifecycle channel' })
      return
    }
    if (IPC_PATH === '') { sendJson(res, 503, { ok: false, error: 'no lifecycle channel configured' }); return }
    const rec = { kind: 'register', nonce: randomUUID(), sessionId: String(p.sessionId ?? ''), role, source: 'devkit' }
    try { appendFileSync(IPC_PATH, JSON.stringify(rec) + '\n') } catch (error) {
      record({ leg: 'devkit-append-failed', error: String(error?.message ?? error) })
      sendJson(res, 500, { ok: false, error: 'channel append failed' })
      return
    }
    record({ leg: 'devkit-queued', role, sessionId: rec.sessionId.slice(0, 60), via: 'devkit->trusted-lifecycle-channel' })
    sendJson(res, 202, { ok: true, queued: true, via: 'devkit->trusted-lifecycle-channel', role })
  }))
  record({ leg: 'devkit-faces', paths: ['/__a5ptc4cdev/health', '/__a5ptc4cdev/provision'], canRegisterLane: false, channelMode: IPC_PATH === '' ? null : (statSync(IPC_PATH).mode & 0o777).toString(8) })
  // the row lives for the process lifetime in dev; disposal symmetry is owned
  // by the closure row (the ONLY adjudication lives there — devkit is ingress
  // ONLY and holds no approval face at all).
  void disposers
}
