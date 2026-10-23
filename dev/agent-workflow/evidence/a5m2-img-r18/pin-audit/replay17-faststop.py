# OVERLAY-17 point-proof (no Host, no world, no build). Slices the kit's OWN text — toolResultText(),
# the OVERLAY-17 pairing helpers AND the real effect-wait loop body — and runs them on tool_result
# messages re-extracted from a failed run's mock.log plus the shapes root's card requires. Expect:
#   * every is_error === true result paired to the single read_image call STOPS the criterion,
#     whatever the text looks like (no 'Error:' prefix and no P_ code required; a code, if present,
#     is only a diagnostic);
#   * a clean is_error === false result does NOT stop (the bounded wait runs to its deadline);
#   * an ambiguous two-call wire does NOT stop (no cross-call misattribution);
#   * when the attachment store has ALREADY gained an object while the call failed, the ERROR WINS
#     (the loop probes the error before the store increment).
# Run from the worktree root:
#   python3 dev/agent-workflow/evidence/a5m2-img-r18/pin-audit/replay17-faststop.py
import io, json, os, re, subprocess, sys

KIT = 'tests/kits/a5m2-todo-c2/a5m2-todo-c2.mjs'
RUN = 'dev/agent-workflow/evidence/a5m2-img-r18/run-2026-10-23T18-17-00'

kit = io.open(KIT, encoding='utf-8').read()

i = kit.index('function toolResultText(')
tool_result_text = kit[i:kit.index('\n}', i) + 2]
# OVERLAY-17b moved the helpers into the C3 common scope (4-space indent); find them by content so
# this harness keeps working regardless of indentation depth.
h0 = kit.index('const wireImageCallIds = () => {')
h0 = kit.rindex('\n', 0, h0) + 1
# OVERLAY-17b put a `if (FIXTURE === 'write') {` between the helpers and the image branch: cut the
# helpers at that statement, and take the loop from its own declaration.
w0 = kit.index("if (FIXTURE === 'write') {", h0)
w0 = kit.rindex('\n', 0, w0) + 1
t0 = kit.index('let terminalImgErr = null')
t0 = kit.rindex('\n', 0, t0) + 1
assert h0 < w0 < t0
helpers = kit[h0:w0]
loop = kit[t0:kit.index('if (terminalImgErr !== null) c3TerminalStop')]
assert 'pairedErrorThisCall' in helpers and 'sameCallTerminalError' in helpers
assert 'const probe = sameCallTerminalError()' in loop
assert loop.index('sameCallTerminalError()') < loop.index('storeCensus()'), 'error must be probed BEFORE the store increment'
assert 'denialPairSeen(' not in helpers, 'the C4/C5 shared predicate must not be CALLED from this path'

raw = io.open(RUN + '/mock.log', encoding='utf-8', errors='replace').read()
m_id = re.search(r'"id": "(call-[a-z0-9-]+)",\s*\n\s*"name": "read_image",\s*\n\s*"input": \{\s*\n\s*"file_path": "([^"]+)"', raw)
m_res = re.search(r'"tool_use_id": "(call-[a-z0-9-]+)",\s*\n\s*"content": \[\s*\n\s*\{\s*\n\s*"type": "text",\s*\n\s*"text": "((?:[^"\\]|\\.)*)"\s*\n\s*\},?\s*\n\s*\],?\s*\n\s*"is_error": true', raw)
call_id, img_rel = m_id.group(1), m_id.group(2)
res_text = json.loads('"%s"' % m_res.group(2))
print('captured from raw mock.log: callId=%s img=%s' % (call_id, img_rel))
print('captured error text: callId=%s head=%r len=%d' % (m_res.group(1), res_text[:46], len(res_text)))


def wire(tid, text, is_err, second=None):
    msgs = [{'role': 'assistant', 'content': [{'type': 'tool_use', 'id': call_id, 'name': 'read_image', 'input': {'file_path': img_rel}}]}]
    if second is not None:
        msgs.append({'role': 'assistant', 'content': [{'type': 'tool_use', 'id': second, 'name': 'read_image', 'input': {'file_path': img_rel}}]})
    msgs.append({'role': 'user', 'content': [{'type': 'tool_result', 'tool_use_id': tid,
                                             'content': [{'type': 'text', 'text': text}], 'is_error': is_err}]})
    return [{'body': {'messages': msgs}}]


cases = {
    'positive_real_wire': wire(call_id, res_text, True),
    'error_without_code': wire(call_id, 'refused by the consumption point, no code here', True),
    'json_shape_refusal': wire(call_id, '{"status":"refused","reason":"binding mismatch"}', True),
    'clean_result': wire(call_id, '<type>image</type> downscaled from 8x8 px', False),
    'ambiguous_two_calls': wire(call_id + '-B', res_text, True, second=call_id + '-B'),
    'store_gained_and_error': wire(call_id, res_text, True),
}

js = '\n'.join([
    "const IMG_REL = process.env.PROBE_IMG_REL;",
    "let mockRef = { requests: [] };",
    "let storeBaseline = [];",
    "let storeCensus = () => [];",
    "let appendDeadline = 0;",
    tool_result_text,
    helpers,
    "async function runLoop() {",
    loop,
    "  return terminalImgErr === null ? null : { callId: terminalImgErr.callId, text: terminalImgErr.text };",
    "}",
    "const cases = JSON.parse(process.env.PROBE_CASES);",
    "const out = [];",
    "for (const name of ['positive_real_wire','error_without_code','json_shape_refusal','clean_result','ambiguous_two_calls','store_gained_and_error']) {",
    "  mockRef = { requests: cases[name] };",
    "  storeCensus = () => (name === 'store_gained_and_error' ? [{ rel: 'aa/obj' }] : []);",
    "  storeBaseline = [];",
    "  appendDeadline = Date.now() + 1500;",
    "  const t = await runLoop();",
    "  out.push({ name, stopped: t !== null, callId: t ? t.callId : null,",
    "    codeIfAny: t ? ((/\\bP_[A-Z0-9_]{4,}\\b/.exec(t.text) || [null])[0]) : null });",
    "}",
    "console.log(JSON.stringify(out));",
])

env = dict(os.environ)
env['PROBE_IMG_REL'] = img_rel
env['PROBE_CASES'] = json.dumps(cases)
io.open('.pinbuild-verify/probe17.mjs', 'w', encoding='utf-8').write(js)
r = subprocess.run(['node', '.pinbuild-verify/probe17.mjs'], capture_output=True, text=True, env=env)
print('harness RC =', r.returncode)
for row in (json.loads(r.stdout) if r.stdout.strip() else []):
    print('  %-22s stopped=%-5s callId=%s code=%s' % (row['name'], row['stopped'], row['callId'], row['codeIfAny']))
if r.stderr.strip():
    print('stderr:', r.stderr[:400])
sys.exit(r.returncode)
