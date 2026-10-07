/**
 * a4p7-blueprint-version-clean.test.ts — A4-PR7 Tasks 7.5 + 7.4-scope: the
 * fence is only a fence because a test calls it, and it is only honest
 * because it says WHICH verdict gates and why.
 *
 * `scripts/verify-blueprint-version-clean.mjs` is the v3-only scan ADR A3-16
 * owns, and ADR A5-9 requires PR7's gate to invoke it BY NAME — the precedent
 * it cites is `verify-zero-core.mjs`, a script that exists and is invoked by
 * nothing. So this file's first job is to be the caller, and its second is to
 * make the scan's output reviewable rather than merely red.
 *
 * TWO VERDICTS, ONE GATE (plan 7.4 "the tooling is the list"; 2026-10-08
 * coordinator finding "the instrument does not cover the corpus it is meant
 * to close"):
 *   - `dirty` — blueprint version literals the type system cannot see
 *     (string/template carriers in .ts, every site in .mjs/.cjs/.js, and data
 *     files .json/.yml/.yaml). THIS is what 7.4 closes on: dirty (plus
 *     `unknown`) empty.
 *   - `advisory` — code-position TS literals. NOT ungated because tsc will
 *     catch them — measured under the real §7.3 flip exactly 1 of 18 sites
 *     reddens (p5t5-helpers.ts:80); 17 survive via toEqual/toMatchObject
 *     arguments, Record<string,unknown> builders, and as-unknown-as casts.
 *     They stay ungated because the PROBE, not tsc, dispositions them; every
 *     printed ADVISORY line carries the caveat naming its mechanism.
 *   - `unknown` — the classifier cannot decide; it gates, because a scan that
 *     drops a site silently is the defect this phase keeps re-meeting.
 *   - `refused` — sites whose enclosing context positively identifies one of
 *     the other schemaVersion namespaces (projection envelope, session
 *     binding, TeamSessionRecordDto, MemberInstanceRecord, registry ROW
 *     stamp, ledger row, governance override/ledger, artifact-grant payload,
 *     compatibility). Visible per line WITH the namespace and the channel
 *     that decided it, never counted as a Blueprint site.
 *
 * THE DEFERRAL LIST BELOW IS NOT AN EXEMPTION MECHANISM. It is the recorded,
 * per-path state of Task 7.4 (fixture migration, one file per lane): every
 * entry names the lane that owns the file and why it is still authoring a
 * retired-version Blueprint at this commit. Two assertions keep it honest in
 * both directions — a NEW offending path fails the list, and a path that
 * migrated but stayed on the list fails too. The list shrinking to empty IS
 * the cutover's fixture work being done; nothing here makes the fence
 * passable in advance.
 *
 * The classifier fixtures live under
 * `dev/agent-workflow/evidence/a4-pr7/scan-scope/fixtures/` as `.txt` files:
 * the evidence tree is out of the scan's scope by prefix and `.txt` is out of
 * its universe by extension, so the fence's own test data can carry retired
 * version literals without becoming fixture-migration work (the plan is
 * explicit that the scan's own prose must never spell the literal it hunts
 * for; the same discipline extends to its corpus).
 */

import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import * as fence from '../../../scripts/verify-blueprint-version-clean.mjs'
import {
  scanBlueprintVersionSites,
  formatReport,
} from '../../../scripts/verify-blueprint-version-clean.mjs'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const SCRIPT = 'scripts/verify-blueprint-version-clean.mjs'
const FIXTURE_DIR = resolve(
  REPO_ROOT,
  'dev/agent-workflow/evidence/a4-pr7/scan-scope/fixtures',
)

type SiteClass = 'dirty' | 'advisory' | 'unknown' | 'refused' | 'prose'
interface Site {
  line: number
  version: number
  why: string
  ns?: string
}
interface Classification {
  dirty: Site[]
  advisory: Site[]
  unknown: Site[]
  refused: Site[]
  prose: Site[]
}

const classifyText = (fence as Record<string, unknown>).classifyText as
  | ((path: string, text: string) => Classification)
  | undefined
const isScanScopePath = (fence as Record<string, unknown>).isScanScopePath as
  | ((path: string) => boolean)
  | undefined

/** Fixture corpus: `;; key: value` header lines, then verbatim content. */
interface Fixture {
  name: string
  expect: SiteClass | 'none'
  rule: string
  namespace?: string
  channel?: string
  why?: string
  path: string
  content: string
}
function loadFixtures(): Fixture[] {
  let names: string[]
  try {
    names = readdirSync(FIXTURE_DIR).filter((n) => n.endsWith('.txt')).sort()
  } catch {
    return []
  }
  return names.map((name) => {
    const raw = readFileSync(resolve(FIXTURE_DIR, name), 'utf8')
    const lines = raw.split('\n')
    const header = new Map<string, string>()
    let i = 0
    for (; i < lines.length; i += 1) {
      // ALL leading `;;` lines are header (key lines plus their wrapped
      // continuation lines); content starts at the first non-`;;` line.
      const h = lines[i]
      if (h === undefined || !h.startsWith(';;')) break
      const m = /^;;\s*([a-z]+):\s*(.*)$/.exec(h)
      if (m !== null && m[1] !== undefined) header.set(m[1], m[2] ?? '')
    }
    return {
      name,
      expect: (header.get('expect') ?? 'none') as Fixture['expect'],
      rule: header.get('rule') ?? '(unnamed)',
      namespace: header.get('namespace'),
      channel: header.get('channel'),
      why: header.get('why'),
      path: header.get('path') ?? 'packages/example/test/fixture.ts',
      content: lines.slice(i).join('\n'),
    }
  })
}

const fixtures = loadFixtures()
function fixture(nameStart: string): Fixture {
  const f = fixtures.find((x) => x.name.startsWith(nameStart))
  if (f === undefined) throw new Error(`fixture ${nameStart} missing from ${FIXTURE_DIR}`)
  return f
}

/** Run one fixture through the classifier with a legible failure message. */
function classify(f: Fixture): Classification {
  if (classifyText === undefined) {
    throw new Error(
      `RED (${f.name}, rule: ${f.rule}): scripts/verify-blueprint-version-clean.mjs exports no classifyText — the two-verdict rule does not exist yet`,
    )
  }
  return classifyText(f.path, f.content)
}

/** Assert the fixture produced sites of exactly one expected class. */
function expectSingle(f: Fixture, want: SiteClass | 'none'): Classification {
  const c = classify(f)
  const present = (['dirty', 'advisory', 'unknown', 'refused', 'prose'] as const).filter(
    (k) => c[k].length > 0,
  )
  if (want === 'none') {
    expect(
      present,
      `RED (${f.name}, rule: ${f.rule}): expected NO site, got ${JSON.stringify(c)}`,
    ).toEqual([])
    return c
  }
  expect(
    present,
    `(${f.name}, rule: ${f.rule}): expected exactly [${want}], got ${JSON.stringify(
      present.map((k) => `${k}:${c[k].map((s) => `L${s.line}=v${s.version}(${s.why})`)}`),
    )}`,
  ).toEqual([want])
  if (f.namespace !== undefined && want === 'refused') {
    expect(c.refused[0]?.ns, `${f.name}: refused but not by namespace ${f.namespace}`).toContain(
      f.namespace,
    )
  }
  // 2026-10-08 review: namespace alone hid WHICH text decided the refusal —
  // f07-f16 asserted only `f.namespace`, never the channel. Pin the channel.
  if (f.channel !== undefined && want === 'refused') {
    for (const s of c.refused) {
      expect(
        s.why,
        `RED (${f.name}): refused, but not by the '${f.channel}' channel — got (${s.why}); the deciding evidence must be the site's own literal`,
      ).toContain(`/${f.channel}`)
    }
  }
  if (f.why !== undefined && want === 'unknown') {
    // Existence, not universality: one fixture may deliberately mix flavors
    // (f11 has a SPREAD site AND an outer-line site).
    expect(
      c.unknown.some((s) => s.why.includes(f.why as string)),
      `RED (${f.name}): no UNKNOWN reason contains '${f.why}' — got ${JSON.stringify(c.unknown.map((s) => s.why))}`,
    ).toBe(true)
  }
  return c
}

/**
 * Task 7.4's per-lane deferral set for the DIRTY verdict, generated from the
 * scan and annotated by hand with the owning lane from the plan's lane table
 * (Task 7.4). A file leaves this list by being migrated to a v3 document with
 * an explicit `teamHardEnvelope` (or by its literal being probed and deleted
 * as a lie), never by being added to a skip list in the scanner.
 */
const DEFERRALS: ReadonlyMap<string, string> = new Map([
  ['packages/tools/harness/d4-restart-reopen.mjs', 'C-tools+harness (plan-named site, harness/d4-restart-reopen.mjs:220)'],
  ['packages/tools/harness/g5-member-e2e.mjs', 'C-tools+harness (plan-named site, harness/g5-member-e2e.mjs:267)'],
  ['packages/tools/harness/run.mjs', 'C-tools+harness (plan-named site, harness/run.mjs:214)'],
  ['packages/tools/harness/t12-vertical.mjs', 'C-tools+harness (plan-named site, harness/t12-vertical.mjs:215; also emits a v2 document; the L1838 occurrence is comment prose, not a site)'],
  ['packages/runtime/root-binding/harness/blueprint-source.mjs', 'C-runtime-fixtures (bounded-run harness Blueprint source)'],
  ['packages/testkit/test/bp1h-blueprint-authoring.test.ts', 'C-testkit (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/testkit/test/t6-10-composition-pipeline.test.ts', 'C-testkit (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/testkit/test/t6-7-fresh-per-delegation.test.ts', 'C-testkit (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['scripts/blueprint-authoring.mjs', 'C-testkit (the blueprint authoring script)'],
  ['tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs', 'C-testkit (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['tests/kits/exec-contract-live-smoke/blueprint.mjs', 'C-testkit (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['tests/kits/f15-mcp-live-loss-smoke/f15-mcp-live-loss-smoke.mjs', 'C-testkit (kit fixture; also emits a v2 document)'],
  ['tests/kits/mcp-initial-grant-smoke/mcp-initial-grant-smoke.mjs', 'C-testkit (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['tests/kits/model-preference-routing-smoke/model-preference-routing-smoke.mjs', 'C-testkit (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['tests/kits/pr-b-effective-policy-smoke/pr-b-effective-policy-smoke.mjs', 'C-testkit (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['tests/kits/pr-c-mcp-isolation-smoke/pr-c-mcp-isolation-smoke.mjs', 'C-testkit (kit fixture; also emits a v2 document)'],
  ['tests/kits/pr-d-control-real-host/pr-d-control-real-host.mjs', 'C-testkit (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['tests/kits/pr-e-requirement-recovery-smoke/pr-e-requirement-recovery-smoke.mjs', 'C-testkit (kit fixture; also carries the V1 anchor contentHash literal that 7.3 re-pins)'],
  ['tests/kits/pr-f-closure-smoke/pr-f-closure-smoke.mjs', 'C-testkit (kit fixture; also carries the V1 anchor contentHash literal that 7.3 re-pins)'],
  ['tests/kits/rc2-real-host-smoke/rc2-real-host-smoke.mjs', 'C-testkit (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['tests/kits/send-message-liveness-smoke/send-message-liveness-smoke.mjs', 'C-testkit (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['tests/kits/team-view-sync-complete-e2e/team-view-sync-complete-e2e.mjs', 'C-testkit (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['tests/kits/work-completion-wakeup-smoke/work-completion-wakeup-smoke.mjs', 'C-testkit (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/domain/blueprint/testdata/fixtures.ts', 'C-domain (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/domain/test/a1-permission-policy.test.ts', 'C-domain (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/domain/test/blueprint-v1-frozen-resume.test.ts', 'C-domain (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/domain/test/bp1-blueprint-inspector.test.ts', 'C-domain (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/domain/test/exec-contract-a1-leader-allow.test.ts', 'C-domain (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/domain/test/t2-blueprint-catalog.test.ts', 'C-domain (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/domain/test/t2-blueprint-hash.test.ts', 'C-domain (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/domain/test/t2-blueprint-parse.test.ts', 'C-domain (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/domain/test/t2-blueprint-v2-hash.test.ts', 'C-domain (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/domain/test/t2-blueprint-v2-requirements.test.ts', 'C-domain (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/domain/test/t2-blueprint-validation.test.ts', 'C-domain (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/a2c1-pwsh-permission.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/a2c3-inspect-operation-permission.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/a2c7-subtree-matcher.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/a3p4-pr4-decision-routing-regression.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/a3p4-pr4-production-entry-regression.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/a3p4-pr7-entry-exec-contract-regression.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/a3p4-production-permission-plane.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/a3p5-permission-read-wiring.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/a3p5-permission-splice.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/a4f1-row-version-not-document-version.test.ts', 'B-runtime-semantics (F1 row-vs-document-version proof; sites are quoted-string replace() args at :136/:146 building v3/v2 DECLARE fixtures under a row stamped 2 — runtime behavioural family per the 2026-10-08 round-3 lane ruling, NOT the fixtures family)'],
  ['packages/runtime/test/a4p6-start-gate-entrances.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/a4p7-v3-cutover-acceptance.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/a4p7-v8-catalog-migration-state.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/a6a-production-wiring.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/alpha2-explicit-agent-setup.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/bound-blueprint-persona-helpers.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/bp1-dual-team-gate.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/bp1-freeze-barrier.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/bp1-red-glue-probe.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/bp1-red-probe.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/consent-scope-hash-binding.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/control-abandon-without-resolve-envelope.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/control-subject-cross-kind-alias.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/d2-s6-ensure-root-live.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/exec-contract-dual-gate.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/f1-webserver-shim-isolation.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/f15-mcp-live-loss-characterization.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/f15-mcp-live-loss.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/fix-control-authz-c-abandon-terminal.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/leader-disable-no-requirements-initial-work.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/leader-recovery-next-boundary-exit.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/leader-template-required-boundary.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/mcp-blueprint-initial-grant.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/mcp-supply-config.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/mcp-target-materialization-unit.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/mcp-target-materialization.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/model-activation-step8.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/model-blueprint-initial-routing.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/model-inspect-config.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/multi-mcp-wiring.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/p6t1-checks.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/p6t1-helpers.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/p6t1-parallel.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/p6t2-helpers.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/p6t3-helpers.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/p6t4-helpers.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/p8s3b-result-effects.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/p8s5a-host-loadability.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/p8s5a-production-assembly.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/p8s6-pagination.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/p8s6-principal.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/p8s6-projection.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/p8s6-push-reconnect.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/p8s6-remote-commands.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/p8s7r2-effective-config.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/p8s7r2-model-state.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/p8s7r2-policy-state-durable.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/p8s7r4-fork-describe.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/p8s7r4-handoff-wiring.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/pbf-default-artifact-urls.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/persona-kind-provider-preflight.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/prf-inspect-same-source.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/rc2a1-fs-containment.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/requirement-d1-d3-decision-scoping.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/requirement-probe-blueprint-scoping.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/rmr-create-or-open-boot.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/rmr-remote-mount-race.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/startup-all-templates-real-authority.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/startup-consent-production.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/startup-preflight-production-create.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/startup-template-disable-production.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/t12a-h1-nullable-mcp.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/t12a-live-bridge.mjs', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/t12b1-real-create.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/t12b2-resume-separation.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/t12b6-handoff-agent-start.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/t12m4-remote-mount.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/t14h-probe-merge.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/t4a-capability-wiring.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/tcm-m2-workspace-attach.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/team-compatibility-scope.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/team-session-startup-fence.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/template-disable-no-requirements-gate.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/legacy/test/p7t6-teammates-adapter.test.ts', 'NO §7.4 LANE ROW (package not in the lane table) — raised to coordinator; carriers: L118=string-carrier-in-typed-file, L248=string-carrier-in-typed-file, L275=string-carrier-in-typed-file, L380=string-carrier-in-typed-file, L398=string-carrier-in-typed-file, L416=string-carrier-in-typed-file, L458=string-carrier-in-typed-file, L460=string-carrier-in-typed-file, L462=string-carrier-in-typed-file'],
  ['cordis.patch.yml', 'SCOPE ADDITION (measured 2026-10-08: the root composition patch\'s blueprintSource block is a live v1 document emitter, cordis.patch.yml:58-62) — NO §7.4 lane row — raised to coordinator'],
  ['tests/mock/scripts/boot.mjs', 'C-testkit scope addition (measured 2026-10-08: mock-boot YAML emitter outside every prior scan)'],
])

/**
 * UNKNOWN adjudications, keyed `path::L<line>` — the 2026-10-08 review made
 * the machine honest about evidence it may not use for a refusal: a decision
 * text on the ENCLOSING lines, or a SPREAD-assisted literal, is UNKNOWN
 * (gates), never a quiet REFUSED. UNKNOWN gates, so every such site on the
 * real tree must be adjudicated BY PATH here with the evidence a human
 * verified — never by a scanner mute, never by widening a rule. A file's
 * entries are removed by fixing the file's shape (or by its migration),
 * never by extending this list to swallow a new shape.
 */
const UNKNOWN_LEDGER: ReadonlyMap<string, string> = new Map([
  // Every entry was hand-verified at its cited source on 2026-10-08 (round 2
  // of the review). Flavors: (a) the namespace name sits only on an OUTER
  // line (a builder signature, a `projection:`/`ledger.put(` head line, a
  // type annotation) or the own keys are SHORTHAND properties the key
  // scanner cannot see (`sessionId,` carries no colon); (b) the literal is
  // SPREAD-built, so hidden keys cannot be certified document-free.
  // None is a Blueprint document; none is machine-refused.
  ['packages/client/test/client-plugin-mount.test.ts::L96', 'projection-envelope: nested `projection:` wire frame (RemoteProjectionValue); own keys carry `teamSessionId,` as SHORTHAND (invisible to the key scanner); hand-verified client-plugin-mount.test.ts:94-103'],
  ['packages/client/test/ledger-adapter.test.ts::L58', 'ledger-row: RemoteLedgerEntryValue builder return (sequence/rootSessionId visible); deciding type name on the builder line; hand-verified ledger-adapter.test.ts:54-60'],
  ['packages/client/test/team-command-flow.test.ts::L76', 'projection-envelope: wireFrame builder return ("the 9-field wire projection" comment at :73); RemoteProjectionValue; hand-verified team-command-flow.test.ts:73-78'],
  ['packages/client/test/team-projection-store-v6.test.ts::L65', 'projection-envelope: buildRemoteSuccess payload `projection:` wire frame; shorthand teamSessionId; hand-verified team-projection-store-v6.test.ts:62-70'],
  ['packages/client/test/team-projection-store-v6.test.ts::L93', 'projection-envelope: same wire-frame shape, second builder; hand-verified team-projection-store-v6.test.ts:90-98'],
  ['packages/client/test/team-projection-store-v6.test.ts::L290', 'projection-envelope: same wire-frame shape, third builder; hand-verified team-projection-store-v6.test.ts:287-295'],
  ['packages/client/test/team-projection-store.test.ts::L74', 'projection-envelope: same wire-frame shape; hand-verified team-projection-store.test.ts:71-79'],
  ['packages/client/test/team-view.client.spec.tsx::L199', 'ledger-row: RemoteLedgerEntryValue builder return (sequence/rootSessionId); hand-verified team-view.client.spec.tsx:195-201'],
  ['packages/contracts/test/negative.test.ts::L151', 'team-session-record: NEGATIVE test of the TeamSessionRecord version axis (SCHEMA_VERSION_MISMATCH at 2); parse call on the same line, literal SPREAD-built ({...validTeam}) — spread guard; hand-verified negative.test.ts:150-152'],
  ['packages/contracts/test/negative.test.ts::L155', 'team-session-record: same class (SCHEMA_VERSION_UNSUPPORTED at 0); spread guard; hand-verified negative.test.ts:154-156'],
  ['packages/contracts/test/negative.test.ts::L157', 'team-session-record: same class (corrupt string version); spread guard; hand-verified negative.test.ts:156-159'],
  ['packages/remote/test/c6-remote-v6.test.ts::L308', 'projection-envelope: value.data.projection wire frame (RemoteProjectionValue); hand-verified c6-remote-v6.test.ts:305-312'],
  ['packages/remote/test/p8t3-helpers.ts::L119', 'ledger-row: p8t3LedgerEntry builder (RemoteLedgerEntryValue shape: sequence/rootSessionId visible); hand-verified p8t3-helpers.ts:117-121'],
  ['packages/remote/test/p8t4-engine.test.ts::L62', 'projection-envelope: dto builder — own comment:59 "the nine frozen top-level fields" (RemoteProjectionValue); hand-verified p8t4-engine.test.ts:59-64'],
  ['packages/remote/test/p8t4-server.ts::L46', 'projection-envelope: p8t4Projection builder return (whole-projection DTO); hand-verified p8t4-server.ts:44-48'],
  ['packages/remote/test/p8t4-server.ts::L66', 'ledger-row: p8t4LedgerEntry builder — own comment:63 "the storage LedgerEntry shape"; hand-verified p8t4-server.ts:63-68'],
  ['packages/remote/test/p8t4-sync.test.ts::L51', 'projection-envelope: syncDto builder ("the nine frozen top-level fields"); hand-verified p8t4-sync.test.ts:48-53'],
  ['packages/runtime/test/p01-team-scoped-overlay.test.ts::L211', 'projection-envelope: createProjectionService option object {clock, schemaVersion} — deciding name two lines above; the 2026-10-08 coordinator record names this stamp projection-owned ("the number is another namespace\'s"); hand-verified p01-team-scoped-overlay.test.ts:210-212'],
  ['packages/runtime/test/p6t4-helpers.ts::L458', 'ledger-row: repositories.ledger.put argument (sequence/rootSessionId visible); ledger.put( on the head line; hand-verified p6t4-helpers.ts:456-460'],
  ['packages/storage/test/bp1-blueprint-registry.test.ts::L146', 'registry-row: parseBlueprintRegistryRecord NEGATIVE test, SPREAD-built ({...baseRecord}); F1 row axis, name on the same line but spread guard forbids machine refusal; hand-verified bp1-blueprint-registry.test.ts:145-147'],
  ['packages/storage/test/bp1-blueprint-registry.test.ts::L159', 'registry-row: serializeBlueprintRegistryRecord round-trip argument, SPREAD-built; same F1 evidence; hand-verified bp1-blueprint-registry.test.ts:158-160'],
  ['packages/storage/test/p4-helpers.ts::L415', 'session-binding: teamMemberBinding record for parseSessionBinding — kind visible, sessionId SHORTHAND (no colon, invisible to the key scanner); binding version axis (SessionBindingDto); hand-verified p4-helpers.ts:413-416'],
  ['packages/storage/test/p4-helpers.ts::L420', 'session-binding: teamRootBinding one-liner; same shorthand class; hand-verified p4-helpers.ts:418-421'],
  ['packages/storage/test/p4-helpers.ts::L425', 'session-binding: ordinaryBinding one-liner; same shorthand class; hand-verified p4-helpers.ts:423-426'],
])


interface ScanRun {
  ran: boolean
  reason: string | null
  scopeFiles: number
  dirty: Array<{ path: string; line: number; version: number; why?: string }>
  advisory: Array<{ path: string; line: number; why?: string }>
  unknown: Array<{ path: string; line: number; why?: string }>
  refused: Array<{ path: string; line: number; ns?: string; why?: string }>
  prose: Array<{ path: string; line: number }>
}

// Defensive derivation: while the two-verdict rule does not exist yet, the
// per-test assertions (each carrying its own RED message) must still run —
// a suite that dies at module load hides which rules are missing.
const rawRun = scanBlueprintVersionSites() as unknown as Partial<ScanRun>
const run: ScanRun = {
  ran: rawRun.ran ?? false,
  reason: rawRun.reason ?? null,
  scopeFiles: rawRun.scopeFiles ?? 0,
  dirty: rawRun.dirty ?? [],
  advisory: rawRun.advisory ?? [],
  unknown: rawRun.unknown ?? [],
  refused: rawRun.refused ?? [],
  prose: rawRun.prose ?? [],
}
let report = ''
try {
  report = formatReport(rawRun as never)
} catch {
  report = ''
}
const dirtyPaths = [...new Set(run.dirty.map((site) => site.path))].sort()

describe('a4p7 blueprint document-version fence (Task 7.5 + 7.4-scope)', () => {
  it('the scan ran (a scan that could not run is never reported as clean)', () => {
    expect(run.ran, `scan did not run: ${String(run.reason)}`).toBe(true)
    // A positive control for `ran`: the extended scope is non-trivial, so an
    // empty tree or a truncated `git ls-files` cannot pass as "nothing to
    // check". The old scope was 117 files; the extended universe must clear
    // 400 (packages/*/test alone adds ~500 tracked code files).
    expect(run.scopeFiles).toBeGreaterThan(400)
  })

  it('invoking the script by name is a real gate: non-zero exit while dirty sites exist', () => {
    const spawned = spawnSync(process.execPath, [SCRIPT], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    })
    // The exit contract, restated for two verdicts: exit 1 iff dirty OR
    // unknown; advisory never moves the exit code.
    const gating = run.dirty.length + run.unknown.length
    expect(spawned.status, spawned.stderr).toBe(gating > 0 ? 1 : 0)
    expect(spawned.stdout).toContain('RESULT dirty(')
    expect(spawned.stdout).toContain('RESULT advisory(')
    expect(spawned.stdout).toContain('RESULT unknown(')
    expect(spawned.stdout).toContain(report.split('\n')[0])
  })

  it('a directory that is not a repository reports not-run with exit 2, never clean', () => {
    const spawned = spawnSync(process.execPath, [resolve(REPO_ROOT, SCRIPT)], {
      cwd: '/tmp',
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    })
    expect(spawned.stdout).toContain('RESULT not-run')
    expect(spawned.stdout).not.toContain('RESULT clean')
    expect(spawned.status).toBe(2)
  })

  it('run from a SUBDIRECTORY the fence reports not-run with exit 2, never a false clean (round-3 F3)', () => {
    // `cd packages/client && node ../../scripts/verify-...` used to print
    // `scanned-in-scope: 0`, `verdict: clean`, exit 0 while the tree held
    // 120 dirty files: every scope prefix and `git ls-files` is
    // cwd-relative. A lane worker must never be handed a green from a
    // subdirectory — only the repository toplevel is a valid cwd.
    const sub = resolve(REPO_ROOT, 'packages/client')
    const spawned = spawnSync(process.execPath, [resolve(REPO_ROOT, SCRIPT)], {
      cwd: sub,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    })
    expect(spawned.stdout, spawned.stderr).toContain('RESULT not-run')
    expect(spawned.stdout).not.toContain('verdict: clean')
    expect(spawned.stdout).not.toContain('scanned-in-scope: 0 tracked files\nRESULT verdict: clean')
    expect(spawned.status).toBe(2)
  })

  it('the dirty set is EXACTLY the recorded Task 7.4 deferral set (no new path)', () => {
    const unexpected = dirtyPaths.filter((p) => !DEFERRALS.has(p))
    expect(unexpected).toEqual([])
  })

  it('every deferred path is still dirty (a migrated path must leave the list)', () => {
    const stale = [...DEFERRALS.keys()].filter((p) => !dirtyPaths.includes(p))
    expect(stale).toEqual([])
  })

  it('the fence needs no exemption for its own author', () => {
    // A scanner that exempts its own source is one line away from exempting
    // anything, so neither the fence's script nor this wrapper may appear in
    // a GATED verdict. (When this test fails because someone documented a
    // version literal in the header, fix the prose; do NOT add a
    // self-exclusion.)
    expect(dirtyPaths.filter((p) => p.startsWith('scripts/verify-blueprint-version-clean'))).toEqual([])
    expect(dirtyPaths).not.toContain('packages/testkit/test/a4p7-blueprint-version-clean.test.ts')
    expect(run.unknown.map((u) => u.path)).not.toContain('packages/testkit/test/a4p7-blueprint-version-clean.test.ts')
  })

  it('the fence reports sites, not a bare count, and names a file the reader can open', () => {
    // The plan's X10 law: the contract is the path set, so the report must
    // carry paths and line numbers. `run.mjs` is a named Task 7.4 site — the
    // positive control that detection actually finds a known v1 author.
    expect(report).toContain('OFFENDING packages/tools/harness/run.mjs :: ')
    expect(report).toMatch(/OFFENDING \S+ :: L\d+=v[12]/)
    expect(report).toContain(`RESULT dirty(${String(dirtyPaths.length)} files`)
  })

  // --- the 7.4-scope extension: the third class is covered by path ---------

  it("the YAML-string factory file (the probe instrument's hardest case) is DIRTY by path and line", () => {
    // The 2026-10-08 probe finding: the largest fixture factory stores its
    // version as a YAML string fragment, so a property-level or AST probe
    // edits NOTHING in the one file that most needs editing. The scan must
    // name those exact lines: 26, 72, 242, 264 (fragment) and 286 (quoted).
    const archetype = 'packages/domain/blueprint/testdata/fixtures.ts'
    const lines = run.dirty.filter((s) => s.path === archetype).map((s) => s.line)
    for (const l of [26, 72, 242, 264, 286]) {
      expect(lines, `fixtures.ts:L${l} must be a DIRTY site (YAML string carrier)`).toContain(l)
    }
    expect(report).toContain(`OFFENDING ${archetype} :: `)
  })

  it('packages/*/test is in scope: a test-tree string-carried emitter reaches the dirty set by path', () => {
    // The coordinator's 139-file co-occurrence count lives under
    // packages/*/test; the fence must now name paths from that class, not
    // just count it. t12a-live-bridge.mjs:1347 is the unambiguous member
    // (a .mjs test-tree emitter, dirty in any classification).
    expect(dirtyPaths).toContain('packages/runtime/test/t12a-live-bridge.mjs')
  })

  it('the named namespace traps are never reported as Blueprint sites', () => {
    // schemaVersion belongs to at least eight namespaces; each named trap was
    // verified against source before being listed here. They may appear in
    // REFUSED (with the namespace that refused them) but never in a gated or
    // dispatch class (dirty / unknown / advisory).
    const traps = [
      'packages/runtime/test/p01-team-scoped-overlay.test.ts', // overlay/projection service stamp
      'packages/runtime/src/plugin/host.ts', // MemberInstance discriminator + ledger row stamp
      'packages/remote/src/handlers/team.ts', // projection envelope reads (runtime, no digit)
      'packages/runtime/src/plugin/s6-remote.ts', // projection envelope read
      'packages/storage/schema/stores.ts', // TEAM_DOMAIN_SCHEMA_VERSION row stamp
      'packages/storage/schema/blueprint-registry.ts', // the row-vs-document lesson itself
      'packages/runtime/test/bp1-blueprint-authority.test.ts', // BlueprintRegistryRecordView row
      'packages/storage/test/bp1-blueprint-registry.test.ts', // row-stamp negative tests
    ]
    const reported = new Set([
      ...run.dirty.map((s) => s.path),
      ...run.advisory.map((s) => s.path),
      // A trap may surface as UNKNOWN only through a by-path adjudication
      // (2026-10-08 review: outer-line evidence can no longer REFUSE, so a
      // trap file whose only evidence is an enclosing line lands in the
      // ledger — visible and gated, with the human verdict written here).
      ...run.unknown
        .filter((s) => !UNKNOWN_LEDGER.has(`${s.path}::L${String(s.line)}`))
        .map((s) => s.path),
    ])
    for (const t of traps) {
      expect(reported, `${t} is not a Blueprint version site — it must not be reported`).not.toContain(t)
    }
  })

  it('the probe-green file is split BY SITE: real Blueprint literal = advisory dispatch, session rows = refused', () => {
    // packages/runtime/test/policy-state-multi-team-bound-blueprint.test.ts
    // is the file the 2026-10-08 probe stayed GREEN on — and both halves of
    // the coordinator's finding live in the same file:
    //  - :101 IS a Blueprint document literal (blueprintOf returns
    //    TeamBlueprint), laundered past tsc by `as unknown as TeamBlueprint`
    //    — exactly the documented advisory caveat. It must show up as
    //    ADVISORY dispatch material for the probe, never as a gated site.
    //  - :140/:147 are TeamSessionRecordDto rows (the nested `blueprint:`
    //    value is an anchor ref, not a document) — they must be REFUSED
    //    under that namespace, invisible to every verdict that dispatches.
    const f = 'packages/runtime/test/policy-state-multi-team-bound-blueprint.test.ts'
    expect(run.dirty.filter((s) => s.path === f)).toEqual([])
    expect(run.unknown.filter((s) => s.path === f)).toEqual([])
    expect(run.advisory.filter((s) => s.path === f).map((s) => s.line)).toEqual([101])
    const refusedHere = run.refused.filter((s) => s.path === f)
    expect(refusedHere.map((s) => s.line)).toEqual([140, 147])
    for (const s of refusedHere) expect(s.ns).toContain('team-session-record')
  })

  it('the REFUSED lines are visible with namespace AND deciding channel, so a refusal is auditable', () => {
    // "A scan that lies by omission is the defect this whole phase keeps
    // re-meeting": refusals are printed per line with the namespace and the
    // deciding channel, never just dropped.
    const ser = run.refused.filter((s) => s.path === 'packages/contracts/test/serialization.test.ts')
    expect(ser.length, 'serialization.test.ts must appear as visible REFUSED lines').toBeGreaterThan(0)
    // The string-embedded sites (:93, :207) refuse from the string's OWN key
    // pool (BLOCKING 1a split), never from the enclosing object's keys; the
    // code-position sites in the same file refuse via visible sibling keys.
    const embedded = ser.filter((s) => s.line === 93 || s.line === 207)
    expect(embedded.map((s) => s.line), 'both string-embedded sites present').toEqual([93, 207])
    for (const s of embedded) {
      expect(s.why, `refusal channel must be the carrier's own keys — got (${s.why})`).toContain(
        '/carrier-sibling',
      )
    }
    expect(report).toContain('REFUSED packages/contracts/test/serialization.test.ts :: ')
    // A code-side sibling refusal carries its channel too:
    const pol = run.refused.filter(
      (s) => s.path === 'packages/runtime/test/policy-state-multi-team-bound-blueprint.test.ts',
    )
    expect(pol.length).toBeGreaterThan(0)
    for (const s of pol) expect(s.why).toContain('/sibling')
  })

  it('every ADVISORY line carries its per-site caveat; the named launderings are named (review dispatch condition #2)', () => {
    // Measured under the real §7.3 flip (evidence 17): 1/18 reddened, 17
    // survived. The caveat line is the dispatch truth the probe reads.
    for (const s of run.advisory) {
      expect(s.why, `${s.path}:${String(s.line)} advisory without caveat`).toContain('[')
      expect(s.why).toContain('typed-code-position')
    }
    // The review condition is about the PRINTED REPORT, not the struct:
    // every printed ADVISORY line carries its caveat (dispatch reads this).
    for (const l of report.split('\n').filter((x) => x.startsWith('ADVISORY '))) {
      expect(l, 'printed ADVISORY line without caveat').toContain('typed-code-position [')
    }
    const named = (path: string, line: number): string => {
      const s = run.advisory.find((x) => x.path === path && x.line === line)
      expect(s, `${path}:${String(line)} must be an advisory line`).toBeDefined()
      return s?.why ?? ''
    }
    expect(
      named('packages/runtime/test/policy-state-multi-team-bound-blueprint.test.ts', 101),
      'the very literal the probe caught lying must SAY so',
    ).toContain('as-unknown-as')
    expect(named('packages/runtime/test/p5t5-helpers.ts', 80)).toContain('annotated TeamBlueprint')
    expect(named('packages/testkit/test/bp1h-blueprint-authoring.test.ts', 95)).toContain('toEqual')
    expect(named('packages/runtime/test/a4p7-v3-cutover-acceptance.test.ts', 571)).toContain('toMatchObject')
  })

  it('every UNKNOWN site on the tree is adjudicated BY PATH in this wrapper — no unadjudicated unknown, no stale ledger row', () => {
    // 2026-10-08 review (BLOCKING 1b/1c): evidence outside the site's own
    // literal, or a spread-hidden literal, may not be machine-refused; it
    // becomes UNKNOWN, which GATES. The price of honesty is a per-path human
    // verdict — recorded here with the evidence, checked in both directions.
    const live = new Set(run.unknown.map((u) => `${u.path}::L${String(u.line)}`))
    for (const u of run.unknown) {
      expect(
        UNKNOWN_LEDGER.has(`${u.path}::L${String(u.line)}`),
        `unadjudicated UNKNOWN at ${u.path}:${String(u.line)} (${u.why}) — verify by hand against the cited source, then ledger it with that evidence`,
      ).toBe(true)
    }
    for (const k of UNKNOWN_LEDGER.keys()) {
      expect(live.has(k), `stale UNKNOWN_LEDGER row ${k} — the site is gone; remove the adjudication`).toBe(true)
    }
    expect(run.unknown.length).toBe(UNKNOWN_LEDGER.size)
  })

  // --- scope boundary -------------------------------------------------------

  it("the scope function is the plan's list plus the measured third class — no more, no less", () => {
    if (isScanScopePath === undefined) {
      throw new Error('RED (scope-rule): scripts/verify-blueprint-version-clean.mjs exports no isScanScopePath yet')
    }
    expect(isScanScopePath('tests/kits/whatever/x.mjs')).toBe(true)
    expect(isScanScopePath('scripts/blueprint-authoring.mjs')).toBe(true)
    expect(isScanScopePath('packages/tools/harness/run.mjs')).toBe(true)
    expect(isScanScopePath('packages/runtime/root-binding/harness/blueprint-source.mjs')).toBe(true)
    expect(isScanScopePath('packages/domain/blueprint/testdata/fixtures.ts')).toBe(true)
    expect(isScanScopePath('packages/runtime/test/p01-team-scoped-overlay.test.ts')).toBe(true)
    // Deviations this task recorded: mock-boot emitters and the composition
    // patch are emitters the old scope missed (measured 2026-10-08).
    expect(isScanScopePath('tests/mock/scripts/boot.mjs')).toBe(true)
    expect(isScanScopePath('cordis.patch.yml')).toBe(true)
    // Out, with the reason encoded in the rule:
    expect(isScanScopePath('packages/runtime/src/plugin/host.ts')).toBe(false) // production plane: 7.3 + tsc own it
    expect(isScanScopePath('tests/mock/hosts/boot1/dump-config.txt')).toBe(false) // leave-inert dumps, not code
    expect(isScanScopePath('dev/agent-workflow/graph.yaml')).toBe(false) // orchestration records are prose
    expect(isScanScopePath('dev/agent-workflow/evidence/x/fixtures/y.ts')).toBe(false)
    expect(isScanScopePath('packages/domain/dist/fixtures.ts')).toBe(false) // build output
    expect(isScanScopePath('docs/notes.md')).toBe(false) // prose extension
  })

  // --- classifier fixtures (evidence/a4-pr7/scan-scope/fixtures) -----------

  it('f01 YAML-string carrier is DIRTY (the type system cannot see it)', () => {
    expectSingle(fixture('f01'), 'dirty')
  })
  it('f02 quoted "1" form is DIRTY (a numeric-rewrite probe edits nothing here)', () => {
    expectSingle(fixture('f02'), 'dirty')
  })
  it('f03 typed code literal is ADVISORY, never DIRTY (tsc + the 7.3 flip own it)', () => {
    expectSingle(fixture('f03'), 'advisory')
  })
  it('f04 multi-line template carrier is DIRTY (per-line quote scanning must not decide)', () => {
    expectSingle(fixture('f04'), 'dirty')
  })
  it('f05 untyped .mjs object literal is DIRTY (nothing type-checks the file)', () => {
    expectSingle(fixture('f05'), 'dirty')
  })
  it('f06 comment-carried versions are PROSE, not sites (predicate half: not prose about versions)', () => {
    expectSingle(fixture('f06'), 'prose')
  })
  it('f07 overlay/projection-service option is UNKNOWN (deciding text on the enclosing line may not refuse)', () => {
    expectSingle(fixture('f07'), 'unknown')
  })
  it('f08 projection wire envelope is REFUSED (projection-envelope)', () => {
    expectSingle(fixture('f08'), 'refused')
  })
  it('f09 session-binding row is REFUSED (session-binding)', () => {
    expectSingle(fixture('f09'), 'refused')
  })
  it('f10 MemberInstance row is REFUSED (member-instance-record)', () => {
    expectSingle(fixture('f10'), 'refused')
  })
  it('f11 registry ROW stamps are UNKNOWN (same-line name but SPREAD-hidden keys; head-line name) — F1 adjudicated by hand', () => {
    const c = expectSingle(fixture('f11'), 'unknown')
    expect(c.unknown.length).toBe(2)
  })
  it('f12 ledger row (shorthand sequence/payload) is UNKNOWN — outer-line evidence gates, never a silent drop', () => {
    expectSingle(fixture('f12'), 'unknown')
  })
  it('f13 TeamSessionRecordDto row is REFUSED (team-session-record)', () => {
    expectSingle(fixture('f13'), 'refused')
  })
  it('f14 governance-override row is REFUSED (governance-override)', () => {
    expectSingle(fixture('f14'), 'refused')
  })
  it('f15 approval-case + operation rows are REFUSED (governance-ledger)', () => {
    const c = expectSingle(fixture('f15'), 'refused')
    expect(c.refused.length).toBe(2)
  })
  it('f16 artifact-grant payload is REFUSED (artifact-grant-payload)', () => {
    expectSingle(fixture('f16'), 'refused')
  })
  it('f17 prose document without the blueprintId half is not a site at all', () => {
    expectSingle(fixture('f17'), 'none')
    if (isScanScopePath !== undefined) {
      expect(isScanScopePath(fixture('f17').path)).toBe(false)
    }
  })
  it('f18 ambiguous hybrid shape is UNKNOWN and gates (no silent drop, no guessed verdict)', () => {
    expectSingle(fixture('f18'), 'unknown')
  })
  it('f19 JSON data is DIRTY (data is never type-checked)', () => {
    expectSingle(fixture('f19'), 'dirty')
  })
  it('f20 YAML config blueprintSource block is DIRTY (cordis.patch.yml shape)', () => {
    expectSingle(fixture('f20'), 'dirty')
  })
  it('f21 supported-version fixtures stay clean in every carrier (reading decision)', () => {
    expectSingle(fixture('f21'), 'none')
  })
  it('f22 string-embedded TeamSessionRecord JSON is REFUSED (siblings live inside the string)', () => {
    // The regex widening to JSON key-quoting caught this class on the real
    // tree (contracts/test/serialization.test.ts:93): a serialized record
    // carried in a TS string must be refused by the keys inside THAT string,
    // not by the enclosing function's object shape. The real file must then
    // be visible as REFUSED and never reach a gated or dispatch class.
    expectSingle(fixture('f22'), 'refused')
    expect(report).toContain('REFUSED packages/contracts/test/serialization.test.ts :: ')
    expect([...new Set([...run.dirty, ...run.unknown, ...run.advisory].map((s) => s.path))]).not.toContain(
      'packages/contracts/test/serialization.test.ts',
    )
  })
  it('f23 string-embedded SessionBinding JSON is REFUSED (kind+sessionId)', () => {
    // Same class, second namespace: serialization.test.ts:207.
    expectSingle(fixture('f23'), 'refused')
  })
  it('f24 string-carried YAML WITH document siblings stays DIRTY (no own-pool ns signature, no refusal)', () => {
    // The counterweight of f22/f23: sibling evidence refuses only from the
    // SITE'S OWN pool. Here the string's own keys are DOCUMENT keys — the
    // doc side never refuses either, and the enclosing object cannot touch
    // a string-carried site (BLOCKING 1a). Doc evidence only raises the bar
    // (signature conflict -> unknown), it never demotes a dirty site into a
    // quiet bucket.
    expectSingle(fixture('f24'), 'dirty')
  })
  it('f25 a complete document smuggled under a row-type annotation is UNKNOWN, never REFUSED', () => {
    // The review's worst real-tree shape: `blueprint:` of a
    // TeamSessionRecordDto holding a full TeamBlueprint literal. The old
    // ladder refused it on the OUTER variable's type annotation — a line
    // the document does not contain.
    expectSingle(fixture('f25'), 'unknown')
  })
  it('f26 document fields + row signature in ONE literal is a conflict UNKNOWN (widened doc-only set)', () => {
    // displayName/members/teamHardEnvelope/metadata are document-only per
    // packages/domain/blueprint/src/types.ts:405-488; the old narrow
    // {leader, memberEnvelopes, policyStates} set let the projection
    // signature refuse this site silently.
    expectSingle(fixture('f26'), 'unknown')
  })

  it('f27 backtick carriers reach the SAME verdict AND channel as the single-quoted twin', () => {
    // BLOCKING 2: one payload, three carriers. The old machine published
    // only unclosed template segments, so the backtick spellings of the f23
    // payload got a different mechanism (or a refusal from the ENCLOSING
    // row's keys — the invisible-site class). Closed template segments are
    // now first-class carriers.
    const c = expectSingle(fixture('f27'), 'refused')
    expect(c.refused.length, 'both backtick spellings are sites').toBe(2)
    for (const s of c.refused) {
      expect(s.why, 'the template carrier must refuse from the keys INSIDE it').toContain(
        '/carrier-sibling',
      )
    }
  })
  it('f28 a document in a multi-line backtick under a row call is UNKNOWN, never refused by the row', () => {
    // The invisible site: refused-by-enclosing-keys removed its document
    // from every verdict. The document's own keys carry no namespace
    // signature; the row call is outer evidence; UNKNOWN gates.
    expectSingle(fixture('f28'), 'unknown')
  })
  it('f29 a backtick inside a regex literal opens no phantom template (YAML stays DIRTY)', () => {
    expectSingle(fixture('f29'), 'dirty')
  })
  it('f30 a backslash-newline string continuation keeps the carrier a carrier (DIRTY)', () => {
    expectSingle(fixture('f30'), 'dirty')
  })

  it('f31 quoted and bare key spellings of one typed object share ONE class', () => {
    // Carrier is decided at the version DIGIT, not at the match start that
    // happens to sit inside a quoted key token (BLOCKING 2 asymmetry).
    expectSingle(fixture('f31'), 'advisory')
  })

  it('f33 one document, two brace spellings under a row: SAME class, both visible (round-3 F1)', () => {
    // The nested document under a same-line double brace opening used to be
    // REFUSED by the ROW's keys (invisible) while the per-line spelling was
    // UNKNOWN. One class now — and it is the visible one.
    expectSingle(fixture('f33'), 'unknown')
  })

  it('f32 V3: members + identity triple under a row conflict is UNKNOWN; f32b: members WITHOUT the triple stays refused (round-3 F2)', () => {
    // The no-op guard (members never counts) refused the real partial
    // document; the naive guard (always counts) would launder wire frames.
    // V3 sits exactly between: f32 and f32b pin both edges.
    expectSingle(fixture('f32'), 'unknown')
    expectSingle(fixture('f32b'), 'refused')
  })

  it('the fixture corpus exists and every fixture was exercised', () => {
    // Guard against the corpus silently emptying (a fixture-less "test" is
    // how a gate dies): names are pinned to the f01..f31 set.
    expect(fixtures.length).toBeGreaterThanOrEqual(34)
    expect(fixtures.length).toBe(new Set(fixtures.map((f) => f.name)).size)
  })

  it('a real in-scope file that keys blueprintId WITHOUT a version literal is not a site', () => {
    // The other direction of the same predicate, measured on the tree rather
    // than on a sample: this kit file keys `blueprintId` and must be clean.
    const clean = 'tests/kits/exec-contract-live-smoke/exec-contract-live-smoke.mjs'
    expect(dirtyPaths).not.toContain(clean)
    expect(run.scopeFiles).toBeGreaterThan(dirtyPaths.length)
  })
})
