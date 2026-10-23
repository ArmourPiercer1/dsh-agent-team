# OVERLAY-16 point-proof (no Host, no world): slices the kit's OWN text — toolResultText(),
# denialPairSeen() and the OVERLAY-16 helpers — and runs them against the REAL captured wire pair
# re-extracted from a failed run's mock.log, plus three negative controls (ambiguous two-call wire,
# clean result, is_error without a P_ code). Expect: positive stops with the right callId+code; every
# negative returns stopped=false (the bounded wait stays in force, so another call's error can never
# be read as this one's). Run from the worktree root:
#   python3 dev/agent-workflow/evidence/a5m2-img-r18/pin-audit/replay16-faststop.py
# Edit RUN below to point at another run directory.
import io, json, re, subprocess, sys

KIT = 'tests/kits/a5m2-todo-c2/a5m2-todo-c2.mjs'
RUN = 'dev/agent-workflow/evidence/a5m2-img-r18/run-2026-10-23T18-17-00'

kit = io.open(KIT, encoding='utf-8').read()


def slice_fn(src, start_marker, end_marker):
    i = src.index(start_marker)
    j = src.index(end_marker, i) + len(end_marker)
    return src[i:j]


# the tested code is literally the kit's own text, sliced out verbatim
tool_result_text = slice_fn(kit, 'function toolResultText(', '\n}')
denial = slice_fn(kit, 'function denialPairSeen(', '\n  return null\n}')
overlay16 = slice_fn(kit, '      const wireImageCallIds = () => {', '\n      let terminalImgErr = null')
assert 'GOV_REFUSAL_PRED' in overlay16 and 'sameCallTerminalError' in overlay16

# the REAL captured wire pair from the failed run (verbatim ids / file_path / text)
raw = io.open(RUN + '/mock.log', encoding='utf-8', errors='replace').read()
m_id = re.search(r'"id": "(call-[a-z0-9-]+)",\s*\n\s*"name": "read_image",\s*\n\s*"input": \{\s*\n\s*"file_path": "([^"]+)"', raw)
m_res = re.search(r'"tool_use_id": "(call-[a-z0-9-]+)",\s*\n\s*"content": \[\s*\n\s*\{\s*\n\s*"type": "text",\s*\n\s*"text": "((?:[^"\\]|\\.)*)"\s*\n\s*\},?\s*\n\s*\],?\s*\n\s*"is_error": true', raw)
if not (m_id and m_res):
    sys.exit('could not re-extract the captured pair from mock.log')
call_id, img_rel = m_id.group(1), m_id.group(2)
res_id, res_text_esc = m_res.group(1), m_res.group(2)
res_text = json.loads('"%s"' % res_text_esc)
print('captured: callId=%s file=%s' % (call_id, img_rel))
print('captured raw text head:', res_text[:90].replace('\n', ' '))

pair = [
    {'role': 'assistant', 'content': [{'type': 'tool_use', 'id': call_id, 'name': 'read_image', 'input': {'file_path': img_rel}}]},
    {'role': 'user', 'content': [{'type': 'tool_result', 'tool_use_id': res_id, 'content': [{'type': 'text', 'text': res_text}], 'is_error': True}]},
]
two_calls = [
    {'role': 'assistant', 'content': [{'type': 'tool_use', 'id': call_id, 'name': 'read_image', 'input': {'file_path': img_rel}}]},
    {'role': 'assistant', 'content': [{'type': 'tool_use', 'id': call_id + '-B', 'name': 'read_image', 'input': {'file_path': img_rel}}]},
    {'role': 'user', 'content': [{'type': 'tool_result', 'tool_use_id': call_id + '-B', 'content': [{'type': 'text', 'text': res_text}], 'is_error': True}]},
]
clean = [
    {'role': 'assistant', 'content': [{'type': 'tool_use', 'id': call_id, 'name': 'read_image', 'input': {'file_path': img_rel}}]},
    {'role': 'user', 'content': [{'type': 'tool_result', 'tool_use_id': call_id, 'content': [{'type': 'text', 'text': '<type>image</type> ok'}], 'is_error': False}]},
]
noncode = [
    {'role': 'assistant', 'content': [{'type': 'tool_use', 'id': call_id, 'name': 'read_image', 'input': {'file_path': img_rel}}]},
    {'role': 'user', 'content': [{'type': 'tool_result', 'tool_use_id': call_id, 'content': [{'type': 'text', 'text': 'Error: some other tool failure without a governance code'}], 'is_error': True}]},
]

js = '\n'.join([
    "const IMG_REL = process.env.PROBE_IMG_REL;",
    "let mockRef = { requests: [] };",
    tool_result_text, denial, overlay16,
    "const cases = JSON.parse(process.env.PROBE_CASES);",
    "const out = [];",
    "for (const [name, reqs] of Object.entries(cases)) { mockRef = { requests: reqs }; const p = sameCallTerminalError();",
    "  out.push({ name, unique: p.unique, observed: p.observed, stopped: p.hit !== null, callId: p.hit ? p.hit.callId : null, code: p.hit ? ((/\\bP_[A-Z0-9_]{4,}\\b/.exec(p.hit.text)||[null])[0]) : null }); }",
    "console.log(JSON.stringify(out, null, 1));",
])
io.open('.pinbuild-verify/probe16.mjs', 'w', encoding='utf-8').write(js)

cases = {'positive_real_wire': [{'body': {'messages': pair}}],
         'ambiguous_two_calls': [{'body': {'messages': two_calls}}],
         'clean_result': [{'body': {'messages': clean}}],
         'error_without_code': [{'body': {'messages': noncode}}]}
import os
env = dict(os.environ); env['PROBE_IMG_REL'] = img_rel; env['PROBE_CASES'] = json.dumps(cases)
r = subprocess.run(['node', '.pinbuild-verify/probe16.mjs'], capture_output=True, text=True, env=env)
print('harness RC =', r.returncode)
print(r.stdout or r.stderr)
