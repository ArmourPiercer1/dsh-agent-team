/**
 * P2-T1 demo probe group — `smoke`.
 *
 * The full-chain demonstration that the harness exists to make repeatable
 * for every later seam group (P2-T2..T5). It proves the public seam is
 * load-bearing in BOTH directions:
 *
 *   1. good row mounted  -> boot succeeds (assertEntriesActivated imported
 *      the probe module and ran apply(); the marker line is machine proof);
 *   2. bad row mounted   -> boot FAILS LOUD with ERR_PACKAGE_PATH_NOT_EXPORTED
 *      (the Node ESM loader itself enforces the upstream exports whitelist —
 *      the runtime is a second, independent line of defense behind the
 *      harness's static scanner);
 *   3. good row restored -> boot succeeds again (recovery);
 *   4. stop -> port free.
 *
 * Steps 1+4 are also covered by the run.mjs lifecycle section; the group
 * re-establishes the good row itself so it can run standalone (`--only
 * probes`).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { extractSpecifiers } from '../../lib/private-import.mjs'
import { checkSpecifier, matchPackageName } from '../../lib/public-surface.mjs'

const GOOD_ROW = {
  id: 'p2t1-smoke-probe',
  rel: 'probes/smoke/plugins/good-host.js',
}
const BAD_ROW = {
  id: 'p2t1-smoke-probe-bad',
  rel: 'probes/smoke/plugins/negative-fixtures/bad-host.js',
}

export default {
  name: 'smoke',
  description: 'demo group: public seam full chain (good boot, private-import runtime rejection, recovery, stop)',

  /**
   * @param {object} ctx - harness context (see lib/harness-core.mjs)
   */
  async run(ctx) {
    const { instance, check, log } = ctx
    const goodUrl = ctx.pluginUrl(GOOD_ROW.rel)
    const badUrl = ctx.pluginUrl(BAD_ROW.rel)

    // The static whitelist view of both plugins (derived from the LIVE
    // surface, so a pin drift that re-exports/removes the subpath is caught
    // here instead of surfacing only as an opaque boot failure).
    const goodSpecs = extractSpecifiers(readFileSync(join(ctx.harnessRoot, GOOD_ROW.rel), 'utf8'))
    const badSpecs = extractSpecifiers(readFileSync(join(ctx.harnessRoot, BAD_ROW.rel), 'utf8'))
    const goodUpstream = goodSpecs.filter((s) => matchPackageName(s.spec, ctx.surface) !== undefined)
    const badUpstream = badSpecs.filter((s) => matchPackageName(s.spec, ctx.surface) !== undefined)
    check(goodUpstream.length >= 1, `good probe carries >=1 upstream import (${goodUpstream.map((s) => s.spec).join(', ')})`)
    check(
      goodUpstream.every((s) => checkSpecifier(s.spec, ctx.surface).admitted),
      'good probe upstream imports all admitted by the live public surface',
    )
    check(badUpstream.length >= 1, `bad probe carries >=1 upstream import (${badUpstream.map((s) => s.spec).join(', ')})`)
    check(
      badUpstream.every((s) => !checkSpecifier(s.spec, ctx.surface).admitted),
      'bad probe upstream import rejected by the live public surface (static)',
    )

    // 1. good row -> successful boot.
    instance.mountRows([{ id: GOOD_ROW.id, name: goodUrl }], [
      'P2-T1 smoke group: good probe row (public exports only). Revert: replace with [].',
    ])
    log('smoke: good row mounted; starting instance')
    let boot
    try {
      boot = await instance.start()
    } catch (error) {
      check(false, `good row boot: ${firstLine(error.message)}`)
      return
    }
    check(boot.url.includes(`127.0.0.1:${ctx.config.port}`), `good row boot succeeded: ${boot.url}`)

    // 2. bad row -> boot must fail loudly with the exports-whitelist error.
    const stop1 = await instance.stop()
    check(stop1.portFree, 'port free after good boot')
    instance.mountRows([{ id: BAD_ROW.id, name: badUrl }], [
      'P2-T1 smoke group: NEGATIVE row — bypasses the static gate on purpose;',
      'proves the runtime itself rejects a private-import probe plugin.',
    ])
    log('smoke: bad row mounted; starting instance (failure expected)')
    let negativeDetail = ''
    try {
      await instance.start({ timeoutMs: 60_000 })
      check(false, 'bad row boot: unexpectedly SUCCEEDED — the runtime did not reject the private import (harness would be vacuous)')
    } catch (error) {
      negativeDetail = error.message
      // The full log of the failed boot is still on disk (start() truncates
      // on the NEXT start). Attribution must hold against the whole log, not
      // just the 12-line tail embedded in the error message.
      let failedBootLog = ''
      try {
        failedBootLog = readFileSync(instance.logPath, 'utf8')
      } catch {
        /* unreadable — fall back to the error tail alone */
      }
      const attributionText = `${negativeDetail}\n${failedBootLog}`
      // Persist the failed-boot log as a standalone negative-test artifact.
      try {
        writeFileSync(join(ctx.config.logDir, `instance-port${ctx.config.port}-negative.log`), failedBootLog)
      } catch {
        /* non-fatal: attribution checks above already hold */
      }
      check(
        attributionText.includes('ERR_PACKAGE_PATH_NOT_EXPORTED'),
        'bad row boot failed loudly with ERR_PACKAGE_PATH_NOT_EXPORTED (runtime whitelist enforcement)',
      )
      check(
        attributionText.includes(BAD_ROW.id),
        'failure names the mounted negative row (attribution is machine-readable)',
      )
    }
    // The failed start() already stopped its child; make sure the port is free.
    const stop2 = await instance.stop()
    check(stop2.portFree, 'port free after failed bad boot')

    // 3. recovery -> good row boots again.
    instance.mountRows([{ id: GOOD_ROW.id, name: goodUrl }], [
      'P2-T1 smoke group: good probe row restored after the negative step.',
    ])
    log('smoke: good row restored; starting instance (recovery)')
    let recovery
    try {
      recovery = await instance.start()
    } catch (error) {
      check(false, `recovery boot: ${firstLine(error.message)}`)
      return
    }
    check(true, `recovery boot succeeded: ${recovery.url}`)

    // 4. stop -> port free. Final state leaves the good row mounted (same
    // policy as the G1 baseline: the dedicated DSH_HOME keeps its rows).
    const stop3 = await instance.stop()
    check(stop3.portFree, 'port free after recovery stop')
    void negativeDetail
  },
}

function firstLine(text) {
  return text.split('\n')[0]
}
