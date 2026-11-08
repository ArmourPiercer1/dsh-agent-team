# Archived boot runs (the path to the shipped assembly, newest last)

Each directory is one `run-boot.mjs` invocation's evidence tree, kept because it
documents a *finding*, not because it is a passing pair (the passing pairs are in
`../runs/` + `../agreement-*.txt`). Read together they show the instrument defect
being found, localised and fixed, which is the part a future lane must not repeat.

| run (UTC) | what it proves |
| --- | --- |
| `allow-2026-11-08T12-17-51-780Z` | shipped preset WITHOUT the governed-realm opt-in: `web_fetch` refused `NETWORK_UNCONFINED_REALM`, 0 facts — the row loaded (install graph present) but no realm owned a web face. Fix: set `a5sfGovernedRealm: true` (the documented opt-in). |
| `allow-2026-11-08T12-20-54-572Z` | realm mounted and search PASSED (real POST + parsed sources), but the FIRST allow fetch was refused `WEB_DESTINATION_FORBIDDEN`: the composition's declared `testEndpoints` did not reach the guard. Fix: the face defaults its exemption to `provider.testEndpoints` (transport-owned), exact-origin only. |
| `allow-2026-11-08T12-25-05-601Z` | all four web arms green, but the regression arm read only 5 of 14 calls: the driver called the turn finished when the MOCK went quiet, while a slow confined `bash`/`grep` child issues no model request. Fix: wait for the durable session to pair every call and the Member's closing text. |
| `allow-2026-11-08T12-35-15-046Z` | the instrument control `A5SF_PD30_NO_INSTALL_GRAPH=1`: the Host answers on its port but `/__p6t6` never becomes ready — the World cannot resolve the shipped rows at all without the profile module graph. |
| `allow-2026-11-08T12-41-36-124Z` | the precondition itself firing: the first version checked membership at a phase where the Team had none (`seedMembers: []`), i.e. it was placed before `team.create`. Fix: keep the row-load check before probes and move the member/surface check to after the Leader's delegation, still before any verdict. |
| `mutations/` | the three mutation-control runs' scratch trees (see `../mutation-controls.log`). |
