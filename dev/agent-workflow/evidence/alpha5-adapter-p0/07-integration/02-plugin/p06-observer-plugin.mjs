/**
 * p06-observer-plugin.mjs — P0-6 stage2a PoC plugin row (Team-owned, mounted
 * ONLY through the public profiles/web/cordis.patch.yml seam; row name = this
 * file's file:// URL, the same resolution mechanism the c1 kit uses for the
 * production dsh-agent-team row).
 * Registers one counting global tool and writes an observation snapshot on
 * init — proof that Team-owned code executes inside the REAL pinned host
 * process via public seams. No private imports; public ctx surface only.
 */
import { writeFileSync } from 'node:fs'

const OUT = process.env.P06_OBS_OUT ?? new URL('./observation.json', import.meta.url).pathname

export default function p06Observer(ctx) {
  const snapshot = { at: new Date().toISOString(), registered: false, error: null, toolNamesBefore: null }
  try {
    snapshot.toolNamesBefore = ctx.tools.schemas().map((s) => s.name).sort()
    ctx.tools.register({
      name: 'p06_observer_echo',
      description: 'P0-6 stage2a observation tool (no side effects beyond counter file)',
      parameters: { type: 'object', properties: {} },
      output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
      execute: async () => {
        writeFileSync(OUT, JSON.stringify({ ...snapshot, registered: true, bodyRanAt: new Date().toISOString() }, null, 2))
        return 'p06-observer-ran'
      },
    })
    snapshot.registered = true
  } catch (err) {
    snapshot.error = String(err?.message ?? err)
  }
  writeFileSync(OUT, JSON.stringify(snapshot, null, 2))
}
p06Observer.inject = ['tools']
