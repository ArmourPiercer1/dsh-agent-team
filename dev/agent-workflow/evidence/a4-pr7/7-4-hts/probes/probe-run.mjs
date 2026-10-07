// Evidence probe — packages/tools/harness/run.mjs (§7.4 file 4/5), the P6-T6 /
// P8-S4B real-host acceptance runner.
//
// The document is the `const TEAM_BLUEPRINT_SOURCE` array literal sliced out of the
// file (no interpolation, so no constants are needed) and evaluated; the result is
// handed to the PRODUCTION parser the booted row uses. No host, no port, no home.
//
// Why `rules: []` preserves the P8-S4B M-scenarios: those mutate governance CELLS
// through `teamRoot.mutation.governance.setOverride` (packages/tools/harness/
// plugin.mjs:659 route → :709 call), and setOverride's only document read is
// `writeTimeChecks` → `policy.readBlueprintEnvelope` →
// `capabilityValuesOf(bound.capabilityPolicy)` (src/plugin/root.ts:1897) — the
// CAPABILITY envelope, which this migration leaves byte-identical. The v3 ceiling
// law lives on the permission-overlay mutation lane (governance/service.ts:651,
// :714, :1154-1178), which this harness never opens; `mutatePermission` is not
// reachable from any route the runner calls.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { read, loadParser, documentFromConst, parserControls, identity } from './lib.mjs'

const REL = 'packages/tools/harness/run.mjs'
const source = process.argv[2] !== undefined ? readFileSync(process.argv[2], 'utf8') : read(REL)
const bp = await loadParser()
const { doc, slicedFrom } = documentFromConst(source, 'TEAM_BLUEPRINT_SOURCE')
const parsed = bp.parseBlueprint(doc)

console.log(JSON.stringify({
  file: REL,
  carrier: "const TEAM_BLUEPRINT_SOURCE = [ … ].join('\\n')",
  slicedFrom,
  consumedAt: REL + ' :: blueprintSource: TEAM_BLUEPRINT_SOURCE (row config, :329)',
  documentVersionLine: /^schemaVersion:.*$/m.exec(doc)[0],
  documentLines: doc.split('\n').length,
  documentSha256: createHash('sha256').update(doc).digest('hex'),
  parsed: identity(parsed),
  // The capability envelope the M-scenarios actually bind on must be untouched.
  teamEnvelope: parsed.teamEnvelope,
  memberEnvelopes: parsed.memberEnvelopes,
  parserControls: parserControls(bp, doc),
}, null, 2))
