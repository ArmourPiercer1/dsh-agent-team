#!/usr/bin/env node
/**
 * run5-oracle-digest — a credential-free, machine-readable measurement excerpt
 * for the six rc2 smoke oracle attributions (evidence 08), so a reviewer can
 * check the claim against data instead of prose.
 *
 * Design rules, enforced in code:
 *  - WHITELIST ONLY. Fields are copied by name from a fixed list. Nothing here
 *    copies a full system prompt, a request body, a header, an env var, or any
 *    log line beyond the kit's own `check()` result lines.
 *  - For long text the digest emits length + sha256 + marker-presence booleans,
 *    never the text itself.
 *  - Before writing, the whole document is scanned for credential shapes
 *    (boot-token / `?token=` / authorization / bearer / api-key). Any hit makes
 *    the script exit 2 WITHOUT writing output.
 *  - Deterministic: no wall-clock, sorted keys, so re-running reproduces the
 *    same bytes and the reviewer can diff against the committed copy.
 *
 * Read-only w.r.t. the repository: it reads evidence files and `git show` blobs.
 * It never runs the kit and never touches a host.
 *
 * Usage: node dev/agent-workflow/evidence/dsh-020rc2-upgrade/tools/run5-oracle-digest.mjs [--out <file>]
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const EVIDENCE = join(HERE, '..')
const RUN_DIR = join(EVIDENCE, 'rc2-smoke-run5')
const REPO = join(EVIDENCE, '..', '..', '..', '..')

/** The pinned revisions the excerpt is traceable to. */
const SHA = {
  /** The revision the run actually executed against - still the inline readers. */
  ran_at: '65f07a26fe7a8ad1a034cfba16d16ab0859438ad',
  /** The revision the independent reviewer locked: readers already replaced. */
  locked_for_review: '00a9a3910cc6ac4711c7cd078be7fcebabbe468c',
  runner_fix: 'd4ff5f0b9759b3a309e172fa9f201a02998fed98',
  patch_apply: '97efc2d62f03af606181722c228ab23f876aa200',
}
const RUNNER_PATH = 'tests/kits/rc2-real-host-smoke/rc2-real-host-smoke.mjs'
const WIRE_PATH = 'tests/kits/rc2-real-host-smoke/wire-shape.mjs'

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')
const gitShow = (sha, path) => execFileSync('git', ['show', `${sha}:${path}`], { cwd: REPO, encoding: 'utf8' })
const num = (n) => n

/** Files whose bytes this digest is derived from (measured, not asserted). */
const INPUTS = [
  'rc2-smoke-run5/mock-requests.json',
  'rc2-smoke-run5/run.log',
  'rc2-smoke-run5/run-budget.json',
  'rc2-smoke-run5/s1-b-leader-request.json',
  'rc2-smoke-run5/s4-b-member-request.json',
]

function inputManifest() {
  return INPUTS.map((rel) => {
    const buf = readFileSync(join(EVIDENCE, rel))
    return { path: rel, bytes: num(buf.length), sha256: sha256(buf) }
  })
}

/** Kit source at a pinned revision: hash + the extractor-family call sites. */
function sourceTrace(sha, path) {
  const text = gitShow(sha, path)
  const lines = text.split('\n')
  const families = {
    inline_role_tool: /messages\s*\.\s*(find|filter)\s*\(.*role === 'tool'/g,
    inline_role_system: /role === 'system'/g,
    generation_aware_tool_results: /toolMsgsOf\s*\(|toolResultEntries\s*\(/g,
    generation_aware_system_text: /systemTextOf\s*\(|wsSystemText\s*\(/g,
  }
  const sites = {}
  for (const [name, re] of Object.entries(families)) {
    const hits = []
    lines.forEach((line, i) => {
      if (name === 'generation_aware_tool_results' && /^\s*(function|const)\s/.test(line) && !line.includes('(')) return
      if (re.test(line)) hits.push({ line: num(i + 1), text: line.trim().slice(0, 160) })
    })
    sites[name] = hits
  }
  return { sha, path, bytes: num(Buffer.byteLength(text)), sha256: sha256(Buffer.from(text)), lines: num(lines.length), extractor_sites: sites }
}

/** The kit's own check() result lines: `[ts] PASS|FAIL <id>: <name> — <detail>`. */
function parseChecks(runLog) {
  const out = []
  runLog.split('\n').forEach((line) => {
    const m = /^\[(\S+)\]\s+(PASS|FAIL)\s+([A-Za-z0-9]+):\s+(.*?)(?: — (.*))?$/.exec(line)
    if (m === null) return
    out.push({
      criterion: m[3],
      verdict: m[2] === 'PASS' ? 'pass' : 'fail',
      name: m[4].slice(0, 200),
      detail_sha256: sha256(Buffer.from(m[5] ?? '')),
      detail_chars: num((m[5] ?? '').length),
      // `result=` / `hasX=` are the extractors' own reported observations, and
      // they are the measurement this digest exists to expose.
      extractor_report: (m[5] ?? '').slice(0, 120).split(' obs(')[0],
      seq_stamp: m[1],
    })
  })
  return out.sort((a, b) => a.criterion.localeCompare(b.criterion))
}

/** Per-request rows, copied field-by-field from the mock recorder's whitelist. */
function perRequest(records) {
  const markerNames = ['RC2SMK_A_LEADER', 'RC2SMK_B_LEADER', 'RC2SMK_A_WORKER', 'RC2SMK_B_WORKER', 'RC2SMK_C_WORKER', 'RC2MK_B', 'RC2MK_BMEM', 'RC2MK_C', 'RC2MK_CMEM', 'rc2-smoke-team-probe', 'rc2-smoke']
  return records.map((r) => {
    const userText = typeof r.userText === 'string' ? r.userText : ''
    const replyText = typeof r.reply?.content === 'string' ? r.reply.content : ''
    return {
      seq: num(r.seq),
      received_at: r.receivedAt,
      // The kit records `toolMsgsOf(r).length`, i.e. the GENERATION-AWARE count
      // (tool results nested in role:user parts included). It is NOT a count of
      // role:'tool' messages; the six failing oracles used that other reader.
      tool_results_via_generation_aware_reader: num(r.toolMsgCount),
      user_text_chars: num(userText.length),
      user_text_truncated_by_recorder: userText.length >= 300,
      user_text_markers: markerNames.filter((k) => userText.includes(k)).sort(),
      reply_kind: r.reply?.kind ?? null,
      reply_markers: markerNames.filter((k) => replyText.includes(k)).sort(),
    }
  })
}

/** The two recorded system-prompt strings, reduced to length + hash + presence bits. */
function promptMeasurements() {
  const shippedPersona = 'You are an AI agent powered by DeepSeek Harness'
  const files = [
    { file: 'rc2-smoke-run5/s1-b-leader-request.json', label: 'leader_request', oracle: 'S4b/S1a' },
    { file: 'rc2-smoke-run5/s4-b-member-request.json', label: 'member_request', oracle: 'S4e' },
  ]
  return files.map(({ file, label, oracle }) => {
    const rec = JSON.parse(readFileSync(join(EVIDENCE, file), 'utf8'))
    const sp = typeof rec.systemPrompt === 'string' ? rec.systemPrompt : ''
    return {
      label,
      oracle,
      source_file: file,
      seq: num(rec.seq),
      // Which extractor produced this string, derived from the writeEvidence call
      // and the assignment behind it - see promptProvenance(). Neither value is the
      // full system prompt; both are whatever that reader returned.
      produced_by: promptProvenance(file.split('/').pop()),
      chars: num(sp.length),
      sha256: sha256(Buffer.from(sp)),
      markers: {
        shipped_deployment_persona: sp.includes(shippedPersona),
        leader_B_persona: /RC2SMK_B_LEADER_/.test(sp),
        leader_A_persona: /RC2SMK_A_LEADER_/.test(sp),
        worker_B_persona: /RC2SMK_B_WORKER_/.test(sp),
        worker_A_persona: /RC2SMK_A_WORKER_/.test(sp),
        worker_C_persona: /RC2SMK_C_WORKER_/.test(sp),
      },
      tools_recorded: Array.isArray(rec.tools) ? num(rec.tools.length) : null,
    }
  })
}

/**
 * How big the joined string is for each tool-result criterion, DERIVED from the
 * revision that ran rather than asserted.
 *
 * `toolResultTextOf` joins the tool results carried inside ONE request body, so the
 * size of what a criterion tested equals that request's own tool-result count - the
 * number the kit recorded as `toolMsgCount` (it records `toolMsgsOf(r).length`).
 * The waiter for each step states the count it waited for
 * (`toolMsgsOf(r).length === N`), so the criterion -> seq -> count chain can be
 * reconstructed instead of guessed:
 *
 *   S1a -> "B chain step 1"  -> N=1 -> seq 5
 *   S2a -> "B chain step 2"  -> N=2 -> seq 6
 *   S3b -> "B chain step 3"  -> N=3 -> seq 7
 *   S4c -> "B chain step 4"  -> N=4 -> seq 8
 *
 * A cross-request running total (the 10 / 15 figures an earlier revision of this
 * digest printed) is NOT what any criterion tested and has been removed: it summed
 * results across all 17 requests, which flatters the pollution argument instead of
 * stating it.
 */
function joinScope(requests) {
  const ranAt = gitShow(SHA.ran_at, RUNNER_PATH)
  const ranAtLines = ranAt.split('\n')
  const bound = criterionExtractors().filter((c) => c.at_ran_at?.variable != null)
  const rows = []
  for (const row of bound) {
    const expr = row.at_ran_at.expression ?? ''
    // The extractor reads one request variable (`bS1` … `bS4`); that waiter is the
    // only place stating how many tool results the request had to carry, which is
    // exactly the size of the join the criterion then tested.
    const reqVar = /\(\s*(b[A-Za-z0-9]+)\.body/.exec(expr)?.[1]
    if (reqVar === undefined) continue
    const waiterLine = ranAtLines.find((l) => new RegExp(`^\\s*const\\s+${reqVar}\\s*=\\s*await\\s+waitForMock`).test(l)) ?? ''
    const wanted = /toolMsgsOf\(r\)\.length === (\d+)/.exec(waiterLine)?.[1]
    if (wanted === undefined) continue
    const match = requests.find((r) => r.tool_results_via_generation_aware_reader === Number(wanted))
    rows.push({
      criterion: row.criterion,
      request_variable: reqVar,
      waiter_required_tool_results: num(Number(wanted)),
      matched_seq: match?.seq ?? null,
      earlier_results_inside_the_same_request: num(Number(wanted) - 1),
      derivation: `const ${reqVar} = await waitForMock(... toolMsgsOf(r).length === ${wanted}) at ran-at line ${(ranAtLines.indexOf(waiterLine) + 1) || null} + the recorded toolMsgCount`,
    })
  }
  return {
    join_scope: 'one request body (not the run, not the session)',
    criterion_to_request: rows,
    pollution_consequence: 'For S3b the joined string carries the S1 and S2 results alongside the bash output; for S4c it carries S1-S3, which includes the S2 deny text. A substring test against the join can therefore pass on an earlier result - a weaker oracle than the criterion intends.',
    removed_metric: 'cumulative_results_by_seq - a cross-request running total (10 by seq 9, 15 by seq 11) describing the run rather than any request. No criterion reads a cross-request total, so the figure neither supported nor weakened the pollution point and it has been dropped.',
  }
}

/**
 * Which extractor produced each persisted system-prompt string - derived from the
 * writeEvidence call and the assignment of the variable it passed, because an
 * earlier revision of this digest asserted "inline role-system filter" for both
 * files and that was wrong for the leader.
 */
function promptProvenance(file) {
  const ranAt = gitShow(SHA.ran_at, RUNNER_PATH).split('\n')
  const callLine = ranAt.find((l) => l.includes(`writeEvidence('${file}'`)) ?? ''
  const varName = /systemPrompt:\s*([A-Za-z_$][\w$]*)/.exec(callLine)?.[1]
  if (varName === undefined) return { variable: null, extractor: 'unknown', line: null, source_line: null }
  const callNo = ranAt.findIndex((l) => l === callLine) + 1
  if (varName === 'systemPrompt') {
    const decl = ranAt.findIndex((l, i) => i < callNo && new RegExp(`^\\s*const\\s+${varName}\\s*=`).test(l))
    const declLine = decl >= 0 ? ranAt[decl] : ''
    return {
      variable: varName,
      extractor: /systemTextOf\s*\(/.test(declLine) ? 'generation-aware systemTextOf helper' : 'unresolved',
      line: decl >= 0 ? num(decl + 1) : null,
      source_line: declLine.trim().slice(0, 160),
    }
  }
  const declIdx = ranAt.findIndex((l, i) => i < callNo && new RegExp(`^\\s*const\\s+${varName}\\s*=`).test(l))
  const declLine = declIdx >= 0 ? ranAt[declIdx] : ''
  const body = declIdx >= 0 ? ranAt.slice(declIdx, declIdx + 5).join(' ') : ''
  return {
    variable: varName,
    extractor: /role === 'system'/.test(body) ? "inline filter role === 'system' (the 0.1 envelope)"
      : /systemTextOf\s*\(/.test(body) ? 'generation-aware systemTextOf helper' : 'unresolved',
    line: declIdx >= 0 ? num(declIdx + 1) : null,
    source_line: declLine.trim().slice(0, 160),
  }
}

/**
 * Bind each criterion to the exact extractor expression that produced its
 * observation, in the revision that ran (ran_at) and in the locked revision, so the
 * attribution is checkable against source rather than against prose.
 */
function criterionExtractors() {
  const before = gitShow(SHA.ran_at, RUNNER_PATH).split('\n')
  const after = gitShow(SHA.locked_for_review, RUNNER_PATH).split('\n')
  const ids = ['S1a', 'S2a', 'S3b', 'S4b', 'S4c', 'S4e', 'S5b', 'S5c']
  const checkSites = (lines, id) => lines.map((l, i) => (l.includes("check('" + id + "'") ? i : -1)).filter((i) => i >= 0)
  const EXTRACTORISH = /role === 'tool'|role === 'system'|toolResultTextOf|systemTextOf|toolMsgsOf|toolResultEntries|wsSystemText/
  const bindAt = (lines, i, skipWaiters) => {
    const callText = lines.slice(i, i + 8).join(' ')
    for (let j = i; j > Math.max(-1, i - 45); j -= 1) {
      const m = /^\s*const\s+(\w+)\s*=\s*(.+)$/.exec(lines[j])
      if (m === null) continue
      if (!callText.includes(m[1])) continue
      // The assignment may span lines (a multi-line filter/map chain), so the
      // expression is read to paren balance rather than one source line.
      let expr = m[2]
      let depth = 0
      for (const ch of expr) { if (ch === '(' || ch === '[' || ch === '{') depth += 1; else if (ch === ')' || ch === ']' || ch === '}') depth -= 1 }
      let k = j
      // Continue over a balanced first line when the next line is a method-chain
      // continuation (`\n  .filter(...)`) - that is how the inline persona readers
      // were written.
      const chainNext = (n) => /^\s*\??\./.test(lines[n] ?? '')
      while ((depth > 0 || chainNext(k + 1)) && k + 1 < lines.length && k - j < 8) {
        k += 1
        expr += ` ${lines[k].trim()}`
        for (const ch of lines[k]) { if (ch === '(' || ch === '[' || ch === '{') depth += 1; else if (ch === ')' || ch === ']' || ch === '}') depth -= 1 }
      }
      if (!EXTRACTORISH.test(expr)) continue
      if (skipWaiters && /waitForMock/.test(expr)) continue
      return {
        line: num(j + 1),
        through_line: num(k + 1),
        variable: m[1],
        expression: expr.trim().replace(/\s+/g, ' ').slice(0, 240),
      }
    }
    return null
  }
  const bind = (lines, id) => {
    // One id can be checked twice (a negative "turn started" guard and the real
    // assertion), so try every site and prefer an extractor-bound variable over a
    // waiter or the guard line itself.
    const all = checkSites(lines, id)
    // A negative guard site (pass literal false, e.g. "the turn started") is not
    // the assertion; prefer the real one.
    const real = all.filter((i) => !/\(\s*'\w+',\s*'[^']*',\s*false,/.test(lines[i]))
    const sites = real.length > 0 ? real : all
    for (const skipWaiters of [true, false]) {
      for (const i of sites) {
        const hit = bindAt(lines, i, skipWaiters)
        if (hit !== null) return hit
      }
    }
    const first = sites[0] ?? -1
    if (first < 0) return null
    return { line: num(first + 1), variable: null, expression: lines[first].trim().slice(0, 180), extractor_bound: false }
  }
  return ids.map((id) => ({
    criterion: id,
    at_ran_at: bind(before, id),
    at_locked_head: bind(after, id),
  }))
}

/**
 * Per-criterion attribution, each entry naming the measurement it rests on. No
 * entry claims more than its evidence: `not_attributable` is a legitimate value.
 */

/**
 * Per-criterion attribution. Each row names the measurement it rests on and stops
 * there: `reader_defect_proven_outcome_unverified` means the expression is proven
 * to return the empty string on this host generation, so the FAIL carries no
 * information about the feature - it does NOT mean the feature works, and a
 * host-side problem underneath is not excluded.
 */
function attributionTable() {
  return [
    {
      criterion: 'S1a',
      verdict: 'fail',
      status: 'reader_defect_proven_outcome_unverified',
      evidence: [
        'criterion_extractors: at 65f07a26 the value came from body.messages.find(m => m.role === "tool")',
        'the waiter that produced this request required 1 tool result and the recorded toolMsgCount at seq 5 is 1, so a result was carried on the wire',
        'criteria[S1a].extractor_report is `result=` (empty)',
      ],
      does_not_establish: 'that reading team/test.md returned the probe content; only that this reader could not have seen it',
    },
    {
      criterion: 'S2a',
      verdict: 'pass',
      status: 'pass_on_a_different_lane',
      evidence: [
        'the assertion is over the durable observation lane (alpha2-perm canonicalized / decision rows), which is separate from the transcript reader',
        'criteria[S2a].extractor_report is `result=` (empty) even though the verdict is pass',
      ],
      does_not_establish: 'anything about the tool-result path; the static-deny observation is what passed',
    },
    {
      criterion: 'S3b',
      verdict: 'fail',
      status: 'reader_defect_proven_outcome_unverified',
      evidence: [
        'same expression class as S1a',
        'its waiter required 3 tool results and the recorded toolMsgCount at seq 7 is 3',
        'S3a (the durable approval row) passed, which is the observation lane, not the transcript',
      ],
      does_not_establish: 'that the approved bash output reached the model. Note too that the current replacement joins S1/S2 results inside this same request, so it can satisfy this criterion on an earlier result',
    },
    {
      criterion: 'S4c',
      verdict: 'fail',
      status: 'reader_defect_proven_outcome_unverified',
      evidence: [
        'same expression class as S1a',
        'its waiter required 4 tool results and the recorded toolMsgCount at seq 8 is 4 - seq 11 / 5 results is a later request and is NOT what S4c read',
      ],
      does_not_establish: 'that create-member succeeded or failed on 0.2. Adjacent criteria do not cover it either: S4a is the team.create control-plane call on the fresh root and S4d is only "delegate tool result observed" - neither is a durable member-record or roster proof',
    },
    {
      criterion: 'S4e',
      verdict: 'fail',
      status: 'reader_defect_proven_outcome_unverified',
      evidence: [
        'prompt_measurements[member_request seq 9]: the persisted value came from the inline role === "system" filter and is 0 characters',
        'the same run S4b shows the generation-aware helper returning 4000 characters on the leader request',
      ],
      does_not_establish: 'that blueprint B persona was or was not bound on the member call; the helper output for that seq was never persisted',
    },
    {
      criterion: 'S5b',
      verdict: 'fail',
      status: 'reader_defect_proven_outcome_unverified',
      evidence: [
        'same inline expression class as S4e, on the C member request',
        'S5c, reading through systemTextOf on the same run, passed',
      ],
      does_not_establish: 'that blueprint C persona resolution works root-scoped',
    },
    {
      criterion: 'S4b',
      verdict: 'pass',
      status: 'control_for_the_helper_lane',
      evidence: [
        'criterion_extractors: systemTextOf(bStart) at both revisions',
        'prompt_measurements[leader_request seq 3] records that the persisted string came from that helper call: 4000 characters, B leader persona present, A absent',
      ],
      does_not_establish: 'the member-side persona question in S4e; it shows the helper lane works on a leader request',
    },
    {
      criterion: 'S5c',
      verdict: 'pass',
      status: 'control_for_the_helper_lane',
      evidence: ['criterion_extractors: systemTextOf(bMemberAgain) at both revisions'],
      does_not_establish: 'the C-persona question in S5b; it shows the helper lane works on a member request',
    },
  ]
}

function frozenFiles() {
  return [RUNNER_PATH, 'tests/kits/rc2-real-host-smoke/runner-wiring.regression.test.mjs'].map((path) => {
    const text = gitShow(SHA.locked_for_review, path)
    const worktree = execFileSync('git', ['show', `HEAD:${path}`], { cwd: REPO, encoding: 'utf8' })
    return {
      path,
      sha256_at_locked_head: sha256(Buffer.from(text)),
      identical_in_current_worktree: text === worktree,
      note: 'read-only for this digest; the pending two-file reader patch belongs to the reviewer',
    }
  })
}

function main() {
  const outIdx = process.argv.indexOf('--out')
  const outFile = outIdx > -1 ? process.argv[outIdx + 1] : join(EVIDENCE, 'rc2-smoke-run5/run5-oracle-digest.json')

  const records = JSON.parse(readFileSync(join(RUN_DIR, 'mock-requests.json'), 'utf8'))
  const budgetFile = JSON.parse(readFileSync(join(RUN_DIR, 'run-budget.json'), 'utf8'))
  const budget = budgetFile.budget ?? budgetFile
  const runLog = readFileSync(join(RUN_DIR, 'run.log'), 'utf8')
  const requests = perRequest(Array.isArray(records) ? records : records.requests ?? [])

  const doc = {
    schema: 'dsh-agent-team.rc2-oracle-attribution/1',
    purpose: 'Credential-free measurement excerpt behind evidence 08 (smoke run 5). Supports independent review of the six-oracle attribution; it is not a compatibility verdict.',
    provenance: {
      ran_at_head: SHA.ran_at,
      locked_head_for_review: SHA.locked_for_review,
      runner_fix_commit: SHA.runner_fix,
      patch_apply_commit: SHA.patch_apply,
      run_stamp: '2026-10-03T16-28-45',
      run_verdict_from_log: (runLog.match(/VERDICT \w+[^\n]*/) ?? [''])[0].slice(0, 200),
      raw_folder_status: 'private: rc2-smoke-run5/instance.log and instance-tail.txt carry the live web boot token and are NOT committed',
      inputs: inputManifest(),
    },
    budget: {
      source_file: 'rc2-smoke-run5/run-budget.json',
      total_requests: num(budget.totalRequests ?? 0),
      scenario_requests: num(budget.scenarioRequests ?? 0),
      consecutive_misses: num(budget.consecutiveMisses ?? 0),
      per_session_max_observed: num(Math.max(0, ...Object.values(budget.perSession ?? {}))),
      per_state_max_observed: num(Math.max(0, ...Object.values(budget.perState ?? {}))),
      limits_recorded_by_the_run: budgetFile.limits ?? null,
      measurement_origin: 'run-budget.json was written by the kit during the run. The post-run process/port census and the :3080 probe quoted in evidence 08 are single-observer measurements taken in this VM (ss -ltnH, filtered ps -eo args); they have NOT been independently reproduced and should be read as reported-by-this-host.',
      violation_recorded_by_the_run: budgetFile.violation ?? null,
      abort_history_entries: num((budget.history ?? []).length),
    },
    sources: [
      sourceTrace(SHA.ran_at, RUNNER_PATH),
      sourceTrace(SHA.locked_for_review, RUNNER_PATH),
      sourceTrace(SHA.locked_for_review, WIRE_PATH),
    ],
    criterion_extractors: criterionExtractors(),
    criteria: parseChecks(runLog),
    per_request: requests,
    prompt_measurements: promptMeasurements(),
    tool_result_join_scope: joinScope(requests),
    per_criterion_attribution: attributionTable(),
    frozen_files: frozenFiles(),
    attribution_rules: [
      'A criterion is attributed to the reader, not the host, only where the same run recorded a generation-aware count > 0 (per_request.tool_results_via_generation_aware_reader) or a passing sibling criterion (S4b, S5c) that used the helper on the same request.',
      'Nothing in this file is evidence that persona binding, post-approval execution or create-member work on 0.2. It is evidence about what the two extractors reported.',
    ],
    gaps: [
      'MISSING, not estimated: the mock recorder at the ran-at revision kept seq/receivedAt/userText(300 chars)/toolMsgCount/reply only - no message array, no role/content shape, no tool-result content. Nothing in this file reconstructs them: no synthesized entries, no placeholders presented as data, no re-derived bodies. A field that cannot be measured is reported as missing, and the only honest fix is a whitelisted body digest in the recorder plus a later run.',
      'For the member request only the inline-reader output was persisted (chars 0). The generation-aware systemTextOf output for that same seq was never written to a file, so the helper side is evidenced indirectly: S4b and S5c passed through systemTextOf on the same run, and the waiter for that request matched on userTextOf plus a tool/tool-count condition.',
      'toolMsgCount is the generation-aware count, so this run cannot state what a 0.1 role:tool count would have been; the claim that the 0.1 lookup is empty rests on the kit check lines (result= / hasB=false) plus the source expressions quoted under sources[].',
    ],
    corrections_in_this_revision: [
      'cumulative_results_by_seq removed: it was a cross-request running total (10 by seq 9, 15 by seq 11) and no criterion reads one; the join under review is inside a single request body.',
      'S4c re-bound from seq 11 / 5 results to seq 8 / 4 results: its waiter (bS4) requires toolMsgsOf(r).length === 4, and seq 11 is a later request (the delegate-result step).',
      'leader prompt provenance corrected: s1-b-leader-request.json was written from systemTextOf(bStart) (the generation-aware helper), not the inline role-system filter; only the member file came from the inline filter. The provenance is now derived from the writeEvidence call and the assignment behind it rather than asserted.',
      'S4a / S4d roles corrected: S4a is the team.create control-plane call on the fresh root, S4d is "delegate tool result observed". Neither is a durable member-record or roster proof, so the earlier claim that they showed the create path was fine has been dropped.',
      'attribution wording narrowed throughout to reader_defect_proven_outcome_unverified: a proven empty read says nothing about whether the feature works, and it does not exclude a host-side problem underneath.',
      'superseded first revision: sha256 668ce17ab7fa784591a61388aa5d9ff2cb99eb8c2ef9252ed94a98570f9cb3ee (kept in git history at 1720db2b).',
    ],
    reproduce: 'node dev/agent-workflow/evidence/dsh-020rc2-upgrade/tools/run5-oracle-digest.mjs  (deterministic; diff against the committed file)',
  }

  const text = `${JSON.stringify(doc, null, 2)}\n`
  const CRED = /\?token=[A-Za-z0-9_-]{8,}|boot[_-]?token|authorization:|x-api-key|Bearer [A-Za-z0-9._-]{6,}|dsh-auth-[A-Za-z0-9_-]{6,}/i
  const hits = text.split('\n').map((l, i) => ({ n: i + 1, l })).filter(({ l }) => CRED.test(l))
  if (hits.length > 0) {
    process.stderr.write(`REFUSING TO WRITE: ${hits.length} credential-shaped line(s): ${hits.slice(0, 3).map((h) => h.n).join(', ')}\n`)
    process.exit(2)
  }
  writeFileSync(outFile, text)
  process.stdout.write(`wrote ${relative(REPO, outFile)} (${Buffer.byteLength(text)} bytes, sha256 ${sha256(Buffer.from(text))})\n`)
}

main()
