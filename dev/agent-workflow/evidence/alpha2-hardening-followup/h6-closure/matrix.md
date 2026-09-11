# H6 closure matrix — alpha.2 follow-up live verification (L1–L4)

World: `references/.dsh-test-a2permhf-<STAMP>` (branch `task/alpha2hf-h6-closure` @ `dbbba5d`, the int tip AFTER H4+H5)
Host: port **3181** (instance) / **3493** (in-process mock model) / 3180 user tsx + 3080 main instance untouched
Kit: `dev/agent-workflow/evidence/alpha2-hardening-followup/h6-closure/kit/`
Evidence: `h6-live-<STAMP>.json` (live battery) / `h6-cold-<STAMP>.json` (cold battery) / sidecars `a2permhf-{live,cold}-counts-<STAMP>.json`

## Brief legs → check IDs

| Brief leg | Requirement | Live check IDs (`h6-live-*.json`) | Cold check IDs (`h6-cold-*.json`) |
| --- | --- | --- | --- |
| **L1** exact-rule topology retarget (H4 P1-A live proof) | `alias` junction → dirA at T0; leader policy DENY on `alias/secret.txt`; T0 read ⇒ static DENY (exact policy reason, zero requests, body untouched); retarget (node fs `rmdirSync` + `symlinkSync(dirB, alias, 'junction')`); T1 read ⇒ STILL static DENY, zero requests (no downgrade to default-ask — the cached-key failure mode); realpath flip recorded | `live-H6-L1-t0-topology` · `live-H6-L1-t0-static-deny` · `live-H6-L1-t0-static-reason` · `live-H6-L1-t0-zero-requests` · `live-H6-L1-t0-body-untouched` · `live-H6-L1-retarget-flip` · `live-H6-L1-retarget-dirA-intact` · `live-H6-L1-t1-still-static-deny` · `live-H6-L1-t1-zero-requests` · `live-H6-L1-t1-body-untouched` (evidence `h6L1.realT0/realT1`) | `cold-H6-L1-retarget-persists` · `cold-H6-L1-still-static-deny` · `cold-H6-L1-zero-requests` · `cold-H6-L1-body-untouched` (L4: exact-rule fresh canonicalization re-run post-resume on the persisted retarget) |
| **L2** bash scope distinction (H5 P1-B live proof) | three foreground bash calls, same command `echo a2hf-scope-probe`, default-ask lane (no bash policy lane), full `/tool` waterfall: (i) workdir dirA, (ii) workdir dirB, (iii) dirA + NEW callId ⇒ (i)≠(ii) fingerprint + requestId, summaries distinguishable (cwd tokens); (i)==(iii) fingerprint, (iii) requestId new; zero consumptions; no bash executed | `live-H6-L2-three-requests` · `live-H6-L2-fp-tool` · `live-H6-L2-fp-A-B-differ` · `live-H6-L2-rid-A-B-differ` · `live-H6-L2-summary-distinguishable` · `live-H6-L2-fp-A-C-same` · `live-H6-L2-rid-A-C-new` · `live-H6-L2-all-three-denied-settle` · `live-H6-L2-zero-consumptions` · `live-H6-L2-workspace-untouched` (evidence `h6L2.requests.i/ii/iii` + raw ledger facts; sidecar `h6L2.fpI/fpII/fpIII`) | `cold-H6-L2-request-created` · `cold-H6-L2-fp-equals-live` (cold fp == live (i) fp — cross-world determinism) · `cold-H6-L2-rid-new` · `cold-H6-L2-denied-settle` · `cold-H6-L2-zero-consumptions` · `cold-H6-L2-workspace-untouched` (L4: bash fingerprint consistent on the cold ctx) |
| **L3** hostile regression (H3 legs re-run unchanged) | hostile seam present + armed; policy-allowed read denied end-cap reason; default-ask zero requests; ask-lane write file unchanged; worker-b hostile ⇒ end-cap (not policy) reason; worker-a no-hostile control executes; PTC two siblings denied; observations carry end-cap rows; durable plane unchanged | `live-H3-0-gate-live` · `live-H3-1-allow-op-denied` · `live-H3-1-exact-reason` · `live-H3-2-ask-op-denied` · `live-H3-3-write-denied` · `live-H3-3-file-unchanged` · `live-H3-2c-static-deny-lane` · `live-H3-2d-unsupported-passthrough` · `live-H3-2b-zero-requests` · `live-H3-4-gate-live` · `live-H3-4-endcap-not-policy` · `live-H3-5-cross-agent-unaffected` · `live-H3-6-gate-live` · `live-H3-6-ptc-shape` · `live-H3-6-ptc1-denied` · `live-H3-6-ptc2-denied` · `live-H3-6-zero-requests` · `live-H3-6-turn-settled` · `live-H3-7-observation-rows` · `live-H3-8-control-unchanged` (evidence `h3Hostile`) | `cold-H3-0-gate-live` · `cold-H3-1-allow-op-denied` · `cold-H3-2-ask-op-denied` · `cold-H3-2b-static-deny-lane` · `cold-H3-3-observation-rows` · `cold-H3-3-control-unchanged` (evidence `h3HostileCold`) |
| **L4** cold resume (listener+guard rebuilt, fresh canonicalization, bash fp consistent) | phase=resume re-boot of the SAME world home; rebuilt policy lanes; H6 cold group runs BEFORE the cold hostile group (end-cap-vs-static reason separation) | — | V1 26-check cold battery (`cold-*` unchanged) + H6 cold group above + cold hostile group |
| **Regression spine** (V1 matrix unchanged) | 115-check live matrix + N-series safety negatives + final-file asserts | `live-*` (V1 IDs unchanged; counts sidecar = pre-hostile durable state) | — |

## Unit legs (same commit, focused suites)

| Leg | Suite | Actuals |
| --- | --- | --- |
| P0-K1 (new) — authorized bash, full H5 effect projection, ask→allow, executes once, exactly-once rows, guard abstains | `packages/runtime/test/h1a-pre-execute-endcap.test.ts` | `H1a P0-K1 (H6)` — 5 checks |
| P0-K2 (new) — same bash call under hostile prepend-allow ⇒ end-cap DENY exact stable reason, body never runs, zero rows, 1 end-cap observation | same | `H1a P0-K2 (H6)` — 4 checks |

## Gate line (see closure-report.md)

focused suites (Part 1 actuals) / full parity failing-set ⊆ H3 baseline / typecheck 9 / build / build:composition 1080 + LF-glue restore / p4t6 pin / references pristine.
