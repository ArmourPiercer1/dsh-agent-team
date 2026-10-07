// Throwaway evidence probe (lane C-tools+harness, §7.4 pre-flip half).
//
// WHAT IT PROVES: the exact Blueprint document that
// packages/runtime/root-binding/harness/blueprint-source.mjs builds — produced by
// IMPORTING that module and calling it with the values the real run directive in
// packages/runtime/root-binding/harness/run.mjs carries (the persona/id/revision
// constants are read out of run.mjs itself, never retyped here) — parses under the
// production parser, and its identity (`blueprintId` / `revision` / `contentHash`)
// is DERIVED by that parser, not asserted from a literal.
//
// The parser is the committed dist build of packages/domain/blueprint — the same
// artifact the harnesses load at runtime (`plugin.mjs:373` imports
// '../../../domain/blueprint/src/index.js' through the harness ts-loader; the dist
// tree is the byte-checked committed install surface, and its validate.js carries
// the same `requireField(record, 'permissionMutationEnvelope'|'teamHardEnvelope')`
// pair as src/validate.ts:1335-1336).
//
// It does NOT boot a host: no §7.6 harness leg runs here.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const findRepo = (from) => {
  let dir = from
  while (dir !== dirname(dir)) {
    try {
      readFileSync(resolve(dir, 'scripts/verify-blueprint-version-clean.mjs'), 'utf8')
      return dir
    } catch {
      dir = dirname(dir)
    }
  }
  throw new Error('probe: cannot walk up to the repository root')
}
const REPO = findRepo(HERE)
const require_ = createRequire(import.meta.url)

const { p5t5BlueprintSource } = await import(
  resolve(REPO, 'packages/runtime/root-binding/harness/blueprint-source.mjs')
)
const bp = await import(
  resolve(REPO, 'packages/runtime/dist/packages/domain/blueprint/src/index.js')
)

// The directive values, taken from the real run program (not retyped).
const runSrc = readFileSync(resolve(REPO, 'packages/runtime/root-binding/harness/run.mjs'), 'utf8')
const constOf = (name) => {
  const m = new RegExp(`^const ${name} = (.+)$`, 'm').exec(runSrc)
  if (m === null) throw new Error(`probe: cannot find \`const ${name}\` in run.mjs`)
  return (0, eval)(m[1])
}
const directiveBlock = runSrc.slice(
  runSrc.indexOf('const blueprint = {'),
  runSrc.indexOf('const facet ='),
)
const blueprintId = /blueprintId: '([^']+)'/.exec(directiveBlock)[1]
const revision = /revision: '([^']+)'/.exec(directiveBlock)[1]
const directive = {
  blueprintId,
  revision,
  leaderPersona: constOf('LEADER_PERSONA'),
  memberPersonas: { p5t5worker: constOf('MEMBER_PERSONA') },
}

const doc = p5t5BlueprintSource(directive)
const docVersionLine = /^schemaVersion:.*$/m.exec(doc)[0]
const parsed = bp.parseBlueprint(doc)

// Static stand-ins for the probe the dispatch prescribes ("set a fixture's
// schemaVersion to 9 and run the lane that owns it"). The lane that owns this
// document boots a real host, which §7.4 forbids; what CAN be run without a host
// is the same parser the harness calls at `plugin.mjs:431`, so the version line
// and the two required carriers are tested against THAT reader: if a forged
// version or a deleted carrier is refused, the migrated bytes are load-bearing
// for the product parser and the document is not decoration.
const refusal = (label, source) => {
  try {
    bp.parseBlueprint(source)
    return { label, outcome: 'PARSED (no refusal)' }
  } catch (error) {
    return {
      label,
      outcome: 'refused',
      code: error?.code ?? error?.name,
      message: String(error?.message ?? error).split('\n')[0],
    }
  }
}
const dropCarrier = (source, key) => {
  const lines = source.split('\n')
  const i = lines.indexOf(`${key}:`)
  if (i === -1) throw new Error(`probe: no "${key}:" carrier line in the document`)
  if (lines[i + 1] !== '  rules: []') throw new Error(`probe: unexpected shape after ${key}: ${lines[i + 1]}`)
  return [...lines.slice(0, i), ...lines.slice(i + 2)].join('\n')
}
const controls = [
  refusal('as-authored', doc),
  refusal('version forged to 9', doc.replace(/^schemaVersion:.*$/m, 'schemaVersion: 9')),
]
for (const key of ['teamHardEnvelope', 'permissionMutationEnvelope']) {
  try {
    controls.push(refusal(`${key} carrier deleted`, dropCarrier(doc, key)))
  } catch (error) {
    // The pre-migration (v1) document has no such line at all — which is itself
    // the finding: the carrier did not exist in the document the harness shipped.
    controls.push({ label: `${key} carrier deleted`, outcome: `no such carrier in this document: ${error.message}` })
  }
}

console.log(JSON.stringify({
  module: 'packages/runtime/root-binding/harness/blueprint-source.mjs',
  exported: 'p5t5BlueprintSource',
  directive,
  documentVersionLine: docVersionLine,
  parsed_schemaVersion: parsed.schemaVersion,
  parsed_blueprintId: parsed.blueprintId,
  parsed_revision: parsed.revision,
  parsed_contentHash: parsed.contentHash,
  permissionMutationEnvelope: parsed.permissionMutationEnvelope,
  teamHardEnvelope: parsed.teamHardEnvelope,
  // The harness's own cross-check (plugin.mjs:432-437): the parsed leader persona
  // must be the persona the directive asserts.
  leaderPersonaRoundTrips: parsed.leader?.persona === directive.leaderPersona,
  parserControls: controls,
}, null, 2))
void require_
