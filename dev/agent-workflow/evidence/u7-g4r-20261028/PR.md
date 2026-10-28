## G4-R phase 1 — offline binding persistence

Adds real pre-spawn profile-patch digests for every World boot (including collected suites and Jobs), per-suite oracle source digest/source inventory with retained exact byte artifact, and explicit null/reason for unavailable plane TrustedSources admission document. Adds hostTreeSha clarity alias; existing hostSha remains.

CORE PATCH BUDGET=0. No packages product edits. No Host boot; no stable GUI/home mutation.

Validation: C1+WorldFactory 44/44; profile and oracle one-byte mutation controls RED; fixture accepted by actual eb3-run-manifest CLI; manifest --new-since origin/master 0 findings; diff --check clean; p4t6 green measured delta 0. Local ci-pr-gate result recorded in README/evidence.

No new authoritative product write path. This does not retroactively repair historical candidate records, assert live C2, or promote G4. README is phase-2 input.
