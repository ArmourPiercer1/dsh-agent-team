/**
 * a5sf-sub-contract.test.mjs — the Subprocess capability face's LAYER B
 * acceptance: the NATIVE-TOOL CONTRACT, not the permission lane.
 *
 * ZERO Host boots, ZERO ports, no DSH_HOME, no `tests/homes/**`. Every arm is
 * an in-process Cordis root over `mkdtemp` fixtures, driving the REAL product
 * route:
 *
 *    mountA5sfRealm  the product seam (`packages/runtime/team-services/src/
 *                    mount.ts`), with the `subprocess: { effective, provider,
 *                    shellClass }` install spec;
 *    real base       the PINNED `LocalSubprocessRuntime` — the service the
 *                    realm shadows, and the UNCONFINED comparison path;
 *    real module     the PINNED `@deepseek-ai/dsh-bash-local` executor, mounted
 *                    through `realm.mountNativeToolModules` INSIDE the Member's
 *                    isolated scope, so it resolves the confined face;
 *    real provider   the PRODUCT's `createConfinedProcessProvider` with the real
 *                    Landlock launcher, wrapped once by a counter that delegates.
 *
 * A real child process is created by the ADMITTED arms (the BL-16 precedent);
 * that is a process, not a Host boot. Every refusal arm measures
 * `spawns.before === spawns.after`, i.e. no process was requested.
 *
 * THE FIVE CONTRACT PROPERTIES (each arm asserts order/identity, not presence):
 *
 *   P1  argv admission boundary — where EXACTLY `SUBPROCESS_SHELL_ARGV_UNSUPPORTED`
 *       fires (shape, not body; after the absolute-program and class/program/
 *       declaration checks), with admitted dangerous-looking vectors (NUL in the
 *       body, a 200 kB body, nested quoting) and rejected benign-looking ones
 *       (a whitespace-only body).
 *   P2  program admission vs shell class — two arms that differ ONLY in the
 *       declared class, so `SUBPROCESS_SHELL_NOT_DECLARED` cannot be masked by
 *       the program allow-list and vice versa.
 *   P3  `probeNetworkDenial` shape — the ONE probe implementation, the real
 *       host's `network-destination: unsupported` row (Landlock ABI v7), and a
 *       deny lane that REFUSES TO SPAWN. The refusal reason is a CAPABILITY
 *       statement; "no transport entries" is never read as a syscall
 *       observation.
 *   P4  write-lane ordering — the refusal happens before any spawn and is
 *       attributed to the WRITE axis (`spawn:write`) even when the READ lane
 *       admits the same path; the read-axis ALLOW fact on that path is the
 *       anti-mis-attribution witness the FS face's bug class needs.
 *   P5  `confinedChildEnvironment` — what the child ACTUALLY receives:
 *       credential-shaped and `DSH_*` names dropped, ordinary names kept, spec
 *       overrides applied; and the measured divergence from upstream: the
 *       proxy overlay `scrubbedParentEnv()` applies is ABSENT, so a Node child
 *       ignores inherited proxy variables and connects directly.
 *
 * NOT DUPLICATING LAYER A: no arm here concludes "the lane refused". A deny
 * fact appears only as the ordering/attribution witness for a property this
 * layer owns. Allow/deny/ceiling/binding semantics are `a5sf-member-policy.test.ts`,
 * `a5sf-product-assembly.test.mjs` and `a5sf-bash.test.mjs`.
 *
 * NOT PROVEN HERE: OS-level network confinement (nothing in this file is
 * evidence of it — see the evidence README), a live Host preset, PTY semantics,
 * and the admitted path of the shipped `bash-local` executor (it is refused at
 * `argv[0]`; `GAP-SUB-CONTRACT-1`).
 *
 * HOST-REQUIRED, three states: absent => `A5SF-SUB-CONTRACT-HOST-REFUSED` and
 * every case registered as SKIPPED (not-run, `pass 0`); present-but-partial =>
 * hard failure; present and complete => run. `A5SF_REQUIRE_PINNED_HOST=1`
 * turns the refusal into a failure for a lane that must provision the host.
 *
 * Run: node --test tests/world-factory/a5sf-sub-contract.test.mjs
 */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import test, { after } from 'node:test'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DSH_BASELINE_VERSION, TEST_USE_BASELINE_SHA } from '../paths.mjs'
import {
  PROXY_ENV_NAMES,
  SHELL_ADMISSION_CODES,
  assertCapabilityNotMeasurement,
  installRealProxyPolicy,
  makeSubContractWorld,
  restoreAmbientEnv,
  shellDeclaration,
  snapshotAmbientEnv,
  snapshotFile,
  spawnSpec,
  subContractHostLayout,
} from './lib/a5sf-sub-contract-world.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = dirname(dirname(HERE))

const CANONICAL = Object.freeze(['/bin/bash', '-c', 'true'])
const OVERLONG_BODY = `printf ${'A'.repeat(200_000)}`
const NUL_BODY = 'printf A5SF\u0000TAIL'
const WHITESPACE_BODY = '   '
const EMPTY_BODY = ''

/** The closure shown to the model/README as a data table: the precise predicate. */
const ARGV_VECTORS = Object.freeze([
  { label: 'canonical <bash> -c <body>', argv: CANONICAL, admitted: true },
  { label: 'nested quoting / command substitution in the body', argv: ['/bin/bash', '-c', 'echo "a;b;$(id)"'], admitted: true },
  { label: 'NUL byte in the body (looks dangerous, admitted by the rule)', argv: ['/bin/bash', '-c', NUL_BODY], admitted: true },
  { label: '200 kB body (overlong, admitted by the rule)', argv: ['/bin/bash', '-c', OVERLONG_BODY], admitted: true },
  { label: 'whitespace-only body (looks benign, rejected)', argv: ['/bin/bash', '-c', WHITESPACE_BODY], admitted: false },
  { label: 'empty body (looks benign, rejected)', argv: ['/bin/bash', '-c', EMPTY_BODY], admitted: false },
  { label: '-lc (flag before -c)', argv: ['/bin/bash', '-lc', 'true'], admitted: false },
  { label: 'extra positional operand', argv: ['/bin/bash', '-c', 'true', 'extra'], admitted: false },
  { label: '-c not at argv[1]', argv: ['/bin/bash', '--', '-c', 'true'], admitted: false },
  { label: 'non-string body', argv: ['/bin/bash', '-c', null], admitted: false },
])

const HOSTED_ABI_V8_GAP_NOTE =
  'landlock ABI v8: Landlock ABI v4 mediates only TCP port bind/connect inside the domain; ' +
  'this host cannot enforce destination-level network denial for the anonymous/path socket families (PoC-4b)'
const SIMULATED_HOSTED_UNSUPPORTED = Object.freeze({
  ok: true,
  value: Object.freeze([
    Object.freeze({
      dimension: 'network-destination',
      level: 'unsupported',
      mechanism: null,
      evidence: null,
      note: HOSTED_ABI_V8_GAP_NOTE,
    }),
  ]),
})

const CASES = [
  {
    title: 'P1-ARGV-ACCEPTED-BOUNDARY: the declared shape admits quoting, NUL and a 200 kB body; none is ARGV_UNSUPPORTED',
    label: 'p1-accepted',
    options: { shellClass: { programs: ['bash'] } },
    run: armArgvAcceptedBoundary,
  },
  {
    title: 'P1-ARGV-SHAPE-REJECTED: a whitespace/empty/non-string body or a non-<-c> shape is ARGV_UNSUPPORTED with zero processes',
    label: 'p1-rejected',
    options: { shellClass: { programs: ['bash'] } },
    run: armArgvShapeRejected,
  },
  {
    title: 'P1-PRECEDENCE: absolute-program, class/program and declaration checks each refuse BEFORE the argv shape',
    label: 'p1-precedence',
    options: { shellClass: { programs: ['bash'] } },
    run: armArgvPrecedence,
  },
  {
    title: 'P2-CLASS-UNDECLARED: the SAME canonical invocation with no declared class is SHELL_NOT_DECLARED, zero processes',
    label: 'p2-undeclared',
    options: {},
    run: armClassUndeclared,
  },
  {
    title: 'P2-CLASS-DECLARED: the SAME canonical invocation with a declared class is admitted and really runs',
    label: 'p2-declared',
    options: { shellClass: { programs: ['bash'] } },
    run: armClassDeclared,
  },
  {
    title: 'P2-SHELL-PROGRAM-NOT-IN-CLASS: a shell program outside the class is PROGRAM_NOT_ADMITTED; adding it to the class admits it',
    label: 'p2-program',
    options: { shellClass: { programs: ['bash'] } },
    run: armShellProgramNotInClass,
  },
  {
    title: 'P2-NON-SHELL-PROGRAM-UNAFFECTED: a declared class never admits /bin/cat; the program allow-list still owns it',
    label: 'p2-nonshell',
    options: { shellClass: { programs: ['bash'] } },
    run: armNonShellProgramUnaffected,
  },
  {
    title: 'P3-PROBE-SHAPE (capability-paired): enforced WITH a mechanism and a realm-bound evidence row, OR unsupported WITH a note naming the ABI gap; a bare enforced is red',
    label: 'p3-probe',
    options: {},
    run: armProbeShape,
  },
  {
    // The SAME arm over the HOSTED runner's capability (Landlock ABI v8 cannot
    // enforce destination denial), injected at the provider seam: on a v7 box the
    // real probe answers `enforced`, so the refusing half would otherwise never
    // be exercised locally (2026-11-18 review).
    title: 'P3-PROBE-SHAPE (hosted capability simulated): unsupported WITH the ABI-v8 gap note, no mechanism, no evidence — and not a measurement',
    label: 'p3-probe-simulated',
    options: { capabilityOverride: SIMULATED_HOSTED_UNSUPPORTED },
    run: armProbeShape,
  },
  {
    title: 'P3-DENY-KERNEL-REFUSED (capability-paired): enforced ⇒ admitted once and refused by the KERNEL in a distinct netns; unsupported ⇒ refused BEFORE SPAWN with NETWORK_UNCONFINED_REALM and zero children',
    label: 'p3-deny',
    options: { shellClass: { programs: ['bash'] }, network: 'deny' },
    run: armNetworkDenyKernelRefused,
  },
  {
    // Case (b) end to end: the hosted ABI v8 capability, injected. The product
    // must refuse the deny lane BEFORE any process exists.
    title: 'P3-DENY-REFUSED-BEFORE-SPAWN (hosted capability simulated): NETWORK_UNCONFINED_REALM with zero provider calls and no child',
    label: 'p3-deny-simulated',
    options: { shellClass: { programs: ['bash'] }, network: 'deny', capabilityOverride: SIMULATED_HOSTED_UNSUPPORTED },
    run: armNetworkDenyKernelRefused,
  },
  {
    title: 'P4-WRITE-AXIS-ATTRIBUTION: a write outside the write lane is spawn:write/IO_WRITE_DENIED while the READ axis allows the same path',
    label: 'p4-attribution',
    options: { shellClass: { programs: ['bash'] }, laneRoots: { read: ['inside', 'outside'], write: ['inside'] } },
    run: armWriteAxisAttribution,
  },
  {
    title: 'P4-WRITE-CONTROL: widening ONLY the write lane admits the same invocation and really creates the file',
    label: 'p4-control',
    options: { shellClass: { programs: ['bash'] }, laneRoots: { read: ['inside', 'outside'], write: ['inside', 'outside'] } },
    run: armWriteControl,
  },
  {
    title: 'P4-CHMOD-WRITE-AXIS: a declared chmod outside the write lane is spawn:write and leaves mode+bytes unchanged',
    label: 'p4-chmod',
    options: { shellClass: { programs: ['bash'] }, laneRoots: { read: ['inside', 'outside'], write: ['inside'] } },
    run: armChmodWriteAxis,
  },
  {
    title: 'P5-ENV-SCRUB: the confined child drops credential-shaped and DSH_* names, keeps ordinary ones, and applies spec overrides',
    label: 'p5-scrub',
    options: { shellClass: { programs: ['bash'] } },
    run: armEnvScrub,
  },
  {
    title: 'P5-PROXY-DIVERGENCE: with a real proxy policy the unconfined child gets NODE_USE_ENV_PROXY=1 and the confined child does NOT',
    label: 'p5-proxy',
    options: { shellClass: { programs: ['bash'] } },
    run: armProxyDivergence,
  },
  {
    title: 'GEN-NATIVE-MODULE-BOUNDARY: the shipped bash-local executor reaches the confined face and is refused at argv[0]; unconfined it runs',
    label: 'gen-native',
    options: { shellClass: { programs: ['bash'] } },
    run: armNativeModuleBoundary,
  },
]

const HOST = subContractHostLayout(REPO_ROOT)
const HOST_PRESENT = existsSync(HOST.root)
const MISSING_ENTRIES = Object.entries(HOST.entries).filter(([, path]) => !existsSync(path))
const REQUIRE_HOST = process.env.A5SF_REQUIRE_PINNED_HOST === '1'
const REFUSAL_TOKEN = 'A5SF-SUB-CONTRACT-HOST-REFUSED'

const REFUSAL = [
  REFUSAL_TOKEN,
  'schema=a5sf-host-refusal/1',
  'refused=1',
  `skipped=${CASES.length}`,
  `cases=${CASES.length}`,
  'verdict=NOT_RUN',
  `pinned=${TEST_USE_BASELINE_SHA}`,
  `baseline=${DSH_BASELINE_VERSION}`,
  `path=${HOST.root}`,
  'reason=pinned-host-not-provisioned',
].join(' ')

if (!HOST_PRESENT) {
  if (REQUIRE_HOST) {
    throw new Error(
      `A5SF-SUB-CONTRACT-HOST-INCOMPLETE: A5SF_REQUIRE_PINNED_HOST=1 but the pinned host is absent at ${HOST.root} — ` +
      `provision tests/deepseek-harness-test-use at ${TEST_USE_BASELINE_SHA} (${DSH_BASELINE_VERSION}) and build it, ` +
      'or unset A5SF_REQUIRE_PINNED_HOST to accept the declared refusal',
    )
  }
  process.stdout.write(`${REFUSAL}\n`)
  for (const testCase of CASES) {
    test(`${testCase.title} — REFUSED (pinned host not provisioned)`, (t) => {
      t.skip(`A5SF host requirement: ${testCase.label} needs the pinned baseline's built lib/ entries. ${REFUSAL}`)
    })
  }
} else if (MISSING_ENTRIES.length > 0) {
  throw new Error(
    'A5SF-SUB-CONTRACT-HOST-INCOMPLETE: the pinned host tree exists at ' +
    `${HOST.root} but is missing ${MISSING_ENTRIES.map(([name, path]) => `${name}=${path}`).join(', ')} — ` +
    `a partial or older host is a pin violation (expected ${TEST_USE_BASELINE_SHA} / ${DSH_BASELINE_VERSION}, built)`,
  )
} else {
  const worlds = []
  after(async () => {
    for (const world of worlds) await world.dispose()
  })

  async function withWorld(label, options, body) {
    const world = await makeSubContractWorld({ repoRoot: REPO_ROOT, label, ...options })
    worlds.push(world)
    try {
      await body(world)
    } finally {
      await world.dispose()
      worlds.splice(worlds.indexOf(world), 1)
    }
  }

  for (const testCase of CASES) {
    test(testCase.title, () => withWorld(testCase.label, testCase.options, testCase.run))
  }
}

// ---------------------------------------------------------------------------
// P1 — the argv admission boundary
// ---------------------------------------------------------------------------

function armArgvAcceptedBoundary(world) {
  const { shellClassAdmissionRefusal } = world.seams.subprocess
  const admission = { programs: ['bash'] }
  for (const vector of ARGV_VECTORS.filter((candidate) => candidate.admitted)) {
    const refusal = shellClassAdmissionRefusal({ argv: vector.argv, shell: shellDeclaration() }, admission)
    assert.equal(refusal, undefined, `${vector.label} must be admitted by the declared rule, got ${refusal?.code}`)
  }

  // The same vectors through the PRODUCT face: an admitted one reaches the real
  // provider (a process is requested); none of them is refused as ARGV_UNSUPPORTED.
  const admitted = [CANONICAL, ['/bin/bash', '-c', 'echo "a;b;$(id)"'], ['/bin/bash', '-c', NUL_BODY], ['/bin/bash', '-c', OVERLONG_BODY]]
  return (async () => {
    for (const argv of admitted) {
      const spawned = await world.spawn(spawnSpec({ argv, cwd: world.fixtures.inside, shell: shellDeclaration() }))
      assert.equal(spawned.code === SHELL_ADMISSION_CODES.argvUnsupported, false, `${JSON.stringify(argv)} must not be ARGV_UNSUPPORTED`)
      assert.equal(spawned.after, spawned.before + 1, `${JSON.stringify(argv)} must reach the provider (the rule admits it)`)
    }
  })()
}

async function armArgvShapeRejected(world) {
  const rejected = ARGV_VECTORS.filter((vector) => vector.admitted === false)
  for (const vector of rejected) {
    const beforeFacts = world.facts.length
    const spawned = await world.spawn(spawnSpec({ argv: vector.argv, cwd: world.fixtures.inside, shell: shellDeclaration() }))
    assert.equal(spawned.code, SHELL_ADMISSION_CODES.argvUnsupported, `${vector.label} must be ${SHELL_ADMISSION_CODES.argvUnsupported}, got ${spawned.code}`)
    assert.equal(spawned.after, spawned.before, `${vector.label} must not request a process`)
    assert.equal(spawned.after, 0, 'no refused vector may have started a process')
    const newFacts = world.facts.slice(beforeFacts)
    assert.equal(newFacts.length, 1, `${vector.label} must record exactly one fact`)
    assert.equal(newFacts[0].method, 'spawn')
    assert.equal(newFacts[0].decision, 'deny')
    assert.equal(newFacts[0].locator, '/bin/bash')
  }
}

async function armArgvPrecedence(world) {
  // 1. The absolute-program check runs BEFORE the shell gate: a bare `bash`
  //    (what the shipped executor emits) is PROGRAM_NOT_ABSOLUTE, not a shell code.
  const relative = await world.spawn(spawnSpec({ argv: ['bash', '-c', 'true'], cwd: world.fixtures.inside, shell: shellDeclaration() }))
  assert.equal(relative.code, 'SUBPROCESS_PROGRAM_NOT_ABSOLUTE', `got ${relative.code}`)
  assert.equal(relative.after, 0)

  // 2. A non-shell program is judged by the program allow-list, never by the
  //    argv shape: /bin/cat is IO_READ_DENIED even though a class is declared.
  const nonShell = await world.spawn(spawnSpec({ argv: ['/bin/cat', world.fixtures.inLane], cwd: world.fixtures.inside }))
  assert.equal(nonShell.code, 'IO_READ_DENIED', `got ${nonShell.code}`)
  assert.notEqual(nonShell.code, SHELL_ADMISSION_CODES.argvUnsupported)
  assert.equal(nonShell.after, 0)

  // 3. The declared-program check runs BEFORE the argv shape: a shell program
  //    outside the class is PROGRAM_NOT_ADMITTED even with a malformed argv.
  const outsideClass = await world.spawn(spawnSpec({
    argv: ['/bin/dash', '-lc', 'true'],
    cwd: world.fixtures.inside,
    shell: shellDeclaration({ program: 'dash' }),
  }))
  assert.equal(outsideClass.code, SHELL_ADMISSION_CODES.programNotAdmitted, `got ${outsideClass.code}`)
  assert.equal(outsideClass.after, 0)

  // 4. A declaration naming ANOTHER program is PROGRAM_NOT_ADMITTED, before shape.
  const mismatch = await world.spawn(spawnSpec({
    argv: ['/bin/bash', '-lc', 'true'],
    cwd: world.fixtures.inside,
    shell: shellDeclaration({ program: 'dash' }),
  }))
  assert.equal(mismatch.code, SHELL_ADMISSION_CODES.programNotAdmitted, `got ${mismatch.code}`)
  assert.equal(mismatch.after, 0)
}

// ---------------------------------------------------------------------------
// P2 — program admission vs shell class (the two arms differ ONLY in class)
// ---------------------------------------------------------------------------

async function armClassUndeclared(world) {
  const spec = spawnSpec({
    argv: ['/bin/bash', '-c', 'cat in-lane.txt'],
    cwd: world.fixtures.inside,
    shell: shellDeclaration({ reads: [world.fixtures.inLane] }),
  })
  const spawned = await world.spawn(spec)
  assert.equal(spawned.code, SHELL_ADMISSION_CODES.notDeclared, `got ${spawned.code}`)
  assert.equal(spawned.after, 0, 'a realm that declares no shell class must not request a process')
  assert.equal(world.facts.length, 1)
  assert.equal(world.facts[0].method, 'spawn')
  assert.equal(world.facts[0].decision, 'deny')
  assert.equal(world.facts[0].decidedBy, 'IO_READ_DENIED')
  assert.equal(world.facts[0].locator, '/bin/bash')
}

async function armClassDeclared(world) {
  const spec = spawnSpec({
    argv: ['/bin/bash', '-c', 'cat in-lane.txt'],
    cwd: world.fixtures.inside,
    shell: shellDeclaration({ reads: [world.fixtures.inLane] }),
  })
  const spawned = await world.spawn(spec)
  assert.equal(spawned.error, undefined, `the identical invocation must be admitted with the class: ${String(spawned.error)}`)
  assert.equal(spawned.after, 1)
  assert.equal(spawned.text, 'IN-LANE-SUBPROCESS-BYTES\n')
  assert.equal(world.facts.length, 1)
  assert.equal(world.facts[0].decision, 'allow')
}

async function armShellProgramNotInClass(world) {
  const refused = await world.spawn(spawnSpec({
    argv: ['/bin/dash', '-c', 'printf DASH-REFUSED'],
    cwd: world.fixtures.inside,
    shell: shellDeclaration({ program: 'dash' }),
  }))
  assert.equal(refused.code, SHELL_ADMISSION_CODES.programNotAdmitted, `got ${refused.code}`)
  assert.equal(refused.after, 0)

  // The SAME call in a realm that declares dash as well: the class is the only
  // difference, so the prior refusal was the class membership, not the program.
  const widened = await makeSubContractWorld({ repoRoot: REPO_ROOT, label: 'p2-program-widened', shellClass: { programs: ['bash', 'dash'] } })
  try {
    const admitted = await widened.spawn(spawnSpec({
      argv: ['/bin/dash', '-c', 'printf DASH-ADMITTED'],
      cwd: widened.fixtures.inside,
      shell: shellDeclaration({ program: 'dash' }),
    }))
    assert.equal(admitted.error, undefined, `dash must be admitted once declared: ${String(admitted.error)}`)
    assert.equal(admitted.after, 1)
    assert.equal(admitted.text, 'DASH-ADMITTED')
  } finally {
    await widened.dispose()
  }
}

async function armNonShellProgramUnaffected(world) {
  const spawned = await world.spawn(spawnSpec({ argv: ['/bin/cat', world.fixtures.inLane], cwd: world.fixtures.inside }))
  assert.equal(spawned.code, 'IO_READ_DENIED', `got ${spawned.code}`)
  assert.notEqual(spawned.code, SHELL_ADMISSION_CODES.notDeclared)
  assert.notEqual(spawned.code, SHELL_ADMISSION_CODES.programNotAdmitted)
  assert.notEqual(spawned.code, SHELL_ADMISSION_CODES.argvUnsupported)
  assert.equal(spawned.after, 0)
}

// ---------------------------------------------------------------------------
// P3 — the network capability probe, and the deny path that refuses
// ---------------------------------------------------------------------------

/**
 * The HOSTED RUNNER's capability, verbatim from the 2026-11-18 L2 run on
 * `b87adf358` (GitHub Actions, run 44343691531, step "B4/1 subprocess boundary"):
 *
 *   probe note: landlock ABI v8: Landlock ABI v4 mediates only TCP port
 *   bind/connect inside the domain; ...
 *
 * Its kernel's Landlock cannot enforce destination-level network denial, so the
 * product probe answers `unsupported` and the deny lane REFUSES TO SPAWN
 * (`NETWORK_UNCONFINED_REALM`). A developer box answers `enforced` and the child
 * runs inside a distinct netns. Both are CORRECT answers to different hosts, so
 * these arms assert the PAIRING, never one host's capability. The constant below
 * is the hosted shape, injected at the provider seam to prove the refusal path
 * on a box whose own ABI is v7.
 */

/**
 * The pairing itself, in one place so both P3 arms read the same rule:
 * `enforced` requires a mechanism AND a realm-bound evidence row; `unsupported`
 * requires a note that NAMES the capability gap. Anything else — including a
 * bare `enforced` — is red.
 */
function assertCapabilityPairing(capability, at) {
  assert.equal(capability.dimension, 'network-destination', `${at}: the capability is about network-destination`)
  assert.ok(['enforced', 'unsupported'].includes(capability.level), `${at}: the probe must answer enforced|unsupported, got ${JSON.stringify(capability.level)}`)
  assert.ok(String(capability.note ?? '').trim() !== '', `${at}: a capability answer always carries its note — an empty note is a silent unknown`)
  if (capability.level === 'enforced') {
    assert.match(String(capability.mechanism), /netns/u, `${at}: enforced must name the mechanism (got ${String(capability.mechanism)})`)
    assert.match(String(capability.evidence), /^evidence:\/\//u, `${at}: enforced must carry a bound evidence reference (got ${String(capability.evidence)})`)
    const row = (capability.rows ?? []).find((candidate) => candidate.dimension === 'network-destination')
    assert.ok(row !== undefined, `${at}: enforced must return the network-destination row`)
    assert.notEqual(row.mechanism, null, `${at}: a row without a mechanism is not evidence`)
    assert.notEqual(row.evidence, null, `${at}: a row without an evidence reference is not evidence`)
    assert.match(String(row.realmId), /^realm-a5sf-sub-contract/u, `${at}: the evidence row is bound to THIS realm`)
    assert.match(String(row.trustRoot), /^sha256:[0-9a-f]{16}#/u, `${at}: the evidence row is bound to the launcher trust root`)
  } else {
    assert.equal(capability.mechanism, null, `${at}: "unsupported" cannot carry a mechanism (that would be a contradiction)`)
    assert.equal(capability.evidence, null, `${at}: "unsupported" cannot carry an evidence reference`)
    assert.match(
      String(capability.note),
      /landlock ABI v\d+|does not mediate|only TCP port bind\/connect|not enforce/iu,
      `${at}: "unsupported" must name the capability GAP in its note (got ${JSON.stringify(String(capability.note).slice(0, 120))})`,
    )
  }
  return capability.level
}

async function armProbeShape(world) {
  const { probeNetworkDenial } = world.seams.subprocess
  const { network } = world.seams

  // CAPABILITY-PAIRED (2026-11-18 review). This arm used to pin ONE host's
  // answer (`enforced`), which is red on a runner whose Landlock cannot enforce
  // destination denial. The CONTRACT is the pairing: `enforced` with a mechanism
  // and a realm-bound evidence row, OR `unsupported` with a note that names the
  // gap. Both are honest observations; `enforced` with no mechanism, a silent
  // unknown, and an empty note are not.
  const probe = await probeNetworkDenial(world.counted.provider)
  const capability = assertCapabilityPairing(probe, 'P3-PROBE-SHAPE')
  if (capability === 'enforced') {
    assert.match(String(probe.rows.find((candidate) => candidate.dimension === 'network-destination').note), /NET-DENY-CONFIRMED/, 'the note is the MEASUREMENT the row is based on')
    assert.match(String(probe.rows.find((candidate) => candidate.dimension === 'network-destination').note), /listener counter unchanged/)
  } else {
    // The hosted shape: the probe is a CAPABILITY GAP, never a measurement.
    assert.match(String(probe.note), /landlock ABI|does not mediate|not enforce/iu)
  }

  // The shipped gate agrees, on the face that measured it: a face-bound PROOF
  // admits on its own face, and a bare level still does not (PD-15 added the face).
  const noProof = network.evaluateNetworkRequirement('deny', 'realm-a5sf-sub-contract')
  assert.equal(noProof.ok, false)
  assert.equal(noProof.error.code, 'IO_POLICY_UNSUPPORTED')
  assert.match(String(noProof.error.message), /no provider in this lane demonstrates full network deny/)
  const proved = network.evaluateNetworkRequirement('deny', 'realm-a5sf-sub-contract', { face: 'subprocess', mechanism: 'netns', evidence: 'evidence://x/1', netNsInode: 1, hostNetNsInode: 2 }, 'subprocess')
  assert.equal(proved.ok, true)
  const gateRow = network.networkProbeRow(7, 'realm-a5sf-sub-contract')
  assert.equal(gateRow.dimension, 'network-destination')
  assert.equal(gateRow.level, 'unsupported')
  assert.match(String(gateRow.note), /landlock ABI v7/)
  assert.equal(gateRow.mechanism, null)

  // ABSENCE IS NOT A MEASUREMENT. No probe, a refusing probe, and a probe with
  // no network row are all "enforcement cannot be proven" — never "zero
  // transport entries were observed".
  const noProbe = await probeNetworkDenial({})
  assert.equal(noProbe.level, 'unsupported')
  assert.match(noProbe.note, /exposes no capability probe/)
  assert.equal(noProbe.rows.length, 0)

  const refusedProbe = await probeNetworkDenial({ probe: async () => ({ ok: false, error: { code: 'PROBE_REFUSED', message: 'no' } }) })
  assert.equal(refusedProbe.level, 'unsupported')
  assert.match(refusedProbe.note, /refused \(PROBE_REFUSED\)/)

  const missingRow = await probeNetworkDenial({ probe: async () => ({ ok: true, value: [] }) })
  assert.equal(missingRow.level, 'unsupported')
  assert.match(missingRow.note, /reported no network-destination capability row/)

  const throwingProbe = await probeNetworkDenial({ probe: async () => { throw new Error('probe exploded') } })
  assert.equal(throwingProbe.level, 'unsupported')
  assert.match(throwingProbe.note, /threw/)

  // BL-42: a bare `enforced` LEVEL is not evidence either.
  // THIRD CASE: a fabricated `enforced` is RED. A level with no mechanism and no
  // evidence reference is intent, not an observation — the exact shape the
  // pre-BL-42 product returned, and the shape a lazy probe would return.
  const bareLevel = await probeNetworkDenial({ probe: async () => ({ ok: true, value: [{ dimension: 'network-destination', level: 'enforced', note: 'trust me' }] }) })
  assert.equal(bareLevel.level, 'unsupported')
  assert.match(bareLevel.note, /NO mechanism/)

  for (const candidate of [probe, noProbe, refusedProbe, missingRow, throwingProbe, bareLevel]) {
    assertCapabilityNotMeasurement(candidate.note, 'a probe note')
  }
}

async function armNetworkDenyKernelRefused(world) {
  assert.equal(world.effective.network.access, 'deny', 'the lane under test must request network=deny')
  const { probeNetworkDenial } = world.seams.subprocess
  // The capability this world's provider reports decides which of the TWO named
  // outcomes is the correct one. Both are contract; neither is "either passes":
  // `unsupported` MUST refuse before spawn, `enforced` MUST admit and be refused
  // by the kernel. A network=deny lane is never silently allowed (that is what
  // the refusal code and the spawn counter below are for).
  const capability = await probeNetworkDenial(world.counted.provider)
  const level = assertCapabilityPairing(capability, 'P3-DENY-KERNEL-REFUSED')
  // The command reports the namespace it ACTUALLY runs in and whether the
  // loopback is reachable at all in it. The claim being tested is that the OS,
  // not the admission layer, is now the boundary.
  const spawned = await world.spawn(spawnSpec({
    argv: ['/bin/bash', '-c', "python3 -c \"import os,socket;s=socket.socket();s.settimeout(2);print('NS',os.stat('/proc/self/ns/net').st_ino)\ntry:\n s.connect(('127.0.0.1',9));print('CONNECTED')\nexcept OSError as e:print('ERR',e.errno,e.strerror)\""],
    cwd: world.fixtures.inside,
    shell: shellDeclaration(),
  }))
  if (level === 'unsupported') {
    // (b) REFUSED BEFORE SPAWN. The product saw a capability gap and declined to
    // run a network-capable child under a deny claim this host cannot enforce.
    assert.equal(spawned.code, 'NETWORK_UNCONFINED_REALM', `an unsupported capability must refuse by name, got ${String(spawned.code)}`)
    assert.match(String(spawned.error?.message ?? ''), /NETWORK_UNCONFINED_REALM/u, 'the refusal is typed, not narrated')
    assert.equal(spawned.after, spawned.before, 'no provider spawn may happen before the refusal')
    assert.equal(spawned.after, 0, 'no child process was ever requested (the selector never ran)')
    assert.equal(spawned.text, undefined, 'nothing ran, so nothing spoke')
    assert.match(String(capability.note), /landlock ABI|does not mediate|not enforce/iu, 'the refusal is explained by the capability note')
    return
  }
  // (a) ADMITTED, then refused by the KERNEL in a distinct netns.
  assert.equal(spawned.error, undefined, `the deny lane must now be admitted: ${spawned.code ?? ''}`)
  assert.equal(spawned.after - spawned.before, 1, 'exactly one provider spawn')
  const text = String(spawned.text ?? '')
  assert.match(text, /^NS \d+$/m, `the child must report the namespace it ran in: ${text}`)
  const childNs = Number(/^NS (\d+)$/m.exec(text)?.[1] ?? NaN)
  assert.ok(Number.isFinite(childNs), `unparsable namespace line: ${text}`)
  assert.match(text, /ERR (101|111|113) /, `the child's own attempt must carry a kernel errno: ${text}`)
}
async function armWriteAxisAttribution(world) {
  const beforeFacts = world.facts.length
  const before = snapshotFile(world.fixtures.outsideCreated)
  const spawned = await world.spawn(spawnSpec({
    argv: ['/bin/bash', '-c', 'printf A5SF > created.txt'],
    cwd: world.fixtures.outside,
    shell: shellDeclaration({ reads: [world.fixtures.outside], writes: [world.fixtures.outsideCreated] }),
  }))
  assert.equal(spawned.code, 'IO_WRITE_DENIED', `got ${spawned.code}`)
  assert.equal(spawned.after, spawned.before, 'the write refusal must precede any provider call')
  assert.equal(spawned.after, 0)

  const newFacts = world.facts.slice(beforeFacts)
  assert.deepEqual(newFacts.map((fact) => [fact.method, fact.decision, fact.locator]), [
    // The READ axis ADMITTED the very directory the write lives under. If the
    // refusal had come from that axis, this fact would be a deny (or absent).
    ['spawn', 'allow', world.fixtures.outside],
    ['spawn:write', 'deny', world.fixtures.outsideCreated],
  ])
  assert.equal(newFacts[1].decidedBy, 'IO_WRITE_DENIED')
  assert.deepEqual(snapshotFile(world.fixtures.outsideCreated), before, 'a refused write must not create the file')
}

async function armWriteControl(world) {
  const beforeFacts = world.facts.length
  const spawned = await world.spawn(spawnSpec({
    argv: ['/bin/bash', '-c', 'printf A5SF > created.txt'],
    cwd: world.fixtures.outside,
    shell: shellDeclaration({ reads: [world.fixtures.outside], writes: [world.fixtures.outsideCreated] }),
  }))
  assert.equal(spawned.error, undefined, `the same call must be admitted once the write lane covers it: ${String(spawned.error)}`)
  assert.equal(spawned.after, 1)
  const newFacts = world.facts.slice(beforeFacts)
  assert.deepEqual(newFacts.map((fact) => [fact.method, fact.decision]), [['spawn', 'allow'], ['spawn:write', 'allow']])
  assert.equal(snapshotFile(world.fixtures.outsideCreated).bytes, 'A5SF')
}

async function armChmodWriteAxis(world) {
  const before = snapshotFile(world.fixtures.outsideSecret)
  const spawned = await world.spawn(spawnSpec({
    argv: ['/bin/bash', '-c', 'chmod 600 secret.txt'],
    cwd: world.fixtures.outside,
    shell: shellDeclaration({ reads: [world.fixtures.outside], chmod: [world.fixtures.outsideSecret] }),
  }))
  assert.equal(spawned.code, 'IO_WRITE_DENIED', `got ${spawned.code}`)
  assert.equal(spawned.after, 0)
  const writeFacts = world.facts.filter((fact) => fact.method === 'spawn:write')
  assert.equal(writeFacts.length, 1)
  assert.equal(writeFacts[0].decision, 'deny')
  assert.equal(writeFacts[0].decidedBy, 'IO_WRITE_DENIED')
  assert.deepEqual(snapshotFile(world.fixtures.outsideSecret), before, 'mode and bytes must be unchanged')
}

// ---------------------------------------------------------------------------
// P5 — the child environment (and the measured proxy divergence)
// ---------------------------------------------------------------------------

const ENV_PROBE_COMMAND = [
  'printf "VIS=%s\\nSEC=%s\\nDSH=%s\\nDSHL=%s\\nNODE=%s\\nHTTP=%s\\n"',
  '"$A5SF_VISIBLE" "$A5SF_SECRET_TOKEN" "$DSH_HOME" "${dsh_lower-}" "${NODE_USE_ENV_PROXY-}" "${HTTP_PROXY-}"',
].join(' ')

function parseEnvOutput(text) {
  const parsed = {}
  for (const line of String(text ?? '').split('\n')) {
    const at = line.indexOf('=')
    if (at === -1) continue
    parsed[line.slice(0, at)] = line.slice(at + 1)
  }
  return parsed
}

function setMarkerEnv() {
  process.env.A5SF_VISIBLE = 'visible-value'
  process.env.A5SF_SECRET_TOKEN = 'secret-value'
  process.env.DSH_HOME = '/should/never/leak'
  process.env.dsh_lower = 'lower-value'
}

async function armEnvScrub(world) {
  const snapshot = snapshotAmbientEnv()
  try {
    for (const name of PROXY_ENV_NAMES) Reflect.deleteProperty(process.env, name)
    setMarkerEnv()
    const confined = await world.spawn(spawnSpec({
      argv: ['/bin/bash', '-c', ENV_PROBE_COMMAND],
      cwd: world.fixtures.inside,
      shell: shellDeclaration(),
    }))
    assert.equal(confined.error, undefined, `the env probe must be admitted: ${String(confined.error)}`)
    const confinedEnv = parseEnvOutput(confined.text)
    assert.equal(confinedEnv.VIS, 'visible-value', 'an ordinary variable is preserved')
    assert.equal(confinedEnv.SEC, '', 'a credential-shaped name is dropped')
    assert.equal(confinedEnv.DSH, '', 'DSH_* is dropped')
    assert.equal(confinedEnv.DSHL, '', 'a lowercase dsh_* name is dropped (case-insensitive)')
    assert.equal(confinedEnv.NODE, '', 'no proxy policy is active, so no proxy flag is injected')

    const unconfined = await world.spawnBase(spawnSpec({ argv: ['/bin/bash', '-c', ENV_PROBE_COMMAND], cwd: world.fixtures.inside }))
    assert.equal(unconfined.error, undefined, `the unconfined control must run: ${String(unconfined.error)}`)
    const unconfinedEnv = parseEnvOutput(unconfined.text)
    assert.deepEqual(unconfinedEnv, confinedEnv, 'without a proxy policy the two scrubs must agree')

    // The spec's explicit entries layer AFTER the scrub: a string is a
    // deliberate opt-in and `undefined` is a tombstone that removes a name the
    // scrub had preserved.
    const overridden = await world.spawn(spawnSpec({
      argv: ['/bin/bash', '-c', ENV_PROBE_COMMAND],
      cwd: world.fixtures.inside,
      shell: shellDeclaration(),
      env: { A5SF_SECRET_TOKEN: 'deliberate-opt-in', A5SF_VISIBLE: undefined },
    }))
    assert.equal(overridden.error, undefined, `the override probe must be admitted: ${String(overridden.error)}`)
    const overrideEnv = parseEnvOutput(overridden.text)
    assert.equal(overrideEnv.SEC, 'deliberate-opt-in', 'an explicit spec entry survives the scrub')
    assert.equal(overrideEnv.VIS, '', 'an explicit undefined is a tombstone')
  } finally {
    restoreAmbientEnv(snapshot)
  }
}

async function armProxyDivergence(world) {
  const snapshot = snapshotAmbientEnv()
  let dispose
  try {
    for (const name of PROXY_ENV_NAMES) Reflect.deleteProperty(process.env, name)
    setMarkerEnv()
    const userEnv = { HTTP_PROXY: 'http://user-proxy.example:8080', HTTPS_PROXY: 'http://user-proxy.example:8080' }
    dispose = await installRealProxyPolicy(world.seams, userEnv)

    // The direct helper comparison first: the pinned upstream scrub carries the
    // overlay, the Team scrub does not.
    const upstreamEnv = world.seams.upstream.scrubbedParentEnv()
    const teamEnv = world.seams.subprocess.confinedChildEnvironment(undefined)
    assert.equal(upstreamEnv.NODE_USE_ENV_PROXY, '1', 'the pinned upstream scrub must carry the proxy flag')
    assert.equal('NODE_USE_ENV_PROXY' in teamEnv, false, 'the Team scrub has no proxy overlay')
    assert.equal(teamEnv.HTTP_PROXY, 'http://user-proxy.example:8080', 'the published proxy names still reach the Team child')

    // Then the REAL children: same command, same ambient process, one confined
    // and one not.
    const confined = await world.spawn(spawnSpec({ argv: ['/bin/bash', '-c', ENV_PROBE_COMMAND], cwd: world.fixtures.inside, shell: shellDeclaration() }))
    assert.equal(confined.error, undefined, `the confined env probe must be admitted: ${String(confined.error)}`)
    const unconfined = await world.spawnBase(spawnSpec({ argv: ['/bin/bash', '-c', ENV_PROBE_COMMAND], cwd: world.fixtures.inside }))
    assert.equal(unconfined.error, undefined, `the unconfined env probe must run: ${String(unconfined.error)}`)

    const confinedEnv = parseEnvOutput(confined.text)
    const unconfinedEnv = parseEnvOutput(unconfined.text)
    assert.equal(unconfinedEnv.NODE, '1', 'the UNCONFINED child receives NODE_USE_ENV_PROXY=1 from the upstream overlay')
    assert.equal(confinedEnv.NODE, '', 'the CONFINED child does NOT receive the overlay')
    assert.equal(confinedEnv.HTTP, 'http://user-proxy.example:8080', 'both children still see the published proxy name')
    assert.equal(unconfinedEnv.HTTP, 'http://user-proxy.example:8080')
    assert.equal(confinedEnv.SEC, '', 'the confined scrub still drops credentials')
    assert.equal(unconfinedEnv.SEC, '')
  } finally {
    if (dispose !== undefined) await dispose()
    restoreAmbientEnv(snapshot)
  }
}

// ---------------------------------------------------------------------------
// The real native module boundary (GAP-SUB-CONTRACT-1 evidence)
// ---------------------------------------------------------------------------

async function armNativeModuleBoundary(world) {
  const { Context, subprocessLocal, bashLocal } = world.seams
  assert.equal(world.nativeFibers.length, 1, 'the real bash-local module must mount inside the Member scope')
  assert.ok(world.shell !== undefined, 'the mounted executor must be reachable as ctx.shell')
  assert.equal(typeof world.shell.execute, 'function')

  const refused = await world.shell.execute({ command: 'cat in-lane.txt', workdir: world.fixtures.inside, timeoutMs: 2_000 })
    .then((handle) => handle.result().then((value) => ({ value }), (error) => ({ error })))
  assert.ok(refused.error !== undefined, 'the shipped executor must be refused by the confined face')
  assert.equal(refused.error.code, 'SUBPROCESS_PROGRAM_NOT_ABSOLUTE', `got ${refused.error.code}`)
  assert.match(String(refused.error.message), /must be an absolute executable path/)
  assert.equal(world.counted.spawns.count, 0, 'the refused executor must not reach the provider')

  // The SAME executor, same package, on an UNCONFINED root: it runs. So the
  // refusal is the confined face's absolute-program rule, not a broken module.
  const bare = new Context()
  try {
    await bare.plugin(subprocessLocal.default ?? subprocessLocal)
    await bare.plugin(bashLocal.default ?? bashLocal, { cwd: world.fixtures.inside })
    const shell = bare.get('shell')
    const handle = await shell.execute({ command: 'cat in-lane.txt', workdir: world.fixtures.inside, timeoutMs: 2_000 })
    const outcome = await handle.result()
    assert.equal(outcome.exitCode, 0)
    assert.equal(outcome.stdout.text, 'IN-LANE-SUBPROCESS-BYTES\n')
  } finally {
    await bare.dispose?.()
  }
}
