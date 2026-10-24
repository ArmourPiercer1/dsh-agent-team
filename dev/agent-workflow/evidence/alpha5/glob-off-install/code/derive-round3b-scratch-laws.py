p = 'a5glob-off-kit.mjs'
s = open(p).read()

# ── 1) two cross-shape legs join the shape map (coverage bookkeeping only) ────
s = s.replace("  C1: 'default', C2: 'default', C3: 'default', C6: 'default', C4: 'default', C5: 'default',\n  R1: 'rename', R2: 'rename', R3: 'rename',",
              "  C1: 'default', C2: 'default', C3: 'default', C6: 'default', C4: 'default', C5: 'off',\n  R1: 'rename', R2: 'rename', R3: 'rename', R4: 'rename',", 1)

# ── 2) the default-shape provider-scratch law, graded on the installed face ───
anchor = """  note('C2b', `sampling-resolution book (never graded): rg sightings in the CONTROL world where the glob row IS live"""
assert anchor in s
new_legs = """  // S family — the DEFAULT public-contract form on the installed face (root
  // 23:34Z: the shut-off sheet never covered default-form usability after the
  // provider's empty-scratch law, so grade it here with the SAME plumbing).
  // The contract (docs/INSTALL.md §3.5) carries NO scratchRoot key; the live
  // glob row therefore runs entirely on its assembled default. Where that
  // default lands is not assumed — it is read from the provider's own records.
  const dLedS = dflt.worldLedger ?? { counts: {}, plans: [] }
  const dGlobPlansS = dLedS.plans.filter((x) => x.kind === 'rg-glob-walker')
  const siblingHits = dGlobPlansS.filter((x) => /governed\\.a5g7-glob-scratch\\/plans\\//.test(x.rel))
  const insideRoot = dGlobPlansS.filter((x) => /^governed\\/plans\\//.test(x.rel) || x.rel.startsWith('governed/'))
  const listingScratch = (L.default.byTool.team_glob ?? []).flatMap((x) => namedFiles(x.text)).filter((n) => /a5g7-glob-scratch|\\/plans\\/|exit\\.json/.test(n))
  check('S1', 'THE DEFAULT FORM IS LIVE ON THE INSTALLED FACE, AND ITS SCRATCH LAW HOLDS WHERE IT LANDED: the glob row — configured with the contract text and NO scratchRoot key — prepared its confined walker plan at the governed-root SIBLING (`<root>.a5g7-glob-scratch/plans/plan-*.json`) with its exit record, no glob-walker plan sits inside the governed root, and the listing the member got back carries no scratch artifact',
    dGlobPlansS.length >= 1 && dGlobPlansS.every((x) => x.hasExitRecord) && siblingHits.length === dGlobPlansS.length && insideRoot.length === 0 && listingScratch.length === 0,
    `globPlans=${String(dGlobPlansS.length)} atSibling=${String(siblingHits.length)} insideRoot=${String(insideRoot.length)} withExit=${String(dGlobPlansS.filter((x) => x.hasExitRecord).length)} planAt=${JSON.stringify(dGlobPlansS[0]?.rel ?? '')} scratchInListing=${String(listingScratch.length)}`)
  const baselineLedgerPath = join(HERE, '..', 'runs', '2026-10-18T22-07-01Z', 'confined-ledger-default.json')
  let baselinePlanAt = '(baseline ledger unreadable)'
  try { baselinePlanAt = (JSON.parse(readFileSync(baselineLedgerPath, 'utf8')).wholeTree?.globWalkerPlans ?? [{ rel: '(none recorded)' }])[0].rel } catch { /* booked only */ }
  note('S1b', 'where the same default moved (booked, never graded): the SAME contract-shaped default world at the 21-5xZ baseline put the glob row\\'s plan at ' + JSON.stringify(baselinePlanAt) + ' (provider default was cwd-relative, before the empty-scratch law); this run records ' + JSON.stringify(dGlobPlansS[0]?.rel ?? '') + ' — the two recorded paths are the difference the #337 assembly fix closed, observed on two real installs',
    `baseline=${JSON.stringify(baselinePlanAt)} now=${JSON.stringify(dGlobPlansS[0]?.rel ?? '')}`)
""" + anchor
s = s.replace(anchor, new_legs, 1)

# S legs belong to the default shape
s = s.replace("  C1: 'default', C2: 'default',", "  S1: 'default',\n  C1: 'default', C2: 'default',", 1)
open(p, 'w').write(s)
print('round-3 sheet completed')
