# A5M2-RSJ SURFACE lane — two ownerless M0 surface rows, real-chain negative-verify vertical slices

Assigned by root's M0 no-master assignment (CENTER relay 2026-10-23). Both records were
`executionEvidence: NOT_RUN` (表内无行=无主). Scope per the assignment: author-side runnable
specs + assertions, gaps named, **no Host booted** (the C2 Host lane remains separately frozen
after its incident; untouched here).

* Baseline: int moved DURING this lane (root merged B-PLUGIN mid-session). Specs were authored
  and first passed at `f47e047f71d12e7f4f096c4c04affa1db49f15e8`; ALL FOUR gates were then
  RE-RUN green at the then-latest tip
  `1eb5f52f2c9fd238a9fd113de7ffd3fc0c89b806` (merge tree: B-PLUGIN vertical + merged
  g1-surface-adapters dist mirror). Observed read-only, no push by this lane:
  `origin/feat/a5-m2-integration` = `c857c9a46735d6b5a51b468c9b46eb060ca85fc7` (local ahead).
  Worktree `feat/a5-m2-integration`; porcelain afterward: only this lane's 3 untracked
  artifacts + pre-existing `packages-pins/.pw-*/` tmp dirs (not written here). 639 read-only
  base `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84` present
  (specs fail closed without it, a5m2-g1 precedent).
* Gates at `1eb5f52f…` (raw RCs, final):
  * `cd packages/runtime && npx vitest run test/a5m2-verify-surface-domain-family.test.ts` → **6/6 pass, RC=0**
  * `cd packages/runtime && npx vitest run test/a5m2-verify-surface-neg4-preset-selfregister.test.ts` → **5/5 pass, RC=0**
  * `npx eslint packages/runtime/test/a5m2-verify-surface-domain-family.test.ts` → **RC=0**
  * `npx eslint packages/runtime/test/a5m2-verify-surface-neg4-preset-selfregister.test.ts` → **RC=0**

## Record 91 `surface:domain_family` (B-DOMAIN) — spec `packages/runtime/test/a5m2-verify-surface-domain-family.test.ts`

Scoped as the assignment spells: TeamDomain **persistence-face family facts, read-verified** on
the REAL medium (testkit `FileStorageSeam` + committed repositories — the a4p7-proven author-side
pattern), plus the record-idx C1 **bidirectional non-override** legs against the committed G1
adapter. NOT C2; claims no C2.

| leg | verdict | fact verified |
| --- | --- | --- |
| U1 | PASS | closed 7-kind effect set carries `domain-ref` acting on its own arm; effects.ts:43 anchor re-read (E2→E1); real parser: `resource:null` law, missing authority id and smuggled extra keys both refused |
| U2 | PASS | the TEN stores ARE the persistence family (names verbatim), real files per store, ONE real `control-request-recorded` PRE-TEAM append lands on disk (liveness contrast for every zero-claim below) |
| U3 | PASS | direction (a): classify carries the domain-ref, mounted port answers DENY, row passes the verdict through verbatim and never mints success; whole leg **zero durable writes** (writeCount + family digest unchanged) |
| U4 | PASS | direction (b): domain-allow mints no credential — classify produces only a plan, same-plan replay refused `ALREADY_DELEGATED`, one port call total, medium untouched |
| U5 | PASS | `P_G1_DOMAIN_REGISTRY_ABSENT` / `P_G1_DOMAIN_CLAIM_MISMATCH` / `P_G1_TRUSTED_FACTS_STALE`, zero port entry |
| U6 | PASS | no-native-fallback: declared in the frozen 14, NOT in the CLOSED PURE-QUERY placement set, capture-less mount throws, invented registration name dead at the registrar |

**Named gaps (reported, not faked):**
* **G-D1** the boundary-decision obligation (`effect-boundary-ledger record-boundary-decision`,
  spec-table 91) has **no durable face today**: the ledger family carries no domain-decision
  member and nothing appends one. U3's zero-write posture is the CURRENT truth, not that
  obligation satisfied. Any C2 that claims the obligation must first give it a face.
* **G-D2** C2 real domain gate = **honest-absence** exactly as the record idx spells
  ("核无→honest-absence"): no public domain-authority registry observable in this tree.
* **G-D3** the row passes the mounted port's verdict through; the consumer that must STOP the
  effect-commit on a domain-deny is the PA effect-commit edge — not mounted author-side. U3's
  zero-write claim is scoped to the row on the real medium, verbatim here.

## Record 92 `surface:neg4_preset_selfregister` (B-ISOLATION) — spec `packages/runtime/test/a5m2-verify-surface-neg4-preset-selfregister.test.ts`

The matrix NEG-4 law ("preset-realm 注册不达全局 tools.schemas()", historically **ABSTAIN —
never VERIFIED**) moved to VERIFIED at the Team-side capture trio; typed refusals; **zero
durable writes on the real medium**; Host never started. NOT C2.

| leg | verdict | fact verified |
| --- | --- | --- |
| V1 | PASS | row registrar: invented registration + spoofed/mismatched native face die `TypeError` at mount; KNOWN name still mounts (全 deny 不算) |
| V2 | PASS | real `verifyPlaneNames`: closed classes, `one name, one placement`, `PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED` on reserved-native hijack, shape law; valid alias map passes |
| V3 | PASS | real `installScopedToolGuard`: preset-realm **self-registration after publish** (agent scope only — global view verifiably never shows it, both faces read live) is bound and **refused at dispatch** ("team tool guard", Body never ran), reported loudly (`tools-change-unbound-names` carrying the name), while the known allowed tool still runs (dynamic unknown cannot run / known allowed still can) |
| V4 | PASS | the whole negative trio over the real FileStorageSeam medium: writeCount and every family file byte-identical; then ONE real PRE-TEAM ledger append flips both — the zero is meaningful |
| V5 | PASS | family law read-anchor in the committed glue (guard arms before publish; unverified inheritances refused at dispatch) re-read from disk (E2→E1) |

**Named gaps (reported, not faked):**
* **G-N1** the Host boot-time profile/patch loader (cordis YAML realm) is NOT exercised — no
  Host is started per the assignment ("不启 Host"); this slice verifies the record's Team-side
  capture law only.
* **G-N2** the registry runs as the **measured a5p1-pattern double** (guard stage before
  waterfalls and Body, per `a5p1-order-hazard` measurement); waterfall stages honestly omitted —
  the two legs driven are deny-at-guard and pass-through. The guard module itself is real.
* **G-N3** historical bind-diag "三世界 17/17" was ABSTAIN-level per the matrix; this spec
  upgrades ONLY the author-side capture trio. VERIFIED-in-world (C2 host) remains open —
  honest label, per "ABSTAIN!=VERIFIED" discipline pointed the other way this time.

## Tier verdicts (root 15:4x four-tier law, fixed baseline f47e047f)

* `surface:domain_family`: 未接线 (declared/INACTIVE row) for the live mount; its **adapter +
  persistence-face negative laws are now 已测试 at author tier** (scoped real acceptance above).
  C2 stays NOT_RUN honestly.
* `surface:neg4_preset_selfregister`: capture trio **已测试 at author tier** (scoped real
  acceptance above); host-side C2 stays 接线未测/NOT_RUN.

Neither card claims more; neither hides a leg.
