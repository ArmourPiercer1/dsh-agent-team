/**
 * corpus.mjs — the OLD-PATH vector table for the ui and agent-state families.
 *
 * Every row is a CLAIM, not a recording: `expect` states the outcome, the
 * refusal CATEGORY (the owner's closed vocabulary), the typed code the governed
 * body must answer with, and the two load-bearing effect facts (did the port
 * run? did a durable write commit?). A capture that disagrees with its own
 * claim is a CORPUS bug reported RED — never a golden relabelled to match.
 *
 * Coverage per member (the four required classes, plus the family-specific
 * ones):
 *   - success with an effect, corroborated independently (port log / durable
 *     store readback);
 *   - wrong input refused before any effect;
 *   - permission withheld by the lane/PA/template or by goal authority;
 *   - abort or deadline (the caller's cancellation, the timed pending wait).
 *
 * The names, spellings and members come from the census
 * (`arc-a-family-census.json`), which `lib/corpus.mjs` re-reads for the
 * `COVERED_MEMBERS` self-check.
 *
 * @module tests/ute-g1-uistate/lib/corpus
 */

const askQuestion = (id, question, extra = {}) => ({ id, question, ...extra })

/** One option set used by several ask vectors. */
const MODE_OPTIONS = [
  { label: 'Fast', description: 'fewer checks, quicker turnaround' },
  { label: 'Thorough', description: 'the full gate set before anything lands' },
]

/**
 * The vector table. Field meanings:
 *   family / member   census family and the exact native spelling
 *   klass             the covered class (success | wrong-input | permission | abort | deadline | missing | cap)
 *   args              the model-facing arguments
 *   timed             the mount variant (uiTimedQuestions) for ask
 *   port              the injected port behaviour (undefined = a real answer)
 *   portAnswer        the service answer batch
 *   policy            'default-deny' flips the template default
 *   decide            'deny' makes the lane verdict deny (template-deny-lane)
 *   pa                'deny' | 'cancelled' (undefined = allow)
 *   agent             null = no calling agent; a string = that agent id
 *   arm               execution-origin arm (agent-state): 'direct-human' default, 'model', 'goal-round'
 *   seedGoal          plant a durable goal before the call (merged over SEED_GOAL)
 *   seedGoalCrossScope plant the same goal under a DIFFERENT agent scope
 *   seedPlanMode      plant plan mode active
 *   expect            the design claim
 */
export const CORPUS = Object.freeze([
  /* ───────────────────────── ask_user_question ────────────────────────── */
  {
    id: 'UI-A1-single-answer', family: 'ui', member: 'ask_user_question', klass: 'success',
    args: { questions: [askQuestion('q1', 'Which review mode?', { header: 'Mode', options: MODE_OPTIONS })] },
    portAnswer: [{ id: 'q1', selected: ['Thorough'] }],
    expect: { outcome: 'allow', refusal: null, code: '-', portCalls: 1 },
    note: 'one question with options; the answered batch is copied model-side (id/selected, no invented custom)',
  },
  {
    id: 'UI-A2-two-questions-multi', family: 'ui', member: 'ask_user_question', klass: 'success',
    args: {
      questions: [
        askQuestion('q1', 'Which lanes may run?', { multi_select: true, options: [{ label: 'Lane A' }, { label: 'Lane B' }] }),
        askQuestion('q2', 'Anything else worth knowing?'),
      ],
    },
    portAnswer: [{ id: 'q1', selected: ['Lane A', 'Lane B'] }, { id: 'q2', selected: [], custom: 'keep it short' }],
    expect: { outcome: 'allow', refusal: null, code: '-', portCalls: 1 },
    note: 'a multi-select batch plus a free-form custom answer travels unchanged',
  },
  {
    id: 'UI-A3-unknown-parameter', family: 'ui', member: 'ask_user_question', klass: 'wrong-input',
    args: { questions: [askQuestion('q1', 'Proceed?')], patience: 5 },
    expect: { outcome: 'deny', refusal: 'invalid-argument', code: 'ask-unknown-parameter', portCalls: 0 },
    note: 'the closed parameter contract refuses before any port or PA touch',
  },
  {
    id: 'UI-A4-no-questions', family: 'ui', member: 'ask_user_question', klass: 'wrong-input',
    args: { questions: [] },
    expect: { outcome: 'deny', refusal: 'invalid-argument', code: 'ask-questions-required', portCalls: 0 },
    note: 'an empty batch is under-specified: there is nothing to ask',
  },
  {
    id: 'UI-A5-lane-deny', family: 'ui', member: 'ask_user_question', klass: 'permission',
    args: { questions: [askQuestion('q1', 'Proceed?')] },
    decide: 'deny',
    expect: { outcome: 'deny', refusal: 'denied-by-lane', code: 'template-deny-lane', portCalls: 0 },
    note: 'the template lane verdict withholds the interaction effect; zero port calls',
  },
  {
    id: 'UI-A6-pa-deny', family: 'ui', member: 'ask_user_question', klass: 'permission',
    args: { questions: [askQuestion('q1', 'Proceed?')] },
    pa: 'deny',
    expect: { outcome: 'deny', refusal: 'denied-by-lane', code: 'ADMISSION_DENIED', portCalls: 0 },
    note: 'the admission edge denies after the lane allowed; still zero port calls',
  },
  {
    id: 'UI-A7-template-default-deny', family: 'ui', member: 'ask_user_question', klass: 'permission',
    args: { questions: [askQuestion('q1', 'Proceed?')] },
    policy: 'default-deny',
    expect: { outcome: 'deny', refusal: 'denied-by-lane', code: 'template-default-deny', portCalls: 0 },
    note: 'a default-DENY template names no interaction rule, so the row refuses before PA',
  },
  {
    id: 'UI-A8-port-absent', family: 'ui', member: 'ask_user_question', klass: 'permission',
    args: { questions: [askQuestion('q1', 'Proceed?')] },
    port: 'absent',
    expect: { outcome: 'deny', refusal: 'unsupported-mode', code: 'UI_INTERACTION_PORT_ABSENT', portCalls: 0 },
    note: 'an enabled family on a mount with no interaction face fails closed and asks nobody',
  },
  {
    id: 'UI-A9-abort-in-port', family: 'ui', member: 'ask_user_question', klass: 'abort',
    args: { questions: [askQuestion('q1', 'Proceed?')] },
    port: 'abort',
    expect: { outcome: 'cancelled', refusal: 'cancelled', code: 'CANCELLED', portCalls: 1 },
    note: 'the caller aborts while the port owns the wait; the row reports cancellation, not an answer',
  },
  {
    id: 'UI-A10-timed-pending', family: 'ui', member: 'ask_user_question', klass: 'deadline', timed: true,
    args: { questions: [askQuestion('q1', 'Proceed?')], timeout: 5 },
    port: 'pending',
    portAnswer: [{ id: 'q1', selected: ['Thorough'] }],
    expect: { outcome: 'allow', refusal: null, code: '-', portCalls: 1 },
    note: 'the deadlined wait expires: the pending outcome is returned and the port\'s dishonest answers are DROPPED',
  },

  /* ───────────────────────────── present ──────────────────────────────── */
  {
    id: 'UI-P1-one-file', family: 'ui', member: 'present', klass: 'success',
    args: { files: [{ path: 'inside/report.md', description: 'the report' }] },
    expect: { outcome: 'allow', refusal: null, code: '-', portCalls: 1 },
    note: 'one in-root regular file is anchored, probed, and published with its receipt turn',
  },
  {
    id: 'UI-P2-two-files', family: 'ui', member: 'present', klass: 'success',
    args: { files: [{ path: 'inside/report.md' }, { path: 'inside/second.md', description: 'the appendix' }] },
    expect: { outcome: 'allow', refusal: null, code: '-', portCalls: 1 },
    note: 'a description is optional per file and the batch publishes in order',
  },
  {
    id: 'UI-P3-outside-root', family: 'ui', member: 'present', klass: 'permission',
    args: { files: [{ path: '<outside>', description: 'a file outside the governed root' }] },
    fixturePath: 'outside',
    expect: { outcome: 'deny', refusal: 'denied-by-lane', code: 'locator-rejected', portCalls: 0 },
    note: 'the pure-lexical anchor refuses a target outside the governed root before any stat',
  },
  {
    id: 'UI-P4-no-files', family: 'ui', member: 'present', klass: 'wrong-input',
    args: { files: [] },
    expect: { outcome: 'deny', refusal: 'invalid-argument', code: 'present-files-required', portCalls: 0 },
    note: 'nothing to publish is under-specified',
  },
  {
    id: 'UI-P5-missing-file', family: 'ui', member: 'present', klass: 'missing',
    args: { files: [{ path: 'inside/absent.md' }] },
    expect: { outcome: 'deny', refusal: 'missing-path', code: 'FILE_NOT_FOUND', portCalls: 0 },
    note: 'an anchored path that does not exist refuses with the missing-path class, zero port calls',
  },
  {
    id: 'UI-P6-directory', family: 'ui', member: 'present', klass: 'wrong-input',
    args: { files: [{ path: 'inside/folder' }] },
    expect: { outcome: 'deny', refusal: 'invalid-argument', code: 'NOT_A_FILE', portCalls: 0 },
    note: 'a directory is not a presentable deliverable',
  },
  {
    id: 'UI-P7-too-many-files', family: 'ui', member: 'present', klass: 'wrong-input',
    args: {
      files: Array.from({ length: 9 }, (_, index) => ({ path: index % 2 === 0 ? 'inside/report.md' : 'inside/second.md' })),
    },
    expect: { outcome: 'deny', refusal: 'invalid-argument', code: 'present-files-limit', portCalls: 0 },
    note: 'nine files exceed the enforced ceiling of eight (four is the recommendation, not the cap)',
  },
  {
    id: 'UI-P8-lane-deny', family: 'ui', member: 'present', klass: 'permission',
    args: { files: [{ path: 'inside/report.md' }] },
    decide: 'deny',
    expect: { outcome: 'deny', refusal: 'denied-by-lane', code: 'template-deny-lane', portCalls: 0 },
    note: 'the lane withholds the publication effect',
  },
  {
    id: 'UI-P9-pa-deny', family: 'ui', member: 'present', klass: 'permission',
    args: { files: [{ path: 'inside/report.md' }] },
    pa: 'deny',
    expect: { outcome: 'deny', refusal: 'denied-by-lane', code: 'ADMISSION_DENIED', portCalls: 0 },
    note: 'the admission edge denies the publication; nothing is probed or published',
  },
  {
    id: 'UI-P10-receipt-without-turn', family: 'ui', member: 'present', klass: 'cap',
    args: { files: [{ path: 'inside/report.md' }] },
    port: 'no-turn',
    expect: { outcome: 'deny', refusal: 'unsupported-mode', code: 'UI_PRESENT_RECEIPT_INVALID', portCalls: 1 },
    note: 'a face that reports success without the host-required integer turn is treated as failed',
  },
  {
    id: 'UI-P11-abort-in-port', family: 'ui', member: 'present', klass: 'abort',
    args: { files: [{ path: 'inside/report.md' }] },
    port: 'abort',
    expect: { outcome: 'cancelled', refusal: 'cancelled', code: 'CANCELLED', portCalls: 1 },
    note: 'the caller aborts during publication; the row reports cancellation',
  },
  {
    id: 'UI-P12-oversized', family: 'ui', member: 'present', klass: 'cap',
    args: { files: [{ path: 'inside/oversized.md' }] },
    expect: { outcome: 'deny', refusal: 'unsupported-mode', code: 'FILE_TOO_LARGE', portCalls: 0 },
    note: 'the 1MiB presentation cap refuses the surplus rather than widening the read',
  },

  /* ───────────────────────────── todo_write ───────────────────────────── */
  {
    id: 'AS-T1-write-three', family: 'agent-state', member: 'todo_write', klass: 'success',
    args: { todos: [
      { content: 'read the ledger', status: 'completed' },
      { content: 'measure the old path', status: 'in_progress' },
      { content: 'write the controls', status: 'pending' },
    ] },
    expect: { outcome: 'allow', refusal: null, code: '-', durableWrites: 1 },
    note: 'the whole list commits durably with the host status counts',
  },
  {
    id: 'AS-T2-empty-list', family: 'agent-state', member: 'todo_write', klass: 'success',
    args: { todos: [] },
    expect: { outcome: 'allow', refusal: null, code: '-', durableWrites: 1 },
    note: 'an empty list is a legitimate replacement (clears the plan)',
  },
  {
    id: 'AS-T3-duplicate-content', family: 'agent-state', member: 'todo_write', klass: 'wrong-input',
    args: { todos: [{ content: 'same line', status: 'pending' }, { content: 'same line', status: 'completed' }] },
    expect: { outcome: 'deny', refusal: 'invalid-argument', code: 'AGENT_STATE_ARGS_INVALID', durableWrites: 0 },
    note: 'content must be trimmed-unique; the duplicate refuses before the store is touched',
  },
  {
    id: 'AS-T4-two-in-progress', family: 'agent-state', member: 'todo_write', klass: 'wrong-input',
    args: { todos: [{ content: 'a', status: 'in_progress' }, { content: 'b', status: 'in_progress' }] },
    expect: { outcome: 'deny', refusal: 'invalid-argument', code: 'AGENT_STATE_ARGS_INVALID', durableWrites: 0 },
    note: 'the strict deployment choice allows at most one in-progress task',
  },
  {
    id: 'AS-T5-unknown-field', family: 'agent-state', member: 'todo_write', klass: 'wrong-input',
    args: { todos: [{ content: 'a', status: 'pending' }], priority: 1 },
    expect: { outcome: 'deny', refusal: 'invalid-argument', code: 'AGENT_STATE_ARGS_UNKNOWN', durableWrites: 0 },
    note: 'the closed parameter contract refuses an unknown top-level field',
  },
  {
    id: 'AS-T6-lane-deny', family: 'agent-state', member: 'todo_write', klass: 'permission',
    args: { todos: [{ content: 'a', status: 'pending' }] },
    decide: 'deny',
    expect: { outcome: 'deny', refusal: 'denied-by-lane', code: 'template-deny-lane', durableWrites: 0 },
    note: 'the lane withholds the state effect; zero durable writes and zero PA entries',
  },
  {
    id: 'AS-T7-pa-deny', family: 'agent-state', member: 'todo_write', klass: 'permission',
    args: { todos: [{ content: 'a', status: 'pending' }] },
    pa: 'deny',
    expect: { outcome: 'deny', refusal: 'denied-by-lane', code: 'ADMISSION_DENIED', durableWrites: 0 },
    note: 'the admission edge denies the mutation; nothing commits',
  },
  {
    id: 'AS-T8-pa-cancelled', family: 'agent-state', member: 'todo_write', klass: 'abort',
    args: { todos: [{ content: 'a', status: 'pending' }] },
    pa: 'cancelled',
    expect: { outcome: 'deny', refusal: 'cancelled', code: 'CANCELLED', durableWrites: 0 },
    note: 'the edge settles cancelled before execution; the body never runs',
  },
  {
    id: 'AS-T9-agent-required', family: 'agent-state', member: 'todo_write', klass: 'wrong-input',
    args: { todos: [{ content: 'a', status: 'pending' }] },
    agent: null,
    expect: { outcome: 'deny', refusal: 'invalid-argument', code: 'TODO_WRITE_AGENT_REQUIRED', durableWrites: 0 },
    note: 'no calling agent means no scope; the call is under-specified, never defaulted',
  },
  {
    id: 'AS-T10-template-default-deny', family: 'agent-state', member: 'todo_write', klass: 'permission',
    args: { todos: [{ content: 'a', status: 'pending' }] },
    policy: 'default-deny',
    expect: { outcome: 'deny', refusal: 'denied-by-lane', code: 'IO_POLICY_UNSUPPORTED', durableWrites: 0 },
    note: 'the closed rule grammar names no agent-state effect, so a default-DENY template refuses it',
  },

  /* ────────────────────────────── get_goal ────────────────────────────── */
  {
    id: 'AS-G1-empty', family: 'agent-state', member: 'get_goal', klass: 'success',
    args: {},
    expect: { outcome: 'allow', refusal: null, code: '-', durableWrites: 0 },
    note: 'a scope with no goal projects the explicit {goal:null}, never an invented goal',
  },
  {
    id: 'AS-G2-seeded', family: 'agent-state', member: 'get_goal', klass: 'success',
    args: {},
    seedGoal: {},
    expect: { outcome: 'allow', refusal: null, code: '-', durableWrites: 0 },
    note: 'the planted goal is projected with its exact id, revision, rounds and arming',
  },
  {
    id: 'AS-G3-cross-scope', family: 'agent-state', member: 'get_goal', klass: 'success',
    args: {},
    seedGoalCrossScope: true,
    expect: { outcome: 'allow', refusal: null, code: '-', durableWrites: 0 },
    note: 'another agent\'s goal is invisible: the read is one scope, never an enumeration',
  },
  {
    id: 'AS-G4-unknown-field', family: 'agent-state', member: 'get_goal', klass: 'wrong-input',
    args: { verbose: true },
    expect: { outcome: 'deny', refusal: 'invalid-argument', code: 'AGENT_STATE_ARGS_UNKNOWN', durableWrites: 0 },
    note: 'get_goal carries no parameters; any field is unknown by construction',
  },
  {
    id: 'AS-G5-lane-deny', family: 'agent-state', member: 'get_goal', klass: 'permission',
    args: {},
    seedGoal: {},
    decide: 'deny',
    expect: { outcome: 'deny', refusal: 'denied-by-lane', code: 'template-deny-lane', durableWrites: 0 },
    note: 'even the read row passes the lane before the store is read',
  },
  {
    id: 'AS-G6-agent-required', family: 'agent-state', member: 'get_goal', klass: 'wrong-input',
    args: {},
    agent: null,
    expect: { outcome: 'deny', refusal: 'invalid-argument', code: 'GOAL_TOOL_AGENT_REQUIRED', durableWrites: 0 },
    note: 'no calling agent means no scope to read',
  },
  {
    id: 'AS-G7-pa-cancelled', family: 'agent-state', member: 'get_goal', klass: 'abort',
    args: {},
    seedGoal: {},
    pa: 'cancelled',
    expect: { outcome: 'deny', refusal: 'cancelled', code: 'CANCELLED', durableWrites: 0 },
    note: 'cancelled at the edge; the bounded read never runs',
  },

  /* ───────────────────────────── create_goal ──────────────────────────── */
  {
    id: 'AS-C1-direct-human', family: 'agent-state', member: 'create_goal', klass: 'success',
    args: { objective: 'Finish the ui/agent-state baseline' },
    expect: { outcome: 'allow', refusal: null, code: '-', durableWrites: 1 },
    note: 'a direct-human create folds revision 1, phase active, armed, zero rounds',
  },
  {
    id: 'AS-C2-model-arm', family: 'agent-state', member: 'create_goal', klass: 'permission',
    args: { objective: 'Finish the baseline' },
    arm: 'model',
    expect: { outcome: 'deny', refusal: 'denied-by-lane', code: 'GOAL_TOOL_NOT_DIRECT_HUMAN', durableWrites: 0 },
    note: 'the model arm may not create a goal; the refusal precedes any store write',
  },
  {
    id: 'AS-C3-already-exists', family: 'agent-state', member: 'create_goal', klass: 'success',
    args: { objective: 'A second goal' },
    seedGoal: { phase: 'active' },
    expect: { outcome: 'deny', refusal: 'unsupported-mode', code: 'GOAL_ALREADY_EXISTS', durableWrites: 0 },
    note: 'one goal per scope: an active goal makes create unsupported in this state',
  },
  {
    id: 'AS-C4-recreate-after-complete', family: 'agent-state', member: 'create_goal', klass: 'success',
    args: { objective: 'The next objective' },
    seedGoal: { phase: 'complete', armed: false },
    expect: { outcome: 'allow', refusal: null, code: '-', durableWrites: 1 },
    note: 'a COMPLETE goal does not block a new create — the state, not a special case, decides',
  },
  {
    id: 'AS-C5-invalid-objective', family: 'agent-state', member: 'create_goal', klass: 'wrong-input',
    args: { objective: '   ' },
    expect: { outcome: 'deny', refusal: 'invalid-argument', code: 'GOAL_INVALID_OBJECTIVE', durableWrites: 0 },
    note: 'a blank objective is not an objective',
  },
  {
    id: 'AS-C6-invalid-max-rounds', family: 'agent-state', member: 'create_goal', klass: 'wrong-input',
    args: { objective: 'Bound the goal', max_goal_rounds: 0 },
    expect: { outcome: 'deny', refusal: 'invalid-argument', code: 'GOAL_INVALID_MAX_ROUNDS', durableWrites: 0 },
    note: 'the round cap must be a positive safe integer',
  },
  {
    id: 'AS-C7-unknown-field', family: 'agent-state', member: 'create_goal', klass: 'wrong-input',
    args: { objective: 'Bound the goal', rounds: 2 },
    expect: { outcome: 'deny', refusal: 'invalid-argument', code: 'AGENT_STATE_ARGS_UNKNOWN', durableWrites: 0 },
    note: 'the closed parameter contract refuses an unknown field name',
  },
  {
    id: 'AS-C8-pa-deny', family: 'agent-state', member: 'create_goal', klass: 'permission',
    args: { objective: 'Finish the baseline' },
    pa: 'deny',
    expect: { outcome: 'deny', refusal: 'denied-by-lane', code: 'ADMISSION_DENIED', durableWrites: 0 },
    note: 'the admission edge denies the create',
  },
  {
    id: 'AS-C9-agent-required', family: 'agent-state', member: 'create_goal', klass: 'wrong-input',
    args: { objective: 'Finish the baseline' },
    agent: null,
    expect: { outcome: 'deny', refusal: 'invalid-argument', code: 'GOAL_TOOL_AGENT_REQUIRED', durableWrites: 0 },
    note: 'no calling agent means no scope to own a goal',
  },
  {
    id: 'AS-C10-pa-cancelled', family: 'agent-state', member: 'create_goal', klass: 'abort',
    args: { objective: 'Finish the baseline' },
    pa: 'cancelled',
    expect: { outcome: 'deny', refusal: 'cancelled', code: 'CANCELLED', durableWrites: 0 },
    note: 'cancelled at the edge; nothing is created',
  },

  /* ───────────────────────────── update_goal ──────────────────────────── */
  {
    id: 'AS-U1-edit-objective', family: 'agent-state', member: 'update_goal', klass: 'success',
    args: { goal_id: 'goal-seed-1', revision: 1, action: 'edit', objective: 'A sharper objective' },
    seedGoal: {},
    expect: { outcome: 'allow', refusal: null, code: '-', durableWrites: 1 },
    note: 'a direct-human edit advances the revision exactly one and replaces the objective',
  },
  {
    id: 'AS-U2-pause', family: 'agent-state', member: 'update_goal', klass: 'success',
    args: { goal_id: 'goal-seed-1', revision: 1, action: 'pause' },
    seedGoal: {},
    expect: { outcome: 'allow', refusal: null, code: '-', durableWrites: 1 },
    note: 'pause disarms the goal and moves it to the paused phase',
  },
  {
    id: 'AS-U3-resume-unarmed', family: 'agent-state', member: 'update_goal', klass: 'success',
    args: { goal_id: 'goal-seed-1', revision: 1, action: 'resume' },
    seedGoal: { phase: 'active', armed: false },
    expect: { outcome: 'allow', refusal: null, code: '-', durableWrites: 1 },
    note: 'an active-but-unarmed goal may be re-armed by a direct-human resume',
  },
  {
    id: 'AS-U4-resume-paused', family: 'agent-state', member: 'update_goal', klass: 'permission',
    args: { goal_id: 'goal-seed-1', revision: 1, action: 'resume' },
    seedGoal: { phase: 'paused', armed: false },
    expect: { outcome: 'deny', refusal: 'denied-by-lane', code: 'GOAL_TOOL_RESUME_PAUSED', durableWrites: 0 },
    note: 'a paused goal belongs to the user: the row withholds resume under every arm',
  },
  {
    id: 'AS-U5-complete-goal-round', family: 'agent-state', member: 'update_goal', klass: 'success',
    args: { goal_id: 'goal-seed-1', revision: 1, action: 'complete' },
    seedGoal: { roundsStarted: 1 },
    arm: 'goal-round',
    expect: { outcome: 'allow', refusal: null, code: '-', durableWrites: 1 },
    note: 'the exact current goal round may complete its goal (no direct human needed)',
  },
  {
    id: 'AS-U6-blocked-below-threshold', family: 'agent-state', member: 'update_goal', klass: 'permission',
    args: { goal_id: 'goal-seed-1', revision: 1, action: 'blocked', blocked_reason: 'waiting on review' },
    seedGoal: { roundsStarted: 1 },
    arm: 'goal-round',
    expect: { outcome: 'deny', refusal: 'denied-by-lane', code: 'GOAL_TOOL_BLOCK_THRESHOLD', durableWrites: 0 },
    note: 'blocking needs three consecutive rounds; round one is refused',
  },
  {
    id: 'AS-U7-blocked-at-threshold', family: 'agent-state', member: 'update_goal', klass: 'success',
    args: { goal_id: 'goal-seed-1', revision: 1, action: 'blocked', blocked_reason: 'waiting on review' },
    seedGoal: { roundsStarted: 3 },
    arm: 'goal-round',
    expect: { outcome: 'allow', refusal: null, code: '-', durableWrites: 1 },
    note: 'at the threshold the blocked phase records its reason durably',
  },
  {
    id: 'AS-U8-stale-revision', family: 'agent-state', member: 'update_goal', klass: 'permission',
    args: { goal_id: 'goal-seed-1', revision: 2, action: 'edit', objective: 'Stale edit' },
    seedGoal: {},
    expect: { outcome: 'deny', refusal: 'stale-version', code: 'GOAL_STALE_REVISION', durableWrites: 0 },
    note: 'the CAS refuses an edit against a revision the caller never observed',
  },
  {
    id: 'AS-U9-pause-with-objective', family: 'agent-state', member: 'update_goal', klass: 'wrong-input',
    args: { goal_id: 'goal-seed-1', revision: 1, action: 'pause', objective: 'not allowed here' },
    seedGoal: {},
    expect: { outcome: 'deny', refusal: 'invalid-argument', code: 'GOAL_TOOL_INVALID_UPDATE', durableWrites: 0 },
    note: 'the field legs are per-action: pause carries no objective',
  },
  {
    id: 'AS-U10-empty-edit', family: 'agent-state', member: 'update_goal', klass: 'wrong-input',
    args: { goal_id: 'goal-seed-1', revision: 1, action: 'edit' },
    seedGoal: {},
    expect: { outcome: 'deny', refusal: 'invalid-argument', code: 'GOAL_INVALID_EDIT', durableWrites: 0 },
    note: 'an edit with no replacement asks for nothing',
  },
  {
    id: 'AS-U11-no-completion-authority', family: 'agent-state', member: 'update_goal', klass: 'permission',
    args: { goal_id: 'goal-seed-1', revision: 1, action: 'complete' },
    seedGoal: { roundsStarted: 2 },
    arm: 'model',
    expect: { outcome: 'deny', refusal: 'denied-by-lane', code: 'GOAL_TOOL_NO_COMPLETION_AUTHORITY', durableWrites: 0 },
    note: 'the model arm cannot complete outside the exact current round',
  },
  {
    id: 'AS-U12-pa-cancelled', family: 'agent-state', member: 'update_goal', klass: 'abort',
    args: { goal_id: 'goal-seed-1', revision: 1, action: 'pause' },
    seedGoal: {},
    pa: 'cancelled',
    expect: { outcome: 'deny', refusal: 'cancelled', code: 'CANCELLED', durableWrites: 0 },
    note: 'the approval was cancelled at the edge; the goal keeps its phase',
  },
  {
    id: 'AS-U13-pa-deny', family: 'agent-state', member: 'update_goal', klass: 'permission',
    args: { goal_id: 'goal-seed-1', revision: 1, action: 'pause' },
    seedGoal: {},
    pa: 'deny',
    expect: { outcome: 'deny', refusal: 'denied-by-lane', code: 'ADMISSION_DENIED', durableWrites: 0 },
    note: 'the admission edge denies the mutation',
  },

  /* ───────────────────────────── exit_plan_mode ───────────────────────── */
  {
    id: 'AS-E1-exit', family: 'agent-state', member: 'exit_plan_mode', klass: 'success',
    args: { plan: '# Ship the ui/agent-state baseline\n\n- baseline both families\n- per-member controls' },
    seedPlanMode: true,
    expect: { outcome: 'allow', refusal: null, code: '-', durableWrites: 1 },
    note: 'the approved plan is recorded on the durable store and plan mode leaves',
  },
  {
    id: 'AS-E2-not-in-plan-mode', family: 'agent-state', member: 'exit_plan_mode', klass: 'permission',
    args: { plan: '# Ship it' },
    expect: { outcome: 'deny', refusal: 'unsupported-mode', code: 'PLAN_MODE_NOT_ACTIVE', durableWrites: 0 },
    note: 'the exit is meaningless when plan mode is not the live mode',
  },
  {
    id: 'AS-E3-plan-without-heading', family: 'agent-state', member: 'exit_plan_mode', klass: 'wrong-input',
    args: { plan: 'Ship it' },
    seedPlanMode: true,
    expect: { outcome: 'deny', refusal: 'invalid-argument', code: 'PLAN_MODE_PLAN_INVALID', durableWrites: 0 },
    note: 'the plan must open with a # heading',
  },
  {
    id: 'AS-E4-unknown-field', family: 'agent-state', member: 'exit_plan_mode', klass: 'wrong-input',
    args: { plan: '# Ship it', mode: 'fast' },
    seedPlanMode: true,
    expect: { outcome: 'deny', refusal: 'invalid-argument', code: 'AGENT_STATE_ARGS_UNKNOWN', durableWrites: 0 },
    note: 'the closed parameter contract refuses the unknown field',
  },
  {
    id: 'AS-E5-agent-required', family: 'agent-state', member: 'exit_plan_mode', klass: 'wrong-input',
    args: { plan: '# Ship it' },
    agent: null,
    expect: { outcome: 'deny', refusal: 'invalid-argument', code: 'EXIT_PLAN_MODE_AGENT_REQUIRED', durableWrites: 0 },
    note: 'no calling agent means no session whose mode could switch',
  },
  {
    id: 'AS-E6-lane-deny', family: 'agent-state', member: 'exit_plan_mode', klass: 'permission',
    args: { plan: '# Ship it' },
    seedPlanMode: true,
    decide: 'deny',
    expect: { outcome: 'deny', refusal: 'denied-by-lane', code: 'template-deny-lane', durableWrites: 0 },
    note: 'the lane withholds the mode switch',
  },
  {
    id: 'AS-E7-pa-cancelled', family: 'agent-state', member: 'exit_plan_mode', klass: 'abort',
    args: { plan: '# Ship it' },
    seedPlanMode: true,
    pa: 'cancelled',
    expect: { outcome: 'deny', refusal: 'cancelled', code: 'CANCELLED', durableWrites: 0 },
    note: 'the approval was cancelled at the edge; plan mode stays active',
  },
])

/** Census members this corpus must cover (re-read, never hand-listed). */
export const COVERED_MEMBERS = Object.freeze([...new Set(CORPUS.map((vector) => vector.member))])

/** The vector ids, in table order. */
export const VECTOR_IDS = Object.freeze(CORPUS.map((vector) => vector.id))

/** Members per family, from the table (the census check lives in the suite). */
export const MEMBERS_BY_FAMILY = Object.freeze({
  ui: Object.freeze([...new Set(CORPUS.filter((vector) => vector.family === 'ui').map((vector) => vector.member))]),
  'agent-state': Object.freeze([...new Set(CORPUS.filter((vector) => vector.family === 'agent-state').map((vector) => vector.member))]),
})

/** The required class coverage per member (asserted by the suite). */
export const REQUIRED_CLASSES = Object.freeze(['success', 'wrong-input', 'permission'])
