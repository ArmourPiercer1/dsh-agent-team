"""Which assertion actually catches each phase (raw vitest failure block, ANSI stripped)."""
import re, shutil, subprocess, pathlib, sys

RAW = pathlib.Path('dev/agent-workflow/evidence/a4-pr7/7-6-skip-fails/raw')
GATE = pathlib.Path('scripts/composition-smoke.mjs')
TEST = pathlib.Path('packages/testkit/test/a4p75-composition-smoke-classification.test.ts')
KEEP_GATE, KEEP_TEST = RAW / 'fixed-composition-smoke.mjs.keep', RAW / 'fixed-test.ts.keep'
BASE_GATE = RAW / 'base-composition-smoke.mjs'
ANSI = re.compile(r'\x1b\[[0-9;]*m')


def remove_statement(needle):
    text = TEST.read_text()
    i = text.index(needle)
    start = text.rindex('\n', 0, i) + 1
    depth, j = 0, i
    while True:
        c = text[j]
        if c in '([{':
            depth += 1
        elif c in ')]}':
            depth -= 1
            if depth == 0:
                j += 1
                break
        j += 1
    TEST.write_text(text[:start] + text[text.index('\n', j) + 1:])


def mutate_gate(needle, replacement):
    text = GATE.read_text()
    assert text.count(needle) == 1
    GATE.write_text(text.replace(needle, replacement))


def run(label, leg):
    proc = subprocess.run(['npx', 'vitest', 'run', str(TEST), '-t', leg],
                          capture_output=True, text=True)
    out = ANSI.sub('', proc.stdout + proc.stderr)
    block = []
    for line in out.splitlines():
        if 'AssertionError' in line or re.match(r'^\s+\d+\|', line) or 'Tests  ' in line:
            block.append(line.rstrip())
    print(f'--- {label}')
    for line in block[:6]:
        print('   ', line.strip()[:120])
    sys.stdout.flush()


shutil.copy2(BASE_GATE, GATE); shutil.copy2(KEEP_TEST, TEST)
run('P1 BASE gate, untouched suite', 'exits non-zero when a step is skipped')
for needle in ['expect(skipped.status).not.toBe(0)',
               'expect(skipped.failures).toHaveLength(1)',
               'expect(skipped.failures[0]).toBe(',
               "expect(skipped.stdout).not.toContain('PASS composition-smoke')"]:
    remove_statement(needle)
    run(f'P2 BASE gate, DELETED: {needle}', 'exits non-zero when a step is skipped')
shutil.copy2(KEEP_GATE, GATE); shutil.copy2(KEEP_TEST, TEST)
mutate_gate('return `SKIP ${label}: ${detail}`', 'return `note ${label}: ${detail}`')
run('P4 FIXED gate, SKIP line RENUMBED', 'exits non-zero when a step is skipped')
shutil.copy2(KEEP_GATE, GATE)
mutate_gate("'A skipped step is an unverified claim, not a green one.'", "'A skipped step is not verified.'")
run('P5 FIXED gate, footer REWORDED', 'exits non-zero when a step is skipped')
shutil.copy2(KEEP_GATE, GATE)
mutate_gate('if (failed || skipped.length > 0) {', 'if (failed || skipped.length > 0 || true) {')
run('P6 FIXED gate, verdict forced always-red', 'exits 0 with every arm green')
shutil.copy2(KEEP_GATE, GATE)
mutate_gate('if (failed || skipped.length > 0) {', 'if (failed) {')
run('P7 FIXED gate, bug RE-ADDED', 'exits non-zero when a step is skipped')
shutil.copy2(KEEP_GATE, GATE); shutil.copy2(KEEP_TEST, TEST)
print('=== restored')
