/**
 * THE glob row (GLUE-7 scope probe -> PR5 commitment): the REAL ripgrep
 * `--files` walk, run INSIDE the confined sandbox on the same provider face
 * the shell row proved live (kernel-enforced read scope: the rg process
 * cannot read outside its allowPaths no matter what the pattern names).
 * The argv/limit vocabulary is the host PUBLIC PACKAGE ROOT's own
 * (`@deepseek-ai/dsh-tool-fs-search`: `buildGlobCommand` bakes
 * `--files --glob=P --sort=modified --no-ignore --hidden` + the
 * GLOB_VCS_EXCLUDES negations, search root behind `--`) — the plan's R3
 * route names these helpers verbatim (memo plan :128; scope probe
 * evidence/alpha5/glue7/glob/README.md, ruling: within the original
 * authorization, no new decision needed). The PRESENTATION is the LANE's
 * own SearchOutcome (`files_with_matches`) so the reviewed renderer and
 * spill law stay single-owned (the host's formatGlobOutput is bound to the
 * host's own spill/sampling caps surface — double-formatting would fork
 * the render law; disclosed). Anchoring is the SAME `resolveAnchored` law
 * the read/grep rows carry (lex + realpath + isBeneath: a symlink whose
 * FINAL target escapes the governed root is refused BEFORE any spawn), and
 * the bounded-output cap is `GLOB_MAX_RESULTS` — an over-cap walk reports
 * `truncated` honestly, it is never silently cut.
 */
export function createAnchoredGlobBackend({ realmId, rootDir, templateId = 'plane', instanceId = 'member', confined, observe = () => {}, timeoutMs = 60_000 }) {
  const provider = createConfinedProcessProvider({
    realmId,
    trustRoot: confined.trustRoot ?? null,
    scratchRoot: confined.scratchRoot ?? rootDir,
    ...(confined.runnerCommand === undefined ? {} : { runnerCommand: confined.runnerCommand }),
    assembly: confined.assembly ?? {},
  })
  let probed = null
  let rgPath = null
  let executed = 0
  let trace = []
  const lastRuns = []
  return {
    backendId: 'a5g7-confined-rg-glob',
    get lastStageTrace() { return trace },
    execCount: () => executed,
    lastRuns,
    async run(call, io) {
      const parsed = call.parsedArgs
      if (parsed.tool !== 'glob') {
        return { ok: false, failure: { class: 'denied', code: 'wrong-tool-for-backend', detail: 'the glob backend got a non-glob call' } }
      }
      const anchor = resolveAnchored(rootDir, parsed.target)
      if (!anchor.ok) {
        trace = ['anchor-refused']
        observe(`anchored-glob refused ${String(anchor.code)} call=${call.callId} realm=${realmId}`)
        return { ok: false, failure: { class: 'denied', code: anchor.code, detail: anchor.detail } }
      }
      const walkRel = anchor.path === anchor.rootReal ? '.' : relative(anchor.rootReal, anchor.path)
      if (rgPath === null) {
        try { rgPath = await resolveRgPath() } catch (e) {
          trace = ['probe', 'terminate']
          return { ok: false, failure: { class: 'failed', code: 'rg-unavailable', detail: String((e && e.message) ?? e).slice(0, 200) } }
        }
      }
      trace = ['probe']
      if (probed === null) {
        probed = await provider.probe()
        if (probed.ok !== true) {
          trace = ['probe', 'terminate']
          observe(`anchored-glob capability REFUSED realm=${realmId} code=${probed.error?.code}`)
          return { ok: false, failure: { class: 'denied', code: `confined-unavailable:${String(probed.error?.code ?? 'probe-refused')}`, detail: String(probed.error?.message ?? 'probe refused') } }
        }
        observe(`anchored-glob capability OK realm=${realmId} rows=${probed.value.length} rg=${rgPath}`)
      }
      trace = ['probe', 'prepare', 'execute']
      const rgBinDir = rgPath.slice(0, rgPath.lastIndexOf('/'))
      const request = {
        grantFingerprint: `glue7:${realmId}:${templateId}:${call.callId}`,
        realmId,
        bindingId: `glue7-plane:${templateId}`,
        memberScope: instanceId,
        argv: [rgPath, ...buildGlobCommand({ pattern: parsed.pattern })],
        cwd: anchor.path,
        env: [['PATH', '/usr/bin:/bin']],
        allowPaths: [
          SYSTEM_RX('/bin'), SYSTEM_RX('/usr'), SYSTEM_RX('/lib'),
          ...(existsSync('/lib64') ? [SYSTEM_RX('/lib64')] : []),
          SYSTEM_RX(rgBinDir),
          { path: anchor.rootReal, accessBits: { readFile: true, readDir: true } },
        ],
      }
      if (walkRel !== '.') {
        // the anchored subtree rides behind `--` (host law: a leading-dash
        // walk root is never a flag); rg receives it as a plain argv element
        request.argv.push('--', walkRel)
      }
      const handle = await provider.spawnStreaming(request)
      if (handle.ok !== true) {
        trace = ['probe', 'prepare', 'terminate']
        observe(`anchored-glob spawn REFUSED realm=${realmId} call=${call.callId} code=${handle.error?.code}`)
        return { ok: false, failure: { class: 'denied', code: `confined-refused:${String(handle.error?.code ?? 'spawn-refused')}`, detail: String(handle.error?.message ?? 'spawn refused') } }
      }
      executed += 1
      const h = handle.value
      let stdout = ''
      let stderr = ''
      let timedOut = false
      h.stdout.on('data', (c) => { const str = String(c); stdout += str; if (io.sink) io.sink.write(str) })
      h.stderr.on('data', (c) => { stderr += String(c) })
      const exit = await Promise.race([
        h.exited,
        new Promise((r) => sleepTimer(() => r({ timedOut: true }), timeoutMs)),
      ])
      await h.terminate() // the lease settles through the frozen arm (once per path)
      if (exit.timedOut === true) {
        timedOut = true
        trace = [...trace, 'terminate']
        return {
          ok: true,
          outcome: { outputMode: 'files_with_matches', matches: [], counts: [], files: [], totalMatches: 0, truncated: false },
          settlement: { kind: 'cancelled', event: 'dispatcher-call-terminated-after-body-start' },
        }
      }
      const code = typeof exit.code === 'number' ? exit.code : null
      trace = [...trace, 'terminate']
      if (code !== 0 && code !== 1) {
        // rg exit>=2 is a REAL walker error (invalid pattern syntax,
        // unreadable root): it lands as a typed failure — never a silently
        // empty list.
        observe(`anchored-glob ERROR realm=${realmId} call=${call.callId} exit=${String(code)}`)
        return { ok: false, failure: { class: 'failed', code: `rg-exit-${String(code)}`, detail: (stderr.trim() || 'ripgrep reported an error').slice(0, 400) } }
      }
      const all = stdout.split('\n').filter((l) => l.trim().length > 0).map((l) => (l.startsWith('./') ? l.slice(2) : l))
      const files = all.slice(0, GLOB_MAX_RESULTS)
      lastRuns.push({ callId: call.callId, pid: h.pid, exit: code, total: all.length })
      observe(`anchored-glob ran realm=${realmId} call=${call.callId} pid=${String(h.pid)} files=${String(all.length)} capped=${String(all.length > GLOB_MAX_RESULTS)}`)
      return {
        ok: true,
        outcome: {
          outputMode: 'files_with_matches',
          matches: [],
          counts: [],
          files,
          totalMatches: all.length,
          truncated: all.length > files.length,
        },
        settlement: { kind: 'completed' },
      }
    },
  }
}

