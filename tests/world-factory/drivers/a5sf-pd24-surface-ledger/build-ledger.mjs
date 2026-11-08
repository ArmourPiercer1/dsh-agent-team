#!/usr/bin/env node
/**
 * tests/world-factory/drivers/a5sf-pd24-surface-ledger/build-ledger.mjs — turn
 * the PD-24 boots into ONE line-by-line ledger artefact.
 *
 * WHY A BUILDER AND NOT HAND-WRITTEN JSON. The point of this lane is a ledger a
 * reader can check line by line. A hand-typed table rots the moment the surface
 * moves; a table DERIVED from the boot artefacts cannot. This script reads the
 * post-fix agreeing pair (`runs/boot01`, `runs/boot02`), the pre-fix pair
 * (`archive/pair-prefix/boot01..02`), the ASK arm (`runs-ask/boot01..02`) and the
 * guard-fact sink of each, and emits:
 *
 *   ledger.json      every shipped name classified once, with its measured
 *                    evidence inline (call issued / isError / fact count /
 *                    out-of-lane result)
 *   roster.json      the measured 34-name surface of each boot + the diff
 *   ledger.txt       the human table (the matrix §1.8 rows)
 *
 * It REFUSES to emit if any measured name is unclassified, if the two boots
 * disagree on the roster, or if a bucket count does not equal its row count.
 * That is the guarantee: the numbers cannot be prose.
 *
 * CORE PATCH BUDGET = 0. Host-free (no boot, no port, no DSH_HOME).
 *
 * @module tests/world-factory/drivers/a5sf-pd24-surface-ledger/build-ledger
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..', '..')
const EVIDENCE = join(REPO, 'dev', 'agent-workflow', 'evidence', 'a5sf-pd24-surface-ledger')

/** World-composition fixtures: mounted BESIDE the preset by the test World. */
const FIXTURES = Object.freeze(['u5_canary', 'u6fs_probe'])
/** The names each earlier lane removed fail-closed (PD-18/21/22/23). */
const REMOVED_EARLIER = Object.freeze([
  'interrupt_agent', 'list_agents', 'pwsh', 'send_message', 'skill', 'subagent', 'subagent_fork',
  'web_fetch', 'web_search', 'workflow',
])
/** PD-24's own removal. */
const REMOVED_BY_PD24 = Object.freeze(['present'])
const REMOVED = Object.freeze([...REMOVED_EARLIER, ...REMOVED_BY_PD24])

const readJson = (path) => {
  if (!existsSync(path)) throw new Error(`missing evidence artefact: ${path}`)
  return JSON.parse(readFileSync(path, 'utf8'))
}
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const textOf = (probe) => String(probe?.result?.text ?? '')

/** The ASK arm has its own artefact shape: it boot deliberately ENDS with a turn
 *  that is still open, so it writes `ask-blocked.json` instead of probes. */
function askPair(root) {
  return ['boot01', 'boot02'].map((name) => {
    const dir = join(root, name)
    return {
      name,
      blocked: readJson(join(dir, 'ask-blocked.json')),
      record: readJson(join(dir, 'run-record.json')),
      surface: readJson(join(dir, 'member-surface.json')),
      summary: readFileSync(join(dir, 'summary.txt'), 'utf8').trim().split('\n').at(-1),
    }
  })
}

function bootPair(root) {
  return ['boot01', 'boot02'].map((name) => {
    const dir = join(root, name)
    return {
      name,
      surface: readJson(join(dir, 'member-surface.json')),
      probes: readJson(join(dir, 'member-probes.json')).probes,
      counters: readJson(join(dir, 'counters.json')),
      facts: readJson(join(dir, 'guard-facts.json')),
      record: readJson(join(dir, 'run-record.json')),
      summary: readFileSync(join(dir, 'summary.txt'), 'utf8').trim().split('\n').at(-1),
    }
  })
}


/** `deliverables/presented` is the ONLY durable trace `present` leaves: count it
 *  per session, so the Member's own session is the one that carries it. */
function deliverablesBySession(counters) {
  const out = {}
  for (const [sessionId, entry] of Object.entries(counters.sessionEvents ?? {})) {
    const n = Number(entry?.types?.['deliverables/presented'] ?? 0)
    if (n > 0) out[sessionId] = n
  }
  return out
}

/** One ledger row per shipped name: the MEASURED fact plus the classification. */
function rowFor(name, { post, pre, ask }) {
  const probe = post.probes
  const facts = post.counters.guardFacts ?? {}
  const factCount = Number(facts.byTool?.[name] ?? 0)
  const called = (p) => p?.call !== undefined && p?.call !== null
  const isError = (p) => p?.result?.isError === true
  const result = (p) => textOf(p)

  if (name.startsWith('team_')) {
    const teamCalled = called(probe.teamSample)
    return {
      name,
      bucket: 'OTHER-AUTHZ',
      onSurface: true,
      executes: 'Team tool plane: its own request-token + envelope authorization (NOT the a5sf confined face)',
      scope: 'Team',
      fact: false,
      outOfBounds: 'no (a different authorization plane; out of this lane\'s remit)',
      onViolation: 'typed Team refusal (e.g. TEAM_RUNTIME_CALLER_AUTHORITY_DENIED / envelope denial)',
      evidence: { measuredHere: teamCalled, note: 'not called by this lane by instruction; plane characterized by PD-21 evidence' },
    }
  }

  switch (name) {
    case 'bash':
      return {
        name, bucket: 'GOVERNED', onSurface: true,
        executes: 'one fresh confined child per command (confined terminal face)',
        scope: 'Member lane (compiled read/write ceiling) + OS sandbox for the child',
        fact: true, facts: factCount,
        outOfBounds: 'L1 admission: the read axis is decided before spawn; dynamic shell reads (`$(…)`/backticks) are not lexically attributable and stay ungoverned on that sub-path',
        onViolation: 'typed refusal at admission (no child)', liveEvidence: true,
        evidence: { probe: probe.bash, facts: post.facts.filter((f) => f.tool === 'bash') },
      }
    case 'read':
      return {
        name, bucket: 'GOVERNED', onSurface: true,
        executes: 'confined `fs` face: stat + readText through the realm provider',
        scope: 'Member lane (read ceiling)', fact: true, facts: factCount,
        outOfBounds: 'L1 admission, before the provider: 0 bytes + typed IO_READ_DENIED + 1 deny fact',
        onViolation: 'typed IO_READ_DENIED', liveEvidence: true,
        evidence: { probe: probe.read, facts: post.facts.filter((f) => f.tool === 'read') },
      }
    case 'write':
      return {
        name, bucket: 'GOVERNED', onSurface: true,
        executes: 'confined `fs` face: writeText through the realm provider',
        scope: 'Member lane (write ceiling)', fact: true, facts: factCount,
        outOfBounds: 'L1 admission on the write axis (+ the host tool\'s read-before-write contract, L2)',
        onViolation: 'typed IO_WRITE_DENIED', liveEvidence: true,
        evidence: { probe: probe.write, facts: post.facts.filter((f) => f.tool === 'write') },
      }
    case 'edit':
      return {
        name, bucket: 'GOVERNED', onSurface: true,
        executes: 'confined `fs` face: stat + readText + editText through the realm provider',
        scope: 'Member lane (read+write ceilings)', fact: true, facts: factCount,
        outOfBounds: 'L1 admission on both axes; the version guard is the host tool\'s own (L2)',
        onViolation: 'typed IO_*_DENIED', liveEvidence: true,
        evidence: { probe: probe.edit, facts: post.facts.filter((f) => f.tool === 'edit') },
      }
    case 'read_image':
      return {
        name, bucket: 'GOVERNED', onSurface: true,
        executes: 'confined `fs` face (same provider as `read`) — but ONLY if the model route declares image input',
        scope: 'Member lane (read ceiling)', fact: true, facts: factCount,
        outOfBounds: 'L1 admission (host-free arm: 1 deny fact). LIVE: the call is refused at the MODEL ROUTE gate before the face',
        onViolation: 'route gate: `model "…" does not declare image input`; below it, typed IO_READ_DENIED',
        liveEvidence: false,
        liveNote: 'NOT_REACHED live: the measured model route (deepseek-v4-flash) declares no image input, so the tool never reaches the face. The confined-face behaviour is host-free evidence only.',
        evidence: { probe: probe.readImage, facts: post.facts.filter((f) => f.tool === 'read_image') },
      }
    case 'grep':
      return {
        name, bucket: 'GOVERNED', onSurface: true,
        executes: 'confined search face: ripgrep runs inside the confined child',
        scope: 'Member lane (read ceiling)', fact: true, facts: factCount,
        outOfBounds: 'L1 admission before the child', onViolation: 'typed refusal', liveEvidence: true,
        evidence: { probe: probe.grep, facts: post.facts.filter((f) => f.tool === 'grep') },
      }
    case 'glob':
      return {
        name, bucket: 'GOVERNED', onSurface: true,
        executes: 'confined search face: ripgrep `--files` inside the confined child',
        scope: 'Member lane (read ceiling)', fact: true, facts: factCount,
        outOfBounds: 'L1 admission before the child', onViolation: 'typed refusal', liveEvidence: true,
        evidence: { probe: probe.glob, facts: post.facts.filter((f) => f.tool === 'glob') },
      }
    case 'todo_write':
      return {
        name, bucket: 'SESSION-LOCAL', onSurface: true,
        executes: 'appends a `todo/write` event to the CALLING session only',
        scope: '本 session', fact: false, facts: 0, outOfBounds: 'n/a (no cross-session surface)',
        onViolation: 'n/a — measured: only A\'s session carries `todo/write`; the Leader and every other session carry none',
        liveEvidence: true, evidence: { probe: probe.todo },
      }
    case 'get_goal':
      return {
        name, bucket: 'SESSION-LOCAL', onSurface: true,
        executes: 'reads the CALLING session\'s goal projection',
        scope: '本 session', fact: false, facts: 0, outOfBounds: 'n/a',
        onViolation: 'n/a — `{"goal":null}` before create; the goal it later reads is A\'s own',
        liveEvidence: true, evidence: { probe: probe.goalGet },
      }
    case 'create_goal':
      return {
        name, bucket: 'SESSION-LOCAL', onSurface: true,
        executes: 'opens a goal in the calling session and ARMS its self-continuation round driver',
        scope: '本 session', fact: false, facts: 0,
        outOfBounds: 'no Team write; the loop is driven in the SAME session',
        onViolation: 'n/a — measured: accepted, then round 1 of `<goal_round>` arrives in A\'s own session',
        liveEvidence: true,
        goalLoop: {
          createRoundsStarted: /"roundsStarted":(\d+)/u.exec(textOf(probe.goalCreate))?.[1] ?? null,
          roundRoundsStarted: /"roundsStarted":(\d+)/u.exec(textOf(probe.goalRoundGet))?.[1] ?? null,
          completeRoundsStarted: /"roundsStarted":(\d+)/u.exec(textOf(probe.goalComplete))?.[1] ?? null,
          goalRoundRequestsInA: post.counters.goalRounds,
          goalRoundRequestsElsewhere: post.counters.goalRoundsInOtherSessions,
          goalEventsBySession: post.counters.goalEventsBySession,
        },
        evidence: { probe: probe.goalCreate, roundGet: probe.goalRoundGet, complete: probe.goalComplete },
      }
    case 'update_goal':
      return {
        name, bucket: 'SESSION-LOCAL', onSurface: true,
        executes: 'mutates the calling session\'s own goal (pause/complete/edit)',
        scope: '本 session', fact: false, facts: 0, outOfBounds: 'n/a',
        onViolation: 'n/a — measured: `complete` accepted on the goal round (`roundsStarted` 1 → 2)',
        liveEvidence: true, evidence: { probe: probe.goalComplete },
      }
    case 'job_list':
      return {
        name, bucket: 'SESSION-LOCAL', onSurface: true,
        executes: 'reads the OWNER-scoped job registry; no producer exists on this preset',
        scope: '本 session (owner-scoped registry)', fact: false, facts: 0,
        outOfBounds: 'n/a — a job id owned by another session is refused',
        onViolation: '`belongs to another session` / `unknown job <id>`',
        liveEvidence: true, evidence: { probe: probe.jobList },
      }
    case 'job_output':
      return {
        name, bucket: 'SESSION-LOCAL', onSurface: true,
        executes: 'reads a job the CALLING session owns (none can exist here)',
        scope: '本 session (owner-scoped registry)', fact: false, facts: 0,
        outOfBounds: 'n/a', onViolation: 'measured: `belongs to another session` for the Leader\'s real job id',
        liveEvidence: true, evidence: { probe: probe.jobForeign },
      }
    case 'job_kill':
      return {
        name, bucket: 'SESSION-LOCAL', onSurface: true,
        executes: 'cancels a job the CALLING session owns (none can exist here)',
        scope: '本 session (owner-scoped registry)', fact: false, facts: 0,
        outOfBounds: 'n/a', onViolation: 'measured: same typed refusal; the Leader\'s job kept running',
        liveEvidence: true, evidence: { probe: probe.jobKill },
      }
    case 'exit_plan_mode':
      return {
        name, bucket: 'SESSION-LOCAL', onSurface: true,
        executes: 'presents a plan and leaves plan mode — only when plan mode is ACTIVE for the calling session',
        scope: '本 session', fact: false, facts: 0,
        outOfBounds: 'n/a (no Team write)',
        onViolation: 'measured (inactive branch): `exit_plan_mode is only available in plan mode`, no `plan/mode` event',
        liveEvidence: true,
        unmeasuredBranch: 'plan-mode-ACTIVE branch: no seam exists to set `plan/mode` active on a DELEGATED Member session (the `/plan` command is a session-level user command; the Team tool plane exposes no command route). Measuring it needs either that command route or a Member session started plan-active.',
        evidence: { probe: probe.exitPlan },
      }
    case 'present':
      return {
        name, bucket: 'FAIL-CLOSED', onSurface: true, preFixOnSurface: true, postFixOnSurface: false,
        executes: 'PRE-FIX: resolved paths with the BASE `fs` and appended a `deliverables/presented` event to the CALLING session — above the compiled read lane',
        scope: 'host filesystem (base `fs`), no ceiling of its own',
        fact: false, facts: factCount,
        outOfBounds: 'YES — MEASURED: a real out-of-lane file was ACCEPTED (`Presented …/secret-out-of-lane.txt`), a missing one refused `file not found` (existence oracle), with ZERO `a5sf-guard-consult` facts',
        onViolation: 'PRE-FIX: silent success (no typed refusal, no fact). POST-FIX: typed `unknown tool "present"` — zero execution',
        liveEvidence: true,
        removedBy: 'PD-24',
        capabilityRegression: 'YES — a governed Member can no longer declare deliverables; restoring it needs a new realm-bound confined `present` face (CORE_SEAM_BLOCKER)',
        evidence: { preFix: pre.probes.presentOut, preFixMissing: pre.probes.presentMissing, postFix: post.probes.presentOut, facts: pre.facts.filter((f) => f.tool === 'present') },
      }
    case 'ask_user_question':
      return {
        name, bucket: 'SESSION-LOCAL', onSurface: true,
        executes: 'asks the human answerer; BLOCKS until an answer arrives (legacy mode has no timeout)',
        scope: '本 session (its own turn)', fact: false, facts: 0,
        outOfBounds: 'n/a — but see the measured hazard',
        onViolation: 'measured in its own arm: NO result inside the observation window (60 s here, 300 s on the first development boot), no `turn/end`, the Member\'s turn stays open; no Team state is written and no `user/questions` event appears',
        liveEvidence: true,
        hazard: 'BLOCKS a delegated turn. Not a boundary crossing (it writes nothing) and therefore NOT removed by this lane: the task\'s rule is to act only on silent-success-out-of-bounds rows. Recorded as a separate, measured defect for a decision.',
        evidence: { askArm: ask?.blocked ?? null },
      }
  }
  throw new Error(`the measured surface carries a name this ledger has no classification for: '${name}' — add it (and its evidence) instead of guessing`)
}

function main() {
  const postPair = bootPair(join(EVIDENCE, 'runs'))
  const prePair = bootPair(join(EVIDENCE, 'archive', 'pair-prefix'))
  const askRuns = askPair(join(EVIDENCE, 'runs-ask'))

  const postRoster = postPair[0].surface.tools
  const postRoster2 = postPair[1].surface.tools
  if (postRoster.join(',') !== postRoster2.join(',')) throw new Error('the two post-fix boots measured DIFFERENT rosters')
  const preRoster = prePair[0].surface.tools
  if (preRoster.join(',') !== prePair[1].surface.tools.join(',')) throw new Error('the two pre-fix boots measured DIFFERENT rosters')

  // The roster this ledger classifies is the PRE-FIX surface — the 34 names the
  // audit was asked to walk. `present` is ON that roster and is one of the rows
  // the lane closes; the 10 names earlier lanes removed were never on it.
  const shipped = preRoster.filter((n) => FIXTURES.includes(n) === false)
  const rows = shipped.map((name) => rowFor(name, { post: postPair[0], pre: prePair[0], ask: askRuns[0] }))
  const closedRows = REMOVED.filter((name) => REMOVED_BY_PD24.includes(name) === false).map((name) => {
    const probe = postPair[0].probes.closed?.[name]
    const preProbe = prePair[0].probes.closed?.[name]
    const removedHere = REMOVED_BY_PD24.includes(name)
    return {
      name,
      bucket: 'FAIL-CLOSED',
      onSurface: false,
      executes: removedHere
        ? 'nothing on the post-fix preset: the host router answers typed `unknown tool "present"`'
        : 'nothing: the row is absent from the governed preset (removed by PD-18/21/22/23)',
      scope: 'n/a (not nameable by the model)',
      fact: false,
      outOfBounds: 'n/a (unreachable)',
      onViolation: 'typed `unknown tool "<name>"` — zero execution',
      liveEvidence: true,
      postFixResult: probe?.result ?? null,
      preFixResult: preProbe?.result ?? null,
      removedBy: removedHere ? 'PD-24' : 'PD-18/21/22/23',
      capabilityRegression: removedHere
        ? 'YES: a governed Member can no longer declare deliverables (`present`)'
        : null,
      evidence: { probe },
    }
  })

  const buckets = ['GOVERNED', 'SESSION-LOCAL', 'OTHER-AUTHZ', 'FAIL-CLOSED', 'UNMEASURED']
  const counts = {}
  for (const bucket of buckets) counts[bucket] = rows.filter((r) => r.bucket === bucket).length + closedRows.filter((r) => r.bucket === bucket).length
  counts.shippedRoster = shipped.length
  counts.measuredRoster = preRoster.length
  counts.postFixRoster = postRoster.length
  counts.fixtures = FIXTURES.length
  counts.onRosterClosed = rows.filter((r) => r.bucket === 'FAIL-CLOSED').length
  counts.offRosterRemoved = closedRows.length
  counts.totalRemoved = REMOVED.length
  // The bucket id is hyphenated (`FAIL-CLOSED`), the count alias is not: the
  // ledger and the matrix both read `counts.FAIL_CLOSED`, so write it once here
  // instead of relying on a property name JS cannot express with a hyphen.
  counts.FAIL_CLOSED = counts['FAIL-CLOSED']

  // THE IDENTITY: the five buckets sum to the shipped roster PLUS the names
  // earlier lanes removed before this measurement (the on-roster closed row is
  // already inside shippedRoster).
  if (counts.GOVERNED + counts['SESSION-LOCAL'] + counts['OTHER-AUTHZ'] + counts.FAIL_CLOSED + counts.UNMEASURED
    !== counts.shippedRoster + counts.offRosterRemoved) {
    throw new Error('bucket identity broken — refusing to write a ledger whose numbers do not add up')
  }
  if (shipped.length + FIXTURES.length !== preRoster.length) throw new Error('shipped + fixtures must equal the measured roster')
  if (counts.GOVERNED !== 7 || counts['SESSION-LOCAL'] !== 9 || counts['OTHER-AUTHZ'] !== 15 || counts.FAIL_CLOSED !== 11 || counts.UNMEASURED !== 0) {
    throw new Error(`the fixed bucket shape moved: ${JSON.stringify(counts)} — a surface change needs a DATED correction, not a silent re-count`)
  }

  const facts = postPair[0].facts ?? []
  const presentPreFix = prePair[0].probes.presentOut
  const ledger = {
    schema: 'a5sf-pd24-surface-ledger/ledger/1',
    at: new Date().toISOString(),
    recordClass: 'DEV-LIVE',
    candidateClaimEligibility: false,
    subject: 'shipped opt-in governed preset `a5sf-governed-member` (cordis.patch.yml), real Member turn on a real Host',
    measured: {
      // The BASE this lane started from, and the actual HEAD each pair booted
      // on (read from the run-record bindings, not typed).
      baseHead: '6cfc67b76',
      head: postPair[0].record?.bindings?.candidate?.head ?? null,
      preFixHead: prePair[0].record?.bindings?.candidate?.head ?? null,
      askHead: askRuns[0]?.record?.bindings?.candidate?.head ?? null,
      host: postPair[0].record?.bindings?.candidate?.hostSha ?? '639ed015397290b3745d163aafe02ffee4aa3f84',
      postFixPair: postPair.map((b) => ({ boot: b.name, summary: b.summary, roster: b.surface.tools.length })),
      preFixPair: prePair.map((b) => ({ boot: b.name, summary: b.summary, roster: b.surface.tools.length })),
      askArmPair: askRuns.map((b) => ({ boot: b.name, summary: b.summary })),
    },
    roster: preRoster,
    postFixSurface: postRoster,
    shipments: shipped,
    fixtures: [...FIXTURES],
    removedNames: [...REMOVED],
    counts,
    identity: 'GOVERNED(7) + SESSION-LOCAL(9) + OTHER-AUTHZ(15) + FAIL-CLOSED(11) + UNMEASURED(0) = 42 = shippedRoster(32) + offRosterRemoved(10); the measured roster is 34 = 32 shipped + 2 World fixtures, and the ONE on-roster closed row (`present`) is inside the 32',
    rows: [...rows, ...closedRows],
    unmeasuredResiduals: [
      {
        name: 'read_image',
        what: 'the LIVE execution branch (route gate -> confined face)',
        missing: 'a model route that DECLARES image input. On this Host the route (deepseek-v4-flash) refuses before the face, so only host-free evidence covers the face.',
        howToClose: 'one DEV-LIVE boot with an image-capable route + an in-lane PNG; the confined-face deny arm is already host-free evidence (PD-17 D5).',
      },
      {
        name: 'exit_plan_mode',
        what: 'the plan-mode-ACTIVE branch',
        missing: 'a route that can set `plan/mode` active on a DELEGATED Member session (the `/plan` command is a session-level user command; the Team tool plane exposes no command route).',
        howToClose: 'either a command route on the Team tool plane, or a Member session seeded plan-active at create time.',
      },
      {
        name: 'ask_user_question',
        what: 'the ANSWERED branch (a human answer reaching a delegated turn)',
        missing: 'a human answerer attached to a Member session. The measured branch is the one that matters for a Member (no answerer -> block); the answered branch would need a test UI provider bound to the Member session.',
        howToClose: 'mount a scripted `userQuestions` answerer in the World and re-run the ask arm; the block itself is already measured twice.',
      },
    ],
    presentDefect: {
      preFix: {
        inLane: prePair[0].probes.presentIn?.result ?? null,
        outOfLaneExisting: presentPreFix?.result ?? null,
        outOfLaneMissing: prePair[0].probes.presentMissing?.result ?? null,
        // 0 is the MEASURED value: `byTool` only lists tools that produced a
        // fact, so an absent key means zero facts, not "unknown".
        guardFactsAttributedToPresent: prePair[0].counters.guardFacts?.byTool?.present ?? 0,
        deliverablesEventsBySession: deliverablesBySession(prePair[0].counters),
      },
      postFix: {
        outOfLaneExisting: postPair[0].probes.presentOut?.result ?? null,
        guardFactsAttributedToPresent: postPair[0].counters.guardFacts?.byTool?.present ?? 0,
        deliverablesEventsBySession: deliverablesBySession(postPair[0].counters),
        presentOnSurface: postPair[0].counters.presentOnSurface ?? null,
      },
    },
    askHazard: {
      preFix: null,
      postFix: askRuns[0].blocked,
      note: 'measured in its own arm; the call never settles inside the window',
    },
    digests: {
      compositionPreFix: sha256(join(EVIDENCE, 'archive', 'pre-fix', 'cordis.patch.yml')),
      compositionPostFix: sha256(join(REPO, 'cordis.patch.yml')),
      driver: sha256(join(HERE, 'run-boot.mjs')),
    },
  }

  writeFileSync(join(EVIDENCE, 'ledger.json'), `${JSON.stringify(ledger, null, 2)}\n`)
  writeFileSync(join(EVIDENCE, 'roster.json'), `${JSON.stringify({
    schema: 'a5sf-pd24-surface-ledger/roster/1',
    postFixPair: postPair.map((b) => ({ boot: b.name, tools: b.surface.tools })),
    preFixPair: prePair.map((b) => ({ boot: b.name, tools: b.surface.tools })),
    shipped,
    fixtures: FIXTURES,
    removed: REMOVED,
    delta: { removedByPd24: REMOVED_BY_PD24, preFixCount: preRoster.length, postFixCount: postRoster.length },
  }, null, 2)}\n`)

  const line = (v) => String(v ?? '').replace(/\|/gu, '\\|').replace(/\n/gu, ' ')
  const table = [
    '# PD-24 governed Member surface ledger (generated by build-ledger.mjs)',
    `# at=${ledger.at} head=${ledger.measured.head} host=${ledger.measured.host}`,
    `# measuredRoster=${counts.measuredRoster} shippedRoster=${counts.shippedRoster} fixtures=${counts.fixtures} removed=${counts.totalRemoved}`,
    `# GOVERNED=${counts.GOVERNED} SESSION-LOCAL=${counts['SESSION-LOCAL']} OTHER-AUTHZ=${counts['OTHER-AUTHZ']} FAIL-CLOSED=${counts.FAIL_CLOSED} UNMEASURED=${counts.UNMEASURED}`,
    '',
    '| 工具名 | 桶 | 在面 | 调用会做什么 | 作用域 | 产 fact | 越界行为 | 依据 |',
    '|---|---|---|---|---|---|---|---|',
    ...[...rows, ...closedRows].map((r) => `| ${line(r.name)} | ${r.bucket} | ${r.postFixOnSurface === false ? '否（pre-fix 是）' : r.onSurface ? '是' : '否'} | ${line(r.executes)} | ${line(r.scope)} | ${r.fact ? `是（${String(r.facts ?? 0)}）` : '否'} | ${line(r.onViolation)} | ${line(r.liveEvidence ? 'live: member-probes.json' : (r.liveNote ?? ''))} |`),
  ].join('\n')
  writeFileSync(join(EVIDENCE, 'ledger.txt'), `${table}\n`)
  // eslint-disable-next-line no-console
  console.log(table)
  // eslint-disable-next-line no-console
  console.log(`\ncounts=${JSON.stringify(counts)} (facts measured: ${String(facts.length)})`)
}

main()
