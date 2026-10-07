// Evidence probe — packages/tools/harness/g5-member-e2e.mjs (§7.4 file 3/5).
//
// Same discipline as probe-d4: the `const BLUEPRINT_DOC` array literal is sliced
// out of the harness file and evaluated with that file's own constants, then run
// through the PRODUCTION parser the booted row uses (host.ts:2125
// classifyBlueprintAnchor). No host, no port, no DSH_HOME write.
//
// Why the empty authority documents cannot change what this harness proves: G5
// drives REAL member file/shell tool calls, i.e. permission APPROVAL decisions.
// The approval narrowing is `narrowingForApproval`
// (packages/domain/authority-envelope/src/authority-envelope.ts:439), whose own
// contract is "the IDENTITY on no match … This is the half of the pair that makes
// the documented `teamHardEnvelope: { rules: [] }` survivable: it removes
// nothing, and the Leader's approvable set stays whatever the ladder grants."
// The expansion lookup `effectiveAuthorityCeiling` (:409) answers `no-authority`
// on no match — the same ceiling an ABSENT v1 carrier already meant. The probe
// below prints the documents so that reading can be checked against the bytes.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { read, loadParser, documentFromConst, parserControls, identity } from './lib.mjs'

const REL = 'packages/tools/harness/g5-member-e2e.mjs'
// argv[2] lets the same probe certify a different copy of the same carrier — the
// `git show HEAD:<path>` snapshot of the pre-migration file — so the before/after
// pair is produced by one program rather than by hand-copied numbers.
const source = process.argv[2] !== undefined ? readFileSync(process.argv[2], 'utf8') : read(REL)
const bp = await loadParser()
const { doc, slicedFrom } = documentFromConst(source, 'BLUEPRINT_DOC', ['BLUEPRINT_ID', 'BLUEPRINT_REVISION'])
const parsed = bp.parseBlueprint(doc)

console.log(JSON.stringify({
  file: REL,
  carrier: "const BLUEPRINT_DOC = [ … ].join('\\n')",
  slicedFrom,
  consumedAt: REL + ' :: blueprintSource: BLUEPRINT_DOC (row config, :1079)',
  documentVersionLine: /^schemaVersion:.*$/m.exec(doc)[0],
  documentLines: doc.split('\n').length,
  documentSha256: createHash('sha256').update(doc).digest('hex'),
  parsed: identity(parsed),
  parserControls: parserControls(bp, doc),
}, null, 2))
