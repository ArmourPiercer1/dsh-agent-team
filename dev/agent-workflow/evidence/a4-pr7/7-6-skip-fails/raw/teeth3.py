"""Teeth matrix, with the FAILING ASSERTION captured per phase (09 only had counts)."""
import hashlib, re, shutil, subprocess, pathlib, sys

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


def run(label, leg):
    proc = subprocess.run(['npx', 'vitest', 'run', str(TEST), '-t', leg],
                          capture_output=True, text=True)
    out = proc.stdout
    failed = re.search(r'Tests\s+(.+)$', out, re.M)
    hits = re.findall(r'^\s+(\d+)\|\s*(expect\(.*)$', out, re.M)
    print(f'--- {label}\n    gate={sha(GATE)} exit={proc.returncode} :: {failed.group(1).strip() if failed else "?"}')
    for line, src in hits[:2]:
        print(f'      at :{line}  {src.strip()[:110]}')
    sys.stdout.flush()


shutil.copy2(KEEP_GATE, GATE); shutil.copy2(KEEP_TEST, TEST)
run('P0 FIXED gate, untouched suite (control: green)', SKIP_LEG)
shutil.copy2(BASE_GATE, GATE)
run('P1 BASE gate, untouched suite (the defect)', SKIP_LEG)
for needle in ['expect(skipped.status).not.toBe(0)',
               'expect(skipped.failures).toHaveLength(1)',
               "expect(skipped.stdout).not.toContain('PASS composition-smoke')"]:
    remove_statement(needle)
    run(f'P2 BASE gate, DELETED: {needle}', SKIP_LEG)
shutil.copy2(KEEP_TEST, TEST)
run('P3 BASE gate, real-repo leg untouched', REPO_LEG)
remove_statement('expect(run.status).not.toBe(0)')
run('P3b BASE gate, real-repo exit assertion DELETED', REPO_LEG)
shutil.copy2(KEEP_GATE, GATE); shutil.copy2(KEEP_TEST, TEST)
run('P3c FIXED gate, real-repo leg restored', REPO_LEG)
mutate_gate('return `SKIP ${label}: ${detail}`', 'return `note ${label}: ${detail}`')
run('P4 FIXED gate, SKIP line RENUMBED (report goes quiet)', SKIP_LEG)
shutil.copy2(KEEP_GATE, GATE)
mutate_gate("'A skipped step is an unverified claim, not a green one.'",
            "'A skipped step is not verified.'")
run('P5 FIXED gate, footer wording REWORDED', SKIP_LEG)
shutil.copy2(KEEP_GATE, GATE)
mutate_gate('if (failed || skipped.length > 0) {', 'if (failed || skipped.length > 0 || true) {')
run('P6 FIXED gate, verdict forced always-red', GREEN_LEG)
shutil.copy2(KEEP_GATE, GATE)
mutate_gate('if (failed || skipped.length > 0) {', 'if (failed) {')
run('P7 FIXED gate, skip clause REMOVED (the bug re-added)', SKIP_LEG)
shutil.copy2(KEEP_GATE, GATE); shutil.copy2(KEEP_TEST, TEST)
print(f'=== restored: gate={sha(GATE) == sha(KEEP_GATE)} test={sha(TEST) == sha(KEEP_TEST)}')
