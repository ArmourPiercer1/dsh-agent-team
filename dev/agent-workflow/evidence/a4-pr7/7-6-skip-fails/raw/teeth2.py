"""P3 redo: the earlier P3 mislabelled its gate (a restore() undid the base copy)."""
import hashlib, shutil, subprocess, pathlib, sys

RAW = pathlib.Path('dev/agent-workflow/evidence/a4-pr7/7-6-skip-fails/raw')
GATE = pathlib.Path('scripts/composition-smoke.mjs')
TEST = pathlib.Path('packages/testkit/test/a4p75-composition-smoke-classification.test.ts')
KEEP_GATE, KEEP_TEST = RAW / 'fixed-composition-smoke.mjs.keep', RAW / 'fixed-test.ts.keep'
BASE_GATE = RAW / 'base-composition-smoke.mjs'
REPO_LEG = 'never reports a passing gate over a step it did not run'


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()[:12]


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


def run(label):
    proc = subprocess.run(['npx', 'vitest', 'run', str(TEST), '-t', REPO_LEG],
                          capture_output=True, text=True)
    print(f'--- {label}\n    [gate sha {sha(GATE)} | vitest exit {proc.returncode}]')
    for line in proc.stdout.splitlines():
        if 'Tests ' in line or 'AssertionError' in line or line.startswith(' FAIL'):
            print('   ', line.strip())
    sys.stdout.flush()


shutil.copy2(KEEP_TEST, TEST)
shutil.copy2(BASE_GATE, GATE)
run('P3  BASE gate, real-repo leg untouched (must be RED: exit 0 over a SKIP)')
remove_statement('expect(run.status).not.toBe(0)')
run('P3b BASE gate, that assertion DELETED (the red must go away)')
shutil.copy2(KEEP_GATE, GATE)
shutil.copy2(KEEP_TEST, TEST)
run('P3c FIXED gate, real-repo leg restored (must be GREEN)')
print('=== restored:', sha(GATE) == sha(KEEP_GATE), sha(TEST) == sha(KEEP_TEST))
