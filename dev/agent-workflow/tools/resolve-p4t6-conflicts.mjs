/**
 * resolve-p4t6-conflicts.mjs — main-agent DEC-1 conflict resolver for
 * `packages/testkit/test/p4t6-session-event-scan.test.ts` during
 * sequential `cherry-pick -x` of P7 wave task commits onto the int branch.
 *
 * Why it exists: every task branch rebases the cumulative file-scan count
 * (330 -> 330 + own new files) on the same P6 base. Picking them
 * sequentially therefore conflicts in exactly two regions of the p4t6
 * coverage test:
 *
 *   1. the it-title line (`... N files scanned, ...`), and
 *   2. the enumeration-comment tail + the two count assertions
 *      (`filesScanned` / `files.length`).
 *
 * Resolution rule (DEC-1, ratified R29): the integrated count is the CUMULATIVE
 * union (330 + every picked wave-1 task's countable .ts/.mts/.mjs files),
 * and the enumeration comment keeps every picked task's block in pick order.
 * Only the T6 block additionally flips the title to "nine carry source /
 * legacy carries the P7-T6 adapter" (withSource 8->9 and the legacy
 * 0->4 assertions auto-merge: only theirs touched those lines).
 *
 * Usage:
 *   node dev/agent-workflow/tools/resolve-p4t6-conflicts.mjs <count>
 *
 * Runs against the working-tree copy of the p4t6 file (relative to the
 * repo root, i.e. CWD) while the cherry-pick conflict is open. After it
 * returns: `git add <file>` + `git cherry-pick --continue`.
 *
 * Fails loudly (throws) on any block shape it does not recognize — never
 * guesses.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const count = Number(process.argv[2])
if (!Number.isInteger(count) || count <= 0) {
  throw new Error('usage: resolve-p4t6-conflicts.mjs <positive-integer-count>')
}

const file = 'packages/testkit/test/p4t6-session-event-scan.test.ts'
const raw = readFileSync(file, 'utf8')
const eol = raw.includes('\r\n') ? '\r\n' : '\n'
const lines = raw.split(eol)
const out = []
let blocks = 0

for (let i = 0; i < lines.length; ) {
  const line = lines[i]
  if (line.startsWith('<<<<<<< HEAD')) {
    i += 1
    const head = []
    while (!lines[i].startsWith('=======')) {
      head.push(lines[i])
      i += 1
    }
    i += 1
    const theirs = []
    while (!lines[i].startsWith('>>>>>>>')) {
      theirs.push(lines[i])
      i += 1
    }
    i += 1
    blocks += 1
    const headTitle = head.find((x) => x.includes('files scanned'))
    const theirsTitle = theirs.find((x) => x.includes('files scanned'))
    if (headTitle !== undefined && theirsTitle !== undefined) {
      // Title block: keep the HEAD wording, except the T6 wording
      // ("legacy carries the P7-T6 adapter"), which is the DEC-1 final.
      const base =
        theirsTitle.includes('legacy carries the P7-T6 adapter')
          ? theirsTitle
          : headTitle
      const replaced = base.replace(/ \d+ files scanned/, ' ' + count + ' files scanned')
      if (replaced === base) throw new Error('title block: no count to substitute in: ' + base)
      out.push(replaced)
    } else {
      // Tail block: accumulated comment (HEAD) + incoming comment (theirs)
      // + cumulative assertions. The accumulated comment's final line must
      // end the sentence (".") which becomes a continuation (") +").
      const isAssertion = (x) => x.includes('filesScanned') || x.includes('files.length')
      const headComments = head.filter((x) => !isAssertion(x))
      const theirsComments = theirs.filter((x) => !isAssertion(x))
      if (headComments.length === 0 || theirsComments.length === 0) {
        throw new Error('tail block: unexpected shape (head=' + headComments.length + ', theirs=' + theirsComments.length + ')')
      }
      const last = headComments[headComments.length - 1]
      if (!last.endsWith(').')) {
        throw new Error('tail block: accumulated comment does not end with ").": ' + last)
      }
      headComments[headComments.length - 1] = last.slice(0, -1) + ') +'
      out.push(...headComments, ...theirsComments)
      out.push('    expect(scanResult.filesScanned).toBe(' + count + ')')
      out.push('    expect(scanResult.files.length).toBe(' + count + ')')
    }
  } else {
    out.push(line)
    i += 1
  }
}

if (blocks === 0) throw new Error('no conflict blocks found — is a p4t6 conflict open?')
if (out.some((x) => x.includes('<<<<<<<') || x.includes('>>>>>>>') || x === '=======')) {
  throw new Error('marker remnants after resolution')
}
writeFileSync(file, out.join(eol))
console.log('p4t6 resolved: ' + blocks + ' block(s), cumulative count ' + count)
