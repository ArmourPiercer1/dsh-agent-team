// ==== G2 RED WITNESS — appended by the G2 lane to a verbatim copy of origin/master's
// a4p7-merge-gate.test.ts. It calls THAT file's own `classifyClientLaneReport` — the parser as
// it shipped — against fixtures assembled from the real hosted runner bytes. The expectations
// are the FIXED behaviour, so against the base parser every colour-dependent leg is RED, and
// the failure text quotes the base verdict verbatim. This block never lands on the branch;
// its transcript and this source are the evidence. ====

describe('G2 red witness — the origin/master parser against hosted-derived fixtures', () => {
  const G2_DIR = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'a4-pr7', 'g2-summary-parser', 'fixtures')
  const g2 = (n: string) => readFileSync(join(G2_DIR, n), 'utf8')
  const quote = (r: { verdict: string; why: string }) => `BASE-PARSER ANSWER: ${r.verdict} — ${r.why.slice(0, 400)}`

  it('witness: the coloured trio transcript reads as the disclosed trio', () => {
    const r = classifyClientLaneReport({ out: g2('client-lane-coloured-trio.raw.txt'), missingTrioFiles: [] })
    expect(quote(r), 'expected verdict passed').toBe('passed')
  })

  it('witness: the hosted census capture is never reported as having no summary', () => {
    const r = classifyClientLaneReport({ out: g2('hosted-census-capture-1.raw.txt'), missingTrioFiles: [] })
    expect(quote(r)).not.toContain('no vitest summary at all')
    expect(quote(r), 'expected verdict failed (root-lane identities are inside the capture)').toBe('failed')
  })

  it('witness: a synthesised fourth failure is refused by name', () => {
    const r = classifyClientLaneReport({ out: g2('client-lane-coloured-fourth-failure.raw.txt'), missingTrioFiles: [] })
    const q = quote(r)
    expect(q, 'expected verdict failed').toBe('failed')
    expect(q).toContain('test/whatever-broke-next.client.spec.tsx')
  })

  it('witness: a capture with no summary is refused as no-summary (this one the base already gets right)', () => {
    const r = classifyClientLaneReport({ out: g2('client-lane-no-summary.raw.txt'), missingTrioFiles: [] })
    expect(quote(r)).toContain('no vitest summary at all')
  })

  it('witness: a summary that exists but cannot be parsed names its shape', () => {
    const r = classifyClientLaneReport({ out: g2('client-lane-summary-unparseable.raw.txt'), missingTrioFiles: [] })
    const q = quote(r)
    expect(q).not.toContain('no vitest summary at all')
    expect(q).toContain('??? ??? ???')
  })

  it('witness: a JSON report grades even when the text stream is unusable', () => {
    const greenJson = JSON.stringify({ numFailedTests: 0, numPassedTests: 880, numTotalTests: 880, success: true, testResults: [] })
    const r = classifyClientLaneReport({ out: '(the text stream died mid-spinner)', jsonText: greenJson, code: 0, missingTrioFiles: [] } as never)
    expect(quote(r), 'expected verdict passed').toBe('passed')
  })

  it('witness: a green text summary with a nonzero exit is refused, not passed', () => {
    const r = classifyClientLaneReport({ out: ' Test Files  55 passed (55)\n      Tests  880 passed (880)\n', code: 137, missingTrioFiles: [] } as never)
    expect(quote(r), 'expected verdict refused').toBe('refused')
  })
})
