// A5M2-G6 ER config PATCHES (root config card 2026-10-24, same-card).
// Separate module so the kit-code strings stay readable.
// Semantics: profile patch layers replace a row's WHOLE config (no deep
// merge — fixed 639 bundle comment :5-6), so every override restates all
// fields. preset-standard: the ORIGINAL full id/order/plugins is read at
// write time from the fixed 639 preset layer (READ ONLY); ONLY the native
// tool-session-query plugin row is appended. sqlite: path :memory: restated
// + openAt first-search. No teamTools entries, no binding invention, no
// guard removal, no shared-host/stable-3080 changes.

const P1_FROM = "  writeFileSync(patchPath, lines.join('\\n'))\n  return rowConfig"

const P1_TO_HEAD = [
  "  writeFileSync(patchPath, lines.join('\\n') + erConfigLayer())",
  '  return rowConfig',
  '}',
  '',
  '// A5M2-G6 ER config layer (root config card 2026-10-24): overrides BY ID;',
  '// whole row.config restated (the patch never deep-merges). The ORIGINAL',
  '// full preset-standard config is re-emitted from the fixed 639 preset',
  '// layer with ONLY the native tool-session-query plugin row appended;',
  '// sqlite restates :memory: + openAt first-search. Fixed host tree READ ONLY.',
  'function erConfigLayer () {',
  "  const pl = readFileSync(join(HOST_TREE, 'packages/bundle/web-app/presets/standard.patch.yml'), 'utf8').split('\\n')",
  "  const start = pl.findIndex((l) => l === '    - id: preset-standard')",
  "  if (start < 0) throw new Error('ER CONFIG LAW: preset-standard row not found in the fixed 639 preset layer — refusing a partial override')",
  '  let end = pl.length',
  '  for (let i = start + 1; i < end; i += 1) if (/^    - id: /.test(pl[i])) { end = i; break }',
  '  const out = []',
  '  let inserted = false',
  '  for (let i = start; i < end; i += 1) {',
  "    const l = pl[i].startsWith('    ') ? pl[i].slice(4) : pl[i]",
  '    out.push(l)',
].join('\n')

const p1PushLine = (tsq) => `    if (!inserted && l === '    plugins:') { out.push('      - id: tool-session-query', "        name: ${tsq}"); inserted = true }`

const P1_TO_TAIL = [
  '  }',
  "  if (!inserted) throw new Error('ER CONFIG LAW: plugins list not found inside preset-standard — refusing')",
  '  const sqlite = [\'- id: session-query-sqlite\', "  name: \'@deepseek-ai/dsh-session-query-sqlite\'", \'  config:\', "    path: \':memory:\'", \'    openAt: first-search\'].join(\'\\n\')',
  '  return \'\\n\' + out.join(\'\\n\') + \'\\n\' + sqlite + \'\\n\'',
].join('\n')

const P2_FROM = '  const mock = await startMockModel({ port: pre.mockPort, decide, log: (l) => log(`mock: ${l}`), fixtures: { dir: join(RUN_DIR, \'model-fixtures\'), maxTextLength: 1600 } })'

const P2_TO = [
  '  const mock = await startMockModel({ port: pre.mockPort, decide: (arg) => {',
  '    const r = decide(arg)',
  '    for (const tc of r?.toolCalls ?? []) {',
  '      const published = new Set(((arg?.req?.tools ?? arg?.req?.body?.tools ?? []).map((t) => t?.name ?? t?.function?.name)))',
  '      if (published.size === 0) throw new Error(`TOOL-VISIBILITY LAW: no published tools visible in this request; refusing to script-call ${String(tc.name)} blind (root law 2026-10-24)`)',
  '      if (!published.has(tc.name)) throw new Error(`TOOL-VISIBILITY LAW: scripted call ${String(tc.name)} NOT among the ${String(published.size)} tools published in THIS request — refusing to force an unpublished tool`)',
  '    }',
  '    return r',
  '  }, log: (l) => log(`mock: ${l}`), fixtures: { dir: join(RUN_DIR, \'model-fixtures\'), maxTextLength: 1600 } })',
].join('\n')

const P3_FROM = 'async function main() {\n  mkdirSync(RUN_DIR, { recursive: true })'

const P3_TO = [
  'async function main() {',
  "  const emitTo = argValue('--emit-patch', null)",
  '  if (emitTo !== null) { writeG6PatchFile(emitTo); console.log(`patch emitted: ${emitTo}`); process.exit(0) }',
  '  mkdirSync(RUN_DIR, { recursive: true })',
].join('\n')

export function erConfigPatches (tsqSpecYaml) {
  return [
    ['profile-layer-er-config', P1_FROM, P1_TO_HEAD + '\n' + p1PushLine(tsqSpecYaml) + '\n' + P1_TO_TAIL],
    ['mock-tool-visibility-law', P2_FROM, P2_TO],
    ['cli-emit-patch-offline', P3_FROM, P3_TO],
  ]
}
