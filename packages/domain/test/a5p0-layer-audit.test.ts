/**
 * Alpha.5 PR0 — the lane-import gate (plan §3: "循环依赖/跨层 imports 审计").
 *
 * Runs `scripts/audit-a5-tool-governance-imports.mjs` IN-PROCESS (no spawn:
 * the runner stays threads-pure per docs/TEST_METHODS.md §2) and additionally
 * pins the two facts the script cannot see from the outside:
 *
 *  - the lane's barrel is the only sanctioned entry point (deep imports from
 *    other packages reach a frozen file, not a moving part);
 *  - the AUDIT ITSELF is non-vacuous: it must have walked real files and real
 *    edges, or "no findings" means nothing (the a3p3 non-vacuity discipline).
 *
 * @module test/a5p0-layer-audit
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// @ts-expect-error — plain-JS tooling script (the repo's scripts/ family is .mjs, no declarations)
import { auditA5ToolGovernanceImports } from '../../../scripts/audit-a5-tool-governance-imports.mjs'

const LANE_SRC = fileURLToPath(new URL('../tool-governance/src', import.meta.url))

describe('the tool-governance lane audit', () => {
  const verdict = auditA5ToolGovernanceImports()

  it('reports no findings (pure domain, no cycles, only reviewed consumers)', () => {
    expect(verdict.findings).toEqual([])
  })

  // PR0 froze this lane DORMANT ("zero production consumers"). PR1 (plan §4)
  // and PR2 (plan §5) are the reviewed wiring steps, so the law is now a
  // NAMED SET — and this file pins the set, not just its emptiness: a new
  // consumer is a design change that has to appear here, and a disappeared
  // one is a broken wire.
  //
  // PR3 (controlled-fs/src ×4, review #259@23dc3bd1) and PR5 (the tools lane
  // src ×6, review #260@5ccc5839) merged WITH their lane imports already present
  // but WITHOUT paying this set — a real ledger debt that carried this audit
  // red on master since those merges. The integration round books the debt
  // against the PR3/PR5 review provenance, file-by-file; the subtree prefixes
  // in the audit script cannot smuggle a file this list does not name, so
  // "no accretion" keeps biting exactly as before.
  //
  // A5-M1 (PR358) books the same way: census run 39866646962 at headSha
  // efecfe2b4 listed FOUR new files, and each is booked here with the symbol
  // it consumes and the reason it needs it (the audit-script entry carries the
  // file:line provenance). Booking an edge is not widening a rule: the four
  // entries are single files, each for the ONE thin face it imports, and the
  // lane's pure-domain law + the outward-leaf leg below still refuse any edge
  // pointing the other way.
  it('the consumer set is exactly the reviewed PR1+PR2+PR3+PR5+A5-M1 wiring (no accretion)', () => {
    expect(verdict.consumers).toEqual([
      // A5-M1: the Control lane's WRITE-side fingerprint — `canonicalJson
      // Fingerprint` (control/service.ts:183) recomputed at :2311 so a PA
      // manifest's `reviewPayloadDigest` / `operationFingerprint` must equal
      // the SERVICE-computed digest of the payload it pairs with.
      'runtime/control/service.ts',
      // A5-M1: the Control lane's READ-side fingerprint (the PR358 f5 item-4
      // read-back VALUE check at types.ts:1285) plus the TYPE-ONLY call-facts
      // vocabulary (`RequestedEffectSet` / `ToolBinding` / `ToolPolicy
      // Document`, types.ts:153 → the slots at :1407/:1414/:1423; erased at
      // emit, so the Control plane gains no runtime edge from that half).
      'runtime/control/types.ts',
      'runtime/controlled-fs/src/cf-descriptor.ts',
      'runtime/controlled-fs/src/cf-errors.ts',
      'runtime/controlled-fs/src/controlled-fs.ts',
      'runtime/controlled-fs/src/index.ts',
      // U7-9a: the two post-consume closures consume TYPE-ONLY faces
      // (`FsWriteReceipt`, `GovernanceResult`) — the receipt shape the
      // write/create bodies return and the closed governance verdict the
      // undetermined arms carry. Type edges add zero runtime coupling;
      // booked because the audit law is per-EDGE, not per-weight. (The
      // standalone script's `runtime/controlled-fs/src/` prefix already
      // covered them; this file-level list enumerates.)
      'runtime/controlled-fs/src/post-consume-create.ts',
      'runtime/controlled-fs/src/post-consume-write.ts',
      // A5-M1: the PA↔Control bridge — the manifest digest it writes
      // (pa-control-bridge.ts:394) and the assurance snapshot it compares
      // (:752), plus the closed admission vocabulary its ports are typed
      // against (:93-98). runtime lane → domain leaf; the bridge's Alpha.4
      // LADDER edge is booked on the a3p3 rows, not here.
      'runtime/operation-permission/pa-control-bridge.ts',
      'runtime/src/plugin/live/agent-bindings.mjs',
      // U6 PR2 (the PR1-disclosed minter rebind): the shadow row consumes
      // the ONE §6 feed face (`definitionIdentityOf`) so its audit identities
      // are the identities the Guard binds; pure function, zero authority.
      'runtime/src/plugin/live/center-shadow-row.mjs',
      // A5-M1's plane-effect-backends booking RETIRED at U6 PR2: its one
      // lane edge (`parseRequestedEffectSet`, the READ row's effect
      // vocabulary) MOVED with the read executor to
      // `tools/fs-family/src/read-executor.mjs` (booked at the tail of this
      // list); the plane file now imports nothing from the lane. Consumer
      // SET unchanged in count — the location moved, and this list is the
      // map of locations.
      // alpha5-ptc-fs (branch `alpha5-ptc-pr`; review provenance 独审 PASS,
      // id 7f0e5d6e, booked by the integration coordinator on the #334 census
      // red): the PTC fs escalation row — direct lane edge = the effect-grammar
      // face (`parseRequestedEffectSet`), grants via the already-reviewed PR2
      // grant-mint module only; zero lane edits (audit script entry carries
      // the file:line provenance).
      'runtime/src/plugin/live/ptc-escalation-row.mjs',
      // GLUE-7 (alpha5-glue7-backend): placement-feed wiring via the
      // tool-dispatch §6 face (see the audit script entry for provenance).
      'runtime/src/plugin/live/team-tool-plane.mjs',
      'runtime/tool-admission/admission-kernel.ts',
      'runtime/tool-admission/approval-case.ts',
      'runtime/tool-admission/assurance-runtime.ts',
      'runtime/tool-admission/clock.ts',
      'runtime/tool-admission/grant-mint.ts',
      'runtime/tool-dispatch/closed-world-guard.ts',
      'runtime/tool-dispatch/install.ts',
      'runtime/tool-dispatch/scoped-dispatcher.ts',
      'tools/a5p5-tools/src/args.ts',
      'tools/a5p5-tools/src/effects-schema.ts',
      'tools/a5p5-tools/src/pipeline.ts',
      // P-B register.ts = pure-data Definition factory consuming tool-governance;
      // placement-scoped registration only; P-B PR #299; GLUE-5 will dedup P-LSP
      // stacked copies. Cross-lane shared-pin edit authorized in writing by the
      // coordinator (P-B writer brief, the #299 census-red fix round).
      'tools/a5p5-tools/src/register.ts',
      'tools/a5p5-tools/src/render.ts',
      'tools/a5p5-tools/src/spill.ts',
      'tools/a5p5-tools/src/types.ts',
      // U7-F: the agent-control family's ONE executor consumes the same thin
      // effect-grammar face (`parseRequestedEffectSet`, domain/tool-governance)
      // the fs-family executors were booked for — parse-only, zero further
      // domain reach (file-by-file booking, zero lane edits; owner role:
      // agent-control-family). Alphabetical here, as the fs block states.
      'tools/agent-control-family/src/agent-control-executor.mjs',
      // U6 PR2 + U7-9a: the FS family's FOUR executors (read/write/edit/
      // read_image bodies) each consume the ONE effect-grammar face
      // (`parseRequestedEffectSet`, domain/tool-governance) — the same thin
      // face plane-effect-backends was booked for; the read file IS that
      // plane file's moved read section, the mutation trio are U7-9a's
      // governed bodies (file-by-file booking, zero lane edits; owner role:
      // fs-family README). Alphabetical here: the expectation is the
      // sorted-edge set the audit walks.
      'tools/fs-family/src/edit-executor.mjs',
      'tools/fs-family/src/image-executor.mjs',
      'tools/fs-family/src/read-executor.mjs',
      'tools/fs-family/src/write-executor.mjs',
      // U7-F (inspect-family lane) booked FILE-BY-FILE, SAME single thin
      // face (`parseRequestedEffectSet`) as the fs-family executors above:
      // the two governed executors validate their admitted effect set at
      // the PA boundary; everything read-only, zero lane edits (booking
      // note in scripts/audit-a5-tool-governance-imports.mjs). Alphabetical.
      'tools/inspect-family/src/inspect-executor.mjs',
      'tools/inspect-family/src/skill-executor.mjs',
      // U7-F (the governed pwsh shell-class row): the executor consumes the
      // same two thin governance faces as the fs executors — the effect
      // grammar (`parseRequestedEffectSet`) and the parsed-record fingerprint
      // (`canonicalJsonFingerprint`, the PR #390 effect-set law) — zero lane
      // edits (the audit script entry carries the file:line provenance).
      'tools/process-family/src/pwsh-executor.mjs',
    ])
  })

  it('is non-vacuous: it really walked the lane and its edges', () => {
    expect(verdict.laneFiles).toBeGreaterThanOrEqual(6)
    expect(verdict.edgeCount).toBeGreaterThan(0)
  })

  it('the only outward edges are the sanctioned leaves', () => {
    // Direct re-check independent of the script: every non-relative import in
    // the lane is forbidden; every outward relative import resolves into one
    // of the two named leaves.
    const files: string[] = []
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) walk(full)
        else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) files.push(full)
      }
    }
    walk(LANE_SRC)
    // Comment strip (a3p3 direction: prose may stop counting, an edge can
    // never be erased) — prose `from "…"` is not a specifier.
    const codeOnly = (source: string): string =>
      source.replace(/^\s*\/\/.*$/gm, ' ').replace(/^\s*\/\*[\s\S]*?\*\//gm, ' ')
    const outward = new Set<string>()
    for (const file of files) {
      const source = codeOnly(readFileSync(file, 'utf8'))
      for (const match of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
        const spec = match[1] ?? ''
        expect(spec.startsWith('.'), `bare specifier ${spec} in ${file}`).toBe(true)
        if (!spec.startsWith('../')) continue
        // Collapse the leading `../` ladder but KEEP the `.js` spelling — the
        // endsWith checks below name the sanctioned leaves exactly as they
        // are imported.
        const normalized = spec.replace(/^\.\.(\/\.\.)+/, '..$1')
        outward.add(normalized)
      }
    }
    for (const spec of [...outward].sort()) {
      expect(
        spec.endsWith('authority-envelope/src/index.js') || spec.endsWith('blueprint/src/hash.js'),
        `unsanctioned outward edge ${spec}`,
      ).toBe(true)
    }
    expect(outward.size).toBeGreaterThan(0)
  })
})
