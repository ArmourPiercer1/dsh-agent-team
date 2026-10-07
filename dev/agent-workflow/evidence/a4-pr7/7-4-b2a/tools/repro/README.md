# How the a2c7 `metadata: {}` loss was found and pinned

1. Whole-diff executable-line census over all 34 roster files (comments and blanks
   dropped, `difflib` opcode pairing, every changed line must be a version carrier, an
   envelope element, or a line that merely gained envelope elements):
   2 lines failed the rule — both in `a2c7-subtree-matcher.test.ts`, both losing a
   `'metadata: {}'` element.
2. Replayed the lane's own transform from base to isolate the cause:
   ```sh
   git show a4ef2a6b:packages/runtime/test/a2c7-subtree-matcher.test.ts > /dev/shm/a2c7.base
   python3 ../migrate.py /dev/shm/a2c7.base 1
   diff <(grep -vE '^\s*(//|\*|/\*)' /dev/shm/a2c7.base | grep -vE '^\s*$') \
        <(git show <measured-head>:packages/runtime/test/a2c7-subtree-matcher.test.ts | \
          grep -vE '^\s*(//|\*|/\*)' | grep -vE '^\s*$')
   ```
   That diff is kept here as `committed-vs-script-delta.diff`: **exactly two lines**, both
   losing `'metadata: {}'`. (The full 1788-line migration output is deliberately not committed —
   the command above regenerates it in seconds; only the delta is evidence.) So the transform was right and a later hand-patch (of the
   `no-sparse-arrays` artifact) had eaten the adjacent element.
3. After restoring both elements, the working file is byte-identical to
   `a2c7.migrated-by-script.txt` modulo comments, `a2c7` runs 31/31, eslint reports only
   the two pre-existing unused-type errors, and the fence class lines are unchanged.

Semantics of the loss: `metadata` is an optional closed-set field — `validate.ts:1458-1459`
takes it with `takeRecord(...)`, and when absent the frozen blueprint still carries
`metadata: {}` (`validate.ts:1518`). So the parse result and the two pinned `MALFORMED_DTO`
diagnostics were identical either way, which is exactly why 31/31 stayed green and nothing
but the census noticed. The fixture bytes were still wrong, and this file's own test name is
"the A2C-1 shell rejections are BYTE-IDENTICAL".
