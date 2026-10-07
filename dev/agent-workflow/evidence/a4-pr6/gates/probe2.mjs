import { readFileSync } from 'node:fs'
function callArgumentTexts(src, fun) {
  const out = []
  const needle = `${fun}(`
  let from = 0
  for (;;) {
    const start = src.indexOf(needle, from)
    if (start === -1) return out
    if (/(?:function|const|let)\s*$/.test(src.slice(Math.max(0, start - 20), start))) { from = start + needle.length; continue }
    let depth = 0
    let quote = null
    let i = start + needle.length
    for (; i < src.length; i += 1) {
      const ch = src[i]
      if (quote !== null) { if (ch === quote && src[i-1] !== '\\') quote = null; continue }
      if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue }
      if (ch === '(' || ch === '{' || ch === '[') depth += 1
      if (ch === ')' || ch === '}' || ch === ']') { if (depth === 0) break; depth -= 1 }
    }
    out.push(src.slice(start + needle.length, i))
    from = i + 1
  }
}
function topLevelArgs(inner) {
  const args = []
  let depth = 0, quote = null, current = ''
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i]
    if (quote !== null) { current += ch; if (ch === quote && inner[i-1] !== '\\') quote = null; continue }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; current += ch; continue }
    if (ch === '(' || ch === '{' || ch === '[') depth += 1
    if (ch === ')' || ch === '}' || ch === ']') depth -= 1
    if (ch === ',' && depth === 0) { args.push(current.trim()); current = ''; continue }
    current += ch
  }
  args.push(current.trim())
  return args
}
const src = readFileSync('packages/runtime/src/plugin/host.ts','utf8')
for (const inner of callArgumentTexts(src, 'commitDurableFact')) {
  const args = topLevelArgs(inner)
  console.log('arg count', args.length, 'arg4 =', JSON.stringify(args[3]))
}
