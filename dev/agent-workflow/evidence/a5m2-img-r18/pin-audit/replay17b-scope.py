# OVERLAY-17b scope + second-wait proof (no Host, no world, no build).
#
# Root 18:52 BLOCK: the OVERLAY-17 helpers were const-declared INSIDE the first image branch, which
# closes before the model-visible block — the second block's references would throw ReferenceError on
# the success path, i.e. exactly on the path no earlier replay exercised. This harness therefore
# executes the kit's OWN contiguous C3 region — from `const appendDeadline` through the second block's
# `if (terminalImgErr2 !== null) c3TerminalStop(...)` line — under stubs, so the REAL second-wait
# callback (the closure handed to waitForMock) and the REAL scope chain run.
#
# Expect:
#   scope_static            — helper declarations precede BOTH image branches (common scope)
#   error_in_effect_wait    — stop comes from the effect loop (finishCriterion called)
#   success_then_error      — effect loop sees the store gain, the model-visible callback then takes
#                             the same-call terminal result and stops (NO ReferenceError)
#   envelope_and_error      — error wins over a present success envelope in the same callback
#   success_only            — callback returns true on the envelope, no stop, region completes
# Run from the worktree root:
#   python3 dev/agent-workflow/evidence/a5m2-img-r18/pin-audit/replay17b-scope.py
import io, json, os, re, subprocess, sys

KIT = 'tests/kits/a5m2-todo-c2/a5m2-todo-c2.mjs'
kit_lines = io.open(KIT, encoding='utf-8').readlines()
CONTRAST = os.environ.get('PROBE_CONTRAST')  # e.g. 27293c72 — the commit WITH the scope BLOCK
if CONTRAST:
    import subprocess as sp
    kit = sp.run(['git', 'show', '%s:%s' % (CONTRAST, KIT)], capture_output=True, text=True, check=True).stdout
    kit_lines = kit.splitlines(keepends=True)
else:
    kit = ''.join(kit_lines)

# ── static scope assertion ──────────────────────────────────────────────────────────────────────
IMG_BRANCH = "    } else if (FIXTURE === 'image') {"
decl = [n for n, l in enumerate(kit_lines, 1) if l.startswith('    const sameCallTerminalError') or l.startswith('    const c3TerminalStop')]
deadl = next(n for n, l in enumerate(kit_lines, 1) if l.strip() == 'const appendDeadline = Date.now() + 120_000')
branches = [n for n in range(deadl, len(kit_lines)) if kit_lines[n].rstrip() == IMG_BRANCH]
b1, b2 = branches[0] + 1, branches[1] + 1
calls = [n for n, l in enumerate(kit_lines, 1) if 'sameCallTerminalError()' in l or re.search(r'c3TerminalStop\(', l) and 'const c3TerminalStop' not in l]
ok_scope = (max(decl) < b1 and max(decl) < b2 and min(calls) > max(decl) and max(calls) > b2) if not CONTRAST else True
print('scope_static: decl=%s appendDeadline=%s imageBranch1=%s imageBranch2=%s callSites=%s -> %s'
      % (decl, deadl, b1, b2, calls, 'OK' if ok_scope else 'FAIL'))
if not ok_scope:
    sys.exit('helpers still scoped inside the first image branch')

# ── slices of the kit's own code ────────────────────────────────────────────────────────────────
def between(a, b):
    i = kit.index(a)
    return kit[i:kit.index(b, i)]


tool_result_text = between('function toolResultText(', '\n}') + '\n}'
image_visible = between('function imageVisiblePair(', '\n  return null\n}') + '\n  return null\n}'
region = between('    const appendDeadline = Date.now() + 120_000',
                 "      if (terminalImgErr2 !== null) c3TerminalStop(terminalImgErr2, terminalBinding2, 'model-visible wait')")
region += "      if (terminalImgErr2 !== null) c3TerminalStop(terminalImgErr2, terminalBinding2, 'model-visible wait')\n    }\n"  # close the second image block
assert 'c3TerminalStop' in region and 'waitForMock' in region and 'sameCallTerminalError' in region
img_w = re.search(r'const IMG_W = (\d+)', kit).group(1)
img_h = re.search(r'const IMG_H = (\d+)', kit).group(1)
img_rel = 'examples/minimal/.sessions/probe.png'
cid = 'call-a5c2-probe'

# ── wire fixtures ───────────────────────────────────────────────────────────────────────────────
use_block = {'type': 'tool_use', 'id': cid, 'name': 'read_image', 'input': {'file_path': img_rel}}
err_msg = {'role': 'user', 'content': [{'type': 'tool_result', 'tool_use_id': cid,
                                        'content': [{'type': 'text', 'text': 'Error: refused-image P_IMAGE_CONSUMPTION_BINDING_MISMATCH …'}],
                                        'is_error': True}]}
env_msg = {'role': 'user', 'content': [{'type': 'tool_result', 'tool_use_id': cid,
                                        'content': [{'type': 'text', 'text': '<type>image</type> raster downscaled from %sx%s px and more' % (img_w, img_h)}],
                                        'is_error': False}]}
clean_msg = {'role': 'user', 'content': [{'type': 'tool_result', 'tool_use_id': cid,
                                          'content': [{'type': 'text', 'text': 'some unrelated non-envelope result'}],
                                          'is_error': False}]}
hist = [{'role': 'assistant', 'content': [use_block]}]
W = lambda *msgs: [{'body': {'messages': hist + list(msgs)}}]

js = '\n'.join([
    "const IMG_REL = process.env.PROBE_IMG_REL;",
    "const IMG_W = %s, IMG_H = %s;" % (img_w, img_h),
    "const FIXTURE = 'image';",
    "let ALL_REQS = [];",
    "const mock = { requests: [] };",
    "let storeBaseline = [];",
    "let storeCensus = () => [];",
    "const RUN_DIR = 'probe-run-dir';",
    "const row1 = { payload: { requestId: 'ctrl-probe' } };",
    "const log = (m) => process.env.PROBE_VERBOSE && console.error('LOG ' + m.slice(0, 70));",
    "const written = [];",
    "const checks = [];",
    "const writeFileSync = (p, c) => written.push({ path: String(p), body: c });",
    "const join = (...a) => a.join('/');",
    "const jstr = (v, n) => JSON.stringify(v).slice(0, n || 120);",
    "const check = (c, t, pass, ev) => checks.push({ criterion: c, pass, ev });",
    "function finishCriterion(c) { throw new Error('FINISH-C3:' + c); }",
    "let phase = 1;",
    "const mockRef = new Proxy({}, { get: (_t, k) => (k === 'requests' ? ALL_REQS.slice(0, phase) : undefined) });",
    "async function waitForMock(m, pred, ms, label) { phase = ALL_REQS.length; for (const r of ALL_REQS) if (pred(r)) return; }",
    tool_result_text, image_visible,
    "async function region() {",
    region,
    "}",
    "const cases = JSON.parse(process.env.PROBE_CASES);",
    "const out = [];",
    "for (const [name, spec] of Object.entries(cases)) {",
    "  written.length = 0; checks.length = 0;",
    "  ALL_REQS = spec.requests;",
    "  phase = 1;",
    "  storeCensus = () => (spec.store ? [{ rel: 'aa/obj' }] : []);",
    "  storeBaseline = [];",
    "  let res = 'region-completed';",
    "  try { await region(); } catch (e) { res = String(e.message).slice(0, 40); }",
    "  const stop = written.find((w) => w.path.includes('c3-first-failure-stop'));",
    "  let where = null;",
    "  if (stop !== undefined) { const bb = JSON.parse(stop.body); const m2 = /;\\s*(effect wait|model-visible wait)\\)/.exec(bb.reason); where = m2 ? m2[1] : 'none'; }",
    "  out.push({ name, result: res, stopped: stop !== undefined, where, checks: checks.length });",
    "}",
    "console.log(JSON.stringify(out));",
])

cases = {
    'error_in_effect_wait': {'requests': W(err_msg), 'store': False},
    'success_then_error': {'requests': W(env_msg) + W(err_msg), 'store': True},
    'envelope_and_error': {'requests': W(env_msg) + W(env_msg, err_msg), 'store': True},
    'success_only': {'requests': W(env_msg), 'store': True},
    # no envelope at all: the callback MUST reach the terminal probe (pre-fix this is where the
    # out-of-scope const throws ReferenceError instead of stopping)
    'error_in_wait_no_envelope': {'requests': W(clean_msg) + W(err_msg), 'store': True},
}
env = dict(os.environ)
env['PROBE_IMG_REL'] = img_rel
env['PROBE_CASES'] = json.dumps(cases)
io.open('.pinbuild-verify/probe17b.mjs', 'w', encoding='utf-8').write(js)
r = subprocess.run(['node', '.pinbuild-verify/probe17b.mjs'], capture_output=True, text=True, env=env, timeout=90)
print('harness RC =', r.returncode)
for row in (json.loads(r.stdout) if r.stdout.strip() else []):
    print('  %-22s result=%-14s stopped=%-5s where=%s' % (row['name'], row['result'], row['stopped'], row['where']))
if r.stderr.strip():
    print('stderr:', r.stderr[:300])
sys.exit(r.returncode)
