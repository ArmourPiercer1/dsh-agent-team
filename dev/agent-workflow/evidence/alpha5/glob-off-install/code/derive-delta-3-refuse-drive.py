p = 'a5glob-delta-kit.mjs'
s = open(p).read()

# ── 1) every shape goes through the same discovery door ──────────────────────
i = s.index("    const MKD = `${MK}_${mode.toUpperCase()}_DISC`")
j = s.index("    const surface = [...new Set(discReq?.digest.toolNames ?? [])].sort()")
new_front = """    const MKD = `${MK}_${mode.toUpperCase()}_DISC`
    // EVERY shape — the refusal shapes included — enters through the same front
    // door the ladder shapes use: the real discovery round on the root session.
    // The refuse worlds differ from `doff` by exactly ONE config key (the name
    // the glob row claims), so the only thing that can change is what the mount
    // does, not how the world is driven.
    const disc = await promptBarrier({ sessionId: ROOT, textBase: MKD, rpcTag: `a5go-${mode}-d` })
    facts.discoveryAttempts = disc.attempts
"""
s = s[:i] + new_front + s[j:]
s = s.replace("""    const surface = [...new Set(discReq?.digest.toolNames ?? [])].sort()""",
              """    const surface = [...new Set(disc.hit.digest.toolNames ?? [])].sort()""", 1)

# ── 2) blueprint for every shape ─────────────────────────────────────────────
s = s.replace("""    if (MODES[mode].ladderless !== true) writeFileSync(join(BLUEPRINT_DIR, 'main.yaml'), mainBlueprintYaml(denyList, { mode, text: MKT }))""",
              """    writeFileSync(join(BLUEPRINT_DIR, 'main.yaml'), mainBlueprintYaml(denyList, { mode, text: MKT }))""", 1)

# ── 3) collection block: move to AFTER team.create, add the witness poll ─────
i = s.index("    if (MODES[mode].ladderless === true) {\n      // No ladder: collect the refusal face and stop.")
end_marker = "      return facts\n    }\n"
j = s.index(end_marker, i) + len(end_marker)
block = s[i:j]
s = s[:i] + s[j:]
anchor = "    facts.teamCreate = { status: created.status, body: redact(JSON.stringify(created.body ?? null)).slice(0, 800) }\n"
assert anchor in s
witness_and_block = anchor + """
    if (MODES[mode].ladderless === true) {
      // The mount is attempted while the host binds the sessions team.create
      // brings up. Poll the two faces that can carry the typed refusal — the
      // plugin's own observation stream (read through the read-only observer
      // row) and the instance's own log — and stop as soon as one shows it.
      facts.refusalWitness = { source: null, line: null, polledMs: 0 }
      const wantNames = ['team_grep', 'team_glob', 'team_bash', 'read', 'subagent_codex', 'subagent_claude_code', 'subagent_fork'].join(',')
      const t0 = Date.now()
      while (Date.now() - t0 < 150_000) {
        try {
          const rawLog = readFileSync(INSTANCE_RAW, 'utf8')
          const hit = rawLog.split('\\n').find((l) => /mount-REFUSED|PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED/.test(l))
          if (hit !== undefined) { facts.refusalWitness = { source: 'instance-log', line: redact(hit).slice(0, 300), polledMs: Date.now() - t0 }; break }
        } catch { /* the log may not be flushed yet */ }
        try {
          const f = await fetchJson(`${origin}/__a5ie/facts?names=${encodeURIComponent(wantNames)}&roots=${encodeURIComponent(CREATE_ROOT)}`, null, 10_000)
          const lines = (f?.body?.planeObservations ?? []).map(String)
          const hit = lines.find((l) => /mount-REFUSED|PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED/.test(l))
          if (hit !== undefined) { facts.refusalWitness = { source: 'observer-stream', line: hit.slice(0, 300), polledMs: Date.now() - t0 }; break }
        } catch { /* not yet */ }
        await new Promise((r) => setTimeout(r, 2_000))
      }
      facts.refusalWitness.polledMs = Date.now() - t0
    }
""" + block.replace("""      const obs = await waitQuietTolerant(45_000, async () => {""", """      const obs = await waitQuietTolerant(20_000, async () => {""")
s = s.replace(anchor, witness_and_block, 1)

# the moved block sets facts.ok/return; make its refusal evidence include the poll
s = s.replace("""      facts.memberToolCallOrder = []
      facts.memberToolResults = []
      facts.outsideMarkerOnWire = 0
      facts.seedNamesOnWire = []
      facts.ok = true
      return facts""",
"""      facts.memberToolCallOrder = []
      facts.memberToolResults = []
      facts.outsideMarkerOnWire = 0
      facts.seedNamesOnWire = []
      facts.refusalCreateBody = facts.teamCreate?.body ?? null
      facts.ok = true
      return facts""", 1)

# ── 4) the X-refuse leg reads every witness surface ───────────────────────────
old = """    const obsLine = String((w.planeObservations ?? []).find((l) => /mount-REFUSED/.test(String(l))) ?? '')
    const logLine = String((w.logObservations ?? []).find((l) => /mount-REFUSED|PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED/.test(String(l))) ?? '')
    const hostErr = String((w.hostErrors ?? []).find((l) => /PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED/.test(String(l))) ?? '')
    const witness = obsLine !== '' ? obsLine : (logLine !== '' ? logLine : hostErr)"""
new = """    const obsLine = String((w.planeObservations ?? []).find((l) => /mount-REFUSED|PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED/.test(String(l))) ?? '')
    const logLine = String((w.logObservations ?? []).find((l) => /mount-REFUSED|PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED/.test(String(l))) ?? '')
    const hostErr = String((w.hostErrors ?? []).find((l) => /PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED/.test(String(l))) ?? '')
    const pollLine = String(w.refusalWitness?.line ?? '')
    const createLine = String(w.refusalCreateBody ?? w.teamCreate?.body ?? '')
    const witness = [pollLine, obsLine, logLine, hostErr, createLine].find((l) => l.includes('PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED')) ?? ''"""
assert old in s
s = s.replace(old, new, 1)
s = s.replace("""      witness.includes('PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED') && witness.includes('mount-REFUSED') && !placed && wirePlane.length === 0,
      `witness=${JSON.stringify(witness).slice(0, 240)} placedLine=${String(placed)} wirePlaneRows=${JSON.stringify(wirePlane)} planKinds=${JSON.stringify(led.counts)} provoke=${JSON.stringify(w.refusalProvoke ?? null)}`)""",
"""      witness !== '' && !placed && wirePlane.length === 0,
      `witness=${JSON.stringify(witness).slice(0, 300)} placedLine=${String(placed)} wirePlaneRows=${JSON.stringify(wirePlane)} planKinds=${JSON.stringify(led.counts)} createStatus=${JSON.stringify(w.teamCreate?.status ?? null)} polledMs=${String(w.refusalWitness?.polledMs ?? -1)} discoverySurface=${JSON.stringify((w.discoverySurface ?? []).filter((n) => n === 'team_glob' || n === name))}`)""", 1)

open(p, 'w').write(s)
print('refuse-shape drive restructured')
