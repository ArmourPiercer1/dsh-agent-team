#!/usr/bin/env node
/**
 * adjudicate.mjs — turn the raw consumer scan into the adjudicated artifact for
 * the UTE-3 FS error-protocol slice (2026-11-20).
 *
 * INPUT   `consumer-scan.raw.txt` — every `file:line` in packages/**, tests/**,
 *         scripts/**, docs/** that mentions the OLD FS refusal representation
 *         (see `scan.sh` for the closed pattern set).
 * OUTPUT  `consumer-scan.txt` — the same rows, each annotated with
 *             scope   = FS | NON-FS | PRODUCER | HARNESS | DOC
 *             verdict = unaffected-by-B+C | needs-adaptation | incompatible
 *             depends = the old-representation mechanism the row keys on
 *         `consumer-verdicts.tsv` — one row per FILE with its verdict + reason,
 *         which is the table the memo summarises.
 *
 * WHY A GROUP TABLE AND NOT A PER-LINE OPINION
 *   The verdict is a property of WHAT THE FILE IS FOR (producer / old-path test
 *   / oracle / handler / doc / other-family test), not of the individual line:
 *   the same literal `IO_READ_DENIED` is a producer token in `fs.ts`, an
 *   assertion in a PD-17 arm, and an unrelated family's fact code in a bash
 *   test. The groups below are the reviewed units. A file that matches NO group
 *   is NOT silently defaulted: it is emitted as `UNREVIEWED` so the adjudicator
 *   itself fails closed on a newly scanned file.
 *
 * Run: node dev/agent-workflow/evidence/ute3-fs-errors-20261120/adjudicate.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const RAW = join(HERE, 'consumer-scan.raw.txt')

/**
 * Old-representation mechanism detected on a line.
 * @param {string} text
 * @returns {string}
 */
export function mechanismOf(text) {
  if (/FS_SANDBOX_DENIED/u.test(text)) return 'literal:FS_SANDBOX_DENIED'
  if (/outside every allow subtree/u.test(text)) return 'prose:lane-denial'
  if (/changed since it was read|has been modified since/u.test(text)) return 'prose:stale-edit'
  if (/has not been read|read the file, then retry/u.test(text)) return 'prose:read-before-write'
  if (/IO_WRITE_REQUIRES_READ/u.test(text)) return 'code:IO_WRITE_REQUIRES_READ'
  if (/IO_ASK_REQUIRES_APPROVAL/u.test(text)) return 'code:IO_ASK_REQUIRES_APPROVAL'
  if (/IO_POLICY_UNSUPPORTED/u.test(text)) return 'code:IO_POLICY_UNSUPPORTED'
  if (/IO_READ_DENIED/u.test(text)) return 'code:IO_READ_DENIED'
  if (/IO_WRITE_DENIED/u.test(text)) return 'code:IO_WRITE_DENIED'
  return 'unclassified'
}

const NEEDS = 'needs-adaptation'
const UNAFFECTED = 'unaffected-by-B+C'
const INCOMPATIBLE = 'incompatible'

/**
 * Reviewed groups. `match` is an exact basename/path predicate; the FIRST hit
 * wins. Every FS-scope file in the scan MUST be covered (see the assertion at
 * the end), so a new file cannot inherit a verdict by accident.
 *
 * reason strings are the memo's justification, kept short enough to read.
 */
const GROUPS = [
  // ── PRODUCERS: the old representation is emitted here; it is mapped, not consumed
  {
    match: (f) => f === 'packages/runtime/team-services/src/fs.ts',
    scope: 'PRODUCER', verdict: UNAFFECTED,
    reason: 'the old FS provider itself: it emits TeamIoDenial codes and the compiled-lane prose that the closed mapping classifies. It keeps emitting until UTE-4 retires it; B+C changes neither its checks nor its timing.',
  },
  {
    match: (f) => f === 'packages/runtime/member-io-policy/src/provider-capabilities.ts',
    scope: 'PRODUCER', verdict: UNAFFECTED,
    reason: 'produces the compiled lane decision (PATH_* code + prose). The prose the corpus measured is emitted here; B+C maps it, it does not alter the decision.',
  },
  {
    match: (f) => f === 'packages/runtime/team-services/src/guard-observability.ts',
    scope: 'HANDLER', verdict: UNAFFECTED,
    reason: 'maps a refusal code to ask/deny for the guard fact. A native FsError never flows through this handler (it is a TeamIoDenial surface); if one did, its else-branch yields deny, which is the correct classification — no spelling dependency.',
  },
  {
    match: (f) => ['packages/runtime/src/plugin/live/a5sf-realm-row.mjs', 'packages/runtime/src/plugin/live/a5sf-skill-provider.mjs', 'packages/runtime/src/plugin/live/team-tool-plane.mjs', 'packages/runtime/team-services/src/subprocess.ts', 'packages/runtime/tool-admission/admission-kernel.ts'].includes(f),
    scope: 'PRODUCER', verdict: UNAFFECTED,
    reason: 'producer/consumer of the SAME TeamIoDenial vocabulary for faces outside the FS tool family (realm service, skill, subprocess/grep/glob, policy projection). The B+C ruling is scoped to the FS family (D4: families retire independently), and none of these reads an FS tool refusal.',
  },
  {
    match: (f) => f === 'packages/tools/src/native-fs-binding.ts',
    scope: 'PRODUCER', verdict: UNAFFECTED,
    reason: 'the NEW path\'s binding: its comment records the rc.5 FS_SANDBOX_DENIED deref that forces route B. It is the reason the ruling exists, not a consumer of the old text.',
  },
  {
    match: (f) => f === 'packages/tools/fs-family/README.md',
    scope: 'DOC', verdict: UNAFFECTED,
    reason: 'the retiring family\'s own README documents its IO_POLICY_UNSUPPORTED half-cover rule; it is deleted with the family, and the native path makes no such promise.',
  },

  // ── FS-SCOPE TESTS / ORACLES / HANDLERS: key on the old representation
  {
    match: (f) => f === 'packages/runtime/test/a5sf-pd17-fs-policy.test.ts',
    scope: 'FS', verdict: NEEDS,
    reason: 'PD-17 arm 4 asserts the Member ceiling decides first via IO_WRITE_DENIED with 0 base calls. After the FS switch the same claim must be asserted on the native FsError (FS_PERMISSION_DENIED / lane category); the safety claim (deny + zero provider calls) must NOT be loosened.',
  },
  {
    match: (f) => f === 'packages/runtime/test/a5sf-service-install.test.ts',
    scope: 'FS', verdict: NEEDS,
    reason: 'asserts TEAM_IO_DENIAL_CODES contains IO_READ_DENIED/IO_WRITE_DENIED/IO_WRITE_REQUIRES_READ and that the mounted FS service rejects out-of-lane reads with those codes. The install surface stays; the FS refusal assertions move to the native codes/categories when the family switches.',
  },
  {
    match: (f) => f === 'packages/runtime/test/a5sf-pd20-admission-close.test.ts',
    scope: 'FS', verdict: NEEDS,
    reason: 'pins the admission-close ordering by observing IO_READ_DENIED on an out-of-lane target. The ORDERING claim (close answers before the lane) is behaviour; its FS spelling must be re-expressed natively without relaxing the ordering assertion.',
  },
  {
    match: (f) => f === 'packages/runtime/test/u7-9a-fs-mutation-c1.test.ts',
    scope: 'FS', verdict: NEEDS,
    reason: 'image/ask arms of the FS mutation C1 suite key on the old typed refusal text/code. read_image is a member of the retirement unit, so its refusal surface must be re-expressed on the native path.',
  },
  {
    match: (f) => f === 'packages/runtime/test/a5-read-slice-window.test.ts' || f === 'packages/runtime/test/a5p2-composition.test.ts',
    scope: 'FS', verdict: UNAFFECTED,
    reason: 'asserts the P1 policy COMPILER\'s IO_POLICY_UNSUPPORTED landing (an assembly-time capability refusal), which is not a model-call FS refusal and is not replaced by the native FsError path.',
  },
  {
    match: (f) => [
      'tests/world-factory/a5sf-pd17-fs-read-axis.test.mjs',
      'tests/world-factory/a5sf-fs-contract.test.mjs',
      'tests/world-factory/a5sf-native-route-c.test.mjs',
      'tests/world-factory/a5sf-f1-ctx.test.mjs',
      'tests/world-factory/a5sf-tool-axis.test.mjs',
      'tests/world-factory/a5sf-p2-seam.test.mjs',
      'tests/world-factory/a5sf-p2-wiring.test.mjs',
      'tests/world-factory/a5sf-product-assembly.test.mjs',
      'tests/world-factory/a5sf-governed-preset.test.mjs',
      'tests/world-factory/a5sf-harness.test.mjs',
      'tests/world-factory/a5sf-pd19-fact-attribution.test.mjs',
    ].includes(f),
    scope: 'FS', verdict: NEEDS,
    reason: 'old-path FS safety arm: asserts the typed IO_* lane code / deny fact on the legacy confined provider. The deny, the zero-byte effect and the one-fact attribution are the claims that must survive; only the refusal surface is adapted through the closed categories when the FS family switches.',
  },
  {
    match: (f) => f === 'tests/world-factory/lib/a5sf-fs-contract-world.mjs',
    scope: 'FS', verdict: NEEDS,
    reason: 'the FS contract world asserts the legacy model-facing prose ("outside every allow subtree", "file has not been read", "re-read the file, then retry") and the legacy provider op codes. This is the densest text dependency in the FS family; it must consume the closed categories for the native path, and its effect assertions must not be relaxed.',
  },
  {
    match: (f) => f === 'tests/world-factory/lib/a5sf-dual-plane.mjs' || f === 'tests/world-factory/a5sf-dual-plane.test.mjs',
    scope: 'FS', verdict: NEEDS,
    reason: 'the dual-plane oracle carries closed expectation tables of decidedBy codes (IO_READ_DENIED / IO_WRITE_DENIED / IO_WRITE_REQUIRES_READ). On a native refusal these tables would report DISAGREE for a non-behavioural reason, so the oracle must compare categories.',
  },
  {
    match: (f) => f === 'tests/world-factory/lib/a5sf-acceptance-preflight.mjs' || f === 'tests/world-factory/a5sf-acceptance-preflight.test.mjs',
    scope: 'FS', verdict: NEEDS,
    reason: 'HANDLER: judges acceptance rows by matching the legacy model-facing prose (LANE_REFUSAL regex, IO_WRITE_REQUIRES_READ_PROSE, the row-4b host sentence). A native-path row would be judged REFUTED for a non-behavioural reason. This handler is the first intended consumer of the closed category mapping.',
  },
  {
    match: (f) => f === 'tests/world-factory/suites/150-a5sf-read.mjs' || f === 'tests/world-factory/suites/010-u6-fs.mjs' || f === 'tests/world-factory/lib/u6-fs-assembly.mjs',
    scope: 'FS', verdict: NEEDS,
    reason: 'FS read/mutation suite (incl. read_image) asserts the legacy refusal code/class on the read axis. read_image is the uncovered member of the retirement unit, so its refusal surface is part of the switch.',
  },
  {
    match: (f) => f === 'tests/world-factory/drivers/a5sf-pd31-read-image/run-boot.mjs',
    scope: 'FS', verdict: NEEDS,
    reason: 'the read_image live driver requires the out-of-lane refusal text to be `outside every allow subtree of the lane`. Under B+C the model-facing text may differ; the driver must assert the lane CATEGORY plus the unchanged effect, keeping the 0-byte / one-deny-fact checks.',
  },
  {
    match: (f) => f === 'tests/world-factory/drivers/a5sf-pd24-surface-ledger/build-ledger.mjs',
    scope: 'FS', verdict: NEEDS,
    reason: 'generates the FS surface ledger with `typed IO_READ_DENIED / IO_WRITE_DENIED` as the onViolation promise. After the switch the generated promise would be false; it must name the native code/category.',
  },
  {
    match: (f) => f === 'tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs' || f === 'tests/kits/joint-acceptance-20261111/run-joint-acceptance.mjs',
    scope: 'FS', verdict: NEEDS,
    reason: 'live acceptance kit: a REAL fs write/read outside the ceiling must be refused IO_WRITE_DENIED / IO_READ_DENIED with zero bytes. The zero-byte and deny-fact claims must survive; the code assertion moves to the category when the FS family switches.',
  },
  {
    match: (f) => f === 'scripts/diag-call-chain.mjs',
    scope: 'FS', verdict: NEEDS,
    reason: 'diagnostic decoder keyed on the legacy refusal codes (IO_POLICY_UNSUPPORTED/IO_*); it cannot explain a native FsError refusal. Adapt the decoder to the closed categories (diagnostic coverage, not a gate).',
  },

  // ── FS-scope records that RETAIN the native sandbox code (route B keeps it)
  {
    match: (f) => f === 'tests/world-factory/m7a-real-slice.test.mjs',
    scope: 'FS', verdict: UNAFFECTED,
    reason: 'asserts FS_SANDBOX_DENIED from the REAL host fs-sandbox backend outside the workspace. Route B keeps that code where the fs-sandbox backend really denies; it only forbids a LANE-ONLY provider from claiming it. The assertion is satisfied by the ruling, not contradicted by it.',
  },
  {
    match: (f) => f === 'tests/world-factory/u6-arc-d.test.mjs',
    scope: 'FS', verdict: UNAFFECTED,
    reason: 'asserts the HOST observation policy\'s own message ("file has not been read") — the same upstream fs-observation-policy that the native path keeps. It is not the Team lane vocabulary.',
  },
  {
    match: (f) => f === 'tests/world-factory/fixtures/a5sf-boot2-row6-sample.json',
    scope: 'FS', verdict: UNAFFECTED,
    reason: 'a recorded historical boot sample (decidedBy: IO_READ_DENIED). A record of what happened is not a promise about what must happen; rewriting it would falsify evidence.',
  },

  // ── HARNESS: the compatibility instrument itself
  {
    match: (f) => f.startsWith('tests/ute-g1-fs/'),
    scope: 'HARNESS', verdict: UNAFFECTED,
    reason: 'the UTE-G1-FS corpus/harness already compares refusal CLASSES and records codes verbatim. The new closed mapping is the contract it implements; adopting it removes an ad-hoc table, it does not weaken an assertion.',
  },

  // ── PRODUCERS of the shared code vocabulary (schema, not a consumer)
  {
    match: (f) => f === 'packages/runtime/team-services/src/types.ts',
    scope: 'PRODUCER', verdict: UNAFFECTED,
    reason: 'the DECLARATION of TEAM_IO_DENIAL_CODES — the closed legacy code set the mapping classifies. It is the vocabulary\'s definition site; B+C does not change it, and the native path simply does not speak it.',
  },

  // ── assembly-time / policy-compilation refusals (not model-call FS refusals)
  {
    match: (f) => f.startsWith('packages/runtime/sandbox-provider/')
      || f.startsWith('packages/runtime/tool-admission/')
      || f.startsWith('packages/runtime/tool-dispatch/')
      || f.startsWith('packages/runtime/controlled-fs/')
      || f.startsWith('packages/runtime/member-io-policy/')
      || f.startsWith('packages/domain/')
      || f.startsWith('packages/tools/agent-state-family/')
      || f.startsWith('packages/tools/search-family/')
      || f.startsWith('packages/testkit/')
      || f === 'packages/runtime/src/plugin/live/confined-bash-tool.mjs'
      || f === 'packages/runtime/src/plugin/live/confined-terminal-tool.mjs'
      || f === 'packages/runtime/src/plugin/types.ts'
      || f === 'packages/runtime/team-services/src/product-assembly.ts'
      || f === 'packages/runtime/team-services/src/terminal.ts',
    scope: 'NON-FS', verdict: UNAFFECTED,
    reason: 'assembly-time or policy-compilation refusal (IO_POLICY_UNSUPPORTED = "this capability/policy cannot be honoured here") or another face\'s capability refusal (sandbox provider, terminal, bash, search/glob, agent-state, admission/assurance). None of them observes an FS tool\'s refusal, and the ruling is scoped per family (D4).',
  },

  // ── other-family tests (D4: no cross-family inference)
  {
    match: (f) => f.startsWith('tests/world-factory/') || f.startsWith('tests/kits/') || f.startsWith('tests/a5sf-diag/') || f.startsWith('tests/diag-call-chain/'),
    scope: 'NON-FS', verdict: UNAFFECTED,
    reason: 'bash / subprocess / terminal / search / web / jobs / skill / subagent / agent-state face, or a generic/other-family assertion. The B+C ruling is scoped to the FS family\'s four tools; families retire independently (owner D4), and no cross-family inference is made.',
  },
  {
    match: (f) => f.startsWith('packages/runtime/test/'),
    scope: 'NON-FS', verdict: UNAFFECTED,
    reason: 'other-family or policy-compilation assertion; the FS refusal surface is not what this test observes.',
  },

  // ── docs
  {
    match: (f) => f === 'docs/plans/active/alpha5-sandbox-first/TOOL-ACCEPTANCE-MATRIX.md',
    scope: 'DOC', verdict: NEEDS,
    reason: 'the acceptance matrix promises a specific model-visible/typed code (`IO_READ_DENIED`, `IO_WRITE_DENIED`, `IO_WRITE_REQUIRES_READ`) for the read/write/edit/read_image rows. Those promises are TRUE today on the old path and become false at the switch; the FS rows must be re-expressed (category + native code), and no V@B level may be lowered by the edit.',
  },
  {
    match: (f) => f === 'docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md',
    scope: 'DOC', verdict: NEEDS,
    reason: 'the register\'s "true today" FS/read_image rows quote the typed old codes. It is a living register (not a frozen record), so the FS rows must be updated at the switch rather than left claiming a code the new path no longer emits.',
  },
  {
    match: (f) => f.startsWith('docs/'),
    scope: 'DOC', verdict: UNAFFECTED,
    reason: 'a dated record, a frozen memo, a review transcript, or the ruling\'s own text. It describes the old path accurately at its date; rewriting history is forbidden and B+C does not require it.',
  },
]

/**
 * Classify one file. Fail closed: a file matched by no group becomes UNREVIEWED
 * (an explicit refusal) instead of inheriting a default.
 * @param {string} file
 * @returns {{scope: string, verdict: string, reason: string}}
 */
export function classify(file) {
  for (const group of GROUPS) {
    if (group.match(file)) return { scope: group.scope, verdict: group.verdict, reason: group.reason }
  }
  return {
    scope: 'UNREVIEWED',
    verdict: 'UNREVIEWED',
    reason: 'this file was not adjudicated by any reviewed group; add it to adjudicate.mjs before claiming compatibility',
  }
}

/** @param {string} text @returns {{file: string, line: string, source: string}} */
export function splitRow(text) {
  const first = text.indexOf(':')
  const second = text.indexOf(':', first + 1)
  return { file: text.slice(0, first), line: text.slice(first + 1, second), source: text.slice(second + 1).trim() }
}

function main() {
  const rows = readFileSync(RAW, 'utf8').split('\n').filter((line) => line.trim().length > 0)
  const files = [...new Set(rows.map((row) => splitRow(row).file))].sort()

  const perFile = files.map((file) => ({ file, ...classify(file) }))
  const unreviewed = perFile.filter((entry) => entry.verdict === 'UNREVIEWED')
  if (unreviewed.length > 0) {
    for (const entry of unreviewed) console.error(`ADJUDICATION-UNREVIEWED file=${entry.file}`)
    console.error(`ADJUDICATION-REFUSED unreviewed=${unreviewed.length} (a file with no reviewed verdict is not "unaffected")`)
    process.exitCode = 1
  }

  const byFile = new Map(perFile.map((entry) => [entry.file, entry]))
  const annotated = rows.map((row) => {
    const { file, line, source } = splitRow(row)
    const verdict = byFile.get(file)
    return `scope=${verdict.scope} verdict=${verdict.verdict} depends=${mechanismOf(source)} | ${file}:${line}: ${source}`
  })

  const header = [
    '# UTE-3 FS error-protocol — adjudicated consumer scan (2026-11-20)',
    '#',
    '# Raw pattern set and excluded directories: see scan.sh. One line per consumer row.',
    '# scope:   FS | NON-FS | PRODUCER | HANDLER | DOC | HARNESS',
    '# verdict: unaffected-by-B+C | needs-adaptation | incompatible',
    '# depends: the OLD representation mechanism the row keys on',
    '#',
    `# rows=${rows.length} files=${files.length}`,
    `# verdicts: ${['unaffected-by-B+C', 'needs-adaptation', 'incompatible', 'UNREVIEWED'].map((verdict) => `${verdict}=${perFile.filter((entry) => entry.verdict === verdict).length}`).join(' ')}`,
    `# scopes:   ${['FS', 'NON-FS', 'PRODUCER', 'HANDLER', 'DOC', 'HARNESS', 'UNREVIEWED'].map((scope) => `${scope}=${perFile.filter((entry) => entry.scope === scope).length}`).join(' ')}`,
    '#',
  ].join('\n')

  writeFileSync(join(HERE, 'consumer-scan.txt'), `${header}\n${annotated.join('\n')}\n`)

  const tsv = ['file\tscope\tverdict\treason', ...perFile.map((entry) => `${entry.file}\t${entry.scope}\t${entry.verdict}\t${entry.reason}`)].join('\n')
  writeFileSync(join(HERE, 'consumer-verdicts.tsv'), `${tsv}\n`)
  console.log(`ADJUDICATED rows=${rows.length} files=${files.length} unreviewed=${unreviewed.length}`)
  for (const verdict of ['unaffected-by-B+C', 'needs-adaptation', 'incompatible']) {
    console.log(`ADJUDICATED-VERDICT verdict=${verdict} files=${perFile.filter((entry) => entry.verdict === verdict).length}`)
  }
}

main()
