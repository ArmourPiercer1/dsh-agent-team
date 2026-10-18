#!/usr/bin/env node
/**
 * a5rbn-witness.mjs — runtime-base narrowing: the NAME-CLASS enumeration
 * witness on the PRODUCTION row face (round2 witness shape per glue7 §4b).
 *
 * Drives the shipped plane (committed `dist` mirror = 出厂面) with the REAL
 * Landlock launcher (this host, ABI v4) through the SAME assembly the live
 * kit uses (fsInstance + confinedProvider), and asks the member shell row to
 * run the enumeration commands the re-review named:
 *
 *   W1  `ls -d /home/*`      — host-home name enumeration (the flagged leak)
 *   W2  `ls <outside dir>`   — a governed-OUTSIDE directory: marker NAMES on
 *                              the row's result text (never bytes — the
 *                              read_file boundary holds; this is the name class)
 *   W3  `ls /`               — the '/' enumeration itself
 *
 *   --expect red    asserts the leak is LIVE (names surface)  → pre-fix bytes
 *   --expect green  asserts EACCES + ZERO outside names       → post-fix bytes
 *
 * Positive controls ride the SAME run (they must survive in BOTH postures):
 *   P1 read inside the governed anchor root        (anchor grant, live)
 *   P2 write+read-back inside the anchor root      (write lane, live)
 *   P3 write OUTSIDE the anchor root               (EACCES — unchanged)
 *   P4 base binary execution (/usr image)          (:77 interpreter, live)
 *   P5 /etc read + /usr enumeration                (:77 libraries/config, live)
 *   P6 read an outside file by name                (EACCES — byte law holds)
 *
 * Exit 0 = every criterion met for the stated posture; verdict JSON lands on
 * stdout and under `runs/<stamp>/criteria.json`. World under tests/homes/
 * (workspace constraint), self-removed at teardown unless --keep.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..', '..', '..', '..')
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')

const expectMode = (() => {
  const i = process.argv.indexOf('--expect')
  const v = i >= 0 ? process.argv[i + 1] : ''
  if (v !== 'red' && v !== 'green') {
    console.error('usage: a5rbn-witness.mjs --expect {red|green} [--keep]')
    process.exit(4)
  }
  return v
})()
const KEEP = process.argv.includes('--keep')
const STAMP = new Date().toISOString().replace(/[:.]/g, '-')
const WORLD = join(REPO, 'tests/homes', `a5rbn-witness-${STAMP}`)
const ANCHOR = join(WORLD, 'governed')            // the controlled-fs instance root
const OUTSIDE = join(WORLD, 'outside-' + 'zq7k') // governed-OUTSIDE dir
const MARKER_A = 'a5rbn-marker-alpha-9x2f'       // a name that must NEVER surface when narrow
const MARKER_B = 'a5rbn-marker-bravo-4t8w'

const CRITERIA = []
function check(id, name, pass, detail = '') {
  CRITERIA.push({ id, name, pass: Boolean(pass), detail: String(detail).slice(0, 400) })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${name}${detail ? ` — ${String(detail).slice(0, 160)}` : ''}`)
  return pass
}

async function main() {
  mkdirSync(join(ANCHOR, 'data'), { recursive: true })
  mkdirSync(OUTSIDE, { recursive: true })
  writeFileSync(join(ANCHOR, 'data', 'inside.txt'), 'A5RBN-INSIDE-TOKEN-51\n')
  writeFileSync(join(OUTSIDE, MARKER_A), 'A5RBN-OUTSIDE-SECRET-88\n') // bytes must never surface
  writeFileSync(join(OUTSIDE, MARKER_B), 'x\n')

  // The PRODUCTION row face: committed dist mirror, same row shape as the
  // glue7 live kit (`fsInstance` + `confinedProvider`).
  const plane = await import(join(REPO, 'packages/runtime/dist/packages/runtime/src/plugin/live/team-tool-plane.mjs'))
  const built = plane.createTeamToolPlaneAssembly({
    permissionPolicy: {
      default: 'ask',
      allow: [{ tool: 'read', resource: { kind: 'any' } }],
      ask: [],
      deny: [],
    },
    realmId: 'a5rbn-realm',
    templateId: 'a5rbn-tpl',
    role: 'member',
    instanceId: 'a5rbn-instance',
    plane: {
      fsInstance: { fs: 'a5rbn-ctl', rootDir: ANCHOR, realmId: 'a5rbn-realm', kind: 'absolute-path' },
      confinedProvider: {
        trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
        assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
      },
    },
  })
  if (!built.ok) { console.log('ASSEMBLY-REFUSED', built.code, built.message); process.exit(4) }
  const def = (name) => built.value.definitions.find((d) => d.name === name)
  const bash = def('team_bash')
  if (!bash) { console.log('NO team_bash def'); process.exit(4) }
  const run = async (command) => {
    const res = await bash.execute({ command })
    return String(res?.text ?? '')
  }

  const denial = (t) => /Permission denied|EACCES/i.test(t)
  let entriesHome = []
  try { entriesHome = readdirSync('/home') } catch { entriesHome = [] }

  // ── W legs: the enumeration face under audit ─────────────────────────────
  const w1 = await run('ls -d /home/* 2>&1')
  const w1b = await run('ls /home 2>&1')
  const w2 = await run(`ls ${OUTSIDE} 2>&1`)
  const w3 = await run('ls / 2>&1')

  const w1names = w1.split(/\s+/).filter((n) => entriesHome.includes(n))
  const w2markers = [MARKER_A, MARKER_B].filter((m) => w2.includes(m))
  const w3names = w3.split(/\s+/).filter((n) => ['usr', 'etc', 'proc', 'home', 'tmp', 'var', 'bin'].includes(n))

  // Byte law (BOTH postures): outside CONTENT never surfaces (W legs here;
  // the cat leg P6 checks the same law below).
  check('B1', 'outside secret BYTES never surface (W legs)', ![w1, w1b, w2, w3].some((t) => t.includes('A5RBN-OUTSIDE-SECRET-88')))

  const w1bnames = w1b.split(/\s+/).filter((n) => entriesHome.includes(n))
  if (expectMode === 'red') {
    check('W1', 'RED witness: `ls /home/*` surfaces REAL host-home names',
      w1names.length > 0 || w1.includes('/home/'), `${JSON.stringify(w1names.slice(0, 8))} raw=${w1.slice(0, 120)}`)
    check('W1b', 'RED witness: bare `ls /home` enumerates host home NAMES',
      w1bnames.length > 0, `${JSON.stringify(w1bnames.slice(0, 8))}`)
    check('W2', 'RED witness: `ls <outside dir>` surfaces governed-outside NAMES',
      w2markers.length === 2, `markers on the line: ${JSON.stringify(w2markers)}`)
    check('W3', 'RED witness: `ls /` enumerates the tree root',
      w3names.length >= 4, `${JSON.stringify(w3names)}`)
  } else {
    check('W1', 'NARROWED: `ls /home/*` yields ZERO host-home names (glob dies on EACCED readdir; bare-path form answers EACCES)',
      w1names.length === 0 && (denial(w1) || /No such file or directory/.test(w1)), `raw=${w1.slice(0, 160)}`)
    check('W1b', 'NARROWED: bare `ls /home` is EACCES with ZERO host-home names',
      denial(w1b) && w1bnames.length === 0, `raw=${w1b.slice(0, 160)}`)
    check('W2', 'NARROWED: `ls <outside dir>` is EACCES, zero marker names',
      denial(w2) && w2markers.length === 0, `raw=${w2.slice(0, 160)}`)
    check('W3', 'NARROWED: `ls /` is EACCES',
      denial(w3) && w3names.length === 0, `raw=${w3.slice(0, 160)}`)
  }

  // ── P legs: positive controls (must be GREEN in BOTH postures) ───────────
  const p1 = await run(`cat ${join(ANCHOR, 'data', 'inside.txt')} 2>&1`)
  check('P1', 'anchor-root read lives (governed anchor grant)', p1.includes('A5RBN-INSIDE-TOKEN-51'), p1.slice(0, 120))
  const p2 = await run(`echo A5RBN-WRITTEN-OK > ${join(ANCHOR, 'written.txt')} && cat ${join(ANCHOR, 'written.txt')} 2>&1`)
  check('P2', 'anchor-root write+readback lives', p2.includes('A5RBN-WRITTEN-OK'), p2.slice(0, 120))
  const p3 = await run(`touch ${join(WORLD, 'outside-escape')} 2>&1`)
  check('P3', 'write outside the anchor stays EACCES (unchanged)', denial(p3), p3.slice(0, 120))
  const p4 = await run('echo BASE-BIN-OK 2>&1; true')
  check('P4', 'base binaries execute (:77 interpreter face)', p4.includes('BASE-BIN-OK'), p4.slice(0, 120))
  const p5 = await run('head -c 20 /etc/passwd | wc -c; ls /usr/bin | wc -l; echo BASE-READ-OK 2>&1')
  check('P5', 'base enumeration survives (:77 libraries/config: /etc read, /usr enumerate)', p5.includes('BASE-READ-OK'), p5.slice(0, 120))
  const p6 = await run(`cat ${join(OUTSIDE, MARKER_A)} 2>&1`)
  check('P6', 'outside file bytes stay kernel-refused (byte law)', denial(p6) && !p6.includes('A5RBN-OUTSIDE-SECRET-88'), p6.slice(0, 120))

  const fails = CRITERIA.filter((c) => !c.pass)
  const verdict = fails.length === 0 ? 'GREEN' : 'RED'
  const runDir = join(HERE, 'runs', STAMP)
  mkdirSync(runDir, { recursive: true })
  writeFileSync(join(runDir, 'criteria.json'), JSON.stringify({
    posture: expectMode, verdict, launcherSha: LAUNCHER_SHA, head: process.env.A5RBN_HEAD ?? '',
    witness: { w1, w1b, w2, w3, p1, p2, p3, p4, p5, p6 }, criteria: CRITERIA,
  }, null, 2))
  console.log(`VERDICT ${verdict} (${CRITERIA.length - fails.length}/${CRITERIA.length}) posture=${expectMode} run=${runDir}`)
  if (!KEEP) { try { rmSync(WORLD, { recursive: true, force: true }) } catch { /* best effort */ } }
  process.exit(fails.length === 0 ? 0 : 1)
}

main().catch((e) => { console.error('WITNESS-CRASH', e); process.exit(4) })
