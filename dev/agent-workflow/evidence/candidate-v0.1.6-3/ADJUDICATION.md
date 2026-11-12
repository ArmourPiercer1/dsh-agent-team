# C2 adjudication of frozen candidate `cand-v0.1.6-3` — both records, one verdict

Adjudicators: **two independent sessions**, neither of which authored, edited or built any product
code for this candidate. C2-A (acceptance) and C2-B (adversarial) ran in separate worktrees and did
not read each other's in-progress files as authority. Date: 2026-11-12/13.

## Frozen identity

| field | value |
| --- | --- |
| candidate | `cand-v0.1.6-3` |
| commit / sha | `17a24e2c302cd991c3ba495ae29576b58a6c1069` |
| ref | `candidate/v0.1.6-3` |
| manifest | `dev/engineering/candidates/cand-v0.1.6-3.json`, `content_digest sha256:06b2bad8…` |
| host pin | `0.2.0-rc.2 @ 639ed015397290b3745d163aafe02ffee4aa3f84` |
| Authority | pointer → `as20261109r1`, baseline `cb2e4148…` (never moved by either adjudicator) |
| verify | `--record C2-A --record C2-B` → **VERIFIED, PASS=148** |

## Verdict

**The measured product surface is green; the candidate is NOT eligible, and both adjudicators
refused to sign candidate-level eligibility.** They refused for different, independently reached
reasons, and neither refusal was relaxed to make the candidate look better:

1. **A6-off zero-regression is NOT established.** The Alpha.5-only instrument
   `a5sf-pd33-preview-e2e` scores **16/19** on this SHA: three cases refuse every governed `bash`
   with the typed token `A5_NATIVE_ADMISSION_UNAVAILABLE` (the plane's admission edge was never
   published for that composition). Whether that is a stale instrument or a real default-path
   regression is **under investigation** and is the gating question for the release claim.
2. **PD-40 reproduces**: a human Stop *between asks* leaves no durable marker (arm B: `markers=[]`,
   the next ask wakes the reviewer; `wakes 0→1`), while the control arm (a latch present) suppresses
   the next leg and survives SIGKILL. This is already disclosed in the release notes as an
   opt-in-experimental limitation — it is a **disclosure obligation**, not a new defect.
3. **Two stale text fields in the frozen manifest** (`evidence.record_root` still names
   `candidate-v0.1.6-1`; the C2-A acceptance-scope description still says "A6 off" while C2-A
   measured the A6-on surface). Recorded as FAIL by C2-A rather than as a note. The manifest is
   **not rewritten** — the freeze rule forbids editing a frozen manifest, and rewriting it would
   change the identity every digest is computed against.

## What both adjudications did establish (and a release may claim)

- Joint acceptance **J01–J11 PASS ×2**, verdicts and normalized details agreeing.
- A6 **allow / deny / throw / exception / Stop / crash** each PASS ×2, evidenced by **durable
  ledger rows** (`team_domain.json#tables.ledger`), not driver booleans: deny leaves zero
  consumption and zero execution-result rows; throw records `outcome=failed` and never `succeeded`;
  Stop cancels after the allow with no consumption and an empty target; crash leaves the PA request
  readable, the late allow refused `CONTROL_REQUEST_ABANDONED`, and both legs settled `unknown`.
- Packaging chain **33/33 + 39/39 ×2**, tarball `7a1d754c…`, installed tree digest equal to the
  packed tree, rollback byte-exact.
- A1 governance **7/7** with the OS sandbox backend `full`.
- Approval validity (#738): **8/8 invalid shapes refused**, RUNNING and SETTLED still validate.

## What neither adjudication proves (kept explicit)

Rates or stability (n=2 is two existences that agree, not a probability); real vendor-model
behaviour (the model is the deterministic in-tree mock; everything else is real); OS-level network
isolation; an upgrade protocol (none exists — install-over and back was measured); the PD-40
no-latch path in C2-A; the A6-on + governed Goal-authorisation conjunction; Q7/V@B/Required-CI
(untouched).

## Non-claims recorded by C2-B

Zero regression with A6 off · PD-42's A1 closed (the approved-bash-out-of-lane conjunction is
unmeasured) · durable Sticky Stop · "every accepted review wake is delivered or decidable" ·
PD-43 / RELEASE-NOTES §4.10 accuracy (docs were stale on this tree; corrected in a follow-up) ·
the operator re-issue path (only resolve-by-id was measured).
