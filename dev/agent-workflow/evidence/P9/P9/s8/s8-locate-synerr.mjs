// S8 helper — locate the syntax error site inside the generated facade.
import { readFileSync } from 'node:fs'

const file = process.argv[2]
const text = readFileSync(file, 'utf8')
try {
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', text)
  console.log('facade parses OK')
} catch (e) {
  console.log('PARSE ERROR:', e.message)
  const lines = String(e.stack ?? '').split('\n')
  for (const l of lines.slice(0, 6)) console.log('  |', l)
  // Extract "at new Function (<anonymous>:LINE:COL)" if present
  const m = String(e.stack ?? '').match(/<anonymous>:(\d+):(\d+)/)
  if (m) {
    const lineNo = Number(m[1]) - 1 // Function wrapper adds a preamble line
    const col = Number(m[2])
    const body = text.split('\n')
    const target = body[lineNo - 1] ?? ''
    console.log(`\noffending line ${lineNo} (col ${col}):`)
    console.log('  >>> ' + target.slice(Math.max(0, col - 60), col + 60))
    console.log('  --- 3 lines before ---')
    for (let i = Math.max(0, lineNo - 4); i < lineNo - 1; i++) {
      console.log(`  ${i + 1}: ${body[i] ? body[i].slice(0, 100) : ''}`)
    }
  }
}
