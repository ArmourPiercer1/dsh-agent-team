#!/usr/bin/env node
/**
 * A5M2 schedule C2 — REAL-HOSTATE (DRAFT: prepared, NOT launchable until the
 * root grants the window; single boot per window, failure stops without
 * retry pending adjudication — root 21:22 law).
 *
 * Target (exactly the root-approved scope, one window, BOTH governed tools,
 * multiple cases, ordinary business evidence only):
 *   C1  LIST RETURNS REAL RECORDS. The member session seeds THREE tasks
 *       through THIS world's own legal creation path — the native
 *       schedule_create tool called in-session (its own permission surface;
 *       any ask is answered over the public resolve API, exactly like the
 *       todo/image kit precedent). NO hand-written persistence, NO direct
 *       storage edits (禁手改未公开持久结构). Then the GOVERNED schedule_list
 *       row (frozen tgz install surface, mounted EXCLUSIVELY — nothing from
 *       .worktrees/) flies ask → public ALLOW → the call's RESULT carries
 *       the three seeded records (ids + titles match the seed receipts).
 *       Store census delta 0 (a list reads).
 *   C2  DELETE GRANTED -> PERSISTENT DISAPPEARANCE. Governed
 *       schedule_delete (task A) -> pending -> public ALLOW -> one service
 *       dispatch; a follow-up governed list + durable read-back proves task
 *       A is GONE persistently (survives re-read), B and C untouched.
 *   C3  DENY -> UNCHANGED. Governed schedule_delete (task B) -> public DENY
 *       -> record B read-back byte-identical; zero service entry.
 *   C4  ABANDON -> UNCHANGED. Governed schedule_list claim -> abandoned ->
 *       everything unchanged (read-back identical), zero consumption.
 *   C5  ABSENT ID (same window, ordinary negative): governed
 *       schedule_delete('sch_a5m2_absent_zz') granted -> the REAL published
 *       error VALUE comes back ({code:'invalid_selector'}) — the published
 *       ScheduleInputError class through the service-error-value law on the
 *       real service; no persistence moved.
 *
 * Evidence sources: durable Control state (requests/decisions/consumptions
 * read back over the public API), the member session transcript rows, and
 * the SERVICE-level read-back (governed list). Existing logs only — NO new
 * product observability hooks of any kind.
 *
 * Pins (measure and fill at packaging; the script REFUSES any placeholder):
 *   HOST   @ 639ed015397290b3745d163aafe02ffee4aa3f84 (0.2.0-rc.2, pristine
 *          tests/deepseek-harness-test-use, porcelain-empty re-check at boot)
 *   PKG    THE ROOT-LEVEL PACKAGE `dsh-agent-team-0.1.1-alpha.2.tgz`
 *          (root 21:29: the real Host plugin entry is the formal complete
 *          root package — exports './host' -> packages/runtime/dist/…/
 *          plugin/host.js etc., all five exports cross-checked EXPORT_OK
 *          against the packed entries; the runtime SUBPACKAGE and the
 *          runtime-tgz wording are NOT the mount artifact).
 *          Source ruling: a66f50886 PRODUCT == int@cf2555fb3 PRODUCT
 *          (measured git diff --shortstat EMPTY on non-test paths — a66
 *          differs in specs/tests only), so the CENTER-CANONICAL pin built
 *          from cf2555fb3-or-later is sufficient; no lane-specific product
 *          package drives this kit. Recorded, NOT driving: runtime tgz
 *          @a66f50886 sha 9715af0d… (manifest 9e8625d0, superseded wording
 *          corrected here) and the lane root-tgz packing measurement
 *          dsh-agent-team-0.1.1-alpha.2.tgz 3,851,629B sha
 *          9244bf2173256170dc4191dffd042dffb4bcbbc6dde36df6dbd9f61e9efdd124
 *          (RC_PACK=0). The bf4-era (bf4e89e10) package is INSUFFICIENT:
 *          measured delta 30 files +675/-224 = this lane's raw-service
 *          production law (schedule-wiring 120d, agent-bindings 37d,
 *          host.ts +29, d.mts 28d) + AUTH vocabulary (admission-kernel +38
 *          et al.) landed only in cf2555fb3.
 */
const PIN_PKG = 'dsh-agent-team-0.1.1-alpha.2.tgz' // ROOT-level package
const PIN_PKG_SHA256 = 'eda06b4a78bba180c0acef1b25237f3f741917385cd0728ee66adc737b1cd09d' // CENTER CANONICAL rootpack @874f3ae0d (3,857,455B/1821 entries; re-measured by this lane at out-874f3ae0d-20261023T213601Z, identical); kit still refuses on placeholder
const PIN_PKG_TGZ_BYTES_MAX = 4_000_000 // measured lane packing 3,851,629B (a66f50886, RC 0); guard against bulk additions

// WORLD BUDGET (root 21:29: two test worlds combined <=500MB, THIS lane
// <=250MB, image keeps its existing 500MB; the 448MB precedent install is
// a full dependency-tree archive — FORBIDDEN here: no whole-tree/big-deps
// copies; extracted install measures ~14.6MB (dist 13,162,240 + shim
// 1,306,021 + root-binding 179,446)).
const WORLD_BUDGET = Object.freeze({
  installBytesMax: 25_000_000, // root tgz extract (measured ~14.6MB) + chmod a-w
  stateBytesMax: 100_000_000, // world session logs/storage for C1..C5
  evidenceBytesMax: 100_000_000, // captured transcripts/manifests (34e9 evidence dir precedent: 37,992,031B)
  worldTotalMax: 250_000_000, // hard cap; boot + teardown MEASURE with du -sb and REFUSE past it
})

// Ports: 3180 family ONLY. 3080/3180/3181 NEVER (stable/dev). 3182/3497 =
// image (currently pinned bf4 line — root 21:2x correction, not 556d);
// 3186 RESERVED for G6; 3183/3184/3498/3499 legacy-unproven-quiet — do not
// reuse. THIS kit takes host 3185 and mock 3496 (both measured idle at
// 2026-10-23T21:2xZ via `ss -ltn`; re-checked at boot, boot REFUSES busy).
const HOST_PORT = 3185
const MOCK_PORT = 3496

const WORLD_PREFIX = 'a5m2-sched-c2'

function refuse(reason) {
  console.error(`a5m2-schedule-c2: REFUSED — ${reason}`)
  process.exit(3)
}

// THE WINDOW GATE: this draft cannot launch. The root-granted window sets
// A5M2_SCHED_C2_WINDOW=GRANTED; without it the script verifies its own
// package shape and exits — no host boot, no world, no network.
if (process.env.A5M2_SCHED_C2_WINDOW !== 'GRANTED') {
  const shape = {
    draft: true,
    pinPkg: PIN_PKG,
    pinPkgSha256: PIN_PKG_SHA256,
    pinPkgBytesMax: PIN_PKG_TGZ_BYTES_MAX,
    worldBudget: WORLD_BUDGET,
    hostPort: HOST_PORT,
    mockPort: MOCK_PORT,
    worldPrefix: WORLD_PREFIX,
    criteria: ['C1 list-returns-real-records', 'C2 delete-granted-persistent-gone', 'C3 deny-unchanged', 'C4 abandon-unchanged', 'C5 absent-id-real-error-value'],
    seedLaw: 'member-session native schedule_create (legal create), public resolve for its asks; zero direct persistence edits',
    bootLaw: 'ONE boot per granted window; first failed criterion -> teardown + STOP (no retry without adjudication)',
  }
  console.log(JSON.stringify(shape, null, 2))
  process.exit(0)
}

// ── GRANTED PATH (not executed by this draft; mirrors the todo-C2 kit's
//    verified sections in order, with ONLY the criteria bodies swapped) ──
if (PIN_PKG_SHA256 === 'PENDING-CENTER-CANONICAL') refuse('PIN_PKG_SHA256 awaits the center canonical root-package pin')
// 1. world create: tests/homes/<WORLD_PREFIX>-<UTCstamp>Z via ../lib/world-safety.mjs
//    parseWorldArg rules; extract the pinned tgz into install-<shortsha>/, chmod a-w.
// 2. idle-port re-check (ss -ltn): HOST_PORT and MOCK_PORT must be free.
// 3. mock model on MOCK_PORT; boot host:
//    DSH_HOME=<world> node apps/cli/lib/bin.js web --port HOST_PORT --no-open
//    boot line token + GET / -> 401.
// 4. team session + member per the frozen blueprint carrier (governed
//    schedule rows come from the tgz mount; NO create/update rows exist).
// 5. seed x3 tasks (legal create; resolve its asks publicly; seed receipts
//    {id,title} recorded).
// 6. run C1..C5 in order; FIRST failure: capture evidence dir, teardown,
//    exit non-zero WITHOUT re-boot.
// 7. teardown: host down, world retained as evidence per TEST_METHODS §7.
refuse('the GRANTED execution path is implemented only after the package sha lands and the center approves this draft')
