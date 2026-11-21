# Round-62 re-run of the round-61 driver (instrument repair validation)

This directory preserves ONE run of `tests/world-factory/drivers/d-boot-feasibility/run-boot.mjs`
(round-61 driver) made in round 62, at HEAD `b583de6315cae08f34e09e43c1aa281cd771e6f5`, host pin
`639ed015397290b3745d163aafe02ffee4aa3f84`, after the `d:native-read-surface` repair.

Why it is here and not in `../runs/`: the round-61 driver uses archive-before-start and writes to
`../runs/`, which would replace the round-61 record. The run was therefore copied here and `../runs/`
was restored from git (`git checkout -- dev/agent-workflow/evidence/d-boot-feasibility/runs`), so the
round-61 artefacts are byte-identical to the round-61 commit. `../driver.log` and `../run-ledger.jsonl`
are append-only and keep this run's lines in addition to the round-61 ones.

- `boot01/` — the full round-62 boot record (run-record, summary, transcript, guard/centre facts, host log tail)
- `agreement.json` / `agreement.txt` — the round-62 single-boot agreement block (one boot, so `agreeing=false` by construction)
- `driver-digest.json` — HEAD/pin/driver sha256 for this run

Result of the repaired clause, all six true and the judge `PASS`:

```
read-present-once                 read schemas on the Member surface=1
native-params                     properties=file_path,limit,offset
native-description                top-level description="Read a UTF-8 text file and return line-numbered content."
native-file-path-description      file_path.description="Path to read, resolved by the filesystem backend."
no-shadow-modules                 config.a5sfNativeToolModules=[]
tool-fs-is-shipped-row            the preset row's own tool-fs row registers `read` (plugins include tool-fs=true)
```

The host source is `tests/deepseek-harness-test-use/packages/fs/tool-fs/src/read.ts:79-81`. The driver's
overall verdict remains `FAIL` for the other judges (notably `d:member-read-denied`'s `typed-denial`
residual); nothing was relaxed and no judge was skipped.
