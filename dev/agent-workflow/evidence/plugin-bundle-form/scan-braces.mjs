import { readFileSync } from 'node:fs'
const [oldF, newF] = process.argv.slice(2)
function scan(file) {
  const t = readFileSync(file, 'utf8')
  let depth = 0, line = 1, state = 0 // 0 code,1 squote,2 dquote,3 template,4 line-comment,5 block-comment
  let firstNeg = -1, lineAtNeg = -1
  const lineDepths = []
  for (let i = 0; i < t.length; i++) {
    const c = t[i], n = t[i + 1]
    if (c === '\n') { lineDepths.push(depth); if (state === 4) state = 0; line++; continue }
    if (state === 0) {
      if (c === "'") state = 1
      else if (c === '"') state = 2
      else if (c === '`') state = 3
      else if (c === '/' && n === '/') { state = 4; i++ }
      else if (c === '/' && n === '*') { state = 5; i++ }
      else if (c === '{') depth++
      else if (c === '}') { depth--; if (depth < 0 && firstNeg < 0) { firstNeg = depth; lineAtNeg = line } }
    } else if (state === 1 || state === 2) {
      if (c === '\\') i++
      else if ((state === 1 && c === "'") || (state === 2 && c === '"')) state = 0
    } else if (state === 3) {
      if (c === '\\') i++
      else if (c === '`') state = 0
    } else if (state === 5) {
      if (c === '*' && n === '/') { state = 0; i++ }
    }
  }
  lineDepths.push(depth)
  return { final: depth, firstNeg, lineAtNeg, endState: state, lines: lineDepths.length }
}
for (const [label, f] of [['old', oldF], ['new', newF]]) {
  const r = scan(f)
  console.log(label, JSON.stringify(r))
}
