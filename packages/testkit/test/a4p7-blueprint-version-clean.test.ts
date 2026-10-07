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
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
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
  ['tests/kits/pr-e-requirement-recovery-smoke/pr-e-requirement-recovery-smoke.mjs', 'C-testkit: migrated group 4; stays dirty ON PURPOSE — the V1_ANCHOR_SOURCE literal is historical pre-PR-E bytes, hash is derived from the embedded source (verify at flip: parseBlueprint(V1_ANCHOR_SOURCE).contentHash must equal the pinned sha256:6a7fba9f… today, and REFUSE post-flip). Disposition: post-§7.3-flip refusal proof — see dev/agent-workflow/evidence/a4-pr7/7-3-flip/intentional-retired.md row 1 (invert-to-refusal). Deleting this entry before that flip goes the stale-check red, which is the design.'],
  ['tests/kits/pr-f-closure-smoke/pr-f-closure-smoke.mjs', 'C-testkit: migrated group 4; stays dirty ON PURPOSE — the V1_ANCHOR_SOURCE literal is historical pre-PR-E bytes, hash is derived from the embedded source (verify at flip: parseBlueprint(V1_ANCHOR_SOURCE).contentHash must equal the pinned sha256:6a7fba9f… today, and REFUSE post-flip). Disposition: post-§7.3-flip refusal proof — see dev/agent-workflow/evidence/a4-pr7/7-3-flip/intentional-retired.md row 2 (invert-to-refusal). Deleting this entry before that flip goes the stale-check red, which is the design.'],
  ['packages/domain/blueprint/testdata/fixtures.ts', 'C-domain STOP, ratified by the coordinator: stays dirty pending (1) the B-lane witness-ownership rewrite of the three revisionSource(...) derivations that splice the factory\'s declared-version line into their v1/v2/99 witnesses (a4f1-row-version-not-document-version, a4p7-v3-cutover-acceptance, a4p7-v8-catalog-migration-state) and (2) the coupled fixtures.ts -> v3 plus empty-rules-envelope PR that updates this file\'s own archetype test in the same PR, owned by the fence/wrapper owner, enumerating the factory\'s full consumer set. Measured evidence: dev/agent-workflow/evidence/a4-pr7/7-4-cdom/FINDINGS.md §5 (v3 without envelopes fails a consumer at COLLECTION; with them, 39 witness tests across the three deriving files). Deliberately avoids quoting the literal carrier pattern here: the fence flags its own author — an earlier draft of this justification made THIS file a dirty site.'],
  ['packages/runtime/test/a2c1-pwsh-permission.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/a2c3-inspect-operation-permission.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/a2c7-subtree-matcher.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/a3p4-pr4-production-entry-regression.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/a6a-production-wiring.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/alpha2-explicit-agent-setup.test.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
  ['packages/runtime/test/bound-blueprint-persona-helpers.ts', 'B-runtime-semantics (string/YAML carriers — the 7.4-scope third class; migrate-by-hand or invert per the 2026-10-08 dispositions)'],
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
  ['packages/legacy/test/p7t6-teammates-adapter.test.ts', 'NO §7.4 LANE ROW (package not in the lane table) — C-testkit STOPPED, file byte-identical: this is the legacy .md teammate-file format\'s OWN version axis, not a TeamBlueprint document (L380 is a NEGATIVE test of which legacy versions the adapter rejects); migrating would delete the adapter\'s acceptance proof. Awaiting the fence\'s dirty-class adjudication row — disposition recorded in dev/agent-workflow/evidence/a4-pr7/7-3-flip/intentional-retired.md row 3 (legitimate non-Blueprint version axis pending adjudication; owner: fence owner + §7.3 emitter). Carriers: L118=string-carrier-in-typed-file, L248=string-carrier-in-typed-file, L275=string-carrier-in-typed-file, L380=string-carrier-in-typed-file, L398=string-carrier-in-typed-file, L416=string-carrier-in-typed-file, L458=string-carrier-in-typed-file, L460=string-carrier-in-typed-file, L462=string-carrier-in-typed-file'],
  ['cordis.patch.yml', 'SCOPE ADDITION (measured 2026-10-08: the root composition patch\'s blueprintSource block is a live v1 document emitter, cordis.patch.yml:58-62) — NO §7.4 lane row — raised to coordinator'],
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
// Part C (round 3): the adjudication ledger MOVED to a file the fence itself
// reads — dev/agent-workflow/evidence/a4-pr7/scan-scope/unknown-adjudications.json
// (reviewed, path-named, versioned with the fence). The fence prints ledgered
// sites as ADJUDICATED (non-gating) and gates only on the unadjudicated
// remainder; this wrapper reads the SAME file, so there is one ledger.
const LEDGER_FILE = 'dev/agent-workflow/evidence/a4-pr7/scan-scope/unknown-adjudications.json'
const LEDGER_ALL: Record<string, string> = JSON.parse(
  readFileSync(resolve(REPO_ROOT, LEDGER_FILE), 'utf8'),
) as Record<string, string>
/**
 * Two row kinds, ONE file, ONE key form, ONE evidence rule (round 4 item 1):
 * plain rows adjudicate UNKNOWNs; `intentionally-dirty:` rows annotate a
 * non-Blueprint version axis with owner + retirement-check + a foreign-axis
 * witness. The kind is the value's prefix — there is no second tier of
 * proof and no second file.
 */
const isDirtyRow = (v: string): boolean => v.trimStart().startsWith('intentionally-dirty:')
const UNKNOWN_LEDGER: ReadonlyMap<string, string> = new Map(
  Object.entries(LEDGER_ALL).filter(([, v]) => !isDirtyRow(v)),
)
const DIRTY_LEDGER: ReadonlyMap<string, string> = new Map(
  Object.entries(LEDGER_ALL).filter(([, v]) => isDirtyRow(v)),
)


interface ScanRun {
  ran: boolean
  reason: string | null
  scopeFiles: number
  dirty: Array<{ path: string; line: number; version: number; why?: string }>
  advisory: Array<{ path: string; line: number; why?: string }>
  unknown: Array<{ path: string; line: number; why?: string }>
  adjudicated: Array<{ path: string; line: number; version: number; evidence: string }>
  intentionallyDirty: Array<{ path: string; line: number; version: number; evidence: string }>
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
  adjudicated: rawRun.adjudicated ?? [],
  intentionallyDirty: rawRun.intentionallyDirty ?? [],
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
    expect(spawned.stdout).toBe(`${report}\n`)
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
    // Round 4 item 1: an `intentionally-dirty` LEDGER row moves a site out of
    // the GATING dirty set but does not launder the DEFERRALS obligation — the
    // path must still be present as dirty or annotated, and the row itself is
    // removed only by executing its retirement-check. A deleted row with an
    // unexecuted check returns the site to dirty and this test stays honest.
    const owed = new Set([...dirtyPaths, ...[...new Set(run.intentionallyDirty.map((x) => x.path))]])
    const stale = [...DEFERRALS.keys()].filter((p) => !owed.has(p))
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
    // carry paths and line numbers.
    //
    // This control used to name ONE path — `packages/tools/harness/run.mjs` — and
    // that shape is a landmine: the day the lane owning the file migrates, the
    // control goes red on SUCCESS, which is precisely when a tired worker mutes
    // it (lane C-tools+harness, §7.4). The law is asserted directly instead:
    // every dirty PATH is named and every dirty SITE's `L<line>=v<version>` is
    // printed, for any path, forever. The literal named path stays, because a
    // reader must be able to open one straight out of this file, and the archetype
    // is the one the next test pins line-by-line anyway.
    //
    // The sites are checked PER PATH — the OFFENDING lines are parsed back into
    // `path -> the sites printed for it`, and a site must appear on ITS OWN path's
    // line. Searching the whole report for the token would be a mute wearing a
    // control: measured at this commit 69 of the 253 dirty sites have an
    // `L<line>=v<version>` token that also occurs on some other report line, so
    // stripping the suffix from one of those passes a whole-report `toContain`
    // (mutation C of scratch/mutate-fence.mjs: green against the whole-report form,
    // red against this one). A report that names no path cannot slip through either:
    // an empty parse makes every path assertion below fail, not pass.
    //
    // On a hypothetical empty dirty set both loops pass vacuously, and that is the
    // correct behaviour HERE: this leg's subject is the SHAPE of a report about
    // dirty sites, and the claim that the set has become empty belongs to the
    // exit-contract leg (`exit 1 iff dirty or unknown`) and to the DEFERRALS
    // staleness legs. Giving this leg a `dirty.length > 0` guard of its own would
    // re-arm it as the red-on-success control it was just rewritten to escape.
    const printed = new Map<string, string[]>()
    for (const line of report.split('\n')) {
      const off = /^OFFENDING (.+?) :: (.*)$/.exec(line)
      const offPath = off?.[1]
      const offSites = off?.[2]
      if (offPath !== undefined && offSites !== undefined) {
        const toks = offSites.split(', ').map((t) => t.trim()).filter((t) => t !== '')
        printed.set(offPath, [...(printed.get(offPath) ?? []), ...toks])
      }
    }
    for (const path of dirtyPaths) {
      const expected = run.dirty
        .filter((s) => s.path === path)
        .map((s) => `L${String(s.line)}=v${String(s.version)}`)
        .sort()
      expect([...(printed.get(path) ?? [])].sort(), `report must print EXACTLY the sites of ${path}`).toEqual(expected)
    }
    expect(report).toContain('OFFENDING packages/domain/blueprint/testdata/fixtures.ts :: ')
    expect(report).toMatch(/OFFENDING \S+ :: L\d+=v[12]/)
    expect(report).toContain(`RESULT dirty(${String(dirtyPaths.length)} files, ${String(run.dirty.length)} sites)`)
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
      // (round 3 Part C) adjudicated sites left run.unknown for the
      // non-gating ADJUDICATED class; a trap surfacing THERE is covered by
      // the ledger's own evidence, so only unadjudicated unknowns violate.
      ...run.unknown.map((s) => s.path),
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
    // B1's cutover-acceptance migration retired the two `schemaVersion: 99`
    // toMatchObject advisories (the probes now read a derived constant, so no
    // digit sits in a code position any more); the surviving named laundering in
    // that file is the v1 bridge assertion below. (Witness ownership, phase 1:
    // the file grew its byte-owned v1 witness builder — the bridge line shifted
    // 547 -> 584; its class and count are unchanged.)
    expect(named('packages/runtime/test/a4p7-v3-cutover-acceptance.test.ts', 584)).toContain('toMatchObject')
    // Re-anchor safety (coordinator ruling, authorized addition): the pin above is a
    // re-anchor, not a shift — the laundering it first named (a v99 `schemaVersion`
    // literal in a toMatchObject argument) was RETIRED by B1's migration, and a pin
    // can only prove the retirement if the retirement is ASSERTED, not narrated. So
    // the tree knows both halves: (1) the text the old pin named is ABSENT from the
    // file; (2) the replacement value is DERIVED from the domain's own version set —
    // strip the derivation back to a literal and this leg goes red even though the
    // fence can no longer see a value hidden behind a constant. That red is the whole
    // safety argument: absence without derivation is just laundering that moved out
    // of the fence's sight. (The absence check is a REGEX, not a string literal: a
    // literal here would re-materialize the very site shape the fence hunts, and the
    // first draft proved it — the fence filed the wrapper itself dirty at once.)
    const cutoverSrc = readFileSync(
      resolve(REPO_ROOT, 'packages/runtime/test/a4p7-v3-cutover-acceptance.test.ts'),
      'utf8',
    )
    expect(cutoverSrc, 're-anchored pin: the old v99 laundering site must be GONE, not re-labelled').not.toMatch(/schemaVersion:\s*99\b/)
    // (2') The derivation half is ANCHORED to the declaration line (reviewer M2
    // hardening, tightened): an unanchored toContain('Math.max(...)') was satisfied
    // by a COMMENT echoing the expression — the derivation could be a lie written
    // in prose. The line-start anchor excludes every comment shape (they put `//`,
    // `/*` or `*` before the text); a lie would now have to BE the declaration line.
    expect(cutoverSrc, 're-anchored pin: the DERIVATION declaration must exist, not a comment echo of it').toMatch(/^\s*const VERSION_NOBODY_DEFINED\s*=\s*Math\.max\(\.\.\.DEFINED_BLUEPRINT_DOCUMENT_VERSIONS\)\s*\+\s*1/m)
    expect(cutoverSrc, 're-anchored pin: the site must speak the constant, not a digit').toContain('schemaVersion: VERSION_NOBODY_DEFINED')
    // (3) M1 (reviewer hardening): the bare-argument slip shape — a retired 99
    // re-introduced as a positional argument (`.toBe(99)`) carries no schemaVersion
    // prefix and slips past the colon-keyed absence check above. Measured against
    // this file BEFORE committing (dev/agent-workflow/evidence/a4-pr7/7-4-b1/transcripts/m1-regex-audit.txt): zero matches
    // today, so no timeout/port/count collision; if a legitimate bare 99 ever
    // lands in this plumbing file, scope this assertion to the W2 assertion region
    // — do not delete it.
    expect(cutoverSrc, 're-anchored pin: no bare-argument 99 may return to the file').not.toMatch(/[,(]\s*99\s*[,)]/)
  })

  it('unknowns are adjudicated BY FILE: the fence reads the ledger, prints ADJUDICATED, gates only the unadjudicated', () => {
    // Part C (round 3, reviewer-ratified F4): the ledger lives in a file the
    // fence reads; ledgered sites print as a sixth, NON-GATING class; closure
    // = dirty empty AND no unadjudicated unknown. Both directions still bite:
    // no unadjudicated unknown may exist, no ledger row may be stale.
    const keyOf = (p: string, line: number, version: number): string => `${p}::L${String(line)}::v${String(version)}`
    const live = new Set(run.adjudicated.map((a) => keyOf(a.path, a.line, a.version)))
    for (const a of run.adjudicated) {
      expect(
        UNKNOWN_LEDGER.get(keyOf(a.path, a.line, a.version)),
        `adjudicated site carries evidence the ledger does not: ${a.path}:${String(a.line)}`,
      ).toBe(a.evidence)
    }
    for (const k of UNKNOWN_LEDGER.keys()) {
      expect(live.has(k), `stale ledger row ${k} — the site is gone; remove the adjudication`).toBe(true)
    }
    expect(run.unknown.map((u) => `${u.path}::L${String(u.line)}`), 'every unknown on this tree must be adjudicated; new unknowns gate until read').toEqual([])
    for (const k of UNKNOWN_LEDGER.keys()) expect(k, 'three-part key required').toMatch(/::L\d+::v\d+$/)
    expect(run.adjudicated.length).toBe(UNKNOWN_LEDGER.size)
    for (const l of report.split('\n').filter((x) => x.startsWith('ADJUDICATED '))) {
      expect(l, 'printed ADJUDICATED line must carry its evidence').toContain('hand-verified')
    }
    expect(report).toContain('RESULT adjudicated(')
  })

  it('every ledger entry cites hand-verified <its own path>:<line> — silence costs a written row', () => {
    // The soft edge the reviewer found: an EMPTY justification kept the whole
    // suite green. Now the fence itself refuses to run on an adjudication that
    // does not name its own entry with a line-referenced hand-verification.
    for (const [key, ev] of Object.entries(LEDGER_ALL)) {
      const path = key.split('::')[0] ?? ''
      expect(typeof ev === 'string' && ev.trim().length > 0, `empty justification: ${key}`).toBe(true)
      expect(
        ev,
        `evidence must cite hand-verified <full path>:<line> for the entry's own file: ${key}`,
      ).toContain(`hand-verified ${path}:`)
    }
  })

  it('the ledger is keyed path::L<line>::v<version>: an old two-part key is NOT-RUN naming it (G2)', () => {
    const good = JSON.parse(readFileSync(resolve(REPO_ROOT, LEDGER_FILE), 'utf8')) as Record<string, string>
    const first = Object.keys(good)[0] ?? ''
    const twoPart = first.replace(/::v\d+$/, '')
    const legacy: Record<string, string> = { ...good }
    delete legacy[first]
    legacy[twoPart] = good[first] ?? ''
    const r = spawnScratchLedger(legacy)
    expect(r.out).toContain('RESULT not-run')
    expect(r.out).toContain(twoPart)
    expect(r.status).toBe(2)
  })

  it('dropping ONE row sends THAT site back to UNKNOWN — a second literal on a ledgered line costs its own row (G2)', () => {
    const good = JSON.parse(readFileSync(resolve(REPO_ROOT, LEDGER_FILE), 'utf8')) as Record<string, string>
    const victim = Object.keys(good)[0] ?? ''
    const path = victim.split('::')[0] ?? ''
    const m = /::L(\d+)::v(\d+)$/.exec(victim)
    expect(m, `three-part key expected: ${victim}`).not.toBeNull()
    delete good[victim]
    const r = spawnScratchLedger(good)
    expect(r.out.slice(0, 500)).not.toContain('RESULT not-run')
    const unknownLine = r.out.split('\n').find((l) => l.startsWith(`UNKNOWN ${path} ::`)) ?? ''
    expect(unknownLine, 'the dropped row must send its OWN site back to UNKNOWN').toContain(`L${m?.[1] ?? '?'}=v${m?.[2] ?? '?'}`)
    expect(r.status).toBe(1)
  })

  it('evidence must cite the key\'s FULL tracked path with a real range containing the site line (G3)', () => {
    const base = JSON.parse(readFileSync(resolve(REPO_ROOT, LEDGER_FILE), 'utf8')) as Record<string, string>
    const key = Object.keys(base)[0] ?? ''
    const m = /^(.+)::L(\d+)::v(\d+)$/.exec(key)
    expect(m, `three-part key expected, got ${key}`).not.toBeNull()
    const sitePath = m?.[1] ?? ''
    const basename = sitePath.split('/').at(-1) ?? ''
    const flavorEdits: Array<[string, string]> = [
      ['empty', ''],
      ['wrong-depth-path', base[key]?.replace(sitePath, `packages/nowhere/deeper/${basename}`) ?? ''],
      ['range-off-end', base[key]?.replace(/(:)\d+(-\d+)?(?!\d)/, '$199999-100000') ?? ''],
      ['range-misses-line', base[key]?.replace(/hand-verified (\S*?):\d+(-\d+)?/, 'hand-verified $1:1-2') ?? ''],
    ]
    for (const [flavor, ev] of flavorEdits) {
      const scratch: Record<string, string> = { ...base, [key]: ev }
      const r = spawnScratchLedger(scratch)
      expect(r.out, `evidence flavor ${flavor} must not run`).toContain('RESULT not-run')
      expect(r.out).toContain(key)
      expect(r.status).toBe(2)
    }
    // and the honest shape still runs
    expect(spawnScratchLedger(base).out).toContain('adjudication-ledger: ')
  })

  it('the report names the ledger it read, and an UNTRACKED ledger needs an explicit test mode (G4)', () => {
    // (a) every normal report prints the resolved path + entry count.
    expect(report).toContain(`adjudication-ledger: ${resolve(REPO_ROOT, LEDGER_FILE)}`)
    expect(report).toContain(`(${String(Object.keys(LEDGER_ALL).length)} entries)`)
    // (b) the override without test mode is refused: it is the mute with a
    // name on it, and post-7.4 (dirty suppressed) it is exactly the lever.
    const good = JSON.parse(readFileSync(resolve(REPO_ROOT, LEDGER_FILE), 'utf8')) as Record<string, string>
    const tmp = scratchLedgerPath('untracked-no-testmode', good)
    const spawned = spawnSync(process.execPath, [resolve(REPO_ROOT, SCRIPT)], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, DSH_SCAN_ADJUDICATIONS: tmp },
    })
    expect(spawned.stdout + spawned.stderr).toContain('RESULT not-run')
    expect(spawned.stdout + spawned.stderr).toMatch(/tracked/i)
    expect(spawned.status).toBe(2)
  })

  it('the blind-spot note prints the load-bearing sentence and the two-number audit clause is gone', () => {
    expect(report).toMatch(/SCOPE-NOTE blind spot: \d+ files \(\d+ non-typed, \d+ doc-marked where the fence is the only defence\)/)
    expect(report).not.toContain('36/7')
    expect(report).not.toContain('round-1 audit')
  })

  const SCRATCH_DIR = resolve(REPO_ROOT, '.tmp-faultscratch')
function scratchLedgerPath(name: string, obj: Record<string, string>): string {
  // G1 rule: legs create their own world — nothing in this file may depend
  // on pre-existing scratch state; a clean checkout must run every leg.
  mkdirSync(SCRATCH_DIR, { recursive: true })
  const file = resolve(SCRATCH_DIR, `adjud-${name}.json`)
  writeFileSync(file, JSON.stringify(obj))
  return file
}
function spawnScratchLedger(obj: Record<string, string>): { out: string; status: number } {
  const tmp = scratchLedgerPath(`spawn-${Object.keys(obj).length}`, obj)
  const spawned = spawnSync(process.execPath, [resolve(REPO_ROOT, SCRIPT)], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, DSH_SCAN_ADJUDICATIONS: tmp, DSH_SCAN_TEST_MODE: '1' },
  })
  return { out: spawned.stdout + spawned.stderr, status: spawned.status ?? -1 }
}

describe('intentionally-dirty rows: the dirty-class annotation with an admission rule', () => {
  const P7 = 'packages/legacy/test/p7t6-teammates-adapter.test.ts'
  const P7KEY = `${P7}::L118::v1`
  const dirtyRow = (cite: string, fields?: Partial<Record<string, string>>): string => {
    const f = {
      'intentionally-dirty': 'legacy .md teammate-file version axis (intentional-retired.md row 3)',
      'foreign-axis': 'legacy-team-teammate-md',
      'witness-key': 'role',
      owner: 'fence owner (ledger row) + 7.3 (emitter)',
      'retirement-check': 'run the p7t6 adapter suite and re-read intentional-retired.md row 3',
    } as Record<string, string>
    Object.assign(f, fields ?? {})
    return Object.entries(f).map(([k, v]) => `${k}: ${v}`).join('; ') + `; ${cite}`
  }
  const honestP7Row = dirtyRow(`hand-verified ${P7}:118-122`)

  it('the tree: the ledger is DERIVED from the fence classification — p7t6 fully annotated, OFFENDING empty, one non-gating class line', () => {
    const p7Sites = [...run.dirty, ...run.intentionallyDirty]
      .filter((d) => d.path === P7)
      .map((d) => `${d.path}::L${String(d.line)}::v${String(d.version)}`)
    // (d) half one: the GATE sees exactly the dirty sites that have no row.
    for (const key of p7Sites) expect(DIRTY_LEDGER.has(key), `ungated but unrowed: ${key}`).toBe(true)
    const foreignRows = [...DIRTY_LEDGER.keys()].filter((k) => !p7Sites.includes(k))
    expect(foreignRows, 'a dirty row for anything still dirty is an escape hatch').toEqual([])
    // honest annotation: derived, never hardcoded
    const derived = (classifyText as NonNullable<typeof classifyText>)(
      P7,
      readFileSync(resolve(REPO_ROOT, P7), 'utf8'),
    ).dirty
    expect([...DIRTY_LEDGER.keys()].sort()).toEqual(
      derived.map((d) => `${P7}::L${String(d.line)}::v${String(d.version)}`).sort(),
    )
    expect(DIRTY_LEDGER.size).toBe(9)
    for (const [k, v] of DIRTY_LEDGER.entries()) {
      for (const field of ['owner:', 'retirement-check:', 'witness-key:', 'foreign-axis:'])
        expect(v, `dirty row missing ${field}: ${k}`).toContain(field)
    }
    expect(run.intentionallyDirty.length).toBe(9)
    expect(report).toContain(`RESULT intentionally-dirty(1 files, 9 sites)`)
    expect(report).toContain(`INTENTIONALLY-DIRTY ${P7}`)
    const offending = report.split('\n').filter((l) => l.startsWith(`OFFENDING ${P7} `))
    expect(offending, 'annotated sites leave the gated OFFENDING print, never the record').toEqual([])
  })

  it('(a) a dirty row whose cited range does not contain the site line is NOT-RUN naming the key', () => {
    const r = spawnScratchLedger({ ...LEDGER_ALL, [P7KEY]: dirtyRow(`hand-verified ${P7}:245-250`) })
    expect(r.out).toContain('RESULT not-run')
    expect(r.out).toContain(P7KEY)
    expect(r.status).toBe(2)
  })

  it('(b) a row for a TeamBlueprint DOCUMENT site is refused by the admission rule (both flavors)', () => {
    // NOTE (the author-exemption discipline bites its own author): this file
    // is scanned by the fence, so NO string here may spell a retired literal
    // — the needle is built from the document half (`blueprintId`) and the
    // ledger's own v-suffix, never from the digit spelling.
    const docFixture = fixtures.find((f) => f.content.includes('blueprintId'))
    expect(docFixture, 'need a document fixture').toBeTruthy()
    const rel = `dev/agent-workflow/evidence/a4-pr7/scan-scope/fixtures/${String(docFixture?.name)}`
    const raw = readFileSync(resolve(REPO_ROOT, rel), 'utf8').split('\n')
    const line = raw.findIndex((l) => l.includes('blueprintId')) + 1
    expect(line).toBeGreaterThan(0)
    const docKey = `${rel}::L${String(line)}::v1`
    const cite = `hand-verified ${rel}:1-${String(raw.length)}`
    // flavor 1: a witness drawn from Blueprint's own key set proves nothing foreign
    const r1 = spawnScratchLedger({ ...LEDGER_ALL, [docKey]: dirtyRow(cite, { 'witness-key': 'blueprintId' }) })
    expect(r1.out, 'witness from the forbidden set must be refused').toContain('RESULT not-run')
    expect(r1.out).toContain(docKey)
    expect(r1.status).toBe(2)
    // flavor 2: a witness that is not in the cited range at all
    const r2 = spawnScratchLedger({ ...LEDGER_ALL, [docKey]: dirtyRow(cite, { 'witness-key': 'zzzNotInTheRange' }) })
    expect(r2.out, 'absent witness must be refused').toContain('RESULT not-run')
    expect(r2.out).toContain(docKey)
    expect(r2.status).toBe(2)
  })

  it('(c) dropping a row sends THAT site back to dirty with its own L=v and gates', () => {
    const victim = `${P7}::L380::v2`
    const without: Record<string, string> = { ...LEDGER_ALL }
    expect(without[victim], 'the v2 row must exist in the tree ledger').toBeTruthy()
    delete without[victim]
    const r = spawnScratchLedger(without)
    const offendingLine = r.out.split('\n').find((l) => l.startsWith(`OFFENDING ${P7} ::`)) ?? ''
    expect(offendingLine, 'the dropped row must return its OWN site to OFFENDING').toContain('L380=v2')
    expect(r.status).toBe(1)
    expect(r.out).toContain('RESULT intentionally-dirty(') // the class prints even now
  })

  it('(d) an honest dirty row does not gate, but every unrowed dirty site still does — annotation, not bypass', () => {
    const withRow = spawnScratchLedger({ ...LEDGER_ALL, [P7KEY]: honestP7Row })
    expect(withRow.out).not.toContain('RESULT not-run')
    expect(withRow.status, 'gate status unchanged by an honest row: ' + withRow.out.slice(0, 300)).toBe(1)
    const offendingCount = withRow.out.split('\n').filter((l) => l.startsWith('OFFENDING ')).length
    expect(offendingCount, 'dirty sites with no row MUST still gate').toBeGreaterThan(100)
    expect(withRow.out).toContain('INTENTIONALLY-DIRTY')
  })

  it('the blind-spot line names the numeric-form family the text predicate does not read', () => {
    expect(report).toMatch(/SCOPE-NOTE blind spot:.*numeric-form family/)
    expect(report).toMatch(/\+N/)
    expect(report).toMatch(/parser refusing|runtime/i)
  })
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

  it('f35 + scope notes: a closed continuation revives CODE on the line tail; both blind spots print (round-3 D)', () => {
    expectSingle(fixture('f35'), 'advisory')
    expect(report).toContain('SCOPE-NOTE blind spot:')
    expect(report).toContain('SCOPE-NOTE lineStates continuation:')
  })

  it('the fixture corpus exists and every fixture was exercised', () => {
    // Guard against the corpus silently emptying (a fixture-less "test" is
    // how a gate dies): names are pinned to the f01..f31 set.
    expect(fixtures.length).toBeGreaterThanOrEqual(35)
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
