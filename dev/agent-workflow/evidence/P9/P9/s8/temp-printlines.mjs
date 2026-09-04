// temp: print verbatim lines of s8-browser.mjs with visible markers
import { readFileSync } from 'node:fs'
const lines = readFileSync(new URL('./s8-browser.mjs', import.meta.url), 'utf8').split('\n')
const [start, end] = process.argv.slice(2).map(Number)
for (let i = start - 1; i < end && i < lines.length; i++) {
  console.log(String(i + 1) + '|' + lines[i])
}
