// U1-C tool enumerator: find every defineTool({...}) registration and extract
// the literal tool name + registration site. Read-only scan.
// Usage: node scan-tools.mjs <rootDir> [--include-tests]
import fs from 'node:fs'
import path from 'node:path'

const root = process.argv[2]
const includeTests = process.argv.includes('--include-tests')

function* walk(dir) {
  let ents
  try { ents = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of ents) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (['node_modules', 'dist', 'lib', 'coverage', '.git'].includes(e.name)) continue
      if (!includeTests && e.name === 'tests') continue
      yield* walk(p)
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.d\.ts$/.test(e.name) && !/\.(spec|test)\.ts$/.test(e.name)) {
      if (!includeTests && /\.fixture\./.test(e.name)) continue
      yield p
    }
  }
}

// Given text and index of '{' that opens the defineTool options object,
// return [objStart, objEnd] by brace matching (skipping string/template/comment contents roughly).
function matchBrace(text, open) {
  let depth = 0, i = open
  while (i < text.length) {
    const c = text[i]
    if (c === '"' || c === "'" || c === '`') { i = skipString(text, i); continue }
    if (c === '/' && text[i + 1] === '/') { i = text.indexOf('\n', i); if (i < 0) break; continue }
    if (c === '/' && text[i + 1] === '*') { const e = text.indexOf('*/', i + 2); i = e < 0 ? text.length : e + 2; continue }
    if (c === '{') depth++
    else if (c === '}') { depth--; if (depth === 0) return [open, i] }
    i++
  }
  return null
}
function skipString(text, q) {
  const quote = text[q]; let i = q + 1
  while (i < text.length) {
    if (text[i] === '\\') { i += 2; continue }
    if (text[i] === quote) return i + 1
    i++
  }
  return text.length
}

// extract top-level `name:` value from object text (offsets relative to obj)
function extractName(objText) {
  let depth = 0, i = 0
  while (i < objText.length) {
    const c = objText[i]
    if (c === '"' || c === "'" || c === '`') { i = skipString(objText, i); continue }
    if (c === '/' && objText[i + 1] === '/') { const e = objText.indexOf('\n', i); i = e < 0 ? objText.length : e; continue }
    if (c === '/' && objText[i + 1] === '*') { const e = objText.indexOf('*/', i + 2); i = e < 0 ? objText.length : e + 2; continue }
    if (c === '{' || c === '[' || c === '(') { depth++; i++; continue }
    if (c === '}' || c === ']' || c === ')') { depth--; i++; continue }
    if (depth === 1 && (c === 'n') && objText.startsWith('name', i)) {
      // ensure word boundary before and after 'name'
      const before = i === 0 ? ' ' : objText[i - 1]
      const after = objText[i + 4]
      if (!/[A-Za-z0-9_$]/.test(before) && !/[A-Za-z0-9_$]/.test(after)) {
        let j = i + 4
        while (j < objText.length && /\s/.test(objText[j])) j++
        if (objText[j] === ':') {
          j++
          while (j < objText.length && /\s/.test(objText[j])) j++
          // capture until top-level , or } at depth 1
          let k = j, d2 = 0
          while (k < objText.length) {
            const cc = objText[k]
            if (cc === '"' || cc === "'" || cc === '`') { k = skipString(objText, k); continue }
            if ('{(['.includes(cc)) d2++
            else if ('})]'.includes(cc)) { if (d2 === 0) break; d2-- }
            else if (cc === ',' && d2 === 0) break
            k++
          }
          return objText.slice(j, k).trim()
        }
      }
    }
    i++
  }
  return null
}

function lineOf(text, idx) {
  return text.slice(0, idx).split('\n').length
}

const results = []
for (const file of walk(root)) {
  const text = fs.readFileSync(file, 'utf8')
  if (!text.includes('defineTool')) continue
  let m
  const re = /defineTool(?:<[^>]*>)?\s*\(/g
  while ((m = re.exec(text))) {
    const open = text.indexOf('{', m.index)
    if (open < 0) continue
    const span = matchBrace(text, open)
    if (!span) continue
    const objText = text.slice(span[0], span[1] + 1)
    const rawName = extractName(objText)
    const rel = path.relative(root, file)
    const pkg = rel.split('/')[1] ?? ''
    const gate = rel.split('/')[0] ?? ''
    results.push({
      file: rel, line: lineOf(text, m.index), pkg: gate + '/' + pkg,
      rawName: rawName === null ? 'NO_NAME_FOUND' : rawName,
    })
  }
}
console.log(JSON.stringify(results, null, 1))
