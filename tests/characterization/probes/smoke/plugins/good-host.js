/**
 * P2-T1 demo probe plugin — GOOD host half (public exports only).
 *
 * This module is mounted as a cordis.profile row through the public
 * `cordis.patch.yml` seam and imported by the booted DSH host process
 * (never by the harness process). A successful host boot with this row
 * present is the machine-level load proof: `app-boot`
 * `assertEntriesActivated` rejects startup when any entry fails import or
 * `apply()`. The module body is a deliberate no-op — nothing else in it
 * could fail, so a green boot isolates the seam under test.
 *
 * The import below must stay inside the upstream public exports whitelist
 * (it is the positive half of the private-import negative test; the bad
 * twin lives in probes/smoke/plugins/negative-fixtures/).
 */
import { randomUUID } from '@deepseek-ai/dsh-util-crypto'

export const name = 'p2t1-smoke-probe'

/**
 * Minted once at module load: proves the public root export of
 * @deepseek-ai/dsh-util-crypto resolves and executes inside the booted host.
 * The value is read by the harness through dump-config-free module state
 * (never serialized from live host objects).
 */
export const probeUuid = randomUUID()

export function apply(ctx) {
  const inspect = ctx.get('inspect')
  if (inspect === undefined) return
  // Read one leaf field only — never serialize live Cordis objects.
  void inspect
}
