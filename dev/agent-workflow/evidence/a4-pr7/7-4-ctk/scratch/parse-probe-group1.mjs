// Throwaway (lane C-testkit §7.4): for every migrated group-1 document —
//  (a) parse with the tree's own strong parser (v3 must be accepted),
//  (b) probe rule: rewrite the declared version to 9 and require the
//      parser to REFUSE (probe-RED ⇒ the version is read ⇒ migrate-by-hand
//      was the correct disposition; a green probe would have meant a lie).
import { parseBlueprint } from '../../../../../../packages/runtime/dist/packages/domain/blueprint/src/validate.js'
import { draftSkeleton } from '../../../../../../scripts/blueprint-authoring.mjs'

function probe(label, doc) {
  const parsed = parseBlueprint(doc)
  const probed = doc.replace(/schemaVersion: \d+/, 'schemaVersion: 9')
  let probeRefused = false
  let why = ''
  try {
    parseBlueprint(probed)
  } catch (e) {
    probeRefused = true
    why = String(e?.code ?? e?.message ?? e).slice(0, 80)
  }
  console.log(`${label}: v${parsed.document?.schemaVersion ?? parsed.schemaVersion ?? '?'} parses OK; probe(v9) refused=${probeRefused} ${why}`)
  if (!probeRefused) {
    console.error(`PROBE-GREEN for ${label} — disposition would be delete-lie, not migrate`)
    process.exitCode = 1
  }
}

probe('skeleton(bp1-h-x)', draftSkeleton('bp1-h-x'))

// t6 docs are string arrays inside .ts test files — extract literally.
import { readFileSync } from 'node:fs'
function extractTsArrayConst(path, name) {
  const src = readFileSync(path, 'utf8')
  const i = src.indexOf(`const ${name}`)
  const start = src.indexOf('[', i)
  const end = src.indexOf("].join('\\n')", start)
  const arrSrc = src.slice(start, end + 1)
  // eslint-disable-next-line no-eval
  return eval(arrSrc).join('\n')
}
probe('t6-10 pipeline', extractTsArrayConst('packages/testkit/test/t6-10-composition-pipeline.test.ts', 'T6_PIPELINE_BLUEPRINT_SOURCE'))
probe('t6-7 fresh', extractTsArrayConst('packages/testkit/test/t6-7-fresh-per-delegation.test.ts', 'T6_FRESH_BLUEPRINT_SOURCE'))
