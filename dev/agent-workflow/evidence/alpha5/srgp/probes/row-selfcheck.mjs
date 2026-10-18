import { mkdirSync, writeFileSync, utimesSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { createHash, } from 'node:crypto'
import { readFileSync } from 'node:fs'
const REPO = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5srgp'
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const W = join(REPO, 'tests/homes', `a5srgp-selfcheck-${Date.now().toString(36)}`)
const ROOT = join(W, 'root'); mkdirSync(join(ROOT, 'src'), { recursive: true })
writeFileSync(join(ROOT, 'src/a.ts'), 'A5SRGP-TOK one\n')
utimesSync(join(ROOT, 'src/a.ts'), 1600000000, 1600000000)
const { createAnchoredRgSearchBackend } = await import(join(REPO, 'packages/runtime/src/plugin/live/search-backend.mjs'))
const be = createAnchoredRgSearchBackend({ realmId: 'r', rootDir: ROOT, confined: { trustRoot: `sha256:${SHA.slice(0,16)}#${LAUNCHER}`, scratchRoot: join(W, 'scratch'), assembly: { launcherPath: LAUNCHER, launcherSha256: SHA, minAbiVersion: 3 } }, observe: (l) => console.log('OBS', l), internalLog: (l) => console.log('DBG', String(l).slice(0, 200)) })
const res = await be.run({ realmId: 'r', callId: 'c1', parsedArgs: { tool: 'grep', pattern: 'A5SRGP-TOK', target: { placement: 'workspace', locator: '.' }, outputMode: 'content', maxResults: 100, contextLines: 0, multiline: false } }, { sink: { write: (t) => console.log('SINK', JSON.stringify(t).slice(0, 200)) } })
console.log(JSON.stringify(res, null, 1).slice(0, 900))
console.log('lastRuns', JSON.stringify(be.lastRuns))
rmSync(W, { recursive: true, force: true })
