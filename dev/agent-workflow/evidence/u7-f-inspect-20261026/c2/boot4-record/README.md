Boot 4 (review round 2, first run-record-shaped record): overall=FAIL, 3 PASS / 3 FAIL.
Superseded by the final c2-verdicts.json (boot 5). The three FAIL witnesses here
(APPROVAL_DENIED, "durable Control request uncreated") are what led to the
envelope root cause: a member PA ask needs request-control in BOTH
blueprint.teamEnvelope.allow AND the member template envelope (the effective
bounds are the INTERSECTION — admission/envelope.ts:100-119, measured live by
u6-proc u6prc6-8). Kept verbatim; nothing hand-edited.
