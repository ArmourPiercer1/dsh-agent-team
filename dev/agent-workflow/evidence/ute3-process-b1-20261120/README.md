# UTE-3 / G1 PROCESS family — stage B1 evidence (2026-11-20)

Worktree `.worktrees/ute3-process-b1-20261120`, branch
`task/ute3-process-b1-20261120`, base `origin/master` at capture time.
Host pin: `0.2.0-rc.2 @ 639ed015397290b3745d163aafe02ffee4aa3f84`
(`tests/deepseek-harness-test-use`, read-only).

## Files

| file | what it is | produced by |
|---|---|---|
| `composition-probe.txt` | the STAGE 0 probe: members, reachability on product route C, the confined face, the `pwsh` verdict with its four facts, the legacy governed plane's answer for these names, and the baseline-scope decision | `node tests/ute-g1-process/probe-composition.mjs` |
| `old-path-capture.txt` | the old-path capture/verify transcript: the identity line, the PRINTED exclusion set, every vector's measured row summary, `OLD-PATH-GOLDEN compare=identical`, `OLD-PATH-VERDICT GREEN` | `node tests/ute-g1-process/capture-old-path.mjs` |
| `negative-controls.txt` | the nine controls, each with its mutated arm going RED and (where applicable) its `-POSITIVE` arm | `node tests/ute-g1-process/negative-controls.mjs` |
| `new-path-absent.txt` | the absence evidence behind `newPathVerified: false` | authored (there is no runner to produce it) |

## Probe answer (machine verdict, not prose)

* **`bash` IS reachable** on `mountMemberA5sfRealm` + `attachA5sfNativeToolModules`
  and the attach REPLACES the preset definition
  (`PROBE-OWNER bash-replaced-by-attach=yes before=preset-definition
  after=routed-definition`). The call reaches the CONFINED provider
  (`confined=yes providerCalls=1 inheritedServiceCalls=0`) — the PD-12
  `confined-bash-tool.mjs` definition, selected because the shipped wiring passes
  NO `faces.terminals` face.
* **`pwsh` is NOT reachable**: `PROBE-ROUTE-UNREACHABLE member=pwsh`. Four
  independent facts: no binary, no route-C shadow, host package present but
  unusable, and the shipped governed preset REMOVES the `tool-pwsh` row.
* **The legacy governed plane** accepts the native `bash` spelling on a COMPLETE
  name map (`PROBE-PLANE names=bash-native+search-aliased gate=accepted`;
  `PLANE_SUPPORTED_NATIVE_TAKEOVERS.bash = ['bash']`), and cannot express `pwsh`
  (`PLANE_NAMES_INVALID`). This is DIFFERENT from Search (whose native names the
  plane refuses with `PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED`), so the answer was
  MEASURED for this family rather than transferred.

## §UNKNOWN (stated, never graded PASS)

1. **A governed `team_bash` DISPATCH** — the probe measures the plane's name
   ledger and its assembly verdict (`TOOL_BINDING_UNVERIFIED` without a binding);
   actually dispatching `team_bash` needs the full governed kernel/PA mount
   (the `u6-arc-a` boot lane's job). Not run here.
2. **The persistent-PTY `bash` definition** (`native-bash-tool.mjs`,
   NATIVE-BASH-PRESERVATION) — never selected by the shipped wiring, so its
   `cd`/`export` state and `stty -echo`/marker protocol are NOT measured. It is
   declared as `SD-PROCESS-3-pty-face-not-measured`.
3. **`pwsh` behaviour** — no binary, no composition: nothing is claimed about
   its semantics.
4. **Read confinement is not PROVEN** — the corpus pins refusals, the absent
   secret token and an unchanged tree; it cannot prove no unauthorized read
   happened.
5. **Booted-member dispatch** — this is a host-free C1 world; no boot, no
   DSH_HOME, no port was used.

## Retirement state

`NOT_RETIREABLE`: `oldBaseline` true, `newPathVerified` false (absence evidence
above), `semanticDifferencesResolved` false (five blocking differences, none
approved), `negativeControlsPass` true. `ute-retirement-gate --all` prints
`unit=0/2` and `requested=4 allowed=0 refused=4` (fs, search, web, process).

**Branch-base note, recorded rather than smoothed over:** the work started on
`origin/master 69e292a29`, where the retirement ledger held only `fs` and
`search`, so the measured summary was `requested=3`. While this branch was
being prepared master merged the WEB B1 row (`3c8412fc0`, PR #810); this branch
was REBASED onto it and every gate re-measured on the merged tree, where the
summary is `requested=4` — matching the task brief's expectation. The earlier
`requested=3` was a measurement of the older base, not a defect and not a
fabricated row.
