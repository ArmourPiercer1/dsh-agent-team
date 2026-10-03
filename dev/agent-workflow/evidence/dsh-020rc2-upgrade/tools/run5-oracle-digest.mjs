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
      // This string is the output of the inline `role === 'system'` reader, which
      // is what the kit wrote as evidence; it is NOT the full system prompt.
      produced_by: "inline filter role === 'system' at runner 00a9a391 lines listed under sources",
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
 * Which tool results existed by the time each tool-result oracle ran, so the
 * reviewer's point — that a join over ALL results lets an earlier expected
 * rejection (S2) satisfy a later criterion (S3/S4) — can be checked with data.
 */
function historyPollution(requests) {
  const withResults = requests.filter((r) => r.tool_results_via_generation_aware_reader > 0)
  return {
    seqs_carrying_tool_results: withResults.map((r) => num(r.seq)),
    results_per_seq: withResults.map((r) => ({ seq: num(r.seq), count: num(r.tool_results_via_generation_aware_reader) })),
    cumulative_results_by_seq: (() => {
      const rows = []
      let running = 0
      for (const r of requests) {
        running += r.tool_results_via_generation_aware_reader
        rows.push({ seq: num(r.seq), cumulative_tool_results: num(running) })
      }
      return rows
    })(),
    affects_oracles: ['S1a', 'S2a', 'S3b', 'S4c'],
    note: 'toolResultTextOf at d4ff5f0b joins every result the request carries, so for S3b and S4c an earlier result (including the S2 deny text) would satisfy a substring test. The reviewer patch reads by call identity / expected result instead; that is the correct fix and this digest does not pre-empt it.',
  }
}

/**
 * Bind each failing criterion to the exact extractor expression that produced its
 * observation, in the revision that ran (ran_at) and in the locked revision - so
 * the attribution is checkable against the source, not against my prose.
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
function attributionTable() {
  return [
    {
      criterion: 'S1a',
      verdict: 'fail',
      attribution: 'runner reader (0.1 envelope), not a demonstrated host defect',
      evidence: [
        'criterion_extractors: at 65f07a26 the value came from body.messages.find(m => m.role === "tool")',
        'per_request seq 5 carries 1 tool result via the generation-aware reader, so a result existed on the wire',
        'criteria[S1a].extractor_report is `result=` (empty)',
      ],
    },
    {
      criterion: 'S2a',
      verdict: 'pass',
      attribution: 'passed on its observation-array assertion while its tool-result reader was equally blind',
      evidence: [
        'criteria[S2a].extractor_report is `result=` (empty) even though the verdict is pass',
        'so a pass here does not certify the tool-result path',
      ],
    },
    {
      criterion: 'S3b',
      verdict: 'fail',
      attribution: 'runner reader (0.1 envelope), not a demonstrated host defect',
      evidence: [
        'same expression class as S1a',
        'per_request seq 7 carries 3 tool results via the generation-aware reader, and S3a (durable allow recorded) passed',
      ],
    },
    {
      criterion: 'S4c',
      verdict: 'fail',
      attribution: 'runner reader (0.1 envelope), not a demonstrated host defect',
      evidence: [
        'same expression class as S1a',
        'per_request seq 11 carries 5 tool results via the generation-aware reader',
        'S4a/S4d (durable member record and roster) passed in the same run, so the create path itself was not observed failing',
      ],
    },
    {
      criterion: 'S4e',
      verdict: 'fail',
      attribution: 'runner reader (0.1 envelope), not a demonstrated host defect',
      evidence: [
        'prompt_measurements[member_request seq 9]: the inline role-system filter produced 0 characters',
        'S4b, reading the same run through systemTextOf, passed with 4000 characters of leader persona',
      ],
    },
    {
      criterion: 'S5b',
      verdict: 'fail',
      attribution: 'runner reader (0.1 envelope), not a demonstrated host defect',
      evidence: [
        'same inline expression class as S4e, on the C member request',
        'S5c, reading through systemTextOf on the same run, passed',
      ],
    },
    {
      criterion: 'S4b',
      verdict: 'pass',
      attribution: 'control: the generation-aware reader worked on the same host and run',
      evidence: ['criterion_extractors: systemTextOf(bStart) at both revisions'],
    },
    {
      criterion: 'S5c',
      verdict: 'pass',
      attribution: 'control: same as S4b, for a member request',
      evidence: ['criterion_extractors: systemTextOf(bMemberAgain) at both revisions'],
    },
  ]
}

/** The kit files under independent review, hashed as they stand at the locked head. */
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
    joined_history_risk: historyPollution(requests),
    per_criterion_attribution: attributionTable(),
    frozen_files: frozenFiles(),
    attribution_rules: [
      'A criterion is attributed to the reader, not the host, only where the same run recorded a generation-aware count > 0 (per_request.tool_results_via_generation_aware_reader) or a passing sibling criterion (S4b, S5c) that used the helper on the same request.',
      'Nothing in this file is evidence that persona binding, post-approval execution or create-member work on 0.2. It is evidence about what the two extractors reported.',
    ],
    gaps: [
      'The mock recorder at 00a9a391 keeps seq/receivedAt/userText(300 chars)/toolMsgCount/reply only: no message array, no role/content shape, no tool-result content. So role/content shape per seq is NOT recoverable from this run; it would need a whitelisted body digest in the recorder.',
      'For the member request only the inline-reader output was persisted (chars 0). The generation-aware systemTextOf output for that same seq was never written to a file, so the helper side is evidenced indirectly: S4b and S5c passed through systemTextOf on the same run, and the waiter for that request matched on userTextOf plus a tool/tool-count condition.',
      'toolMsgCount is the generation-aware count, so this run cannot state what a 0.1 role:tool count would have been; the claim that the 0.1 lookup is empty rests on the kit check lines (result= / hasB=false) plus the source expressions quoted under sources[].',
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
