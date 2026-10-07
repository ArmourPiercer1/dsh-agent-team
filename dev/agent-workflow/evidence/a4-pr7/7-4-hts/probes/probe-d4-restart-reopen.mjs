// Evidence probe — packages/tools/harness/d4-restart-reopen.mjs (§7.4 file 2/5).
//
// The harness embeds its boot document as `const BLUEPRINT_DOC` and hands it to
// the production row (`:740 blueprintSource: BLUEPRINT_DOC`), which the host
// parses at boot (src/plugin/host.ts:2125 classifyBlueprintAnchor →
// blueprint-authority.ts:328; :1857-1862 createBlueprintSourceIndex). This probe
// does NOT boot that host (§7.4 forbids it): it slices the exact array literal out
// of the file, evaluates it with the file's own constants, and runs the PRODUCTION
// parser over the result — the same reader the row calls at boot.
import { readFileSync } from 'node:fs'
import { read, loadParser, documentFromConst, parserControls, identity } from './lib.mjs'

const REL = 'packages/tools/harness/d4-restart-reopen.mjs'
const source = process.argv[2] !== undefined ? readFileSync(process.argv[2], 'utf8') : read(REL)
const bp = await loadParser()
const { doc, slicedFrom } = documentFromConst(source, 'BLUEPRINT_DOC', ['BLUEPRINT_ID', 'BLUEPRINT_REVISION'])
const parsed = bp.parseBlueprint(doc)

console.log(JSON.stringify({
  file: REL,
  carrier: 'const BLUEPRINT_DOC = [ … ].join(\'\\n\')',
  slicedFrom,
  consumedAt: REL + ' :: blueprintSource: BLUEPRINT_DOC (row config)',
  documentVersionLine: /^schemaVersion:.*$/m.exec(doc)[0],
  documentLines: doc.split('\n').length,
  documentSha256: (await import('node:crypto')).createHash('sha256').update(doc).digest('hex'),
  parsed: identity(parsed),
  parserControls: parserControls(bp, doc),
}, null, 2))
