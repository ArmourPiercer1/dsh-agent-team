// temp: print verbatim numbered lines of ANY file: temp-pline2.mjs <file> <start> <end>
import { readFileSync } from 'node:fs'
const [file, start, end] = process.argv.slice(2)
const lines = readFileSync(file, 'utf8').split('\n')
for (let i = start - 1; i < end && i < lines.length; i++) {
  console.log(String(i + 1) + '|' + lines[i])
}
