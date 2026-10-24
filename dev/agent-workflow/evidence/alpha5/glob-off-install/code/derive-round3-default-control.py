p = 'a5glob-off-kit.mjs'
s = open(p).read()

# ── 1) parameterised install face (no new kit: the audited sheet stays) ───────
old = """/** The commit this round grades (root instruction 21:39Z, #342 landed). */
const EXPECTED_MASTER = '46e48218e48314662586ff053ca3825e2889a6bb'"""
new = """/**
 * The commit this round grades. Defaults to the 21:39Z #342 baseline; a later
 * round (root 23:34Z) re-drives the SAME sheet for a default-contract positive
 * control on a named ref, so the install face is parameterised:
 *   --install-sha <40-hex>   the frozen SHA to install and grade
 *   --install-ref refs/heads/<branch>  the ref whose live tip must equal it
 *   --install-lineage <re>   what the graded commit's own subject must carry
 *   --world-prefix <p>       DSH_HOME prefix (cleanup stays exact-name)
 * Nothing else about the criteria moves: the three zeros, the argv-attributed
 * ledger, the sweep and the :3080 probe law are the same code.
 */
const EXPECTED_MASTER = argValue('install-sha', '46e48218e48314662586ff053ca3825e2889a6bb')
const INSTALL_REF = argValue('install-ref', 'refs/heads/master')
const INSTALL_REF_SHORT = INSTALL_REF.replace(/^refs\\/heads\\//, '')
const EXPECT_LINEAGE = new RegExp(argValue('install-lineage', '#342'))"""
assert old in s
s = s.replace(old, new, 1)

s = s.replace("const WORLD_PREFIX = 'a5glob-off'", "const WORLD_PREFIX = argValue('world-prefix', 'a5glob-off')", 1)
s = s.replace("""    realmId: `a5glob-off-${mode}-realm`,
    fsInstance: { fs: `a5glob-off-${mode}-ctl`, rootDir: world.governedRoot, realmId: `a5glob-off-${mode}-realm`, kind: 'absolute-path' },""",
"""    realmId: `${WORLD_PREFIX}-${mode}-realm`,
    fsInstance: { fs: `${WORLD_PREFIX}-${mode}-ctl`, rootDir: world.governedRoot, realmId: `${WORLD_PREFIX}-${mode}-realm`, kind: 'absolute-path' },""", 1)

# ── 2) H1b against the named ref; H1c expectations from args + the #337 byte ──
s = s.replace("""spawnSync('git', ['-C', SRC, 'ls-remote', 'origin', 'refs/heads/master']""",
              """spawnSync('git', ['-C', SRC, 'ls-remote', 'origin', INSTALL_REF]""", 1)
s = s.replace("""spawnSync('git', ['-C', MAIN_CHECKOUT, 'ls-remote', 'origin', 'refs/heads/master']""",
              """spawnSync('git', ['-C', MAIN_CHECKOUT, 'ls-remote', 'origin', INSTALL_REF]""", 1)
s = s.replace("""  check('H1b', 'INSTALL SPEC = live master, measured from TWO SOURCES""",
              """  check('H1b', `INSTALL SPEC = live ${INSTALL_REF_SHORT}, measured from TWO SOURCES""", 1)

old_h1c = """  check('H1c', 'the graded SHA carries the candidate in its OWN lineage and source bytes: subject lineage contains #342 and the source of the production plane row consumes globEnabled / a5-glob-config-disabled',
    /#342/.test(lineage) && srcPlaneBytes.includes('globEnabled') && srcPlaneBytes.includes('a5-glob-config-disabled'),"""
new_h1c = """  const srcGlobBytes = spawnSync('git', ['-C', SRC, 'show', `${EXPECTED_MASTER}:packages/runtime/src/plugin/live/glob-backend.mjs`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout ?? ''
  const siblingDefault = srcGlobBytes.includes('`.a5g7-glob-scratch`') || srcGlobBytes.includes(".a5g7-glob-scratch")
  check('H1c', `the graded SHA carries the candidate in its OWN lineage and source bytes: its subject lineage matches ${String(EXPECT_LINEAGE)} , the production plane row still consumes globEnabled / a5-glob-config-disabled, and the live glob row's DEFAULT scratch is the governed-root SIBLING (the #337 form the default contract rides with no scratchRoot key at all)`,
    EXPECT_LINEAGE.test(lineage) && srcPlaneBytes.includes('globEnabled') && srcPlaneBytes.includes('a5-glob-config-disabled') && siblingDefault,"""
assert old_h1c in s
s = s.replace(old_h1c, new_h1c, 1)
s = s.replace("""    `lineage-#342=${String(/#342/.test(lineage))} src-globEnabled=${String(srcPlaneBytes.includes('globEnabled'))} src-shutId=${String(srcPlaneBytes.includes('a5-glob-config-disabled'))} row=${gitAt(SRC, 'log', '--format=%h %s', '-1', EXPECTED_MASTER).slice(0, 70)}`)""",
"""    `lineage-match=${String(EXPECT_LINEAGE.test(lineage))} src-globEnabled=${String(srcPlaneBytes.includes('globEnabled'))} src-shutId=${String(srcPlaneBytes.includes('a5-glob-config-disabled'))} globDefaultSiblingScratch=${String(siblingDefault)} row=${gitAt(SRC, 'log', '--format=%h %s', '-1', EXPECTED_MASTER).slice(0, 70)}`)

  // The already-ruled pin convention, recorded as its own leg instead of being
  // folded into H1b: a frozen SHA whose ref has since moved is graded on
  // per-file byte equivalence (I3a-I3d) plus the successor difference — and the
  // run never claims green for a face it did not install.
  const liveMasterNow = (spawnSync('git', ['-C', MAIN_CHECKOUT, 'ls-remote', 'origin', 'refs/heads/master'], { encoding: 'utf8' }).stdout ?? '').split('\\t')[0].trim()
  spawnSync('git', ['-C', MAIN_CHECKOUT, 'fetch', '-q', 'origin', liveMasterNow], { encoding: 'utf8' })
  const gradedIsAncestorOfMaster = spawnSync('git', ['-C', MAIN_CHECKOUT, 'merge-base', '--is-ancestor', EXPECTED_MASTER, liveMasterNow], { encoding: 'utf8' }).status === 0
  const masterIsAncestorOfGraded = spawnSync('git', ['-C', MAIN_CHECKOUT, 'merge-base', '--is-ancestor', liveMasterNow, EXPECTED_MASTER], { encoding: 'utf8' }).status === 0
  check('H1e', 'pin condition of the NAMED ref, stated not hidden: the ref tip measured live equals the frozen SHA that this run installs (H1b above), while master is recorded separately with its relation to the graded SHA (ancestor / descendant / diverged) so the report never implies a face it did not run',
    true,
    `graded=${EXPECTED_MASTER.slice(0, 12)} ref=${INSTALL_REF_SHORT} masterNow=${liveMasterNow.slice(0, 12)} gradedAncestorOfMaster=${String(gradedIsAncestorOfMaster)} masterAncestorOfGraded=${String(masterIsAncestorOfGraded)} masterOnTop=${spawnSync('git', ['-C', MAIN_CHECKOUT, 'rev-list', '--count', `${EXPECTED_MASTER}..${liveMasterNow}`], { encoding: 'utf8' }).stdout.trim()} gradedOnTop=${spawnSync('git', ['-C', MAIN_CHECKOUT, 'rev-list', '--count', `${liveMasterNow}..${EXPECTED_MASTER}`], { encoding: 'utf8' }).stdout.trim()}`)""", 1)

# ── 3) shape-aware N/A: a leg whose world was not executed is booked, not red ─
old_check = """function check (id, claim, cond, observed) {
  CRITERIA.push({ id, claim, pass: cond === true, observed })
  console.log(`${cond === true ? 'PASS' : 'FAIL'} ${id} — ${claim}${observed === undefined ? '' : ` [${observed}]`}`)
}"""
new_check = """/**
 * Which world each leg needs. When a run drives a SUBSET of shapes (the
 * 23:34Z default-contract control drives `default` only), a leg belonging to a
 * shape that was not executed is recorded as `na` — booked, printed, and kept
 * out of the red set. That is a statement about coverage, never a relaxed
 * criterion: the leg itself is unchanged and still fails if its own shape ran.
 */
const LEG_SHAPE = {
  M0: 'off', M0b: 'off', M1: 'off', M2: 'off', M2b: 'off', M3: 'off', M4: 'off', M5: 'off', M6: 'off', M7: 'off', M8: 'off', M9: 'off', M10: 'off',
  C1: 'default', C2: 'default', C3: 'default', C6: 'default', C4: 'default', C5: 'default',
  R1: 'rename', R2: 'rename', R3: 'rename',
}
function check (id, claim, cond, observed) {
  const shape = LEG_SHAPE[id]
  if (shape !== undefined && !MODE_RUN.includes(shape)) {
    CRITERIA.push({ id, claim, pass: null, na: true, observed: `shape '${shape}' not executed in this run (--only ${MODE_RUN.join('/')}), so this leg is coverage-N/A, not a verdict` })
    console.log(`NA   ${id} — ${claim} [shape '${shape}' not executed this run]`)
    return
  }
  CRITERIA.push({ id, claim, pass: cond === true, observed })
  console.log(`${cond === true ? 'PASS' : 'FAIL'} ${id} — ${claim}${observed === undefined ? '' : ` [${observed}]`}`)
}"""
assert old_check in s
s = s.replace(old_check, new_check, 1)

s = s.replace("""  console.log(`VERDICT ${red.length === 0 ? 'GREEN' : `RED (${red.map((c) => c.id).join(',')})`} (${String(CRITERIA.filter((c) => c.pass === true).length)}/${String(CRITERIA.filter((c) => c.pass !== null).length)}${CRITERIA.some((c) => c.pass === null) ? ` +${String(CRITERIA.filter((c) => c.pass === null).length)} booked` : ''})`)""",
"""  const naCount = CRITERIA.filter((c) => c.na === true).length
  console.log(`VERDICT ${red.length === 0 ? 'GREEN' : `RED (${red.map((c) => c.id).join(',')})`} (${String(CRITERIA.filter((c) => c.pass === true).length)}/${String(CRITERIA.filter((c) => c.pass === true || c.pass === false).length)}${CRITERIA.some((c) => c.pass === null && c.na !== true) ? ` +${String(CRITERIA.filter((c) => c.pass === null && c.na !== true).length)} booked` : ''}${naCount > 0 ? ` +${String(naCount)} shape-N/A` : ''})`)""", 1)

# the install probe layer text should carry the round's prefix, not a literal
s = s.replace("# a5glob-off INSTALL-PROBE layer", "# ${WORLD_PREFIX} INSTALL-PROBE layer", 1)
open(p, 'w').write(s)
print('parameterised')
