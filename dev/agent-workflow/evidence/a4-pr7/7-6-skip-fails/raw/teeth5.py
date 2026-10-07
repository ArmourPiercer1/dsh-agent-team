"""Isolate the report clause the earlier cumulative deletion never reached."""
import re, shutil, subprocess, pathlib, sys

RAW = pathlib.Path('dev/agent-workflow/evidence/a4-pr7/7-6-skip-fails/raw')
GATE, TEST = pathlib.Path('scripts/composition-smoke.mjs'), pathlib.Path('packages/testkit/test/a4p75-composition-smoke-classification.test.ts')
KEEP_GATE, KEEP_TEST = RAW / 'fixed-composition-smoke.mjs.keep', RAW / 'fixed-test.ts.keep'
ANSI = re.compile(r'\x1b\[[0-9;]*m')

shutil.copy2(RAW / 'base-composition-smoke.mjs', GATE)
text = pathlib.Path(TEST).read_text()
# Comment out every clause of the skip leg that comes BEFORE the stdout clause,
# so the only thing left that can catch the base verdict is that one.
lines = text.splitlines(keepends=True)
out, inside = [], False
for line in lines:
    if "expect(skipped.status).not.toBe(0)" in line:
        inside = True
    if inside and "expect(skipped.stdout).not.toContain" in line:
        inside = False
    out.append(('// MUTATED-OUT: ' + line) if inside else line)
pathlib.Path(TEST).write_text(''.join(out))

proc = subprocess.run(['npx', 'vitest', 'run', str(TEST), '-t', 'exits non-zero when a step is skipped'],
                      capture_output=True, text=True)
print(ANSI.sub('', proc.stdout + proc.stderr).split('⎯⎯⎯⎯⎯⎯⎯ Failed Tests')[-1][:1400])
shutil.copy2(KEEP_GATE, GATE)
shutil.copy2(KEEP_TEST, TEST)
print('=== restored:', pathlib.Path(GATE).read_text() == KEEP_GATE.read_text(),
      pathlib.Path(TEST).read_text() == KEEP_TEST.read_text())
