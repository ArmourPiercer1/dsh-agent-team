# Alpha.4 governance drafts — review round 1 (2026-10-07)

**Object under review**: `docs/plans/drafts/alpha4-permission-governance/{ADR,spec,implementation-plan}` as pushed on `origin/docs/alpha4-governance-draft-20261007` (tip `7ffa7f5e`), against code baseline `master@2b86ee42`.
**Method**: four independent read-only reviewer subagents, one lane each, briefed not to see each other's work, required to verify against real code with `path:line` evidence and to return PASS / SUPPLEMENT / BLOCK. All four were read-only; none modified the repo, started a host, or touched ports.
**Protocol note**: this round follows Amendment A1's review rules (later codified in `docs/ROUTER_RULES.md` §0), not the superseded per-Gate 3-reviewer composition.

## Verdicts

| Lane | Verdict | BLOCKER | MAJOR | MINOR/NOTE |
|---|---|---|---|---|
| Security / governance invariants (adversarial) | **BLOCK** | 4 | 14 | 9 |
| Architecture / contract feasibility | **BLOCK** | 3 | 12 | 10 |
| Executability in this repo today | SUPPLEMENT | 0 | 6 | 6 |
| Compatibility / migration / durable data | SUPPLEMENT | 0 | 3 | 9 |

Round outcome: **not accepted as written** → closed by Amendment A1 (security + executability + compat) and Amendment A2 (architecture) in the three documents.

## Blockers and their closure

| # | Blocker (paraphrased) | Evidence anchor | Closure |
|---|---|---|---|
| SEC-B1 | `beneficiaryAuthority` / `operationClass` are evaluator **inputs**; a Leader declaring `beneficiary=member` self-approves legally | `packages/runtime/governance/types.ts:393-396`; `remote/src/contracts/params.ts:1485-1505` | ADR **A1-1**, spec §24.1 (server-minted principal token, `derived === supplied`, invariant #16) |
| SEC-B2 | `intervention.act` has no principal derivation and the shipped fallback hands callers **operator** identity; `s6-principal.ts` absent from PR6 | `runtime/src/plugin/s6-principal.ts:434` (default), `:206` (closed set), `control/types.ts:153-157` | ADR **A1-2**, spec §24.7, plan A1.3 (PR6 owns the file + catalog-enumeration test) |
| SEC-B3 | caller-chosen `kind` + `targetInstanceId` on `team_request_control` / `resolveControl` survives all 7 PRs; no requester-vs-resolver check | `tools/src/tools.ts:952-1008`; `control/service.ts:1668-1687` | ADR **A1-3**, spec §24.4 (one decision gate, two entrances) |
| SEC-B4 | "no matching ceiling rule" is undefined for one-shot approvals: strict reading makes every `ask` Admin-required under `rules: []`; permissive reading voids `teamHardEnvelope` | ADR §7.1 vs §15; ADR §7.1 vs §15; spec §7.4/§21.4 (round-2 note: an earlier revision of this file cited a spec §5.4, which does not exist) | ADR **A1-4** (restriction-only on the operation plane; rejected alternative recorded) |
| ARCH-B1 | `escalate` is **fail-open**: the last-mile guard branches only on `stale-denied`/`deny` then falls through to authorization | `control/service.ts:2236-2252` (+ `:719`, `:1760`, `control/types.ts:777`) | ADR **A2-1** (leg fact, exhaustive switch, blocking RED test) |
| ARCH-B2 | mutation proposals have **no durable home**; no PR owns `packages/storage/schema`, and a malformed Control row reads back as absent | `governance/service.ts:707`; `control/service.ts:592-600`; zero "proposal" hits in storage | ADR **A2-2** + new **Task 0 / A4-PR0** (ledger-first, strict parser, typed corrupt outcome) |
| ARCH-B3 | the "one shared grammar" cannot live in `runtime/governance`: `domain` cannot depend on `runtime`, and Blueprint parsing does no canonicalization | `packages/domain/package.json:17-19`; `blueprint/src/validate.ts:613-621`; `permission-plane.ts:492-527` | ADR **A2-3**, spec §25.3 (grammar in `domain`, runtime adapter injects canonicalization) |

## Majors — disposition index

- **Closed normatively in the documents**: SEC-M5 lattice not total → A1-5 (9-pairing table in spec §24.2); SEC-M6 circular relevance filter → A1-6; SEC-M7 `undetermined` absent from terminal vocabularies → A1-7; SEC-M8 vacuous CAS revalidation → A1-8; SEC-M9 fingerprint hygiene / denied re-proposal → A1-9; SEC-M10 leg identity vs deterministic request id → A1-10; SEC-M11 `escalate` not product-reachable → A1-11; SEC-M12 absence-of-reviewer law untight → A1-12; SEC-M13 lifecycle revalidation has no legal set → A1-13; SEC-M15 recheck not at consumption point → A1-14; SEC-M16 two inconsistent decision gates → A1-3/A1-15 area + spec §24.4; SEC-M17 optional `operationFingerprint` → A1-15; SEC-M18 invariant #14 under-scoped and untested → A1-1 + A1.4 (matrix).
- **Closed by executability corrections**: no committed fail-set tool → A1.2.2; baseline must be re-recorded at the exact tip → A1.2.1; `smoke:composition` client leg red by design (`b5b16ece`, upstream `clsx`) → A1.2.4; dist co-commit + `p4t6` pin (971) missing from gates → A1.2.5; lane splits violating the plan's own file-disjoint rule (PR3/PR5/PR6) → A1.3; PR4∥PR5 collision set → A1.3; live-UI lanes unreachable in this environment → A1.5; push/merge authority and retry cap → A1.1.
- **Closed by compat corrections**: spec claimed `permissionMutationEnvelope` is "required" (it is optional today) → A1-19 + in-place spec fix; cold-resume must resolve+parse the bound Blueprint and handle reference-less legacy rows → A1-20; boot-anchor parse fails a whole home → A1-20 / A2-10; typed-name collision → A1-21; alias lifetime at PR7 undecided → A1-18; `p8t3-version.test.ts` `[1..7]` pin not in PR6 → A1.3; ADR silent on pre-acknowledgement blocking → A1-16; warning gate vs cold resume → A1-16.
- **Closed by architecture corrections**: algebra-by-document-version unstated → A2-4; `undeterminable` annihilating v3 authority → A2-5; envelope/beneficiary basis vs recorded Alpha.3 ruling → A2-6; strict parsing → A2-9; cutover blast radius → A2-10; version union + byte-identity pins → A2-11; policy-referenceability unpinned → A2-12; what a matcher freezes (`stat().version`, no link-type detection) → A2-13; single canonicalization owner → A2-14; ownerless Team-start gate → A2-15; single-writer structural test → A2-16; naming collisions (`teamEnvelope`, two `CONTROL_DECISION_VALUES`) → A2-17; model-facing tool text → A2-18; PR3 vocabulary duplicated in five unlisted files → plan A2 addenda; shared-file ranking (`root.ts`, `agent-bindings.mjs`, `permission-mutation.ts`) → plan A2 addenda; PR7 missing kit/fixture lane (kits carry their own golden hash, outside the vitest gate) → plan A2 lane C7.

## Explicit non-findings (recorded so later rounds do not re-litigate)

- **Not a `CORE_SEAM_BLOCKER`**: live subtree membership and frozen root identity are expressible through public seams the plugin already uses (`host.ts:1213-1263`, `:1739-1757`; host `fs` `resolve`/`contains`/`stat`), with `fsContainsKeys` throwing rather than guessing when `contains` is absent.
- **No second mutation authority** is required or created; one durable writer exists (`governance/service.ts:707`) and v7 Remote reuses that lane; new outcome codes are wire-additive.
- **Red lines hold**: no Team `SessionEvents` vocabulary in the three drafts, no copying of legacy `packages/team`, zero core patches; the plan keeps CORE PATCH BUDGET at 0 explicitly.
- Plan file-list sweep found exactly one non-existent path (`packages/remote/src/contracts/index.ts`), replaced with `contracts/catalog.ts`.

## Not verified by this round (carried forward, not guessed)

1. The suite-debt baseline itself: no reviewer was permitted to run tests, so "9 failing files / 19 failing tests" remains a *recorded-evidence* claim until A1.2.1 re-records it at `2b86ee42`.
2. "No Alpha.3 test declares overlapping envelope rules" is an inspection of test declaration sites, not an executable proof; PR1's RED-first overlap matrix is what actually settles it.
3. Whether `packages/client` carries an independent v1/v2 blueprint validator (none found by grep; absence not exhaustively proven).
4. Per-category Remote dispatch exhaustiveness for a future v8.
5. Two findings in the security lane inferred exploitability below the code-path level and were labelled as uncertainty there; their closures are written as normative anyway, so the uncertainty is not load-bearing.

## Round-2 requirement

A fresh, independent reviewer (no access to this document's dispositions) must verify that SEC-B1…B4 and ARCH-B1…B3 are closed by A1/A2 as written, and must flag any closure that introduces a new contradiction. Round 2 evidence lands in this directory as `REVIEW-ROUND-2.md`.
