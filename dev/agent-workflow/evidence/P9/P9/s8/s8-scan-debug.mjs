// S8 helper — run the bundle scanner over a dist file range and dump
// per-line mode/depth so a state drift is visible.
import { readFileSync } from 'node:fs'

const [file, from, to] = process.argv.slice(2, 5)
const lines = readFileSync(file, 'utf8').split('\n')
const start = Number(from) - 1
const end = Number(to) - 1

// Mirror of makeScanner() in s8-bundle.mjs
const st = { mode: 'code', depth: 0, lineDepthStart: 0, lineEndsCode: false, lastCodeChar: '' }
function scan(line) {
  st.lineDepthStart = st.depth
  st.lineEndsCode = false
  st.lastCodeChar = ''
  if (st.mode === 'linecomment') st.mode = 'code'
  let i = 0
  while (i < line.length) {
    const c = line[i]
    const c2 = line[i + 1]
    if (st.mode === 'code') {
      if (c === '/' && c2 === '/') { st.mode = 'linecomment'; i += 2; continue }
      if (c === '/' && c2 === '*') { st.mode = 'blockcomment'; i += 2; continue }
      if (c === "'") { st.mode = 'sq'; i += 1; continue }
      if (c === '"') { st.mode = 'dq'; i += 1; continue }
      if (c === '`') { st.mode = 'tpl'; i += 1; continue }
      if (c === '{') st.depth++
      if (c === '}') st.depth--
      st.lineEndsCode = true
      st.lastCodeChar = c
      i += 1
      continue
    }
    if (st.mode === 'linecomment') { i = line.length; continue }
    if (st.mode === 'blockcomment') {
      if (c === '*' && c2 === '/') { st.mode = 'code'; i += 2; continue }
      i += 1
      continue
    }
    if (st.mode === 'sq' || st.mode === 'dq') {
      const q = st.mode === 'sq' ? "'" : '"'
      if (c === '\\') { i += 2; continue }
      if (c === q) { st.mode = 'code'; st.lineEndsCode = true; st.lastCodeChar = q }
      i += 1
      continue
    }
    if (st.mode === 'tpl') {
      if (c === '\\') { i += 2; continue }
      if (c === '`') { st.mode = 'code'; st.lineEndsCode = true; st.lastCodeChar = '`' }
      i += 1
      continue
    }
    i += 1
  }
}
for (let i = start; i <= end; i++) {
  scan(lines[i])
  console.log(`L${i + 1} d=${st.lineDepthStart}=>${st.depth} last='${st.lastCodeChar}' endsCode=${st.lineEndsCode} mode=${st.mode} :: ${lines[i].trim().slice(0, 70)}`)
}
