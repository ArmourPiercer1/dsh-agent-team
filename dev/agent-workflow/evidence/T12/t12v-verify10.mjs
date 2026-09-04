import { readFileSync, statSync } from 'node:fs'
const main = 'D:/AgentDev/dsh-plugins/dsh-agent-team'
const nonce = 'mtkltfm07fb4c6'
const out = []
// 1. root session file on disk in home A (create-phase persistence)
const rootFile = `${main}/references/.dsh-test-t12-a/sessions/--C-agent-team-work-t12v-a--/session-t12v-a-root-${nonce}/session.jsonl.zstd`
try {
  const st = statSync(rootFile)
  out.push(`rootSessionFile EXISTS: size=${st.size} mtime=${st.mtime.toISOString()}`)
} catch (e) { out.push(`rootSessionFile MISSING: ${e.message}`) }
// 2. home A sessions tree (what resume discovery can see)
import { readdirSync } from 'node:fs'
const sessDir = `${main}/references/.dsh-test-t12-a/sessions/--C-agent-team-work-t12v-a--`
try {
  out.push('home-A session dirs: ' + readdirSync(sessDir).map((d) => d.replace(sessionRe(nonce), '<ROOT>')).join(' | '))
} catch (e) { out.push(`home-A sessions read fail: ${e.message}`) }
function sessionRe(n) { return new RegExp(`session-t12v-a-root-${n}`) }
// 3. A2 directive row in the shared patch file (A2 wrote last)
const patch = `${main}/references/.dsh-test-t12-a/profiles/web/cordis.patch.yml`
const text = readFileSync(patch, 'utf8')
const rootIds = [...text.matchAll(/rootSessionId:\s*(\S+)/g)].map((m) => m[1])
const phases = [...text.matchAll(/phase:\s*(\S+)/g)].map((m) => m[1])
const boots = [...text.matchAll(/boot:\s*(\S+)/g)].map((m) => m[1])
out.push(`patch rows: rootSessionIds=[${[...new Set(rootIds)].join(',')}] phases=[${phases.join(',')}] boot=[${boots.join(',')}]`)
out.push(`rootSessionIdMatchesPersistedRoot=${rootIds.every((r) => r === `session-t12v-a-root-${nonce}`)}`)
out.push(`undefinedRootPresent=${rootIds.some((r) => r === 'undefined')}`)
// 4. summary.phaseFailures + top-level integrity
const s = JSON.parse(readFileSync(`${main}/dev/agent-workflow/evidence/T12/summary.json`, 'utf8'))
out.push(`phaseFailures=${JSON.stringify(s.phaseFailures ?? 'KEY ABSENT')}`)
out.push(`exitCode=${s.exitCode} nonce=${s.nonce}`)
out.push(`port3080=${JSON.stringify(s.port3080)} pristine=${s.testUsePristine?.pristine ?? 'n/a'}`)
const passCount = Object.values(s.scenarios).filter((x) => x.pass).length
out.push(`scenarios pass=${passCount}/8 :: ` + Object.entries(s.scenarios).map(([k, v]) => `${k}=${v.pass ? 'T' : 'F'}`).join(' '))
console.log(out.join('\n'))
