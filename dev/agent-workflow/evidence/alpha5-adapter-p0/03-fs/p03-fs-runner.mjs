#!/usr/bin/env node
/**
 * p03-fs-runner.mjs — Alpha.5 P0-3 Controlled FS fixture (plain node, deterministic, re-runnable).
 *
 * Plan: docs/plans/memo/alpha5-tool-io-governance/P0-independent-adapter-poc-implementation-guide.md
 *       §1 (INV-1/4/5/9/10), §3 P0-3, §4 FS-01..FS-04, §5; architecture.md §14.4/§14.5.
 *
 * FIXTURE SEMANTICS (details in notes.md): the in-process Trusted FS boundary = the
 * Team adapter enforcing policy AT ITS OWN REAL node:fs CALL SITES (§14.5: read/write/
 * edit family = Controlled FS, no process sandbox). The un-adapted "native-style" lane
 * is a bypass CONTROL SURFACE (test definition over raw node:fs; the real native read
 * pass-through is separately source-confirmed: 00-baseline S-10 CONFIRMED). All file
 * contents are SYNTHETIC. No real user data, no credentials, no :3080, no source/config
 * changes, no git commit. Mount mechanism reused READ-ONLY from 00-baseline/
 * p00-fixture.mjs — no junction is created/modified here (set audited before/after).
 *
 * Evidence channels:
 *   1) adapter-level open ledger — every policy decision is booked with the stage where
 *      it stopped; 'refused:*' happens STRICTLY BEFORE any open ("deny" = never opened,
 *      not output filtering).
 *   2) strace re-run of every leg in a fresh child (when available) — independent
 *      OS-level openat/open/openat2/creat counts per sensitive path.
 *   3) sha256 + mtimeNs before/after for write-denial legs.
 *
 * Usage:  node p03-fs-runner.mjs                   # full run
 *         node p03-fs-runner.mjs --child=LEG_ID    # internal: single-leg child under strace
 * Exit:   0 = every executed leg PASS; 1 = any FAIL; 2 = environment failure.
 */
import { spawnSync, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { release } from 'node:os'
import { pathToFileURL } from 'node:url'

const HERE = path.dirname(new URL(import.meta.url).pathname)
const WORKTREE_ROOT = path.resolve(HERE, '..', '..', '..', '..', '..')
const P00_FIXTURE = path.join(WORKTREE_ROOT, 'dev', 'agent-workflow', 'evidence', 'alpha5-adapter-p0', '00-baseline', 'p00-fixture.mjs')
const TEST_USE = path.join(WORKTREE_ROOT, 'tests', 'deepseek-harness-test-use')
const SCRATCH = path.join(HERE, 'probe-scratch')
const FX = path.join(SCRATCH, 'fixture-tree') // immutable Workspace anchor for this fixture
const MODEL_REPORTED_BY_AGENT = 'qwen3.8-flash-next' // transcribed verbatim by the agent from its system prompt (the runner cannot self-verify the model)

// ---------------- fixture tree (all contents SYNTHETIC) ----------------
const SYN = (s) => `SYNTHETIC ALPHA.5 P0-3 fs fixture — ${s}\n`
const SECRET_TOKEN = 'SECRET-DISCLOSURE-TEST-TOKEN-9d2e'
const OLD_TOKEN = 'OLD-CONTENT-TEST-TOKEN-b4c9'
const ONESHOT_TOKEN = 'ONE-SHOT-A-TEST-TOKEN-77aa'
const FILES = {
  readTxt: path.join(FX, 'allowed', 'read.txt'),
  secret: path.join(FX, 'private', 'secret.txt'),
  spaced: path.join(FX, 'allowed', 'sp '), // trailing-space filename ("sp␠")
  nested: path.join(FX, 'sub', 'nested-target.txt'),
  aliasLink: path.join(FX, 'alias'), // symlink -> private (directory alias)
  outDir: path.join(FX, 'out'),
  outNew: path.join(FX, 'out', 'new-file.txt'),
  specialA: path.join(FX, 'special-a', 'oneshot.txt'),
  specialB: path.join(FX, 'special-b', 'b-read.txt'),
  hardlink: path.join(FX, 'allowed', 'secret-alias.txt'), // hard link to private/secret.txt (same inode, allowed location)
  // OBSERVER hard-link aliases live OUTSIDE the fixture anchor: the leg observer hashes
  // denied files through these so the OS-level open counters on the DENIED path strings
  // stay a clean adapter/bypass-lane-only signal (same inode => same content).
  obsDir: path.join(SCRATCH, 'observer'),
  obsSecret: path.join(SCRATCH, 'observer', 'secret.alias'),
  obsNested: path.join(SCRATCH, 'observer', 'nested.alias'),
}
const CONTENTS = {
  readTxt: SYN('allowed positive-control read target') + 'token=ALLOWED-PUBLIC-1e6f\n',
  secret: `SYNTHETIC SECRET — must never be disclosed through a denied path\n${SECRET_TOKEN}\n`,
  spaced: SYN('trailing-space filename probe') + 'token=SPACED-A7b3\n',
  nested: SYN('sub/nested-target: old content for write-only edit probe') + `prev=${OLD_TOKEN}\n`,
  specialA: SYN('special-a one-shot grant target (leg A)') + `token=${ONESHOT_TOKEN}\n`,
  specialB: SYN('special-b ordinary target') + 'token=B-REGULAR-3c3c\n',
}

function buildFixture({ wipe }) {
  if (wipe && fs.existsSync(FX)) fs.rmSync(FX, { recursive: true, force: true })
  for (const d of ['allowed', 'private', 'sub', 'special-a', 'special-b']) fs.mkdirSync(path.join(FX, d), { recursive: true })
  fs.mkdirSync(FILES.outDir, { recursive: true })
  const put = (p, c) => { if (!fs.existsSync(p)) fs.writeFileSync(p, c) }
  put(FILES.readTxt, CONTENTS.readTxt)
  put(FILES.secret, CONTENTS.secret)
  put(FILES.spaced, CONTENTS.spaced)
  put(FILES.nested, CONTENTS.nested)
  put(FILES.specialA, CONTENTS.specialA)
  put(FILES.specialB, CONTENTS.specialB)
  if (!fs.existsSync(FILES.aliasLink)) fs.symlinkSync('private', FILES.aliasLink, 'dir')
  if (!fs.existsSync(FILES.hardlink)) fs.linkSync(FILES.secret, FILES.hardlink) // same inode, different path
  fs.mkdirSync(FILES.obsDir, { recursive: true })
  if (!fs.existsSync(FILES.obsSecret)) fs.linkSync(FILES.secret, FILES.obsSecret)
  if (!fs.existsSync(FILES.obsNested)) fs.linkSync(FILES.nested, FILES.obsNested)
}

const sha256 = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const statStamp = (p) => { try { const s = fs.statSync(p); return { sha256: sha256(p), mtimeNs: String(s.mtimeNs), size: s.size, inode: `${String(s.dev)}:${String(s.ino)}`, nlink: s.nlink } } catch { return null } }

// ---------------- Trusted FS adapter = the in-process enforcement boundary ----------------
// Policy is enforced HERE, at the adapter's own node:fs call sites: every check runs
// BEFORE the open; every decision is booked into an append-only ledger. I/O always uses
// the realpath-resolved target (authorized object == accessed object).
const deniedInodes = new Set() // dev:ino of every private/* file (policy-compile time)
const deniedRealPaths = new Set() // realpath of every private/* file
function compileDenySets() {
  deniedInodes.clear(); deniedRealPaths.clear()
  const dir = path.join(FX, 'private')
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isFile()) continue
    const p = path.join(dir, e.name)
    const s = fs.statSync(p)
    deniedInodes.add(`${String(s.dev)}:${String(s.ino)}`)
    deniedRealPaths.add(fs.realpathSync(p))
  }
}

class TrustedFsAdapter {
  constructor({ anchor, members }) {
    this.anchor = anchor
    this.members = members // id -> { readDirs:[absRealPath], writeDirs:[absRealPath] }
    this.ledger = [] // append-only: {at, member, tool, req, real, mode, stage, code}
    this.grants = new Map() // adapter-level one-shot grant ledger
    this.grantSeq = 0
  }
  book(e) { this.ledger.push({ at: process.hrtime.bigint().toString(), ...e }) }
  static under(child, dir) { return child === dir || child.startsWith(dir + path.sep) }
  /** Resolution ladder — performs NO content open (realpath/stat only). */
  resolveTarget(memberId, reqPath, tool, mode, { deferContainment = false } = {}) {
    const m = this.members[memberId]
    const base = { member: memberId, tool, req: reqPath, real: null, mode }
    const deny = (code, extra) => { this.book({ ...base, ...extra, stage: 'refused', code }); return { refused: true, code } }
    if (typeof reqPath !== 'string' || reqPath.length === 0 || reqPath.includes('\0')) return deny('MALFORMED_PATH')
    // (1) explicit relative-traversal rejection (architecture.md §14.4: reject '..'; never normalize)
    if (reqPath.split(/[\\/]/).includes('..')) return deny('TRAVERSAL_DENIED')
    // (2) workspace-anchor containment on the lexical path
    const abs = path.resolve(this.anchor, reqPath)
    if (!TrustedFsAdapter.under(abs, this.anchor)) return deny('ANCHOR_OUT')
    // (3) actual object identity via realpath (symlink / alias bypass surface)
    let rp, st = null
    try {
      rp = fs.realpathSync(abs)
      st = fs.statSync(rp)
    } catch (e) {
      if (e.code === 'ENOENT' && mode === 'write') {
        // create path: anchor the nearest existing ancestor, keep the remainder verbatim
        let cur = abs; const tail = []
        while (!fs.existsSync(cur)) { tail.unshift(path.basename(cur)); const up = path.dirname(cur); if (up === cur) return deny('NOT_FOUND'); cur = up }
        rp = path.join(fs.realpathSync(cur), ...tail)
        if (!TrustedFsAdapter.under(rp, this.anchor)) return deny('SYMLINK_ESCAPED')
        st = null
      } else return deny(e.code === 'ENOENT' ? 'NOT_FOUND' : 'UNRESOLVABLE')
    }
    base.real = rp
    if (!TrustedFsAdapter.under(rp, this.anchor)) return deny('SYMLINK_ESCAPED')
    // (4) inode identity BEFORE containment: a hard link shares the denied inode while
    //     looking "allowed" lexically. Skipped for the denied object itself (it must
    //     refuse via containment with the mode-specific code).
    if (st !== null) {
      const inoKey = `${String(st.dev)}:${String(st.ino)}`
      if (!deniedRealPaths.has(rp) && deniedInodes.has(inoKey)) return deny('ALIAS_DENIED', { real: rp, ino: inoKey })
      if (!st.isFile()) return deny('NOT_A_FILE', { real: rp })
    }
    // (5) member mode containment against the REAL path (unless grant path defers it)
    if (!deferContainment) {
      const dirs = mode === 'write' ? m.writeDirs : m.readDirs
      if (!dirs.some((d) => TrustedFsAdapter.under(rp, d))) return deny(mode === 'write' ? 'WRITE_DENIED' : 'READ_DENIED', { real: rp })
    }
    return { rp, st }
  }
  /** one-shot grant consumption; adapter-level Map ledger; consumed BEFORE I/O. */
  consumeGrant(grantId, callId, memberId, rp, tool) {
    const g = this.grants.get(grantId)
    const base = { member: memberId, tool, req: `grant:${String(grantId)}`, real: rp, mode: 'read' }
    const deny = (code, extra) => { this.book({ ...base, ...extra, stage: 'refused', code }); return { refused: true, code } }
    if (!g) return deny('GRANT_UNKNOWN')
    if (g.consumed) { g.replayAttempts = (g.replayAttempts ?? 0) + 1; return deny('GRANT_CONSUMED', { grant: grantId }) }
    if (g.callId !== callId) { g.foreignUseAttempts = (g.foreignUseAttempts ?? 0) + 1; return deny('GRANT_CALL_MISMATCH', { grant: grantId }) }
    if (g.memberId !== memberId) return deny('GRANT_MEMBER_MISMATCH', { grant: grantId })
    if (!g.dirs.some((d) => TrustedFsAdapter.under(rp, d))) return deny('GRANT_SCOPE_DENIED', { grant: grantId })
    g.consumed = true
    g.consumedFor = { rp, at: process.hrtime.bigint().toString() }
    this.book({ ...base, stage: 'grant-consumed', code: 'OK', grant: grantId })
    return { ok: true }
  }
  issueGrant(memberId, callId, dirs) { const id = `G${String(++this.grantSeq)}`; this.grants.set(id, { id, memberId, callId, dirs, consumed: false, replayAttempts: 0, foreignUseAttempts: 0 }); return id }
  /** governed read: static member read-set OR a consumed one-shot grant; opens ONLY after all checks pass */
  read(memberId, reqPath, { grantId, callId, tool = 'read' }) {
    const hasGrant = grantId !== undefined && grantId !== null
    const t = this.resolveTarget(memberId, reqPath, tool, 'read', { deferContainment: hasGrant })
    if (t.refused) return t
    if (hasGrant) {
      const g = this.consumeGrant(grantId, callId, memberId, t.rp, tool)
      if (g.refused) return g
    } else {
      const m = this.members[memberId]
      if (!m.readDirs.some((d) => TrustedFsAdapter.under(t.rp, d))) { this.book({ member: memberId, tool, req: reqPath, real: t.rp, mode: 'read', stage: 'refused', code: 'READ_DENIED' }); return { refused: true, code: 'READ_DENIED' } }
    }
    this.book({ member: memberId, tool, req: reqPath, real: t.rp, mode: 'read', stage: 'open-issued', code: 'OK' })
    const content = fs.readFileSync(t.rp, 'utf8')
    this.book({ member: memberId, tool, req: reqPath, real: t.rp, mode: 'read', stage: 'open-returned', code: 'OK' })
    return { ok: true, realPath: path.relative(this.anchor, t.rp), bytes: Buffer.byteLength(content), content }
  }
  /** governed write; result body NEVER contains old content (write-only = no read authority) */
  write(memberId, reqPath, content, { tool = 'write' } = {}) {
    const t = this.resolveTarget(memberId, reqPath, tool, 'write')
    if (t.refused) return t
    this.book({ member: memberId, tool, req: reqPath, real: t.rp, mode: 'write', stage: 'open-issued', code: 'OK' })
    fs.writeFileSync(t.rp, content, 'utf8')
    this.book({ member: memberId, tool, req: reqPath, real: t.rp, mode: 'write', stage: 'open-returned', code: 'OK' })
    return { ok: true, realPath: path.relative(this.anchor, t.rp), bytesWritten: Buffer.byteLength(content) } // suppression-by-design: no diff / no old content
  }
  /** str_replace style edit: needs read (old-content search) AND write; write-only => typed refusal */
  strReplace(memberId, reqPath, oldStr, newStr, { tool = 'str_replace' } = {}) {
    const r = this.resolveTarget(memberId, reqPath, tool, 'read')
    if (r.refused) { this.book({ member: memberId, tool, req: reqPath, real: r.real ?? null, mode: 'read', stage: 'refused', code: 'READ_REQUIRED_FOR_EDIT' }); return { refused: true, code: 'READ_REQUIRED_FOR_EDIT', note: 'str_replace needs read authority for old-content search; grant is write-only; old content never read (suppressed)' } }
    const w = this.resolveTarget(memberId, reqPath, tool, 'write')
    if (w.refused) return w
    this.book({ member: memberId, tool, req: reqPath, real: w.rp, mode: 'read+write', stage: 'open-issued', code: 'OK' })
    const old = fs.readFileSync(w.rp, 'utf8')
    if (!old.includes(oldStr)) { this.book({ member: memberId, tool, req: reqPath, real: w.rp, mode: 'read+write', stage: 'no-match', code: 'NO_MATCH' }); return { refused: true, code: 'NO_MATCH' } }
    fs.writeFileSync(w.rp, old.replaceAll(oldStr, newStr), 'utf8')
    this.book({ member: memberId, tool, req: reqPath, real: w.rp, mode: 'read+write', stage: 'open-returned', code: 'OK' })
    return { ok: true, replaced: old.split(oldStr).length - 1 }
  }
}

// ---------------- strace channel ----------------
function straceAvailable() { try { execFileSync('strace', ['-V'], { stdio: ['ignore', 'pipe', 'pipe'] }); return true } catch { return false } }
const OPEN_RE = /^(?<pid>\d+)\s+(?:\[pid \d+\]\s+)?(?<op>openat2|openat|open|creat)\((?:AT_FDCWD,\s*)?"(?<p>(?:[^"\\]|\\.)*)"/
function parseStraceOpens(logPath) {
  const out = []
  if (!fs.existsSync(logPath)) return out
  for (const line of fs.readFileSync(logPath, 'utf8').split('\n')) {
    const m = OPEN_RE.exec(line)
    if (!m?.groups) continue
    let p = m.groups.p
    try { p = JSON.parse(`"${p}"`) } catch { /* keep raw */ }
    out.push({ pid: Number(m.groups.pid), op: m.groups.op, path: p, failed: line.includes('= -1 ') })
  }
  return out
}
const succOpens = (opens, needle) => opens.filter((o) => !o.failed && (o.path === needle || o.path.endsWith(needle)))

// ---------------- harness ----------------
const git = (args, cwd) => { try { return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { return '' } }
function junctionAudit() {
  const dir = path.join(WORKTREE_ROOT, 'node_modules', '@deepseek-ai')
  const out = {}
  for (const n of fs.readdirSync(dir)) { const l = path.join(dir, n); const st = fs.lstatSync(l); out[n] = st.isSymbolicLink() ? `LINK->${fs.readlinkSync(l)}` : 'REAL' }
  return out
}

let seq = 0
async function callTool(f, name, args, agentKey, callId) {
  const cid = f.ToolCallId(callId ?? `p03-c${String(++seq)}`)
  const r = await f.ctx.tools.execute({ signal: new AbortController().signal, callId: cid, name, arguments: args, agent: agentKey })
  const text = r?.content?.[0]?.text ?? ''
  let parsed
  try { parsed = JSON.parse(text) } catch { parsed = text }
  return { callId: String(cid), text, parsed, isError: r?.isError === true }
}

function makeToolDefs(adapter, nativeLedger) {
  const out = { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] }
  return [
    { name: 'read', description: 'P0-3 governed read adapter (member m-alice)', parameters: { type: 'object', properties: { path: { type: 'string' } } }, output: out,
      execute: async (args) => JSON.stringify(adapter.read('m-alice', args?.path, {})) },
    { name: 'oneshot_read', description: 'P0-3 one-shot grant read adapter (member m-oneshot)', parameters: { type: 'object', properties: { path: { type: 'string' }, grantId: { type: 'string' } } }, output: out,
      execute: async (args, exec) => JSON.stringify(adapter.read('m-oneshot', args?.path, { grantId: args?.grantId, callId: String(exec?.callId ?? '?') })) },
    { name: 'write', description: 'P0-3 governed write adapter (member m-alice)', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } }, output: out,
      execute: async (args) => JSON.stringify(adapter.write('m-alice', args?.path, args?.content ?? '')) },
    { name: 'str_replace', description: 'P0-3 governed str_replace adapter (member m-wonly, write-only)', parameters: { type: 'object', properties: { path: { type: 'string' }, old: { type: 'string' }, new: { type: 'string' } } }, output: out,
      execute: async (args) => JSON.stringify(adapter.strReplace('m-wonly', args?.path, args?.old, args?.new)) },
    { name: 'legacy_native_read', description: 'UN-ADAPTED native-style read (bypass control surface)', parameters: { type: 'object', properties: { path: { type: 'string' } } }, output: out,
      execute: async (args) => { nativeLedger.push({ path: String(args?.path), at: process.hrtime.bigint().toString() }); const fd = fs.openSync(String(args?.path), 'r'); try { return fs.readFileSync(fd, 'utf8') } finally { fs.closeSync(fd) } } },
  ]
}

async function buildHarness() {
  buildFixture({ wipe: false })
  compileDenySets()
  const p00 = await import(pathToFileURL(P00_FIXTURE).href) // read-only reuse of the mount mechanism (junctions pre-exist; none created here)
  const f = await p00.makeFixture()
  const sc = await f.mintScope('agent-fs')
  const adapter = new TrustedFsAdapter({
    anchor: FX,
    members: {
      'm-alice': { readDirs: [path.join(FX, 'allowed'), path.join(FX, 'special-b')], writeDirs: [path.join(FX, 'out')] },
      'm-wonly': { readDirs: [], writeDirs: [path.join(FX, 'sub')] },
      'm-oneshot': { readDirs: [], writeDirs: [] }, // reads ONLY via one-shot grants
    },
  })
  const nativeLedger = []
  for (const def of makeToolDefs(adapter, nativeLedger)) sc.scope.ctx.tools.register(def)
  const gate = {}
  gate.promise = new Promise((res) => { gate.resolve = res })
  return { f, agentKey: sc.key, adapter, nativeLedger, obs: [], gate }
}

// ---------------- legs ----------------
async function runLeg(legId, harness) {
  const { f, agentKey, adapter, nativeLedger, obs } = harness
  const checks = []
  const evidence = {}
  const check = (name, expect, observed, pass) => checks.push({ name, expect, observed, pass: Boolean(pass) })
  const opensFor = (member, needle, stage = 'open-issued') => adapter.ledger.filter((e) => e.member === member && e.stage === stage && ((e.real ?? '').endsWith(needle) || String(e.req).endsWith(needle))).length

  if (legId === 'FS-01.pos') {
    const res = await callTool(f, 'read', { path: 'allowed/read.txt' }, agentKey)
    evidence.adapterResult = { ...res, parsed: { ...res.parsed, content: '<elided-below>' }, text: undefined }
    check('positive read succeeds', 'ok + ALLOWED token', { ok: res.parsed?.ok === true, token: res.parsed?.content?.includes('ALLOWED-PUBLIC-1e6f'), realPath: res.parsed?.realPath }, res.parsed?.ok === true && res.parsed?.content?.includes('ALLOWED-PUBLIC-1e6f'))
  } else if (legId === 'FS-01.neg') {
    const res = await callTool(f, 'read', { path: 'private/secret.txt' }, agentKey)
    evidence.adapterResult = res.parsed
    evidence.openLedgerForSecret = adapter.ledger.filter((e) => String(e.real ?? e.req).endsWith('private/secret.txt'))
    check('negative read refused', 'READ_DENIED', res.parsed, res.parsed?.refused === true && res.parsed?.code === 'READ_DENIED')
    check('no disclosure', 'secret token absent from body', { bodyIncludesToken: res.text.includes(SECRET_TOKEN) }, !res.text.includes(SECRET_TOKEN))
    check('adapter NEVER opened the file (open ledger)', '0 open-issued + >=1 refused(READ_DENIED)', { openIssued: opensFor('m-alice', 'private/secret.txt'), refused: adapter.ledger.filter((e) => e.stage === 'refused' && e.code === 'READ_DENIED' && String(e.req).includes('private/secret.txt')).length }, opensFor('m-alice', 'private/secret.txt') === 0)
  } else if (legId === 'FS-01.native-bypass') {
    // INV-1 coverage-gap control: an un-adapted, still-dispatchable native-style tool
    // reads private directly. The leak IS the finding: coverage must be enforced.
    const res = await callTool(f, 'legacy_native_read', { path: path.join(FX, 'private', 'secret.txt') }, agentKey)
    evidence.bypassResult = { leakedToken: String(res.parsed ?? res.text).includes(SECRET_TOKEN) }
    const disp = { get: f.ctx.tools.get('legacy_native_read', agentKey) !== undefined, schemas: f.ctx.tools.schemas(agentKey).map((s) => s.name) }
    evidence.dispatchableSurface = disp
    evidence.nativeLedger = nativeLedger.map(({ at, ...rest }) => rest)
    check('bypass tool is dispatchable (T_dispatchable)', 'get+schemas', disp, disp.get && disp.schemas.includes('legacy_native_read'))
    check('bypass lane READ private => coverage gap (leak EXPECTED)', 'leak observed -> INV-1 coverage/deny must coexist', evidence.bypassResult, evidence.bypassResult.leakedToken === true)
  } else if (legId === 'FS-02.refusal') {
    const before = statStamp(FILES.obsNested)
    const res = await callTool(f, 'str_replace', { path: 'sub/nested-target.txt', old: `prev=${OLD_TOKEN}`, new: 'prev=NEW' }, agentKey)
    const after = statStamp(FILES.obsNested)
    evidence.refusalBody = res.text; evidence.before = before; evidence.after = after
    evidence.observerVia = 'hash/mtime read through observer hardlink alias (same inode, outside fixture anchor)'
    check('write-only edit = typed refusal', 'READ_REQUIRED_FOR_EDIT', res.parsed, res.parsed?.refused === true && res.parsed?.code === 'READ_REQUIRED_FOR_EDIT')
    check('returned body contains NO old content', `body lacks "${OLD_TOKEN}"`, { body: res.text }, !res.text.includes(OLD_TOKEN))
    check('file untouched (sha256+mtimeNs via observer inode)', 'before==after', { before, after }, before?.sha256 === after?.sha256 && before?.mtimeNs === after?.mtimeNs)
  } else if (legId === 'FS-02.pos') {
    const res = await callTool(f, 'write', { path: 'out/new-file.txt', content: SYN('FS-02 positive write') }, agentKey)
    const stamp = statStamp(FILES.outNew)
    evidence.writeResult = res.parsed; evidence.after = stamp
    check('write to out/ succeeds', 'ok + file hash present', res.parsed, res.parsed?.ok === true && stamp?.sha256 === sha256OfText(SYN('FS-02 positive write')))
    check('write body discloses no old content', `no "${OLD_TOKEN}"`, { body: res.text }, !res.text.includes(OLD_TOKEN))
  } else if (legId === 'FS-02.neg') {
    const before = statStamp(FILES.obsSecret)
    const res = await callTool(f, 'write', { path: 'private/secret.txt', content: SYN('attempted overwrite') }, agentKey)
    const after = statStamp(FILES.obsSecret)
    evidence.writeResult = res.parsed; evidence.before = before; evidence.after = after
    evidence.observerVia = 'hash/mtime read through observer hardlink alias (same inode, outside fixture anchor)'
    evidence.deniedPathInode = `${String(fs.statSync(FILES.secret).dev)}:${String(fs.statSync(FILES.secret).ino)}`
    check('write to private refused', 'WRITE_DENIED', res.parsed, res.parsed?.refused === true && res.parsed?.code === 'WRITE_DENIED')
    check('file unchanged (sha256+mtimeNs)', 'before==after', { before, after }, before?.sha256 === after?.sha256 && before?.mtimeNs === after?.mtimeNs)
    check('no open issued for denied write', '0 open-issued', { opens: opensFor('m-alice', 'private/secret.txt') }, opensFor('m-alice', 'private/secret.txt') === 0)
  } else if (legId === 'FS-03.race') {
    // deterministic one-shot race: B parks on an event fence BEFORE any I/O check;
    // A completes + consumes its grant during the wait; fence released; B denied;
    // consumed grant replay on a fresh call is denied.
    const gA = adapter.issueGrant('m-oneshot', 'p03-callA', [path.join(FX, 'special-a')])
    const gB = adapter.issueGrant('m-oneshot', 'p03-callB', [path.join(FX, 'allowed')])
    const gX = adapter.issueGrant('m-oneshot', 'p03-callZ', [path.join(FX, 'special-a')]) // never consumed by its bound call
    obs.push({ e: 'B:await-gate-before-io', at: process.hrtime.bigint().toString() })
    const pB = (async () => {
      await harness.gate.promise // deterministic event fence (plan §4: no sleep lotteries)
      const steal = await callTool(f, 'oneshot_read', { path: 'special-a/oneshot.txt', grantId: gB }, agentKey, 'p03-callB')
      const replay = await callTool(f, 'oneshot_read', { path: 'special-a/oneshot.txt', grantId: gX }, agentKey, 'p03-callB')
      obs.push({ e: 'B:denied', at: process.hrtime.bigint().toString() })
      return { steal: steal.parsed, replay: replay.parsed }
    })()
    const resA = await callTool(f, 'oneshot_read', { path: 'special-a/oneshot.txt', grantId: gA }, agentKey, 'p03-callA')
    obs.push({ e: 'A:consumed-grant', at: process.hrtime.bigint().toString() })
    harness.gate.resolve()
    const resB = await pB
    const resC = await callTool(f, 'oneshot_read', { path: 'special-a/oneshot.txt', grantId: gA }, agentKey, 'p03-callC-fresh')
    evidence.resA = { ...resA, parsed: { ...resA.parsed, content: '<elided>' }, text: undefined }
    evidence.resB = resB
    evidence.resC = resC.parsed
    evidence.grantLedger = [...adapter.grants.values()].map((g) => ({ id: g.id, consumed: g.consumed, replayAttempts: g.replayAttempts, foreignUseAttempts: g.foreignUseAttempts }))
    const order = obs.map((o) => o.e)
    check('A reads special-a via its one-shot grant', 'ok + A token', { ok: resA.parsed?.ok === true, token: resA.parsed?.content?.includes(ONESHOT_TOKEN) }, resA.parsed?.ok === true && resA.parsed?.content?.includes(ONESHOT_TOKEN))
    check('B never gets A resource (own grant scope)', 'GRANT_SCOPE_DENIED', resB.steal, resB.steal?.refused === true && resB.steal?.code === 'GRANT_SCOPE_DENIED')
    check('B cannot consume A grant (call binding)', 'GRANT_CALL_MISMATCH', resB.replay, resB.replay?.refused === true && resB.replay?.code === 'GRANT_CALL_MISMATCH')
    check('consumed grant not reusable (fresh call)', 'GRANT_CONSUMED', resC.parsed, resC.parsed?.refused === true && resC.parsed?.code === 'GRANT_CONSUMED')
    check('B outputs never disclose A token', 'no token', { leaked: JSON.stringify(resB).includes(ONESHOT_TOKEN) }, !JSON.stringify(resB).includes(ONESHOT_TOKEN))
    check('event order: B-wait < A-consume < B-denied', 'monotone', order, order.indexOf('B:await-gate-before-io') < order.indexOf('A:consumed-grant') && order.indexOf('A:consumed-grant') < order.indexOf('B:denied'))
    check('exactly one open for special-a (ledger)', '1 open-issued', { opens: opensFor('m-oneshot', 'special-a/oneshot.txt') }, opensFor('m-oneshot', 'special-a/oneshot.txt') === 1)
  } else if (legId === 'FS-04.symlink') {
    const res = await callTool(f, 'read', { path: 'alias/secret.txt' }, agentKey)
    evidence.aliasResult = res.parsed
    check('symlink->private refused via real object identity (realpath)', 'code in {READ_DENIED, ALIAS_DENIED, SYMLINK_ESCAPED}', res.parsed, res.parsed?.refused === true && ['READ_DENIED', 'ALIAS_DENIED', 'SYMLINK_ESCAPED'].includes(res.parsed?.code))
    check('no disclosure', 'no secret token', { body: res.text }, !res.text.includes(SECRET_TOKEN))
  } else if (legId === 'FS-04.hardlink') {
    const inoSecret = fs.statSync(FILES.secret); const inoLink = fs.statSync(FILES.hardlink)
    evidence.inodeFacts = { secret: `${String(inoSecret.dev)}:${String(inoSecret.ino)}`, link: `${String(inoLink.dev)}:${String(inoLink.ino)}`, nlink: inoLink.nlink, sameInode: inoSecret.ino === inoLink.ino && inoSecret.dev === inoLink.dev }
    const res = await callTool(f, 'read', { path: 'allowed/secret-alias.txt' }, agentKey)
    evidence.hardlinkResult = res.parsed
    check('fixture: hard link shares denied inode', 'same dev:ino', evidence.inodeFacts, evidence.inodeFacts.sameInode)
    check('hard-link alias refused (object identity, not realpath)', 'ALIAS_DENIED', res.parsed, res.parsed?.refused === true && res.parsed?.code === 'ALIAS_DENIED')
    check('no disclosure through alias', 'no secret token', { body: res.text }, !res.text.includes(SECRET_TOKEN))
  } else if (legId === 'FS-04.traversal') {
    const r1 = await callTool(f, 'read', { path: '../../etc/passwd' }, agentKey)
    const r2 = await callTool(f, 'read', { path: '/etc/passwd' }, agentKey)
    const r3 = await callTool(f, 'read', { path: 'allowed/../allowed/read.txt' }, agentKey)
    evidence.results = [r1.parsed, r2.parsed, r3.parsed]
    check('relative ".." refused', 'TRAVERSAL_DENIED', r1.parsed, r1.parsed?.code === 'TRAVERSAL_DENIED')
    check('absolute outside anchor refused', 'ANCHOR_OUT', r2.parsed, r2.parsed?.code === 'ANCHOR_OUT')
    check('in-anchor ".." also refused (fail-closed, never normalize)', 'TRAVERSAL_DENIED', r3.parsed, r3.parsed?.code === 'TRAVERSAL_DENIED')
  } else if (legId === 'FS-04.spaces') {
    const res = await callTool(f, 'read', { path: 'allowed/sp ' }, agentKey)
    evidence.readResult = { ...res.parsed, content: '<elided>' }
    check('trailing-space name readable as authorized (NOT trimmed)', 'ok + realPath "allowed/sp "', { ok: res.parsed?.ok, realPath: res.parsed?.realPath }, res.parsed?.ok === true && res.parsed?.realPath === 'allowed/sp ')
    let enoent = null
    try { const fd = fs.openSync(path.join(FX, 'allowed', 'sp'), 'r'); fs.closeSync(fd) } catch (e) { enoent = e.code }
    evidence.trimmedProbe = { trimmedPath: 'allowed/sp', openResult: enoent }
    check('trimmed variant does NOT exist (ENOENT probe)', 'ENOENT', evidence.trimmedProbe, enoent === 'ENOENT')
  } else {
    return { id: legId, verdict: 'NOT_RUN', checks: [{ name: 'unknown-leg', expect: '-', observed: legId, pass: false }], evidence }
  }
  return { id: legId, verdict: checks.every((c) => c.pass) ? 'PASS' : 'FAIL', checks, evidence }
}
const sha256OfText = (t) => createHash('sha256').update(t).digest('hex')

const LEG_IDS = ['FS-01.pos', 'FS-01.neg', 'FS-01.native-bypass', 'FS-02.refusal', 'FS-02.pos', 'FS-02.neg', 'FS-03.race', 'FS-04.symlink', 'FS-04.hardlink', 'FS-04.traversal', 'FS-04.spaces']

// ---------------- main ----------------
async function main() {
  const childArg = process.argv.find((a) => a.startsWith('--child='))
  if (childArg) {
    const harness = await buildHarness()
    const leg = await runLeg(childArg.slice('--child='.length), harness)
    process.stdout.write(`\nP03_CHILD ${JSON.stringify(leg)}\n`)
    process.exit(leg.verdict === 'PASS' ? 0 : 1)
  }

  const t0 = new Date()
  const junctionsBefore = junctionAudit()
  buildFixture({ wipe: true })
  compileDenySets()
  const hasStrace = straceAvailable()

  // Pass 1 — in-process legs with the real ToolRuntime dispatch (rich ledger state).
  const harness = await buildHarness()
  const legs = []
  for (const id of LEG_IDS) {
    const leg = await runLeg(id, harness)
    leg.evidence.openLedgerTail = harness.adapter.ledger.slice(-6).map(({ at, ...rest }) => rest)
    legs.push(leg)
  }
  const adapterLedgerDump = harness.adapter.ledger.map(({ at, ...rest }) => rest)
  const grantLedgerDump = [...harness.adapter.grants.values()].map((g) => ({ id: g.id, memberId: g.memberId, callId: g.callId, consumed: g.consumed, replayAttempts: g.replayAttempts, foreignUseAttempts: g.foreignUseAttempts, consumedFor: g.consumedFor ? { rp: path.relative(FX, g.consumedFor.rp) } : null }))
  const nativeLedgerDump = harness.nativeLedger.map(({ at, ...rest }) => rest)

  // Pass 2 — per-leg strace re-run in a fresh child => OS-level open accounting.
  const straceByLeg = {}
  for (const id of LEG_IDS) {
    if (!hasStrace) { straceByLeg[id] = { available: false }; continue }
    const logPath = path.join(SCRATCH, `strace-${id.replace(/[^\w.-]/g, '_')}.log`)
    const r = spawnSync('strace', ['-f', '-qq', '-e', 'trace=openat,openat2,open,creat', '-s', '512', '-o', logPath, process.execPath, new URL(import.meta.url).pathname, `--child=${id}`], { encoding: 'utf8', timeout: 120000 })
    const m = /P03_CHILD (\{.*\})/.exec(r.stdout ?? '')
    const childLeg = m ? JSON.parse(m[1]) : null
    const opens = parseStraceOpens(logPath)
    const fxOpens = opens.filter((o) => o.path.startsWith(FX))
    straceByLeg[id] = {
      available: true,
      log: path.basename(logPath),
      childVerdict: childLeg?.verdict ?? 'NOT_RUN',
      counts: {
        secret_okOpens: succOpens(opens, 'private/secret.txt').length,
        specialA_okOpens: succOpens(opens, 'special-a/oneshot.txt').length,
        etcPasswd_okOpens: succOpens(opens, '/etc/passwd').length,
        allowedRead_okOpens: succOpens(opens, 'allowed/read.txt').length,
        spacedExact_okOpens: opens.filter((o) => !o.failed && o.path.endsWith(path.join('allowed', 'sp '))).length,
        spacedTrimmed_okOpens: opens.filter((o) => !o.failed && o.path === path.join(FX, 'allowed', 'sp')).length,
        spacedTrimmed_FAILEDAttempts: opens.filter((o) => o.failed && o.path === path.join(FX, 'allowed', 'sp')).length,
        hardlink_okOpens: succOpens(opens, 'allowed/secret-alias.txt').length,
      },
      fixtureOpens: fxOpens.map((o) => ({ ...o, path: path.relative(FX, o.path) })),
    }
  }

  // Fold syscall checks into legs. strace unavailable => NOT_RUN (does not flip leg verdict).
  for (const leg of legs) {
    const st = straceByLeg[leg.id] ?? { available: false }
    const fold = (name, pass, observed) => leg.checks.push({ name, expect: 'OS-level syscall evidence', observed, pass: st.available ? Boolean(pass) : 'NOT_RUN' })
    if (leg.id === 'FS-01.pos') fold('strace: exactly 1 successful open of allowed/read.txt', st.counts?.allowedRead_okOpens === 1, st.counts)
    if (leg.id === 'FS-01.neg') fold('strace: 0 successful opens of private/secret.txt', st.counts?.secret_okOpens === 0, st.counts)
    if (leg.id === 'FS-01.native-bypass') fold('strace: bypass lane DID open private/secret.txt (gap evidence)', st.counts?.secret_okOpens === 1, st.counts)
    if (leg.id === 'FS-02.refusal') fold('strace: 0 successful opens of sub/nested-target.txt (refused before read)', st.fixtureOpens?.filter((o) => o.path.endsWith('sub/nested-target.txt') && !o.failed).length === 0, st.fixtureOpens)
    if (leg.id === 'FS-02.pos') fold('strace: write open of out/new-file.txt occurred', st.fixtureOpens?.some((o) => o.path === 'out/new-file.txt') === true, st.fixtureOpens)
    if (leg.id === 'FS-02.neg') fold('strace: 0 successful opens of private/secret.txt', st.counts?.secret_okOpens === 0, st.counts)
    if (leg.id === 'FS-03.race') fold('strace: exactly 1 successful open of special-a/oneshot.txt', st.counts?.specialA_okOpens === 1, st.counts)
    if (leg.id === 'FS-04.symlink') fold('strace: 0 successful opens of private/secret.txt via alias', st.counts?.secret_okOpens === 0, st.counts)
    if (leg.id === 'FS-04.hardlink') fold('strace: 0 successful opens of alias AND secret', st.counts?.secret_okOpens === 0 && st.counts?.hardlink_okOpens === 0, st.counts)
    if (leg.id === 'FS-04.traversal') fold('strace: 0 successful opens of /etc/passwd', st.counts?.etcPasswd_okOpens === 0, st.counts)
    if (leg.id === 'FS-04.spaces') fold('strace: >=1 open of "allowed/sp "; trimmed "allowed/sp" ONLY as failed ENOENT probe', (st.counts?.spacedExact_okOpens ?? 0) >= 1 && (st.counts?.spacedTrimmed_okOpens ?? 1) === 0 && (st.counts?.spacedTrimmed_FAILEDAttempts ?? 0) >= 1, st.counts)
    const hard = leg.checks.filter((c) => c.pass !== 'NOT_RUN')
    leg.verdict = hard.every((c) => c.pass) ? 'PASS' : 'FAIL'
  }

  const junctionsAfter = junctionAudit()
  const junctionsUnchanged = JSON.stringify(junctionsBefore) === JSON.stringify(junctionsAfter)
  const executed = legs.filter((l) => l.verdict !== 'NOT_RUN')
  const failed = executed.filter((l) => l.verdict === 'FAIL')

  const result = {
    header: {
      recorded_at_utc: t0.toISOString(),
      pwd: HERE,
      team_HEAD: git(['rev-parse', 'HEAD'], WORKTREE_ROOT),
      team_branch: git(['rev-parse', '--abbrev-ref', 'HEAD'], WORKTREE_ROOT),
      test_use_HEAD: git(['rev-parse', 'HEAD'], TEST_USE),
      test_use_porcelain: git(['status', '--porcelain'], TEST_USE).length === 0 ? 'CLEAN' : 'DIRTY(FIXTURE MUST NOT WRITE HERE)',
      node: process.version,
      platform: `${process.platform} ${release()}`,
      strace_available: hasStrace,
      model_reported_by_agent: MODEL_REPORTED_BY_AGENT,
      junctions_before: junctionsBefore,
      junctions_after: junctionsAfter,
      junctions_unchanged: junctionsUnchanged,
    },
    semantics: 'In-process Trusted FS boundary: the Team adapter enforces policy at its own real node:fs call sites (architecture.md §14.5: read/write/edit family = Controlled FS, no process sandbox). The un-adapted native-style lane is a bypass control surface; the real native read pass-through is separately source-confirmed (00-baseline S-10 CONFIRMED: fs-sandbox fences only mutations, reads pass through). All fixture contents are SYNTHETIC.',
    legs,
    ledgers: { adapter: adapterLedgerDump, grants: grantLedgerDump, native_lane_observation_only: nativeLedgerDump },
    strace: straceByLeg,
    family_verdict: {
      per_leg: legs.map((l) => ({ id: l.id, verdict: l.verdict })),
      family: 'INCONCLUSIVE (fixture-level candidate)',
      leaning: 'fixture evidence is consistent with in-process Controlled FS enforcement at adapter node:fs call sites for the read/write/edit family (FS-01..FS-04 legs all behaved as designed)',
      preconditions_not_met: [
        'INV-1 full coverage (T_dispatchable ⊆ T_governed) NOT enforced here — the bypass control leg deliberately demonstrates an un-adapted dispatchable tool reading private; deny/coverage must coexist before any family conclusion',
        'real pinned-host re-verification (P0-6 / REG-01) not performed',
      ],
      non_claims: ['not OS-level enforcement', 'not a real-host result', 'strace here only observes this sandboxed test process'],
    },
  }
  fs.writeFileSync(path.join(HERE, 'p03-result.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify({ legs: legs.map((l) => `${l.id}:${l.verdict}`), failed: failed.map((l) => l.id), strace: hasStrace, junctions_unchanged: junctionsUnchanged, out: path.join(HERE, 'p03-result.json') }))
  process.exit(executed.length > 0 && failed.length === 0 ? 0 : 1)
}

main().catch((e) => { console.error('P03_ENV_FAIL', e?.stack ?? String(e)); process.exit(2) })
