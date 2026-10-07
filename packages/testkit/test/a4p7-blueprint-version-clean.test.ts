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
 *   - `advisory` — code-position TS literals: §7.3's narrowing of
 *     TeamBlueprint.schemaVersion is the instrument for those, and gating
 *     them here would double-count a gate tsc holds. They are PRINTED by path
 *     because they are dispatch material, not because this fence owns them.
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
      if (!lines[i].startsWith(';;')) break
      const m = /^;;\s*([a-z]+):\s*(.*)$/.exec(lines[i])
      if (m !== null) header.set(m[1], m[2])
    }
    return {
      name,
      expect: (header.get('expect') ?? 'none') as Fixture['expect'],
      rule: header.get('rule') ?? '(unnamed)',
      namespace: header.get('namespace'),
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
      ...run.unknown.map((s) => s.path),
      ...run.advisory.map((s) => s.path),
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

  it('the REFUSED lines are visible with their namespace, so a refusal is auditable', () => {
    // "A scan that lies by omission is the defect this whole phase keeps
    // re-meeting": refusals are printed per line with the namespace and the
    // deciding channel, never just dropped.
    const p01 = run.refused.filter((s) => s.path === 'packages/runtime/test/p01-team-scoped-overlay.test.ts')
    expect(p01.length, 'p01:211 must appear as a visible REFUSED line').toBeGreaterThan(0)
    expect(report).toContain('REFUSED packages/runtime/test/p01-team-scoped-overlay.test.ts :: ')
    expect(report).toContain('projection-envelope')
  })

  it('unknown is empty on the current tree (every shape classifies or is refused with evidence)', () => {
    expect(
      run.unknown.map((u) => `${u.path}:L${u.line}`),
      'a new ambiguous shape landed in the tree — adjudicate it by hand, do not widen a rule to swallow it',
    ).toEqual([])
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
  it('f07 overlay/projection-service option is REFUSED (projection-envelope)', () => {
    expectSingle(fixture('f07'), 'refused')
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
  it('f11 registry ROW stamp is REFUSED (registry-row, F1: row stamp != document version)', () => {
    expectSingle(fixture('f11'), 'refused')
  })
  it('f12 ledger row is REFUSED (ledger-row)', () => {
    expectSingle(fixture('f12'), 'refused')
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
  it('f24 string-carried YAML WITH document siblings stays DIRTY (no ns hit, no refusal)', () => {
    // The counterweight of f22/f23: sibling evidence alone never REFUSES.
    // Refusal requires a positive namespace signature; doc siblings only
    // raise the bar (signature conflict -> unknown), they never demote a
    // dirty site into a quiet bucket.
    expectSingle(fixture('f24'), 'dirty')
  })

  it('the fixture corpus exists and every fixture was exercised', () => {
    // Guard against the corpus silently emptying (a fixture-less "test" is
    // how a gate dies): names are pinned to the f01..f24 set.
    expect(fixtures.length).toBeGreaterThanOrEqual(24)
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
