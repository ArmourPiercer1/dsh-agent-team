# Round 93 evidence — R1 (Alpha.6 case producer) and the live D4 measurement

| file | what it is |
| --- | --- |
| `d4-boots2-results.json` | the FINAL `probe-d4-routed-wake.mjs --boots 2` result file (two agreeing DEV-LIVE boots, rc.2 host `639ed015…`). `enablement` / `officer-up` / `officer-binding` / `refusal` = **PROVEN**; `routed-wake` = **REFUTED** with its failing clause list. |
| `d4-boots2-agreement.txt` | the two-run agreement table the probe prints (`agreeing=true differing=[]`). |
| `d4-binding-world-verdicts.json` | the `D4_BINDING_WORLD=1` arm's verdicts (the declared `toolBindings[]` world). |
| `d4-binding-world-wake-measurement.json` | the same arm's measurement: `workerWrite.result` = `LANE_DENY … outside the tool's compiled fs.write lane`, `control-request-recorded` count **0**, zero wake facts / intent files. THIS is the measurement behind finding **G11**. |

The `--boots 1` run is kept in the probe's own evidence home as
`dev/agent-workflow/evidence/d-boot-feasibility/d4/archive/2026-11-23T19-57-run93-boots1-refuted-keep/`
(same verdicts as the pair; the probe archives each previous run by convention).

Judge amendment (disclosed in the probe's own clauses): the two clauses that ASSERTED the pre-fix defect
(`route() === null`; "the Leader received the plain ask") now assert the REQUIREMENT (the product's router
must select the durable Officer instance; the plain case-less ask must be ABSENT), and the router probe
serves the boot's real member view instead of a hard-coded `[]`. No clause was deleted, made vacuous, or
re-pointed at a weaker property.
