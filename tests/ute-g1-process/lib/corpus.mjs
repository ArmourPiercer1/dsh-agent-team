/**
 * corpus.mjs — the G1-PROCESS golden-vector corpus (the `bash` member).
 *
 * One vector = one declared lane + one fixture pre-state + one invocation + the
 * claims the old path must satisfy. The corpus is executed by
 * `capture-old-path.mjs` through the PRODUCT route-C composition (see
 * `lib/world.mjs`) and recorded into `golden/old-path.tsv`.
 *
 * `entry` is the member that produced the effect (`bash`), so the retirement
 * unit's member coverage is machine-derivable from the fixture's `entry` column
 * (see scripts/ute-retirement-gate.mjs).
 *
 * THE UNIT IS TWO MEMBERS AND THIS CORPUS COVERS ONE. The census books
 * `dsh.process-family` → `bash` + `pwsh`; `pwsh` is NOT reachable on the product
 * route and has no binary on this machine, and that is a PRINTED exclusion
 * (`PROBE-PWSH` / `PROBE-ROUTE-UNREACHABLE` in
 * dev/agent-workflow/evidence/ute3-process-b1-20261120/composition-probe.txt),
 * not a skip. A corpus that quietly ignored a member would be the under-claim
 * the retirement gate refuses (`UTE_MEMBER_UNCOVERED`).
 *
 * `expect` is the DESIGN CLAIM, checked against the captured old path: a claim
 * the old path does not satisfy is a CORPUS BUG (reported RED), never a green.
 * It is never checked against the tool's own prose — see
 * `lib/effect-oracle.mjs` for the witnesses each field is derived from.
 *
 * COVERAGE, and the gaps stated:
 *   in-lane deterministic stdout, exit-code propagation, stderr capture, the
 *   stdout byte cap (tail retention), a timeout that really kills the payload,
 *   cancellation before dispatch, the DECLARED-root lane denial (workdir), the
 *   OS-enforced out-of-lane read and write, the published environment scrub,
 *   stdin being ignored, a missing workdir, and a closed-schema argument
 *   refusal.
 *   NOT covered: the governed PTY/persistent-`bash` face (a composition that
 *   wires `faces.terminals` selects `native-bash-tool.mjs` instead — NOT mounted
 *   by the shipped product wiring, measured in the composition probe), a
 *   background job arm, mid-command cancellation (only pre-dispatch), the
 *   network axis, `pwsh` (unreachable), and any LIVE boot.
 *
 * @module tests/ute-g1-process/lib/corpus
 */

/** The secret token planted outside the lane (never a real credential). */
export const PROCESS_SECRET = 'UTE3_PROCESS_OUTLANE_SECRET_9d2f'
/** The token printed inside the lane. */
export const PROCESS_NEEDLE = 'UTE3_PROCESS_INLANE_NEEDLE'
/** The ambient environment name that MUST be scrubbed (matches the SECRET law). */
export const PROCESS_SECRET_ENV = 'UTE3_PROCESS_SECRET'
/** A second ambient name, scrubbed by the `DSH_*` law rather than the credential one. */
export const PROCESS_DSH_ENV = 'DSH_UTE3_PROCESS_LEAK'

/** The agent's cwd token (resolved by the harness to an absolute path). */
const CWD = 'inside'
/** Lane tokens are resolved to absolute paths by each harness. */
const INSIDE = ['inside']
const BOUND = ['inside/bound']

/** 300 000 bytes: above the tool's declared 256 KiB stdout cap (1 << 18). */
const BIG_OUTPUT = 'aaa'
/** The marker the tail-retention claim rests on (present only at the very end). */
const BIG_TAIL = 'UTE3_PROCESS_TAIL_MARKER'

/** The command builder for the byte-cap arm: 300 000 `a`s then the tail marker. */
const BIG_COMMAND = `printf '%300000s' '' | tr ' ' a; printf '${BIG_TAIL}'`

export const CORPUS = Object.freeze([
  {
    id: 'PB-B1-inlane-stdout',
    entry: 'bash',
    cwd: CWD,
    lane: { read: INSIDE, write: INSIDE },
    setup: [{ op: 'writeFile', path: 'inside/a.txt', content: `${PROCESS_NEEDLE} alpha\n` }],
    steps: [{ tool: 'bash', args: { command: 'printf "one\\ntwo\\n"; cat a.txt', description: 'print two lines then read the in-lane file' } }],
    expect: {
      outcome: 'allow',
      refusal: null,
      exit: 0,
      timedOut: false,
      stdout: `one\ntwo\n${PROCESS_NEEDLE} alpha\n`,
      fsUnchanged: true,
    },
    note: 'a deterministic in-lane command: the child reads a file INSIDE the declared lane through the OS profile and returns its bytes; the fixture tree is untouched',
  },
  {
    id: 'PB-B2-exit-code',
    entry: 'bash',
    cwd: CWD,
    lane: { read: INSIDE, write: INSIDE },
    setup: [],
    steps: [{ tool: 'bash', args: { command: 'exit 7', description: 'exit with a non-zero status' } }],
    expect: { outcome: 'allow', refusal: null, exit: 7, timedOut: false, stdout: '', fsUnchanged: true },
    note: 'a non-zero exit is DATA on this path (the tool answers a JSON record), not a refusal: the exact status 7 is the observed effect',
  },
  {
    id: 'PB-B3-stderr',
    entry: 'bash',
    cwd: CWD,
    lane: { read: INSIDE, write: INSIDE },
    setup: [],
    steps: [{ tool: 'bash', args: { command: 'printf "boom\\n" >&2; exit 3', description: 'write to stderr and exit 3' } }],
    expect: { outcome: 'allow', refusal: null, exit: 3, timedOut: false, stdout: '', stderr: 'boom\n', fsUnchanged: true },
    note: 'stderr is captured as its own channel and digested; it is never merged into stdout',
  },
  {
    id: 'PB-B4-stdout-cap',
    entry: 'bash',
    cwd: CWD,
    lane: { read: INSIDE, write: INSIDE },
    setup: [],
    steps: [{ tool: 'bash', args: { command: BIG_COMMAND, description: 'emit more than the declared stdout cap' } }],
    expect: {
      outcome: 'allow',
      refusal: null,
      exit: 0,
      timedOut: false,
      stdoutBytes: 262144,
      stdoutEndsWith: BIG_TAIL,
      fsUnchanged: true,
    },
    note: 'MEASURED CAP: the tool declares stdout maxBytes=1<<18 (262144) and the confined reader keeps the TAIL, so a 300 022-byte stream arrives as exactly 262144 bytes ending with the final marker. The record carries no truncation FLAG — the byte count and the tail marker are the witnesses, and the loss of a flag is declared as a difference, not hidden',
  },
  {
    id: 'PB-B5-timeout',
    entry: 'bash',
    cwd: CWD,
    lane: { read: INSIDE, write: INSIDE },
    setup: [],
    steps: [{ tool: 'bash', args: { command: 'sleep 3; printf x > marker.txt', description: 'sleep past the caller timeout, then write a marker', timeoutMs: 400 } }],
    expect: {
      outcome: 'allow',
      refusal: null,
      exit: null,
      timedOut: true,
      stdout: '',
      fsUnchanged: true,
    },
    note: 'the caller timeout (400 ms) terminates the payload BEFORE it writes marker.txt, so the FILESYSTEM witness (marker absent on an unchanged tree) corroborates the kill independently of the reported flag; the exit status of a killed child is recorded as null and the signal name is excluded by the printed exclusion set',
  },
  {
    id: 'PB-B6-abort-before-dispatch',
    entry: 'bash',
    cwd: CWD,
    lane: { read: INSIDE, write: INSIDE },
    setup: [],
    steps: [{ tool: 'bash', args: { command: 'printf never', description: 'must never run: the call arrives pre-aborted' }, abort: true }],
    expect: { outcome: 'deny', refusal: 'cancelled', exit: null, timedOut: false, fsUnchanged: true },
    note: 'cancellation is expressible only BEFORE dispatch on this path (a pre-aborted signal is refused by the registry): zero spawns and no effect',
  },
  {
    id: 'PB-B7-outside-workdir',
    entry: 'bash',
    cwd: CWD,
    lane: { read: INSIDE, write: INSIDE },
    setup: [{ op: 'writeFile', path: 'outside/secret.txt', content: `${PROCESS_SECRET}\n` }],
    steps: [{ tool: 'bash', args: { command: 'pwd', description: 'run with an out-of-lane workdir', workdir: 'outside' } }],
    expect: { outcome: 'deny', refusal: 'denied-by-lane', exit: null, timedOut: false, fsUnchanged: true, noSpawn: true },
    note: 'the DECLARED roots are the only statically attributable input a shell body has: an out-of-lane `workdir` is refused by the lane BEFORE any process exists (zero confined provider calls)',
  },
  {
    id: 'PB-B8-outside-read-os',
    entry: 'bash',
    cwd: CWD,
    lane: { read: INSIDE, write: INSIDE },
    setup: [{ op: 'writeFile', path: 'outside/secret.txt', content: `${PROCESS_SECRET}\n` }],
    steps: [{ tool: 'bash', args: { command: 'cat ../outside/secret.txt', description: 'read a file outside the lane' } }],
    expect: {
      outcome: 'allow',
      refusal: null,
      exit: 1,
      timedOut: false,
      stdout: '',
      stderrContains: 'denied',
      fsUnchanged: true,
    },
    note: 'the shell BODY is not statically attributed, so this call is ADMITTED and then refused by the OS profile: the child exits non-zero, stdout is empty and the secret never reaches the model. The absence of the secret is the effect; it does not prove an unauthorized read never happened',
  },
  {
    id: 'PB-B9-outside-write-os',
    entry: 'bash',
    cwd: CWD,
    lane: { read: INSIDE, write: INSIDE },
    setup: [{ op: 'mkdir', path: 'outside' }],
    steps: [{ tool: 'bash', args: { command: 'printf x > ../outside/leak.txt', description: 'write outside the lane' } }],
    expect: {
      outcome: 'allow',
      refusal: null,
      exit: 1,
      timedOut: false,
      stdout: '',
      stderrContains: 'denied',
      fsUnchanged: true,
      absentFile: 'outside/leak.txt',
    },
    note: 'the OS write profile is the boundary for a redirection the declaration cannot see: the child fails, and the absent out-of-lane file is corroborated on the filesystem',
  },
  {
    id: 'PB-B10-env-scrub',
    entry: 'bash',
    cwd: CWD,
    lane: { read: INSIDE, write: INSIDE },
    setup: [],
    steps: [{
      tool: 'bash',
      args: {
        command: `printf 'secret=%s dsh=%s path=%s' "\${${PROCESS_SECRET_ENV}-ABSENT}" "\${${PROCESS_DSH_ENV}-ABSENT}" "\${PATH:+present}"`,
        description: 'ask the child what it can see of the ambient environment',
      },
    }],
    expect: {
      outcome: 'allow',
      refusal: null,
      exit: 0,
      timedOut: false,
      stdout: 'secret=ABSENT dsh=ABSENT path=present',
      fsUnchanged: true,
    },
    note: 'the published env law strips credential-shaped names (/\bKEY|PASSWORD|SECRET|TOKEN\b/i) and every DSH_* name, and keeps everything else (PATH proves the channel works, so ABSENT is a scrub decision and not a broken environment)',
  },
  {
    id: 'PB-B11-stdin-ignored',
    entry: 'bash',
    cwd: CWD,
    lane: { read: INSIDE, write: INSIDE },
    setup: [],
    steps: [{ tool: 'bash', args: { command: 'read -r line; printf "got:%s" "${line}"', description: 'read stdin, which the invocation declares as ignore' } }],
    expect: { outcome: 'allow', refusal: null, exit: 0, timedOut: false, stdout: 'got:', fsUnchanged: true },
    note: 'the invocation declares stdin=ignore, so the child sees EOF immediately instead of inheriting the parent\'s stdin: `read` fails and the empty answer is deterministic, not a race',
  },
  {
    id: 'PB-B12-missing-workdir',
    entry: 'bash',
    cwd: CWD,
    lane: { read: INSIDE, write: INSIDE },
    setup: [],
    steps: [{ tool: 'bash', args: { command: 'pwd', description: 'run in a workdir that does not exist', workdir: 'inside/absent' } }],
    expect: { outcome: 'deny', refusal: 'missing-path', exit: null, timedOut: false, fsUnchanged: true, noSpawn: true },
    note: 'a workdir that does not exist is classified by the filesystem witness (the deny locator is absent), not by the shared IO code, which also names a lane denial',
  },
  {
    id: 'PB-B13-invalid-command',
    entry: 'bash',
    cwd: CWD,
    lane: { read: INSIDE, write: INSIDE },
    setup: [],
    steps: [{ tool: 'bash', args: { command: '   ', description: 'an empty command must be refused by the closed schema' } }],
    expect: { outcome: 'deny', refusal: 'invalid-argument', exit: null, timedOut: false, fsUnchanged: true, noSpawn: true },
    note: 'the tool\'s own closed argument law refuses a blank command before the confined face is entered (zero spawns), which is a different class from a lane decision',
  },
  {
    id: 'PB-B14-bound-workdir',
    entry: 'bash',
    cwd: 'inside/bound',
    lane: { read: BOUND, write: BOUND },
    setup: [{ op: 'writeFile', path: 'inside/a.txt', content: 'alpha\n' }],
    steps: [{ tool: 'bash', args: { command: 'pwd', description: 'run from a bound subtree, escaping it with an absolute workdir', workdir: 'inside' } }],
    expect: { outcome: 'deny', refusal: 'denied-by-lane', exit: null, timedOut: false, fsUnchanged: true, noSpawn: true },
    note: 'the cwd/lane boundary is a BOUND SUBTREE, not just the world root: an absolute workdir inside the fixture but outside every declared read root is refused',
  },
])
