# F3 / F11 / F9 / T1.4 Repair Adjudications

Date: 2026-09-07. The user authorized proceeding according to the third-party recommendation where reasonable and asked for repair, validation, and two pushes. The following defaults are therefore adopted unless a frozen-document conflict is discovered:

- U1: allow one Remote contract version bump to v4 for human control resolution.
- U2: place the method in the existing `team` category (not a new category).
- U3: freeze `team.resolveControl { teamSessionId, requestId, decision: 'allow'|'deny', note? }`; no caller role/principal fields.
- U4: carry F9 and T1.4 semantic entries in one shared v4 record.
- U5: use strict T1-B host fact completion: client facts are authoritative only for persona; capability domains come only from row-config facts.
- U6: split both member-work and root-initial-work long-hold paths; accept documented overlap semantics; preserve throw-after-settle and Phase-C durability after abort.
- U7: re-verify R-F2/R-F5/R-B7 and R-F4/F7/F10 unchanged fingerprints this round; do not expand scope to fix them.

These adjudications preserve CORE PATCH BUDGET=0, the frozen resolver roles, required→FATAL compatibility semantics, and all upstream/test-use red lines. Push #1 is authorized for the completed Batch 1 after its gate; Push #2 is authorized for completed Batch 2 after its gate, with no force-push.
