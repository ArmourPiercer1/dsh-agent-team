import { readFileSync, writeFileSync } from 'node:fs'
const p = 'a5ie-r3-kit.mjs'
const lines = readFileSync(p, 'utf8').split('\n')
const iStart = lines.findIndex((l) => l === '  const mock = await startMockModel({')
if (iStart < 0) throw new Error('mock start header not found')
if (lines[iStart + 1].trim() !== 'port: mockPort,' || lines[iStart + 2].trim() !== 'log: () => { },' || lines[iStart + 3].trim() !== 'decide: ({ req }) => {') {
  throw new Error(`unexpected mock header shape: ${JSON.stringify(lines.slice(iStart, iStart + 4))}`)
}
let iEnd = -1
for (let i = iStart + 4; i < lines.length; i += 1) { if (lines[i] === '  })' ) { iEnd = i; break } }
if (iEnd < 0) throw new Error('mock call end not found')
const body = lines.slice(iStart + 4, iEnd) // the decide body lines
const replaced = [
  '  const mockDecide = ({ req }) => {',
  ...body,
  '  }',
  '  // The 349x pick is re-proved AT BIND TIME, not only at the pre-flight: on a',
  '  // busy host another process can claim a port between the check and the',
  '  // listen, and a mock that cannot bind would abort the round for no reason',
  '  // of the product. The port actually used is what gets reported and checked.',
  '  let mock = null',
  '  let mockPortUsed = 0',
  '  for (const candidate of [mockPort, 3492, 3493, 3494, 3495, 3496, 3497, 3498, 3499]) {',
  '    if (candidate === 0 || !(await portFree(candidate))) continue',
  '    try {',
  '      mock = await startMockModel({ port: candidate, log: () => { }, decide: mockDecide })',
  '      mockPortUsed = candidate',
  '      break',
  '    } catch (error) {',
  "      if (String(error?.code ?? '') !== 'EADDRINUSE') throw error",
  '    }',
  '  }',
  '  if (mock === null) die(`no 349x mock port could be bound for the LLM stand-in (preflight picked ${String(mockPort)})`)',
]
lines.splice(iStart, iEnd - iStart + 1, ...replaced)
let src = lines.join('\n')
const uses = [
  ["  const portsReleased = (await portFree(HOST_PORT)) && (await portFree(BASELINE_PORT)) && (await portFree(mockPort))",
   "  const portsReleased = (await portFree(HOST_PORT)) && (await portFree(BASELINE_PORT)) && (await portFree(mockPortUsed))"],
  ['`ports=${String(HOST_PORT)}/${String(BASELINE_PORT)}/${String(mockPort)} free=${String(portsReleased)}`',
   '`ports=${String(HOST_PORT)}/${String(BASELINE_PORT)}/${String(mockPortUsed)} free=${String(portsReleased)}`'],
  ['runStamp: RUN_STAMP, ports: [HOST_PORT, BASELINE_PORT, mockPort], installSpec: INSTALL_SPEC, installedSha: INSTALL_SHA,',
   'runStamp: RUN_STAMP, ports: [HOST_PORT, BASELINE_PORT, mockPortUsed], installSpec: INSTALL_SPEC, installedSha: INSTALL_SHA,'],
]
for (const [from, to] of uses) {
  const n = src.split(from).length - 1
  if (n !== 1) throw new Error(`mockPort use anchor matched ${String(n)} times: ${from.slice(0, 60)}`)
  src = src.replace(from, to)
}
writeFileSync(p, src)
console.log('patch4 applied: mock bind-time port retry; decide lines', body.length)
