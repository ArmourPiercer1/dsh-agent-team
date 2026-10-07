"""Prove each new assertion is load-bearing: delete one, show what stays red."""
import hashlib, shutil, subprocess, pathlib, sys

RAW = pathlib.Path('dev/agent-workflow/evidence/a4-pr7/7-6-skip-fails/raw')
GATE = pathlib.Path('scripts/composition-smoke.mjs')
TEST = pathlib.Path('packages/testkit/test/a4p75-composition-smoke-classification.test.ts')
KEEP_GATE, KEEP_TEST = RAW / 'fixed-composition-smoke.mjs.keep', RAW / 'fixed-test.ts.keep'
BASE_GATE = RAW / 'base-composition-smoke.mjs'
SKIP_LEG = 'exits non-zero when a step is skipped'
REPO_LEG = 'never reports a passing gate over a step it did not run'
GREEN_LEG = 'exits 0 with every arm green'


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()[:12]


def restore():
    shutil.copy2(KEEP_GATE, GATE)
    shutil.copy2(KEEP_TEST, TEST)
    assert sha(GATE) == sha(KEEP_GATE), 'gate restore mismatch'
    assert sha(TEST) == sha(KEEP_TEST), 'test restore mismatch'


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
    assert text.count(needle) == 1, f'gate needle not unique: {needle!r}'
    GATE.write_text(text.replace(needle, replacement))


def run(label, test_name):
    proc = subprocess.run(['npx', 'vitest', 'run', str(TEST), '-t', test_name],
                          capture_output=True, text=True)
    tail = [line for line in proc.stdout.splitlines()
            if 'Tests ' in line or 'AssertionError' in line or line.startswith(' FAIL')]
    print(f'--- {label}\n    [vitest exit {proc.returncode}]')
    for line in tail:
        print('   ', line.strip())
    sys.stdout.flush()
    return proc.returncode


results = []
restore()
results.append(run('P0 fixed gate, untouched suite (control)', SKIP_LEG))
shutil.copy2(BASE_GATE, GATE)
results.append(run('P1 BASE gate, untouched suite (the defect)', SKIP_LEG))
for needle in ['expect(skipped.status).not.toBe(0)',
               'expect(skipped.failures).toHaveLength(1)',
               "expect(skipped.stdout).not.toContain('PASS composition-smoke')"]:
    remove_statement(needle)
    results.append(run(f'P2 BASE gate, assertion DELETED: {needle}', SKIP_LEG))
shutil.copy2(BASE_GATE, GATE)
restore()
results.append(run('P3 BASE gate, real-repo leg, untouched (control red)', REPO_LEG))
remove_statement('expect(run.status).not.toBe(0)')
results.append(run('P3b BASE gate, real-repo assertion DELETED', REPO_LEG))
restore()
mutate_gate('return `SKIP ${label}: ${detail}`', 'return `note ${label}: ${detail}`')
results.append(run('P4 fixed gate, SKIP line RENUMBED (report goes quiet)', SKIP_LEG))
restore()
mutate_gate("'A skipped step is an unverified claim, not a green one.'",
            "'A skipped step is not verified.'")
results.append(run('P5 fixed gate, footer wording REWORDED', SKIP_LEG))
restore()
mutate_gate('if (failed || skipped.length > 0) {', 'if (failed || skipped.length > 0 || true) {')
results.append(run('P6 fixed gate, always-red verdict (green leg must catch it)', GREEN_LEG))
restore()
mutate_gate('if (failed || skipped.length > 0) {', 'if (failed) {')
results.append(run('P7 fixed gate, skip clause REMOVED from the verdict (the bug, re-added)', SKIP_LEG))
restore()
print('=== exit codes in order:', results)
print('=== restored:', sha(GATE) == sha(KEEP_GATE), sha(TEST) == sha(KEEP_TEST))
