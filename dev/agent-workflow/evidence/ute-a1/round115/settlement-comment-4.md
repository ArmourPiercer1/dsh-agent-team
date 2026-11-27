[dated settlement, 2026-11-25T00:24:37Z]

Settlement for 5cb5c606203eaf07dd78a2a5c67b442899db2377.

Hosted ci-integration at 92be91dfb was red on `scripts/test-catalog.test.mjs` parity control: round 114 added tests/checks/d4-evidence-consistency.test.mjs to a dispatch leg, so the committed parity evidence still pinned the old union digest (f8488aa9… vs b5b99294…). The control refused correctly; the evidence was regenerated deliberately with the repo generator and its declared base (e5bf05670), union 25→78, problems=0, nothing missing, only the one declared suite added. No assertion relaxed, no suite removed, no timeout changed.

Local: test-catalog 28/28, tinf-instruments 807/801/0/6. Full local ci-pr-gate was green before this evidence-only change.

Open owner decisions unchanged: candidate gate non-required (no row PRODUCT-PROVEN), draft→ready flip at the final head, DEEPSEEK_API_KEY for real-model evidence (currently ENV-LIMITED), SEC-03/SEC-04 declared boundaries, and the measured devex maxRecords 600→900 raise. PR #822 stays DRAFT; no merge, release or deploy.
