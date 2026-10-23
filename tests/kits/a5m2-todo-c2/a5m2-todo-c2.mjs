#!/usr/bin/env node
/**
 * ─── r18 HEAD (this branch, kit sha lineage aa242e37… ← 361331a9… ← 5b039e9b…) ───
 * A5M2 r18 = ONE bounded REAL-HOST IMAGE re-verification of the r17 lexical-seam fix,
 * `--fixture image`. The window is the FULL r17 positive+negative control window, NOT
 * reduced (center 17:1x: the earlier "one positive + one negative" wording is VOID):
 *   C1  governed read_image row binding: durable row on lane `plane-image`, def#22 /
 *       B-IMAGE rev2 / a5p5-plane canonicalTarget + declaredMediaType + byteCap 20971520,
 *       requiredAuthority leader + perEffectRequired [leader, leader], the OLD front door
 *       EMPIRICALLY opening ZERO parameter-permission rows, and the member model surface
 *       carrying read_image with the captured native description bytes.
 *   C2  PENDING with ZERO store objects: while row1 is pending, the attachment store gains
 *       nothing and the synthetic 1024x768 PNG is byte-untouched.
 *   C3  PUBLIC ALLOW -> exactly ONE control-allow-consumed for that live requestId, exactly
 *       ONE new store object whose name-sha equals its byte-sha, REAL normalization
 *       (1024x768 -> 512x384 via the INDEPENDENT normalizationPolicy
 *       normalizedImageMaxDimension 512, with the INPUT cap maxImageDimension 1024 unchanged) and the
 *       model-visible two-block envelope carrying the ORIGINAL dimensions text + image part
 *       with byte-identity to the stored object; PNG byte-untouched.
 *   C4  PUBLIC DENY of the SAME image (second read_image, fresh callId -> row2 / lane-2,
 *       confirmed read-only by the 307c lane): zero consumptions, ZERO store objects,
 *       structural callId-paired refusal to the member (no marker word).
 *   C5  PUBLIC ABANDON of a third row through the EXISTING p6t6 abandonControlRequest
 *       route: exactly one abandon fact, zero consumptions, store unchanged.
 *   H1  test-use porcelain EMPTY + HEAD baseline before and after; :3080 zero-touch.
 *   H2  port inventory: both ports released, no survivor pids.
 * ROOT LAWS ENFORCED IN CODE (not just in prose): first SUBSTANTIVE failure stops the run
 * immediately (no chained 90s+120s+180s waits after a fact already proved false), never a
 * second round automatically, NO todo emission whatsoever in image mode, requestIds are
 * always read live from the ledger (no prior-round id can be reused), the world is
 * `a5m2-img-r18-*` under tests/homes only, the forbidden ports are asserted, and the world +
 * install surface are RETAINED (this kit contains no rm / prune / df; teardown is
 * process-only). Pin identity lives in packages-pins/<SOURCE_PIN_SHA>/MANIFEST-*.txt; if
 * that dir carries STATUS-PROVISIONAL.txt the run refuses to start.
 * ─── r17-and-earlier HEAD (the todo/write C2 window this kit grew from) ───
 *
 * A5M2 todo C2 — REAL-HOGATE (single bounded run, root ruling 2026-10-23).
 *
 * Verifies the governed todo_write plane row on a REAL DSH 0.2.0-rc.2 host
 * (@639ed01539 pristine test-use runtime) with the plugin mounted EXCLUSIVELY
 * from the frozen install surface extracted from the pinned tgz
 * (root 10:30 GO: packages-pins/495aeb23…/dsh-agent-team-0.1.1-alpha.2.tgz —
 * ROOT-level package, extracted into the WORLD at the INSTALL_DIR surface and chmod a-w) plus the pinned tools/harness
 * plugin.mjs. NOTHING mounts from .worktrees/ (the worktree supplies ONLY the
 * tests/paths.mjs constants and the harness scripts — kit public interfaces).
 *
 * FIVE CRITERIA (exactly this scope, no C3 extras):
 *  C1  REAL todo_write registration: the member model-facing surface carries
 *      todo_write with the CAPTURED NATIVE description bytes (== the boot
 *      leader's native surface text) and calling it runs the GOVERNED row:
 *      a durable Control row exists whose correlation carries the callId
 *      grammar `plane-todo:<realm>-N` (row bytes captured).
 *  C2  Ask PENDING with ZERO append: while the row is pending the member
 *      session log (session.v4*, read back from the world storage) contains
 *      ZERO `todo/write` entries.
 *  C3  PUBLIC ALLOW -> UNIQUE consumption -> EXACTLY ONE native append:
 *      allow over the public remote v4 team.resolveControl; the durable
 *      ledger shows exactly ONE control-allow-consumed for that requestId
 *      and the session log carries EXACTLY ONE todo/write entry whose todos
 *      list equals the model's submitted list field-for-field.
 *  C4  REAL DENY with ZERO append: a second todo_write call (fresh registry
 *      exec token), DENIED over the same public wire: zero appends for it
 *      (session log total stays at 1), zero consumptions, the refusal is
 *      surfaced to the member (tool result carries refused-todo).
 *  C5  cancel/owner via the EXISTING p6t6 abandon fixture (the exemplar kit's
 *      production-abandonControlRequest thin route): a third pending row is
 *      abandoned; exactly one abandon fact, zero consumptions, session log
 *      total stays 1, member-visible refusal.
 *
 * FIRST FAILURE STOPS: the first failed criterion (or setup fatal) exits with
 * the full state (run.log, host log copy, ledger dump, session-log dump).
 * World + install surface are NEVER deleted (evidence retention is mandatory; worldRetained:true).
 *
 * EXIT: 0 = all criteria pass; 2 = a criterion failed; 1 = fatal (env/boot).
 *
 * USAGE:
 *   node tests/kits/a5m2-todo-c2/a5m2-todo-c2.mjs \
 *     --world tests/homes/a5m2-img-r18-<UTC-stamp> --fixture image \
 *     [--worktree <interface tree, default ../a5-m2-int>] \
 *     [--testuse <Host639 tree, default <worktree>/tests/deepseek-harness-test-use>] \
 *     [--host-port N] [--mock-port N] [--evidence-dir <path>] [--run-stamp S]
 *   Ports are BIND-PROBED when not given explicitly; an explicit port is still checked
 *   against FORBIDDEN_PORTS and bind-probed before use.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync, chmodSync } from 'node:fs' // realpathSync: OVERLAY-11b homes-root proof
import { deflateSync } from 'node:zlib'
import { basename, dirname, join, resolve } from 'node:path' // basename: OVERLAY-11b homes-root proof (a missing import here crashed module load — caught by the OVERLAY-15 probe-hold test copy, never by node --check)
import { pathToFileURL } from 'node:url'
import { zstdDecompressSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createServer } from 'node:net'

// ── harness imports: the M1 kit PUBLIC interfaces, taken from the worktree
// checkout (per root clause 2: the worktree supplies ONLY provenance + these
// scripts; the executed PLUGIN never comes from there) ─────────────────────
const KIT_DIR = dirname(new URL(import.meta.url).pathname)
const REPO = resolve(KIT_DIR, '..', '..', '..')
const args = process.argv.slice(2)
function argValue(name, dflt) {
  const i = args.indexOf(`--${name}`)
  if (i === -1) return dflt
  const v = args[i + 1]
  if (v === undefined || v.startsWith('--')) throw new Error(`--${name} requires a value`)
  return v
}
// ENTRY-SAFETY LAW: harness dependency loading is DEFERRED to main() (direct
// entry only). An import of this module never loads worktree CLI-dependency
// modules (root 1805 BLOCK item 3: no pre-positioned CLI/dependency effects).
// OVERLAY-4 (interface tree default). The worktree supplies ONLY tests/paths.mjs (the Host
// baseline pin) + the harness scripts; the executed PLUGIN never comes from there. Since this
// kit now lives in a SIBLING worktree, the default resolves to the sibling that carries the
// Host639 baseline pair instead of a path under this tree (--worktree still overrides).
const WORKTREE = resolve(argValue('worktree', join(REPO, '..', 'a5-m2-int')))
let CLIENT_COMMIT_HASH, TEST_USE_BASELINE_SHA, startMockModel, DshInstance, logTail, portInUse, waitForPortFree, captureGitState
async function loadHarness() {
  ;({ CLIENT_COMMIT_HASH, TEST_USE_BASELINE_SHA } = await import(pathToFileURL(join(WORKTREE, 'tests', 'paths.mjs')).href))
  ;({ startMockModel } = await import(pathToFileURL(join(WORKTREE, 'packages', 'tools', 'harness', 'mock-deepseek.mjs')).href))
  ;({ DshInstance } = await import(pathToFileURL(join(WORKTREE, 'tests', 'characterization', 'lib', 'instance.mjs')).href))
  ;({ logTail, portInUse, waitForPortFree } = await import(pathToFileURL(join(WORKTREE, 'tests', 'characterization', 'lib', 'util.mjs')).href))
  ;({ captureGitState } = await import(pathToFileURL(join(WORKTREE, 'tests', 'characterization', 'lib', 'tree-clean.mjs')).href))
}

// ── OVERLAY-1 (r18 pins; root 17:03 mission + center 17:1x/17:2x): ROOT-level product
// package pin for the ONE bounded image RE-VERIFICATION of the r17 lexical-seam fix.
// LABELS ONLY — no gate, no criterion, no leg moved. Two deliberate path changes, both
// named: (i) the pin's authoritative home is THIS branch's `packages-pins/<SHA>/` (the
// interface worktree supplies only tests/paths.mjs + the harness scripts), and (ii) the
// p6t6 helper row now resolves INSIDE the same pin dir; its bytes are unchanged and the
// existing double gate (file sha + `git show <SHA>:packages/tools/harness/plugin.mjs`
// blob sha) is kept verbatim, so a substituted helper still cannot ride the run.
// IDENTITY (root 21:15/21:16 LIMITED AUTHORIZATION — b23 successor pin): source-HEAD
// bf4e89e108620479d1a43344a8ea74d82cfde229, i.e. the b23 surface (2188f15ce) plus the center landings
// after it: the family-chain dist mirrors (G1/G3/G6/B-SCHEDULE/B-TEAM), the artifacts fixup of
// control/types, the G6 mount-site block, the team-plane placement/seat, and the PROVIDER-IDENTITY
// supply the r18 failure needed (P_IMAGE_CONSUMPTION_BINDING_MISMATCH was a provider-side defect).
// Measured in THIS lane, read-only, NO build (full record: packages-pins/<SHA>/MANIFEST-bf4e89e1.txt):
// PACKAGE == COMMITTED TREE compared=1821 missingBlobs=0 drift=1 — the single drift is package.json pack
// normalization (keys-only-in-committed = ["packageManager"], no common key differs in value); glue
// audit 24/24 placements with committed-dist-vs-src drift 0 AND tarball-vs-committed-src drift 0; the
// r17 lexical seam is still on the mounted dist face (fsSeam: agent-bindings 2, pa-mount-registry 1;
// subtreeContains 6). NO check:artifacts:head was run here — it requires a build, unauthorized here.
// The path-set is NOT byte-identical to b23's (+8 dist mirrors, 0 removed, 8 changed), so the entries
// digest and both manifest digests below are the NEW measured values. Only pin IDENTITY moved: every
// gate mechanism, stop, same-call rule and negative control is byte-unchanged, and each value was read
// off the delivered tarball's own bytes (measured first, constants set afterwards). The 126b12cc /
// d5454cb23 / 249eb65ec / 2188f15ce dirs stay in this branch as the unfalsified audit trail, and
// PIN_HOLDOUT_FILE below is still what refuses a pin whose identity is not final.
const SOURCE_PIN_SHA = 'bf4e89e108620479d1a43344a8ea74d82cfde229'
const PIN_SHA = SOURCE_PIN_SHA // helper bytes are STILL 471475b9… (byte-identical to the b23 pin's), asserted twice below
const PIN_DIR = join(REPO, 'packages-pins', SOURCE_PIN_SHA)
const PIN_TGZ = join(PIN_DIR, 'dsh-agent-team-0.1.1-alpha.2.tgz')
const PIN_PLUGIN = join(PIN_DIR, 'plugin.mjs') // helper bytes (blob at SOURCE_PIN_SHA, verified)
const PIN_HOLDOUT_FILE = join(PIN_DIR, 'STATUS-PROVISIONAL.txt') // presence = identity not final -> REFUSE
const EXPECT_TGZ_SHA = 'b999dfe100d18f0831af5093021d4d2106b21d8218625ea80e49ea77d27d67cf'
const EXPECT_PLUGIN_SHA = '471475b96e70f05a178f6006cf7b256765533313092b7c4689553c7c8d0ee784'
const EXPECT_TREE_SHA = '3b136adf67f000806757cbe0d63343dead37940d7308a042626c37af70897709' // sha256 OF manifest-tgz-dist-hashes.txt (same recipe, re-measured on THIS tarball; non-gating INFO)
const EXPECT_SURFACE_SHA = '9b91cdca2813a467c8b46e850503869f8198c3a7660ddcc942ea6a8eb972a7e8' // sha256 OF manifest-installsurface-hashes.txt (481 lines; 473 at b23)
const EXPECT_ENTRIES = 1821 // +8 dist mirrors over b23, 0 removed; entries digest a7d35916… measured from the tarball
const INSTALL_DIR = 'install-bf4e89e1' // fresh surface for THIS pin; earlier install-* surfaces are never touched

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

// ── world / install surface / evidence ─────────────────────────────────────
// ENTRY-SAFETY LAW (2026-10-23 ruling, test-infra owner; incident class: import
// executed main + missing --world defaulted HOME to REPO + recursive teardown):
// the world is a REQUIRED, validated, single-safe-basename-under-tests/homes path
// (tests/kits/lib/world-safety.mjs). Missing/illegal --world NEVER derives a
// default and NOTHING is created, mounted or removed. An IMPORT of this module
// never runs main() and never derives a world from the importer's argv — it
// resolves against an inert placeholder only.
import { parseWorldArg, isDirectEntry, WorldSafetyError } from '../lib/world-safety.mjs'
// OVERLAY-11 (homes root, entry-safety-law compatible). The guard refuses ANY world whose real
// path contains a `.worktrees` segment — correctly, and it is what caught this during the guard
// self-check: this kit is AUTHORED inside .worktrees/a5m2-imgverify, so a homes root derived from
// its own file location could never host a world. DSH_HOME lives in the SUPERPROJECT's
// tests/homes (workspace-internal, gitignored), exactly where the r11-r17 worlds are.
// OVERLAY-11b (root 17:42 item 2): there is NO homes-root override — an arbitrary resolve() there
// would have WIDENED the guard's root set, which is the one thing the entry-safety law forbids. The
// root is the single derived superproject path, and it is re-proved before use: no .worktrees
// segment, basename `homes` under a `tests` directory, and its realpath EQUALS the canonical
// <superproject realpath>/tests/homes (so a symlinked or relocated homes root fails closed). Direct
// entry exits before any write; an import gets a catchable Error (OVERLAY-11c). The guard's own
// protections (parseWorldArg, protected roots, realpath re-check) stay exactly as shipped.
const SUPERPROJECT_ROOT = (() => {
  const seg = REPO.split('/')
  const i = seg.lastIndexOf('.worktrees')
  return i > 0 ? seg.slice(0, i).join('/') || '/' : REPO
})()
const HOMES_ROOT = join(SUPERPROJECT_ROOT, 'tests', 'homes')
function assertHomesRoot() {
  // OVERLAY-11c (root 17:50): this gate runs at MODULE LOAD, so an unconditional process.exit(1)
  // here let a mere IMPORT kill the importing process — the exact regression class the entry-safety
  // law exists to prevent. On direct entry it still exits before any write; for an import it throws
  // a catchable Error instead.
  const fail = (why) => {
    const msg = `homes root rejected (${why}): ${HOMES_ROOT} — the world root is fixed to the verified superproject tests/homes; no override exists and the entry-safety guard is not widened.`
    if (ENTRY_DIRECT) { console.error(`FATAL: ${msg}`); process.exit(1) }
    throw new Error(msg)
  }
  if (HOMES_ROOT.split('/').includes('.worktrees')) fail('under a .worktrees segment')
  if (basename(HOMES_ROOT) !== 'homes' || basename(dirname(HOMES_ROOT)) !== 'tests') fail('not <root>/tests/homes')
  let realHomes, realSuper
  try { realHomes = realpathSync(HOMES_ROOT); realSuper = realpathSync(SUPERPROJECT_ROOT) } catch (e) { fail(`realpath unavailable: ${e.code ?? e.message}`) }
  // EXACTLY the canonical <superproject>/tests/homes — a two-segment "somewhere under super" test
  // would accept any other two-deep dir, and a homes root that is a SYMLINK elsewhere fails here too.
  if (realHomes !== join(realSuper, 'tests', 'homes')) fail(`realpath ${realHomes} is not canonically ${join(realSuper, 'tests', 'homes')}`)
  return realHomes
}
const ENTRY_DIRECT = isDirectEntry(import.meta.url, process.argv[1])
assertHomesRoot() // after ENTRY_DIRECT: the gate must be able to tell import from direct entry
const WORLD_REL = ENTRY_DIRECT ? argValue('world', null) : null
let HOME
if (ENTRY_DIRECT) {
  try {
    HOME = parseWorldArg({ repoRoot: REPO, homesRoot: HOMES_ROOT, worldArg: WORLD_REL }).home
  } catch (e) {
    console.error(`FATAL: ${e instanceof WorldSafetyError ? e.message : `--world invalid: ${String(e?.message ?? e)}`}`)
    console.error('a5m2-todo-c2: NOTHING created, mounted or removed (entry-safety law). Usage: --world <tests/homes/a5m2-img-r18-<UTC-stamp>> --fixture image [--validate-only]')
    process.exit(1)
  }
} else {
  HOME = join(HOMES_ROOT, '__module-import-no-world__') // inert: main() is entry-gated at the file end
}
// OVERLAY-3 (r18 naming + port LAW; root 17:0x/17:2x). Two closures, both additive:
//  (a) THIS run's world is named `a5m2-img-r18-<UTC-stamp>` and nothing else, so a
//      leftover world from another round can never be mounted by mistake;
//  (b) the forbidden ports become an ASSERTION instead of a comment (in the r11-r17
//      lanes :3080/:3182/:3497 and the RSJ-frozen :3186/:3500 were law but nothing in
//      the kit checked them). Enforced on the candidates AND on any explicit
//      --host-port/--mock-port the operator passes.
const WORLD_PREFIX = 'a5m2-img-r18-'
// OVERLAY-6b (root 17:4x correction): the ORIGINAL image-lane pair 3182/3497 is REUSED after a
// real free + no-in-flight check — the earlier ban on them was center's mis-exclusion of the image
// lane, not a root order. What IS off-limits here: the stable dev instance (3080), the family
// defaults nobody owns (3180/3181), the RSJ-frozen pair (3186/3500), and the two prior INFRA worlds
// whose quiescence is unproven (3183/3498 and 3184/3499, plus 3185 which root never released).
const FORBIDDEN_PORTS = [3080, 3180, 3181, 3183, 3184, 3185, 3186, 3498, 3499, 3500]
if (ENTRY_DIRECT && !HOME.split('/').pop().startsWith(WORLD_PREFIX)) {
  console.error(`FATAL: --world basename must start with "${WORLD_PREFIX}" (this round's exclusive world prefix). NOTHING created, mounted or removed (entry-safety law).`)
  process.exit(1)
}
const FIXTURE = argValue('fixture', 'todo')
if (FIXTURE !== 'todo' && FIXTURE !== 'write' && FIXTURE !== 'image') {
  // direct entry only: an import must NEVER exit the importing process
  if (ENTRY_DIRECT) {
    console.error('FATAL: --fixture must be todo|write|image')
    process.exit(1)
  }
}
const ROW_TOOL = FIXTURE === 'image' ? 'read_image' : FIXTURE === 'write' ? 'write' : 'todo_write'
const REFUSAL_MARK = FIXTURE === 'write' ? 'refused-write' : FIXTURE === 'todo' ? 'refused-todo' : 'STRUCTURAL:image-denial-protocol' // image mode NEVER uses a marker word (root 14:29/14:57 law: structural callId-paired protocol only)
const INSTALL_PKG = join(HOME, INSTALL_DIR, 'package')
const INSTALL = join(INSTALL_PKG, 'packages', 'runtime', 'dist')
const LOCK_FILE = `${HOME}.lock`
const EVIDENCE_DIR = resolve(argValue('evidence-dir', join(REPO, 'dev', 'agent-workflow', 'evidence', 'a5m2-img-r18')))

function utcStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
}
// OVERLAY-5 (run naming): the r18 tag drives the run directory, session ids, realm and
// markers, so nothing from r11-r17 can collide with this round (r17's world/session ids stay
// untouched evidence).
const RUN_TAG = 'a5m2-img-r18'
const RUN_STAMP = argValue('run-stamp', `${RUN_TAG}-${utcStamp()}`)
if (!RUN_STAMP.startsWith(`${RUN_TAG}-`)) {
  // direct entry only: an import must NEVER exit the importing process
  if (ENTRY_DIRECT) {
    console.error(`FATAL: --run-stamp must start with "${RUN_TAG}-" (run + evidence identity stays attributable to this round).`)
    process.exit(1)
  }
}
// OVERLAY-14 (root 17:42 item 3): the suffix after "<RUN_TAG>-" becomes a RUN DIR NAME, and teardown
// runs scrubDir() over the run directory (a RECURSIVE read-write pass). So the suffix must be ONE
// safe basename: no separator, no dot-dot, no leading dot — otherwise `--run-stamp a5m2-img-r18-x/
// ../../…` would relocate the run dir outside the evidence tree and point the scrub at foreign
// files. Belt and braces: the resolved RUN_DIR is additionally asserted to sit STRICTLY inside
// EVIDENCE_DIR, and the check runs for imports too (it cannot exit the importing process, so an
// imported misuse throws instead of silently writing elsewhere).
const RUN_SUFFIX = RUN_STAMP.slice(RUN_TAG.length + 1)
const RUN_SUFFIX_OK = /^[A-Za-z0-9][A-Za-z0-9._@-]*$/.test(RUN_SUFFIX) && !RUN_SUFFIX.includes('..')
const RUN_DIR = join(EVIDENCE_DIR, `run-${RUN_SUFFIX}`)
if (!RUN_SUFFIX_OK || !resolve(RUN_DIR).startsWith(`${resolve(EVIDENCE_DIR)}/`)) {
  const msg = `run identity invalid: --run-stamp must be "${RUN_TAG}-<one safe basename>" with no path separator or dot-dot (got ${JSON.stringify(RUN_STAMP)}); the run dir stays strictly inside ${EVIDENCE_DIR}`
  if (ENTRY_DIRECT) { console.error(`FATAL: ${msg}`); process.exit(1) }
  throw new Error(msg)
}

// The DESIGNATED host runtime (root ruling 10:03 item 2): the test-use
// checkout INSIDE the worktree tree (the runtime host, distinct from the
// plugin surface; reading/running it is in-scope). Its git identity is
// verified in preflight (HEAD == the paths.mjs baseline + porcelain EMPTY).
const TESTUSE = resolve(argValue('testuse', join(WORKTREE, 'tests', 'deepseek-harness-test-use')))
const HOST_TREE = TESTUSE
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
let HOST_BASELINE_SHA = null // set by loadHarness() in main(); generation lives ONLY in tests/paths.mjs

// THE MOUNT SURFACE — ROOT-level package at the INSTALL_DIR surface (layout unchanged since root 10:30 GO)
// + the pinned helper at mount-helper/packages/tools/harness/plugin.mjs, laid
// out so its RELATIVE leg ../../runtime/dist/packages/runtime/mutation/index.js
// resolves (packages/runtime -> symlink into the extracted package). Nearest
// package.json for every mounted entry = the root manifest (dsh-agent-team, 9
// exact peers). Never a .worktrees path (guard below).
const PRODUCTION_ROW_PATH = join(INSTALL, 'packages', 'runtime', 'src', 'plugin', 'host.js')
const GLUE_PATH = join(INSTALL, 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')
const SEAM_PATH = join(INSTALL, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')
const P6T6_PLUGIN_PATH = join(HOME, 'mount-helper-root', 'package', 'packages', 'tools', 'harness', 'plugin.mjs')
const PRODUCTION_ROW_NAME = pathToFileURL(PRODUCTION_ROW_PATH).href
const GLUE_URL = pathToFileURL(GLUE_PATH).href
const SEAM_URL = pathToFileURL(SEAM_PATH).href
const P6T6_ROW_NAME = pathToFileURL(P6T6_PLUGIN_PATH).href

// Ports (OVERLAY-2, r18 selection): 3180 family ONLY. The stable dev instance and
// every port this program or another lane has frozen are ABSOLUTELY forbidden —
// :3080 (stable dev), :3180/:3181 (family defaults), :3182 + :3497 (the r11-r17 C2
// pair), :3186 + :3500 (RSJ-frozen). The remaining candidates are 3183-3185 (host)
// and 3498 (mock). Selection is by ACTIVE BIND-PROBE, not by connect-guessing: the
// kit binds 127.0.0.1:<port> itself (EADDRINUSE = taken), HELDS that socket while it
// decides, and releases it only in the instant before the process that will own the
// port starts (Host / mock). Every probe attempt is recorded in <run>/port-probe.json.
const HOST_PORT_CANDIDATES = [3182] // this image lane's OWN historical pair (r11-r17), reused per root 17:4x
const MOCK_PORT_CANDIDATES = [3497] // nothing else is selectable: infra pairs and RSJ ports are forbidden

const ROOT = `session-a5m2c2-boot-${RUN_STAMP}`
const ROOT_P = `session-a5m2c2-p-${RUN_STAMP}`
const BP_ANCHOR_ID = 'team.a5m2c2-anchor'
const BP_TODO_ID = 'team.a5m2c2-todo'
const BLUEPRINT_DIR = join(HOME, 'blueprints')

// ── markers ────────────────────────────────────────────────────────────────
const NONCE = RUN_STAMP.replace(/[^a-zA-Z0-9-]/g, '')
const MK = (p) => `${p}_${NONCE}`
const MK_CREATE = MK('CREATE')
const MK_WORK1 = MK('W1')
const MK_W3L = MK('W3L')
const MK_WORK3 = MK('W3')
const MK_DISC = MK('DISC')
const DONE_DISC = 'A5M2C2_DISC_DONE'
const DONE_CREATE = 'A5M2C2_CREATE_DONE'
const DONE_WORK1 = 'A5M2C2_W1_DONE'
const DONE_W3L = 'A5M2C2_W3L_DONE'
const DONE_WORK3 = 'A5M2C2_W3_DONE'
const NOTIF_PREFIX = '[team-control requestId='

// The submitted todo lists (trimmed, non-duplicated, single-active-safe).
const LIST1 = [
  { content: `a5m2c2-alpha-${NONCE}`, status: 'in_progress' },
  { content: `a5m2c2-beta-${NONCE}`, status: 'pending' },
]
const LIST2 = [{ content: `a5m2c2-deny-${NONCE}`, status: 'pending' }]
const LIST3 = [{ content: `a5m2c2-cancel-${NONCE}`, status: 'pending' }]
// write fixture (root 13:01Z): task-synthesized EXISTING file under the anchored
// governed root; gitignored pattern examples/*/*.jsonl (porcelain-neutral, probed
// 2026-10-23). Leg baselines: pending/deny/abandon compare zero-change against the
// ACTUAL bytes AT EACH LEG START (post-allow that baseline is TGT, not INIT).
const WF_REL = `examples/minimal/a5m2c2-wf-${RUN_STAMP}.jsonl`
const WF_ABS = join(TESTUSE, WF_REL)
const WF_INIT = `{"phase":"initial","stamp":"${RUN_STAMP}"}\n`
const WF_TGT = `{"phase":"written","stamp":"${RUN_STAMP}","marker":"a5m2c2-write-allow"}\n`
const WF_DENY = `{"phase":"deny-should-not-land","stamp":"${RUN_STAMP}"}\n`
const WF_CANCEL = `{"phase":"cancel-should-not-land","stamp":"${RUN_STAMP}"}\n`
const WF_TGT_SHA = createHash('sha256').update(Buffer.from(WF_TGT)).digest('hex')
// ── A5M2 IMAGE fixture. OVERLAY-19 (root 21:41): the image leg is now the NEW INDEPENDENT LEGAL
// POSITIVE CONTROL — input 1024x768 INSIDE the input cap, output policy 512, so the store must
// NORMALIZE to exactly 512x384. This is a NEW input identity (new PNG bytes, new sha, new run dir),
// deliberately NOT a re-spun version of the recorded 2048x1536-vs-cap-1024 case: that over-limit
// input (2411037 B, sha256 d6bfd5ebba2b067a58d9532c40b4162574075cd6dca14467892a47c16add48b8) is still
// refused today by the same fixed Host code with IMAGE_DIMENSION_TOO_LARGE, and its raw + hashes stay
// as the unfalsified record — nothing here washes it green. Input admission rule measured in the Host
// (attachment-local/lib/types/image.js:86-89): refuses only when max(w,h) > maxDimension, so an input
// whose long side EQUALS the 1024 cap is legal. PNG lives under the ANCHORED root in the gitignored
// `examples/*/.sessions/` pattern (L15 of the test-use .gitignore — Host .gitignore untouched, H1
// porcelain law intact). Deterministic bytes: filter-0 RGB scanlines, zlib level 9, single IDAT
// (this size: 1092684 B, sha256 59c5e468a161bb7833c0062f9935d4d0c48e9a5e37d42c7c73964f78427d1516).
const IMG_W = 1024
const IMG_H = 768
const IMG_NAME = `a5m2c2-im-${RUN_STAMP}.png`
const IMG_REL = `examples/minimal/.sessions/${IMG_NAME}`
const IMG_ABS = join(TESTUSE, 'examples', 'minimal', '.sessions', IMG_NAME)
const IMG_NORM_W = 512
const IMG_NORM_H = 384
// The full effective store limit set for THIS control, field by field from the FIXED Host639 schema
// (packages/attachment/attachment-local/lib/index.js:971-983 LocalAttachmentStore.Config; defaults
// measured at :896-916). Only two fields carry this control's identity: the INPUT cap
// maxImageDimension 1024 (unchanged from the recorded window — the product/input hard cap was NOT
// touched) and the INDEPENDENT output policy normalizedImageMaxDimension 512. Every other field is
// the Host default, restated verbatim so the wholesale config replacement silently changes nothing:
// pixels 4194304 >= 786432 and bytes 4194304 >= 1092684 keep those two caps non-binding, which is what
// makes maxDimension the single driver of the resample (initialDimensions: scale 512/1024 = 0.5 ->
// floor(1024*.5)=512 x floor(768*.5)=384). dshHome stays supplied by the Host, as in every previous
// image run — this patch has never carried it.
const IMG_STORE_CONFIG = {
  maxImageBytes: 20971520,
  maxImagesPerMessage: 20,
  maxMessageImageBytes: 209715200,
  maxImagePixels: 64000000,
  maxImageDimension: 1024,
  normalizedImageMaxPixels: 4194304,
  normalizedImageMaxDimension: 512,
  normalizedImageMaxBytes: 4194304,
  imageCompressionConcurrency: 2,
}
function crc32(buf) {
  let c, table = crc32.table
  if (table === undefined) {
    table = crc32.table = new Int32Array(256)
    for (let n = 0; n < 256; n += 1) { c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; table[n] = c }
  }
  c = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i += 1) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function synthPng(width, height) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0 // 8-bit truecolor RGB
  const rowLen = 1 + width * 3
  const raw = Buffer.alloc(rowLen * height)
  for (let y = 0; y < height; y += 1) {
    const off = y * rowLen
    raw[off] = 0 // filter: None
    for (let x = 0; x < width; x += 1) {
      const o = off + 1 + x * 3
      raw[o] = (x * 256 / width) | 0
      raw[o + 1] = (y * 256 / height) | 0
      raw[o + 2] = ((x + y) % 256)
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}
/** Committed attachment objects: <dshHome>/attachments/v1/objects/<sha[0:2]>/<sha> (store law: the file name IS the sha256 of its bytes). */
function storeCensus() {
  const base = join(HOME, 'attachments', 'v1', 'objects')
  const out = []
  const walk = (d) => {
    for (const e of existsSync(d) ? readdirSync(d, { withFileTypes: true }) : []) {
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else out.push({ rel: p.slice(base.length + 1), size: statSync(p).size })
    }
  }
  walk(base)
  return out.sort((a, b) => a.rel < b.rel ? -1 : 1)
}
let IMG_SRC_SHA = null
let storeBaseline = []
let allowStoreRel = null
function wfState() {
  try {
    const b = readFileSync(WF_ABS)
    return { sha: createHash('sha256').update(b).digest('hex'), size: b.length }
  } catch { return { sha: null, size: -1 } }
}

// ── logging / criteria ─────────────────────────────────────────────────────
let RUN_LOG = null
function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`
  console.log(stamped)
  if (RUN_LOG !== null) {
    try { writeFileSync(RUN_LOG, stamped + '\n', { flag: 'a' }) } catch { /* best-effort */ }
  }
}

const CRITERIA = [
  // OVERLAY-10: criterion NAMES follow the fixture, so the run summary of an image round never
  // reads like a todo round (the legs themselves are unchanged; write keeps the r16 wording).
  { id: 'C1', name: FIXTURE === 'image' ? 'GOVERNED read_image row binding: durable row on lane plane-image (B-IMAGE rev2 manifest, canonicalTarget + declaredMediaType + byteCap), requiredAuthority leader x2, ZERO old parameter-permission rows for read_image (the hand-off EMPIRICALLY opens the old front door at zero) + the member surface carries read_image with the CAPTURED NATIVE description bytes' : FIXTURE === 'write' ? 'REAL write registration (captured native description bytes) + governed durable row bound to the live callId' : 'REAL todo_write registration (captured native description bytes) + governed durable row with plane-todo callId grammar' },
  { id: 'C2', name: FIXTURE === 'image' ? 'PENDING with ZERO side effects: no consumption, ZERO new attachment-store objects, source PNG byte-untouched' : FIXTURE === 'write' ? 'Ask PENDING with ZERO effect (fixture file bytes unchanged, zero consumption)' : 'Ask PENDING with ZERO append (member session log has zero todo/write entries while pending)' },
  { id: 'C3', name: FIXTURE === 'image' ? `PUBLIC ALLOW -> exactly ONE control-allow-consumed + EXACTLY ONE new store object (name-sha == byte-sha) + REAL normalization ${IMG_NORM_W}x${IMG_NORM_H} with the ORIGINAL ${IMG_W}x${IMG_H} dimensions in the model-visible text and the stored bytes as the image part` : FIXTURE === 'write' ? 'PUBLIC ALLOW -> exactly ONE control-allow-consumed + the fixture file bytes equal the submitted content' : 'PUBLIC ALLOW -> exactly ONE control-allow-consumed + EXACTLY ONE todo/write append, field-for-field equal' },
  { id: 'C4', name: FIXTURE === 'image' ? 'PUBLIC DENY of the SAME image (fresh callId -> row2 on lane plane-image): ZERO consumptions, ZERO new store objects, structural callId-paired refusal surfaced to the member' : FIXTURE === 'write' ? 'REAL DENY with ZERO effect (bytes unchanged, zero consumption, refusal surfaced to member)' : 'REAL DENY with ZERO append (log total stays 1, zero consumption, refusal surfaced to member)' },
  { id: 'C5', name: FIXTURE === 'image' ? 'PUBLIC ABANDON via the existing p6t6 abandonControlRequest route: one abandon fact, ZERO consumptions, store unchanged, callId-paired refusal to the member' : FIXTURE === 'write' ? 'cancel via the existing p6t6 abandon fixture (one abandon fact, zero consumption, zero effect)' : 'cancel via the existing p6t6 abandon fixture (one abandon fact, zero consumption, zero append)' },
  { id: 'H1', name: 'test-use porcelain EMPTY + HEAD baseline before and after; :3080 zero-touch BY CONSTRUCTION' },
  { id: 'H2', name: 'every allocated port released + no surviving host/mock process (ps proof)' },
]
const results = {}
for (const c of CRITERIA) results[c.id] = { id: c.id, name: c.name, status: 'not-run', checks: [] }

function check(critId, name, ok, detail) {
  results[critId].status = 'run'
  results[critId].checks.push({ name, ok: ok === true, detail: detail === undefined ? undefined : String(detail).slice(0, 2000) })
  log(`${critId} ${ok ? 'PASS' : 'FAIL'} — ${name}${detail !== undefined && detail !== null ? ` :: ${String(detail).slice(0, 300)}` : ''}`)
}
function finishCriterion(critId) {
  const r = results[critId]
  r.pass = r.status === 'run' && r.checks.length > 0 && r.checks.every((c) => c.ok === true)
  log(`${critId}: ${r.pass ? 'PASS' : 'FAIL'} (${r.checks.filter((c) => c.ok).length}/${r.checks.length} checks)`)
  if (!r.pass) throw new FirstFailureStop(`${critId} FAILED — first-failure stop (full state in ${RUN_DIR})`)
}
class FirstFailureStop extends Error {}

async function dieFatal(msg, isCriterionFailure = false) {
  log(`${isCriterionFailure ? 'FIRST-FAILURE-STOP' : 'FATAL'} ${msg}`)
  closeAllProbeHolds('dieFatal') // root 17:42: no held probe socket survives this exit path
  try {
    mkdirSync(RUN_DIR, { recursive: true })
    for (const h of EVID.hostLogs) {
      const dest = join(RUN_DIR, `host-${h.phase}-port${h.port}.log`)
      try { writeFileSync(dest, readFileSync(h.logPath, 'utf8')) } catch { /* gone */ }
    }
    try { if (mockRef !== null) writeFileSync(join(RUN_DIR, 'mock.log'), mockRef.requestLogText ? mockRef.requestLogText() : JSON.stringify(mockRef.requests, null, 2)) } catch { /* ok */ }
    try { writeFileSync(join(RUN_DIR, 'api-transcript.json'), JSON.stringify(TRANSCRIPT, null, 2)) } catch { /* ok */ }
    try { writeFileSync(join(RUN_DIR, 'port-probe.json'), JSON.stringify({ forbidden: FORBIDDEN_PORTS, attempts: PORT_PROBE }, null, 2)) } catch { /* ok */ }
    dumpSessionLogs('on-stop')
    dumpPaEdgeEvidence()
    writeFileSync(join(RUN_DIR, 'ledger-dump.json'), JSON.stringify(LEDGER_CACHE, null, 2))
  } catch { /* best-effort */ }
  const backstop = setTimeout(() => process.exit(isCriterionFailure ? 2 : 1), 75_000)
  try { await sweepLiveHosts() } catch { /* ok */ }
  try { if (mockRef !== null) await mockRef.close() } catch { /* ok */ }
  clearTimeout(backstop)
  try {
    writeFileSync(join(RUN_DIR, 'summary.json'), JSON.stringify({
      task: 'A5M2 todo C2 single bounded real-host run',
      runStamp: RUN_STAMP,
      fatal: String(msg).slice(0, 4000),
      world: HOME,
      worldRetained: true,
      criteria: Object.values(results),
      pass: false,
      exitCode: isCriterionFailure ? 2 : 1,
    }, null, 2))
    scrubDir(RUN_DIR)
  } catch { /* ok */ }
  process.exit(isCriterionFailure ? 2 : 1)
}

const TRANSCRIPT = []
const EVID = { hostLogs: [] }
const LEDGER_CACHE = {}
let mockRef = null
function noteTranscript(entry) { TRANSCRIPT.push({ at: new Date().toISOString(), ...entry }) }

// ── port selection + stable-instance discipline ────────────────────────────
// OVERLAY-6 (root 17:0x: "bind-probe the two ports, then hold"): selection is an ACTIVE
// bind test on 127.0.0.1 (EADDRINUSE = taken), not a connect guess; the winning probe socket
// is HELD while the rest of the setup runs and released only in the instant before the
// process that will own the port starts (mock, then Host). Every attempt — including the
// rejected ones and the explicit --host-port/--mock-port values — is recorded in
// <run>/port-probe.json, and FORBIDDEN_PORTS is asserted before any probe. Candidate SET and the
// forbidden SET are corrected by OVERLAY-6b below; the mechanism is unchanged.
const PORT_PROBE = []
const PORT_HELD = new Map()
async function bindProbeHold(port, label) {
  const srv = createServer()
  const rec = { at: new Date().toISOString(), label, port, connectProbe: null, inFlight: null, bindProbe: null, held: false }
  PORT_PROBE.push(rec)
  rec.connectProbe = (await portInUse(port, 1500)) ? 'listener-seen' : 'no-listener'
  // "真实空闲/无在途核" (root 17:4x): a listener-free port is not enough — a port can hold ESTABLISHED
  // or TIME_WAIT sockets of a lane that just quiesced while still accepting a fresh bind. Any TCP
  // socket in ANY state on this port refuses the candidate; the evidence line is kept either way.
  try {
    const lines = execFileSync('ss', ['-Htan'], { encoding: 'utf8' }).split('\n')
      .filter((l) => new RegExp(`:${port}\b`).test(l))
    rec.inFlight = lines.length === 0 ? 'no-socket' : `refused: ${lines.length} socket(s) [${lines.slice(0, 3).map((l) => l.trim().split(/\s+/)[0]).join(',')}…]`
  } catch (e) { rec.inFlight = `ss-unavailable (${e.code ?? e.message}); bind probe only` }
  if (typeof rec.inFlight === 'string' && rec.inFlight.startsWith('refused')) { try { srv.close() } catch {} ; return false }
  await new Promise((res, rej) => {
    srv.once('error', (e) => { rec.bindProbe = `EADDR/${e.code ?? 'ERR'}`; rej(e) })
    srv.listen(port, '127.0.0.1', () => { rec.bindProbe = 'bound'; res() })
  }).then(() => {
    PORT_HELD.set(port, srv)
    rec.held = true
    return true
  }).catch(() => false)
  if (rec.bindProbe !== 'bound') { try { srv.close() } catch {} }
  return rec.bindProbe === 'bound'
}
async function releaseHold(port, why) {
  const srv = PORT_HELD.get(port)
  if (!srv) return
  PORT_HELD.delete(port)
  await new Promise((res) => { srv.close(() => res()) })
  log(`port ${port} hold released (${why})`)
}
// OVERLAY-15 (root 17:42 supplement): EVERY probe socket this run opened is closed on EVERY exit
// path. Before this, the entry catch set only process.exitCode, so an init-time exception (or any
// throw between selection and start) left HELD LISTENERS bound in a lingering process — a port that
// looks busy to the next lane and a self-collision risk for the Host about to bind it. Idempotent,
// never throws, and it stamps the truth into PORT_PROBE so port-probe.json says which port was
// released on which exit path.
function closeAllProbeHolds(why) {
  for (const [port, srv] of [...PORT_HELD.entries()]) {
    PORT_HELD.delete(port)
    try { srv.close() } catch { /* already closed */ }
    try { srv.unref() } catch { /* ok */ }
    const rec = PORT_PROBE.filter((r) => r.port === port && r.held === true).at(-1)
    if (rec) { rec.held = false; rec.released = `closed on exit path (${why})` }
  }
}
function assertPortAllowed(port, label) {
  if (FORBIDDEN_PORTS.includes(port)) {
    PORT_PROBE.push({ at: new Date().toISOString(), label, port, bindProbe: 'REFUSED-forbidden-port' })
    throw new Error(`${label}: port ${port} is FORBIDDEN (${FORBIDDEN_PORTS.join('/')}) — the stable dev instance and every frozen lane port are off-limits`)
  }
}
async function pickPort(candidates, label) {
  for (const p of candidates) {
    try { assertPortAllowed(p, label) } catch (e) { log(`${label}: ${e.message}`); continue }
    if (await bindProbeHold(p, label)) { log(`${label}: port ${p} bind-probed free and HELD until start`); return p }
    log(`${label}: port ${p} not bindable, next`)
  }
  await dieFatal(`${label}: no bind-probed free port in [${candidates.join(', ')}]`)
}
async function explicitPort(n, label) {
  assertPortAllowed(n, label)
  if (!(await bindProbeHold(n, label))) await dieFatal(`${label}: --${label}-port ${n} is not bindable on 127.0.0.1`)
  log(`${label}: explicit port ${n} bind-probed free and HELD until start`)
  return n
}
async function writePortProbe() {
  try { writeFileSync(join(RUN_DIR, 'port-probe.json'), JSON.stringify({ forbidden: FORBIDDEN_PORTS, attempts: PORT_PROBE }, null, 2)) } catch {}
}

async function fetchJson(url, init, timeoutMs) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  let body = null
  try { body = text === '' ? null : JSON.parse(text) } catch { body = { nonJsonBody: text.slice(0, 800) } }
  return { status: res.status, body }
}

async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) throw new Error(`auth returned HTTP ${res.status} (expected 303 + set-cookie)`)
  return setCookie.split(';', 1)[0]
}

function scrubTokens(text) {
  return String(text ?? '').replace(/\/\?token=([A-Za-z0-9_-]+)/g, '/?token=<SCRUBBED>')
    .replace(/("token"\s*:\s*")[A-Za-z0-9_-]+(")/g, '$1<SCRUBBED>$2')
}
function scrubDir(dir) {
  if (!existsSync(dir)) return 0
  let changed = 0
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) { changed += scrubDir(p); continue }
    if (!st.isFile()) continue
    let raw
    try { raw = readFileSync(p, 'utf8') } catch { continue }
    const scrubbed = scrubTokens(raw)
    if (scrubbed !== raw) { writeFileSync(p, scrubbed); changed++ }
  }
  return changed
}

// ── remote / prompt wires (exemplar-verbatim shapes) ───────────────────────
async function remoteCall(origin, cookie, method, params, tag = 'a5c2', version = 1, timeoutMs = 180_000) {
  const res = await fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, method, payload: { version, params } }),
  }, timeoutMs)
  noteTranscript({ method, params: scrubTokens(JSON.stringify(params)), status: res.status, body: scrubTokens(JSON.stringify(res.body)) })
  return res
}
async function remoteCallReady(host, method, params, tag, version = 1, retries = 20) {
  let last = null
  for (let i = 0; i < retries; i += 1) {
    last = await remoteCall(host.origin, host.cookie, method, params, tag, version)
    if (last.status !== 429) return last
    await new Promise((r) => setTimeout(r, 1500))
  }
  return last
}
function resultError(body) {
  const r = body?.result
  if (r === undefined) return { code: 'NO_RESULT', message: String(body).slice(0, 200) }
  if (r.ok !== true) return r.error ?? { code: 'UNKNOWN', message: JSON.stringify(r).slice(0, 200) }
  return null
}
function resultData(body) {
  const r = body?.result
  if (r === undefined || r.ok !== true) return null
  const v = r.value
  if (v && typeof v === 'object' && 'data' in v) return v.data
  return v
}
async function apiPrompt(origin, cookie, sessionId, text, tag = 'a5c2') {
  const res = await fetchJson(`${origin}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/prompt',
      payload: { args: { request: { requestId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, sessionId, mode: 'queue', content: [{ type: 'text', text }] } } },
    }),
  }, 240_000)
  noteTranscript({ method: 'session/prompt', sessionId, text: String(text).slice(0, 200), status: res.status, body: scrubTokens(JSON.stringify(res.body)) })
  return res
}
async function p6t6Health(port) { return fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, undefined, 10_000) }
async function p6t6Control(port, body, timeoutMs = 60_000) {
  const res = await fetchJson(`http://127.0.0.1:${port}/__p6t6/control/mutate`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }, timeoutMs)
  noteTranscript({ method: '__p6t6/control/mutate', action: body?.action, status: res.status, body: scrubTokens(JSON.stringify(res.body)) })
  return res
}

// ── durable control ledger (exemplar recipe, team_domain.json read-only) ───
function safeParse(v) {
  if (v === null || v === undefined) return {}
  if (typeof v === 'object') return v
  try { return JSON.parse(v) } catch { return { raw: String(v).slice(0, 400) } }
}
function jstr(x, n = 400) { const s = JSON.stringify(x); return (s === undefined ? 'undefined' : s).slice(0, n) }

function readLedger() {
  const out = { recorded: [], decisions: [], consumptions: [], abandonments: [], error: null }
  try {
    const parsed = JSON.parse(readFileSync(join(HOME, 'storages', 'team_domain.json'), 'utf8'))
    for (const e of Object.values(parsed?.tables?.ledger ?? {})) {
      const row = safeParse(e)
      if (row.rootSessionId !== ROOT_P) continue
      const payload = safeParse(row.payload)
      if (row.factType === 'control-request-recorded') out.recorded.push({ sequence: row.sequence, payload })
      else if (row.factType === 'control-decision-recorded') out.decisions.push({ sequence: row.sequence, payload })
      else if (row.factType === 'control-allow-consumed') out.consumptions.push({ sequence: row.sequence, payload })
      else if (row.factType === 'control-request-abandoned') out.abandonments.push({ sequence: row.sequence, payload })
    }
  } catch (error) { out.error = String(error?.message ?? error) }
  LEDGER_CACHE.last = { recorded: out.recorded, decisions: out.decisions, consumptions: out.consumptions, abandonments: out.abandonments, error: out.error }
  return out
}
const TODO_CORR_RE = () => new RegExp(`plane-todo:${REALM_ESC}-\\d+`)
let REALM_ESC = 'a-realm'

// OVERLAY-9 (root law "image mode NEVER emits todo", turned into a GATE). r17 showed the
// failure mode is not "the oracle calls todo_write" (it never does) but RESIDUE: an
// orphan todo row from another fixture reached the governed plane and only surfaced as an
// unexplained extra PA row mid-run. So in image mode the kit now asserts, inside the leg it
// belongs to (a failure therefore stops the run AT that leg), that the todo footprint is
// ZERO on all three independent surfaces: the durable ledger (no `plane-todo` lane fact),
// the member session storage (no `todo/write` entry), and the model wire (no todo_write tool
// call in any request the mock served).
function todoFootprint(childSidOrNull) {
  const led = readLedger()
  const laneFacts = [...led.recorded, ...led.decisions, ...led.consumptions, ...led.abandonments]
    .filter((f) => /:plane-todo:/.test(String(f?.payload?.correlation ?? '')))
    .map((f) => ({ fact: f?.payload?.requestId ? 'row' : 'row', rid: f?.payload?.requestId ?? null, corr: f?.payload?.correlation ?? null }))
  let sessionRows = 0
  let sessionFiles = []
  if (typeof childSidOrNull === 'string' && childSidOrNull !== '') {
    try { const ml = readMemberTodoLog(childSidOrNull); sessionRows = ml.rows.length; sessionFiles = ml.files } catch { /* reader is best-effort; the count stays 0 */ }
  }
  let wireCalls = 0
  const wireHits = []
  for (const r of (mockRef?.requests ?? [])) {
    for (const m of (r?.body?.messages ?? [])) {
      for (const b of (Array.isArray(m?.content) ? m.content : [])) {
        if (b?.type === 'tool_use' && b?.name === 'todo_write') { wireCalls++; wireHits.push({ role: m?.role ?? null, id: b?.id ?? null }) }
      }
      for (const tc of (Array.isArray(m?.tool_calls) ? m.tool_calls : [])) {
        if (tc?.function?.name === 'todo_write' || tc?.name === 'todo_write') { wireCalls++; wireHits.push({ role: m?.role ?? null, id: tc?.id ?? null }) }
      }
    }
  }
  return { laneFacts, sessionRows, sessionFiles, wireCalls, wireHits, ledgerError: led.error }
}
function assertNoTodoInImageMode(critId, childSidOrNull, phase) {
  if (FIXTURE !== 'image') return
  const f = todoFootprint(childSidOrNull)
  writeFileSync(join(RUN_DIR, `zero-todo-law-${phase}.json`), JSON.stringify(f, null, 2))
  check(critId, `ZERO todo footprint at the ${phase} boundary (root law: image mode never emits todo) — no plane-todo lane fact in the durable ledger, no todo/write entry in the member session storage, no todo_write tool call on the model wire`,
    f.laneFacts.length === 0 && f.sessionRows === 0 && f.wireCalls === 0,
    `laneFacts=${jstr(f.laneFacts, 400)} sessionTodoWriteRows=${f.sessionRows} sessionFiles=${f.sessionFiles.length} wireTodoCalls=${f.wireCalls} wireHits=${jstr(f.wireHits, 200)} ledgerError=${f.ledgerError}`)
}

/** The FULL durable control history over the REMOTE wire (exemplar-verbatim
 *  read plane: pages team.getLedgerPage; FAIL LOUD on an error page — an
 *  error page is a contract/host problem, never an "empty ledger"). */
async function remoteControlFacts(host) {
  const byType = {
    'control-request-recorded': [],
    'control-decision-recorded': [],
    'control-allow-consumed': [],
    'control-request-abandoned': [],
  }
  let afterSequence = 0
  for (let pageNo = 0; pageNo < 50; pageNo++) {
    const page = await remoteCallReady(host, 'team.getLedgerPage', { teamSessionId: ROOT_P, afterSequence, limit: 500 }, `a5c2-ledger-${pageNo + 1}`, 1)
    const pageErr = resultError(page.body)
    if (pageErr !== null) {
      throw new Error(`team.getLedgerPage failed (page ${pageNo + 1}, afterSequence=${afterSequence}): ${pageErr.code} ${String(pageErr.message).slice(0, 300)}`)
    }
    const data = resultData(page.body)
    const entries = Array.isArray(data?.entries) ? data.entries : []
    for (const e of entries) {
      if (byType[e?.factType] !== undefined) byType[e.factType].push({ sequence: e.sequence, payload: safeParse(e.payload) })
    }
    const next = data?.nextAfterSequence
    if (next === null || next === undefined || entries.length === 0) break
    afterSequence = next
  }
  return byType
}

async function waitForTodoRow(host, pred, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const byType = await remoteControlFacts(host)
    const hit = byType['control-request-recorded'].find((f) => pred(f.payload))
    if (hit !== undefined) return hit
    if (Date.now() >= deadline) { log(`todo-row wait timed out: ${label}`); return null }
    await new Promise((r) => setTimeout(r, 500))
  }
}
async function waitForLedgerFact(host, factType, requestId, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const byType = await remoteControlFacts(host)
    const hit = byType[factType].filter((f) => f.payload.requestId === requestId)
    if (hit.length > 0) return hit
    if (Date.now() >= deadline) { log(`ledger wait timed out: ${label}`); return null }
    await new Promise((r) => setTimeout(r, 500))
  }
}

// ── member session log reader (zstd-framed session.v4*, restart-kit recipe) ─
function decodeSessionFile(file) {
  const raw = readFileSync(file)
  let text
  if (file.endsWith('.zstd')) {
    const ZSTD_MAGIC = 0xfd2fb528
    const frames = []
    let offset = 0
    while (offset < raw.length) {
      const start = offset
      if (raw.length - offset < 4) break
      if (raw.readUInt32LE(offset) !== ZSTD_MAGIC) break
      offset += 4
      if (offset === raw.length) break
      const descriptor = raw.readUInt8(offset)
      offset += 1
      if ((descriptor & 0x18) !== 0) break
      const contentSizeFlag = descriptor >>> 6
      const singleSegment = (descriptor & 0x20) !== 0
      const checksum = (descriptor & 0x04) !== 0
      const dictionaryFlag = descriptor & 0x03
      const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
      const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag
      const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
      if (raw.length - offset < remainingHeaderBytes) break
      offset += remainingHeaderBytes
      let complete = false
      for (;;) {
        if (raw.length - offset < 3) break
        const blockHeader = raw.readUIntLE(offset, 3)
        offset += 3
        const lastBlock = (blockHeader & 1) !== 0
        const blockType = (blockHeader >>> 1) & 0x03
        const blockSize = blockHeader >>> 3
        if (blockType === 0x03) break
        const payloadBytes = blockType === 0x01 ? 1 : blockSize
        if (raw.length - offset < payloadBytes) break
        offset += payloadBytes
        if (lastBlock) { complete = true; break }
      }
      if (!complete) break
      if (checksum) { if (raw.length - offset < 4) break; offset += 4 }
      frames.push([start, offset])
    }
    const parts = []
    for (const [s, e] of frames) { try { parts.push(zstdDecompressSync(raw.subarray(s, e)).toString('utf8')) } catch { /* torn */ } }
    text = parts.join('')
  } else {
    text = raw.toString('utf8')
  }
  return text
}
function walkSessionFiles(dir, depth, out) {
  if (depth > 5) return
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walkSessionFiles(p, depth + 1, out)
    else if (e.isFile() && /^session\.v\d+(\.jsonl)?(\.zstd)?$/.test(e.name)) out.push(p)
  }
}
/** All todo/write rows of one child session (member). Returns rows + files. */
function readMemberTodoLog(childSessionId) {
  const sessRoot = join(HOME, 'sessions')
  const files = []
  if (existsSync(sessRoot)) walkSessionFiles(sessRoot, 0, files)
  const mine = files.filter((f) => f.includes(childSessionId))
  const rows = []
  const fileTexts = {}
  for (const f of mine) {
    let text = ''
    try { text = decodeSessionFile(f) } catch { continue }
    fileTexts[f] = text
    for (const line of text.split('\n')) {
      if (line === '' || !line.includes('todo/write')) continue
      try {
        const row = JSON.parse(line)
        const t = row.type ?? row.kind ?? row.t ?? null
        if (t === 'todo/write') rows.push(row)
      } catch { /* torn tail */ }
    }
  }
  return { rows, files: mine, fileTexts }
}
function dumpSessionLogs(phase) {
  try {
    const sessRoot = join(HOME, 'sessions')
    if (!existsSync(sessRoot)) return
    const files = []
    walkSessionFiles(sessRoot, 0, files)
    const outDir = join(RUN_DIR, 'session-logs')
    mkdirSync(outDir, { recursive: true })
    for (const f of files) {
      const rel = f.slice(sessRoot.length + 1).replace(/[\/]/g, '__')
      try { writeFileSync(join(outDir, `${phase}__${rel}.txt`), decodeSessionFile(f)) } catch { /* best-effort */ }
    }
  } catch { /* best-effort */ }
}
/** EVIDENCE LAW (root ruling 3): the PA-edge consumed-witness evidence as a
 *  SEPARATE artifact from the CONTROL consumption facts: the plane/PA
 *  observation rows in the host log + the durable session tool/result row of
 *  the governed todo_write call (only reachable THROUGH the edge). */
function dumpPaEdgeEvidence() {
  try {
    const lines = []
    for (const h of EVID.hostLogs) {
      let text = ''
      try { text = readFileSync(h.logPath, 'utf8') } catch { continue }
      for (const line of text.split('\n')) {
        if (/a5-pa-bridge|a5m2-todo|plane-todo|pa-edge|consumed|consume/i.test(line)) lines.push(line.slice(0, 500))
      }
    }
    const sessRoot = join(HOME, 'sessions')
    const files = []
    if (existsSync(sessRoot)) walkSessionFiles(sessRoot, 0, files)
    const toolResultRows = []
    for (const f of files) {
      let text = ''
      try { text = decodeSessionFile(f) } catch { continue }
      for (const l of text.split('\n')) {
        if (!l.includes('todo')) continue
        if (l.includes('todo/write') || l.includes('tool/result') || l.includes('tool/call')) toolResultRows.push({ file: f, row: l.slice(0, 800) })
      }
    }
    writeFileSync(join(RUN_DIR, 'pa-edge-witness-evidence.json'), JSON.stringify({ hostLogObservationLines: lines.slice(0, 400), sessionTodoToolRows: toolResultRows }, null, 2))
  } catch { /* best-effort */ }
}

/** instanceId -> childSessionId from the durable operations table (fallback:
 *  the single child session dir when exactly one member exists). */
function childSessionOf(instanceId) {
  try {
    const parsed = JSON.parse(readFileSync(join(HOME, 'storages', 'team_domain.json'), 'utf8'))
    const hits = []
    for (const e of Object.values(parsed?.tables?.operations ?? {})) {
      const row = safeParse(e)
      const child = row.childSessionId
      const iid = safeParse(row.intent ?? {}).payload?.instanceId ?? row.payload?.instanceId
      if (typeof child === 'string' && iid === instanceId) hits.push(child)
    }
    if (hits.length > 0) return hits[hits.length - 1]
  } catch { /* fall through */ }
  return null
}

// ── mock oracle ────────────────────────────────────────────────────────────
function toolCall(name, argumentsObj) {
  return { kind: 'tool-call', toolCalls: [{ id: `call-a5c2-${Math.random().toString(36).slice(2, 10)}`, name, arguments: argumentsObj }] }
}
function userTextOf(m) {
  if (m === null || typeof m !== 'object') return ''
  if (typeof m.content === 'string') return m.content
  if (Array.isArray(m.content)) return m.content.map((b) => (b !== null && typeof b === 'object' && typeof b.text === 'string' ? b.text : '')).join('\n')
  return ''
}
const ALL_MARKERS = [MK_CREATE, MK_WORK1, MK_W3L, MK_WORK3, MK_DISC]
function lastTriggerIndex(msgs) {
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const m = msgs[i]
    if (m?.role !== 'user') continue
    const t = userTextOf(m)
    if (t.startsWith(NOTIF_PREFIX) || ALL_MARKERS.some((mk) => t.includes(mk))) return i
  }
  for (let i = msgs.length - 1; i >= 0; i -= 1) if (msgs[i]?.role === 'user') return i
  return -1
}
function lastUserTextOf(msgs) { const i = lastTriggerIndex(msgs); return i === -1 ? '' : userTextOf(msgs[i]) }
/**
 * root 14:22/14:29 law: refusal visibility is a STRUCTURAL protocol check, not
 * a fuzzy prefix word. Find, inside ONE model-visible request, the PAIR:
 * assistant tool_use {name:'write', input.file_path=WF_REL, input.content=want}
 * (binding the callId) and a tool result for THAT callId carrying
 * is_error===true (or the wire 'Error:' prefix on tool-role strings) whose text
 * satisfies the requestId-bound protocol predicate. Returns {text, callId} or null.
 */
function denialPairSeen(msgs, want, textPred) {
  const uses = new Set()
  const match = (b) => b?.type === 'tool_use' && b?.name === want?.tool
    && (want?.content === undefined || b?.input?.content === want.content)
    && (want?.file === undefined || b?.input?.file_path === want.file)
  for (const m of msgs ?? []) {
    if (m?.role !== 'assistant' || !Array.isArray(m.content)) continue
    for (const b of m.content) {
      if (match(b)) uses.add(b.id)
    }
  }
  if (uses.size === 0) return null
  for (const m of msgs ?? []) {
    if (m?.role === 'tool' && uses.has(m.tool_call_id ?? '')) {
      const t = toolResultText(m.content ?? '')
      if ((m.is_error === true || t.startsWith('Error:')) && textPred(t)) return { text: t, callId: m.tool_call_id }
    }
    if (Array.isArray(m?.content)) {
      for (const b of m.content) {
        if (b?.type === 'tool_result' && uses.has(b.tool_use_id ?? '') && b.is_error === true) {
          const t = toolResultText(b.content ?? '')
          if (textPred(t)) return { text: t, callId: b.tool_use_id }
        }
      }
    }
  }
  return null
}

/** Model-visible ALLOWED image result: callId-paired tool_use(read_image, IMG_REL) ->
 * tool_result whose text is the native two-block envelope with the ORIGINAL-frame clause
 * (plane render 249eb:3076-3114 — text names BOTH frames; the image part carries the
 * store-normalized attachment ref). Root 14:57 wording proof, structural. */
function imageVisiblePair(msgs) {
  const uses = new Set()
  for (const m of msgs ?? []) {
    if (m?.role !== 'assistant' || !Array.isArray(m.content)) continue
    for (const b of m.content) {
      if (b?.type === 'tool_use' && b?.name === 'read_image' && b?.input?.file_path === IMG_REL) uses.add(b.id)
    }
  }
  if (uses.size === 0) return null
  for (const m of msgs ?? []) {
    if (!Array.isArray(m?.content)) continue
    for (const b of m.content) {
      if (b?.type === 'tool_result' && uses.has(b.tool_use_id ?? '') && b.is_error !== true) {
        const t = toolResultText(b.content ?? '')
        if (t.includes('<type>image</type>') && t.includes(`downscaled from ${IMG_W}x${IMG_H} px`)) return { callId: b.tool_use_id, text: t }
      }
    }
  }
  return null
}

/** How many read_image(IMG_REL) tool_use blocks a wire already carries. OVERLAY-20 uses it as the
 * second half of the case-1 guard: the second call may only follow when exactly ONE such call exists
 * and imageVisiblePair confirmed ITS success envelope. A body that already shows two calls therefore
 * yields no third, whatever else it contains (root 22:05: case 1 and case 2 can never both issue). */
function readImageUses(msgs) {
  let n = 0
  for (const m of msgs ?? []) {
    if (m?.role !== 'assistant' || !Array.isArray(m.content)) continue
    for (const b of m.content) if (b?.type === 'tool_use' && b?.name === 'read_image' && b?.input?.file_path === IMG_REL) n += 1
  }
  return n
}
function toolResultText(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((b) => (b !== null && typeof b === 'object' && typeof b.text === 'string' ? b.text : JSON.stringify(b ?? ''))).join('\n')
  return JSON.stringify(content ?? '')
}
function allToolResults(msgs) {
  const out = []
  for (const m of msgs) {
    if (m?.role === 'tool') { out.push({ id: m.tool_call_id ?? null, content: toolResultText(m.content) }); continue }
    const blocks = Array.isArray(m?.content) ? m.content : []
    for (const b of blocks) if (b?.type === 'tool_result') out.push({ id: b.tool_use_id ?? null, content: toolResultText(b.content) })
  }
  return out
}
function toolMsgsOf(msgs) { const i = lastTriggerIndex(msgs); return allToolResults(msgs.slice(i + 1)) }
function extractInstanceId(content) {
  const m = /"targetInstanceId"\s*:\s*"([^"]+)"/.exec(String(content)) ?? /"instanceId"\s*:\s*"([^"]+)"/.exec(String(content)) ?? /inst-[A-Za-z0-9][A-Za-z0-9-]{3,64}/.exec(String(content))
  return m === null ? null : (m[1] ?? m[0])
}
function makeDecide() {
  const LOOP_BREAK_CAP = 2
  const issued = new Map()
  function decideInner({ req }) {
    const msgs = Array.isArray(req?.messages) ? req.messages : []
    const first = msgs[0]
    const firstText = Array.isArray(first?.content) ? first.content.map((b) => (b !== null && typeof b === 'object' && typeof b.text === 'string' ? b.text : '')).join('') : (typeof first?.content === 'string' ? first.content : '')
    if (firstText.startsWith('Create a concise title') || firstText.startsWith('Generate the session title')) return { kind: 'text', content: 'a5m2c2 todo gate session' }
    const lastUser = lastUserTextOf(msgs)
    const tools = toolMsgsOf(msgs).length
    if (lastUser.includes(MK_DISC)) return { kind: 'text', content: DONE_DISC }
    if (lastUser.startsWith(NOTIF_PREFIX)) return { kind: 'text', content: 'A5M2C2_NOTIF_REMOTE_DRIVEN' }
    if (lastUser.includes(MK_WORK1)) {
      // OVERLAY-20 (root 22:05, image C4 only). Real RC2 evidence (run-2026-10-23T21-53-39): C1/C2/C3 all
      // PASS on the new positive control (one store object 99cfdcaa…, 12197 B, name-sha == byte-sha; the
      // model-visible text carried BOTH frames 512x384 / downscaled from 1024x768), but the whole wire held
      // exactly ONE read_image tool_use id (call-a5c2-1i8huzff) — this case-1 branch ended the turn with
      // DONE_WORK1, so no second call ever existed, no second governed row could appear, and C4's wait for
      // row2 timed out. The oracle, not the product, was the gap.
      // Fix is confined to image case 1: emit the SECOND read_image ONLY when the kit's existing
      // imageVisiblePair confirms this call SUCCEEDED — a tool_use(read_image, IMG_REL) whose paired
      // tool_result is NOT is_error and carries the native image envelope with the ORIGINAL-frame clause,
      // bound to that same tool_use_id. First result is an error, or no success pair exists: return
      // DONE_WORK1 exactly as before, so C3's own first-failure / terminal-is_error stop stays in charge
      // and a failed leg can never be continued past. The second call reuses the PROVEN case-0 request
      // builder verbatim (toolCall('read_image', { file_path: IMG_REL })), so no new wire field is invented;
      // toolCall mints a fresh callId, which is what row2/lane-2 needs.
      // Unchanged by law here: case 2 still DONE_WORK1 (so case 1 and case 2 can never both issue, and no
      // third call exists), LOOP_BREAK_CAP 2, every timeout, every negative control, and the product.
      switch (tools) {
        case 0: return FIXTURE === 'image' ? toolCall('read_image', { file_path: IMG_REL }) : FIXTURE === 'write' ? toolCall('write', { file_path: WF_REL, content: WF_TGT }) : toolCall('todo_write', { todos: LIST1 })
        case 1: return FIXTURE === 'image' ? (imageVisiblePair(msgs) !== null && readImageUses(msgs) === 1 ? toolCall('read_image', { file_path: IMG_REL }) : { kind: 'text', content: DONE_WORK1 }) : FIXTURE === 'write' ? toolCall('write', { file_path: WF_REL, content: WF_DENY }) : toolCall('todo_write', { todos: LIST2 })
        case 2: return { kind: 'text', content: DONE_WORK1 }
        default: return { kind: 'text', content: `A5M2C2_W1_FALLTHROUGH tools=${tools}` }
      }
    }
    if (lastUser.includes(MK_WORK3)) {
      switch (tools) {
        case 0: return FIXTURE === 'image' ? toolCall('read_image', { file_path: IMG_REL }) : FIXTURE === 'write' ? toolCall('write', { file_path: WF_REL, content: WF_CANCEL }) : toolCall('todo_write', { todos: LIST3 })
        case 1: return { kind: 'text', content: DONE_WORK3 }
        default: return { kind: 'text', content: `A5M2C2_W3_FALLTHROUGH tools=${tools}` }
      }
    }
    if (lastUser.includes(MK_CREATE)) {
      switch (tools) {
        case 0: return toolCall('team_create_member', { rootSessionId: ROOT_P, requestToken: `a5c2-create-${NONCE}`, delegationTemplateId: 'worker', label: 'w1' })
        case 1: {
          const id = extractInstanceId(toolMsgsOf(msgs)[0]?.content)
          if (id === null || id === undefined || id === '') return { kind: 'text', content: `A5M2C2_CREATE_EXTRACT_FAIL :: ${String(toolMsgsOf(msgs)[0]?.content).slice(0, 300)}` }
          return toolCall('team_delegate', { rootSessionId: ROOT_P, requestToken: `a5c2-delegate-${NONCE}`, delegationInstanceId: id, label: 'w1', prompt: MK_WORK1, async: true })
        }
        case 2: return { kind: 'text', content: DONE_CREATE }
        default: return { kind: 'text', content: `A5M2C2_CREATE_FALLTHROUGH tools=${tools}` }
      }
    }
    if (lastUser.includes(MK_W3L)) {
      const memberId = allToolResults(msgs).map((m) => extractInstanceId(m.content)).find((v) => v !== null) ?? null
      if (memberId === null) return { kind: 'text', content: 'A5M2C2_W3L_MEMBERID_FAIL' }
      switch (tools) {
        case 0: return toolCall('team_delegate', { rootSessionId: ROOT_P, requestToken: `a5c2-w3-delegate-${NONCE}`, delegationInstanceId: memberId, label: 'w1', prompt: MK_WORK3, async: true })
        case 1: return { kind: 'text', content: DONE_W3L }
        default: return { kind: 'text', content: `A5M2C2_W3L_FALLTHROUGH tools=${tools}` }
      }
    }
    return { kind: 'text', content: 'A5M2C2_ORACLE_FALLTHROUGH (no marker)' }
  }
  return function decide({ req }) {
    const reply = decideInner({ req })
    if (reply.kind === 'tool-call') {
      const names = (Array.isArray(reply.toolCalls) ? reply.toolCalls : [reply.toolCalls]).map((c) => String(c.name)).join(',')
      const trigger = lastUserTextOf(Array.isArray(req?.messages) ? req.messages : []).slice(0, 80)
      const key = `${trigger}|${names}`
      const n = (issued.get(key) ?? 0) + 1
      issued.set(key, n)
      if (n > LOOP_BREAK_CAP) { log(`oracle: LOOP BREAK ${names} for ${JSON.stringify(trigger)}`); return { kind: 'text', content: `A5M2C2_LOOP_BREAK ${names}` } }
    }
    return reply
  }
}
async function waitForMock(mock, pred, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const hit = mock.requests.find(pred)
    if (hit !== undefined) return hit
    if (Date.now() >= deadline) { log(`mock wait timed out: ${label} (requests=${mock.requests.length})`); return null }
    await new Promise((r) => setTimeout(r, 400))
  }
}

// ── row config + blueprint (exemplar schema, todo-scoped) ──────────────────
const REALM = `a5m2c2-realm-${NONCE.slice(-12)}`

function teamRowConfig({ bootPhase }) {
  return {
    rootSessionId: ROOT,
    bootPhase,
    blueprintSource: BP_ANCHOR_YAML,
    blueprintDir: BLUEPRINT_DIR,
    seedMembers: [],
    generation: 1,
    // image mode rides the SHIPPED catalog model that DECLARES image input (llm-deepseek
    // src/models.ts:8-14 inputModalities ['text','image']) — assertImageCapableRoute
    // (host tool-fs/src/read-image.ts:117-130) requires the RESOLVED route to include 'image'
    // before any resolve/read/store; todo/write keep the gate-model spelling untouched.
    staticModel: { provider: 'deepseek-official', model: FIXTURE === 'image' ? 'deepseek-flash' : 'a5m2c2-gate-model' },
    deniedSelection: null,
    mcpServers: [],
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: GLUE_URL,
    seamUrl: SEAM_URL,
    teamToolPlane: {
      realmId: REALM,
      todoEnabled: true,
      todoAllowParallelInProgress: false,
      ...(FIXTURE === 'write' ? { writeEnabled: true } : {}),
      ...(FIXTURE === 'image' ? { imageEnabled: true } : {}), // closed boolean gate (team-tool-plane.mjs:930; pairing law both directions)
      // root ruling 12:20Z (r9): governed fs instance = the world's NATIVE
      // session workspace root — recorded r8 byte-evidence: projcache
      // record.identity.cwd === TESTUSE (single-project host launch; members
      // inherit it). Public a5ie row shape; a23d consumers read rootDir ONLY
      // (agent-bindings.mjs:3045 seam, :2815 write, :2902 image anchors).
      // NO mkdir, NO new root, NO cwd change; relative team/runtime lanes and
      // the 19 global denies UNTOUCHED. team_grep becoming reachable is the
      // existing assembled read-only anchored backend's consequence —
      // disclosed as a surface delta and NEVER called by this kit;
      // team_bash/team_glob stay typed-refused (no confinedProvider).
      fsInstance: {
        fs: 'a5m2c2-governed',
        rootDir: TESTUSE,
        realmId: REALM,
        kind: 'absolute-path',
      },
    },
  }
}

const BP_ANCHOR_YAML = [
  '---',
  'schemaVersion: 3',
  `blueprintId: ${BP_ANCHOR_ID}`,
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: "You are the leader of the A5M2 todo gate boot team."',
  'members:',
  '  - templateId: worker',
  '    persona: "You are a worker of the A5M2 todo gate boot team."',
  'memberEnvelopes: []',
  'requirements: []',
  'permissionMutationEnvelope:',
  '  rules: []',
  'teamHardEnvelope:',
  '  rules: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

const LEADER_TEAM_TOOLS_ALLOW = [
  'team_list_members', 'team_list_templates', 'team_inspect_config', 'team_create_member',
  'team_delegate', 'team_collect', 'team_list_pending_control', 'team_resolve_control',
]
const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']
const OWN_LAYER_SPAWN_TOOLS = ['subagent']
const TEAM_TOOL_CATALOG = [
  'team_list_members', 'team_list_templates', 'team_inspect_config', 'team_create_member',
  'team_delegate', 'team_follow_up', 'team_collect', 'team_send_message', 'team_report_progress',
  'team_request_control', 'team_resolve_control', 'team_list_pending_control', 'team_archive_member',
  // PR4 round 5 governance pair — 495-generation closed team set is 15 (proven by
  // the 495-tracked exemplar tests/kits/rc2-real-host-smoke/fixture-invariants.mjs;
  // run-2026-10-23T10-42-00 died because the old 13-name catalog let these two
  // leak into builtinToolDeny, which the host lawfully rejects as team-tool names).
  'team_grant_permission', 'team_revoke_permission',
]

function savedBlueprintYaml(bpId, denyList) {
  const denyLines = (list, baseIndent) => {
    const pad = '  '.repeat(baseIndent)
    return list.length === 0 ? [`${pad}builtinToolDeny: []`] : [`${pad}builtinToolDeny:`, ...list.map((n) => `${pad}  - ${n}`)]
  }
  const leaderBlock = [
    'leader:',
    '  templateId: leader',
    '  persona: "You are the leader of the A5M2 todo gate team. Keep answers brief."',
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items:',
    ...LEADER_TEAM_TOOLS_ALLOW.map((t) => `        - ${t}`),
    ...denyLines(denyList, 2),
    '    skills:',
    '      kind: allow',
    '      items: []',
    '    mcp:',
    '      kind: allow',
    '      items: []',
    '    permissions:',
    '      default: ask',
    '      allow:',
    '        - tool: read',
    '          resource:',
    '            kind: subtree',
    '            path: team',
    '      ask:',
    '        - tool: bash',
    '          resource:',
    '            kind: any',
    '      deny:',
    '        - tool: read',
    '          resource:',
    '            kind: subtree',
    '            path: runtime',
  ]
  const workerBlock = [
    'members:',
    '  - templateId: worker',
    '    persona: "You are a worker of the A5M2 todo gate team. Follow the delegated instruction exactly with the tools you have; keep answers brief."',
    '    capabilities:',
    '      teamTools:',
    '        kind: deny',
    ...denyLines(denyList, 3),
    '      skills:',
    '        kind: allow',
    '        items: []',
    '      mcp:',
    '        kind: allow',
    '        items: []',
    '      permissions:',
    '        default: ask',
    '        allow:',
    '          - tool: read',
    '            resource:',
    '              kind: subtree',
    '              path: team',
    '        ask:',
    '          - tool: bash',
    '            resource:',
    '              kind: any',
    '        deny:',
    '          - tool: read',
    '            resource:',
    '              kind: subtree',
    '              path: runtime',
  ]
  return [
    '---',
    'schemaVersion: 3',
    `blueprintId: ${bpId}`,
    'revision: "1"',
    ...leaderBlock,
    ...workerBlock,
    'teamEnvelope:',
    '  allow:',
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    '    - request-control',
    '    - resolve-control',
    '  deny: []',
    'memberEnvelopes:',
    '  - templateId: worker',
    '    envelope:',
    '      allow:',
    '        - send-message',
    '        - report-progress',
    '        - request-control',
    '      deny: []',
    'requirements: []',
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

// yaml emitter (exemplar-verbatim)
function yamlScalar(v) { if (v === null) return 'null'; if (typeof v === 'string') return JSON.stringify(v); return String(v) }
function yamlValueLines(value, indent) {
  if (Array.isArray(value)) return value.flatMap((item) => yamlEmitItem(item, indent))
  return Object.entries(value).flatMap(([k, v]) => yamlEmit(k, v, indent))
}
function yamlEmit(key, value, indent) {
  const pad = '  '.repeat(indent)
  if (value !== null && typeof value === 'object') {
    const empty = Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0
    if (empty) return [`${pad}${key}: ${Array.isArray(value) ? '[]' : '{}'}`]
    return [`${pad}${key}:`, ...yamlValueLines(value, indent + 1)]
  }
  return [`${pad}${key}: ${yamlScalar(value)}`]
}
function yamlEmitItem(item, indent) {
  const pad = '  '.repeat(indent)
  if (item === null || typeof item !== 'object') return [`${pad}- ${yamlScalar(item)}`]
  if (Array.isArray(item)) { if (item.length === 0) return [`${pad}- []`]; return [`${pad}-`, ...yamlValueLines(item, indent + 1)] }
  const entries = Object.entries(item)
  const [firstKey, firstValue] = entries[0]
  const firstLines = yamlEmit(firstKey, firstValue, indent + 1)
  const rest = entries.slice(1).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))
  return [`${pad}- ${firstLines[0].slice((indent + 1) * 2)}`, ...firstLines.slice(1), ...rest]
}
function writeTeamPatchFile(patchPath, bootPhase) {
  mkdirSync(dirname(patchPath), { recursive: true })
  const lines = [
    `# A5M2 r18 image C2 gate patch layer (world ${RUN_STAMP}): production row from the FROZEN ${INSTALL_DIR} ROOT-level surface (pin ${SOURCE_PIN_SHA} tgz ${EXPECT_TGZ_SHA}) + p6t6 observability row from the PINNED plugin.mjs (${EXPECT_PLUGIN_SHA}) — public profile-patch seam only (CORE PATCH BUDGET = 0).`,
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig({ bootPhase }) }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    // image mode: REAL normalization via the public profile seam — the base-bundle attachment-local
    // row (base cordis.patch.yml:138) carries NO config, so this replacement states the WHOLE limit +
    // policy set (IMG_STORE_CONFIG, in schema declaration order) instead of resting on defaults.
    // Input 1024x768 passes the 1024 input cap, then the independent policy (512) downscales it to
    // 512x384; the receipt carries originalDimensions 1024x768 — that pair is the positive control.
    ...(FIXTURE === 'image' ? ['- id: attachment-local', "  name: '@deepseek-ai/dsh-attachment-local'", '  config:', ...Object.entries(IMG_STORE_CONFIG).map(([k, v]) => `    ${k}: ${v}`)] : []),
    '',
  ]
  writeFileSync(patchPath, lines.join('\n'))
}

// ── world boot / stop ──────────────────────────────────────────────────────
const liveHosts = new Set()
let WORLD_IDENTITY = null // {dev,ino} registered at use time (L2): any future cleanup must re-assert via assertCleanupTarget
async function assertWorld() {
  // L3 defense-in-depth: re-validate the REGISTERED world against the same law at
  // use time (symlink swap / TOCTOU). Any mismatch dies BEFORE any mkdir/write.
  // This kit performs NO recursive deletes; every write below is under HOME only.
  try {
    const recheck = parseWorldArg({ repoRoot: REPO, homesRoot: HOMES_ROOT, worldArg: WORLD_REL })
    if (recheck.home !== HOME) await dieFatal(`world identity drift: parsed ${recheck.home} != registered ${HOME}`)
    WORLD_IDENTITY = recheck.identity
  } catch (e) {
    await dieFatal(`world-safety re-validation failed: ${String(e?.message ?? e)}`)
  }
  if (!existsSync(HOME)) { await dieFatal(`world missing: ${HOME}`) }
  for (const stale of ['storages', 'sessions']) {
    if (existsSync(join(HOME, stale))) await dieFatal(`world not fresh: ${HOME}/${stale} exists`)
  }
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  writeFileSync(LOCK_FILE, JSON.stringify({ world: HOME, identity: WORLD_IDENTITY, pid: process.pid, kit: 'a5m2-todo-c2.mjs', runStamp: RUN_STAMP, at: new Date().toISOString() }, null, 2))
}
async function bootHost({ label, port, boot, phase }) {
  const instLogDir = join(RUN_DIR, 'instances', label)
  mkdirSync(instLogDir, { recursive: true })
  const instance = new DshInstance({ hostTree: HOST_TREE, dshHome: HOME, port, clientCommitHash: CLIENT_COMMIT_HASH, logDir: instLogDir })
  const rec = { label, port, instance, logPath: null, token: null, cookie: null, origin: null, pid: null }
  writeTeamPatchFile(instance.patchFile, phase)
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({ boot, phase, reportDir: RUN_DIR, runStamp: RUN_STAMP, rootSessionId: ROOT }, null, 2))
  // OVERLAY-13 (root 17:42 item 1): this process HELD the bind-probe socket for this port to keep it
  // race-free; the Host is about to bind the SAME port, so the hold MUST be released here for the
  // port this boot owns — otherwise the kit collides with itself (the earlier fix released only the
  // mock hold). Generic on `port`, no-op when nothing is held.
  await releaseHold(port, `${label} binds it now`)
  const started = await instance.start({ timeoutMs: 240_000 })
  rec.logPath = started.logPath
  rec.pid = instance.child?.pid ?? null
  liveHosts.add(rec)
  const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(started.url)
  if (m === null) await dieFatal(`${label}: unexpected boot url: ${scrubTokens(started.url)}`)
  rec.token = m[2]
  rec.origin = `http://127.0.0.1:${m[1]}`
  rec.cookie = await authenticate(rec.origin, rec.token)
  log(`${label}: booted at ${rec.origin} pid=${rec.pid}; cookie exchanged`)
  const dump = await instance.dumpConfig({ timeoutMs: 60_000 })
  writeFileSync(join(RUN_DIR, 'instances', label, 'dump-config.txt'), dump.text)
  if (!DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME })) await dieFatal(`${label}: production row (${INSTALL_DIR}) not in composed profile dump`)
  if (!DshInstance.rowInDump(dump.text, { id: 'p6t6-team-tools', name: P6T6_ROW_NAME })) await dieFatal(`${label}: p6t6 row (pinned plugin.mjs) not in composed profile dump`)
  const deadline = Date.now() + 240_000
  let hb = null
  for (;;) {
    hb = await p6t6Health(port)
    if (hb.status === 200 && hb.body?.ok === true) break
    if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) {
      await dieFatal(`${label}: row setup failed — ${String(hb.body.setupError).slice(0, 600)}; log tail:\n${logTail(rec.logPath, 30)}`)
    }
    if (Date.now() >= deadline) await dieFatal(`${label}: row health not ready in 240s; log tail:\n${logTail(rec.logPath, 30)}`)
    await new Promise((r) => setTimeout(r, 1000))
  }
  log(`${label}: row ready (health=${jstr(hb.body, 200)})`)
  return rec
}
async function stopHost(rec) {
  try {
    const res = await rec.instance.stop({ timeoutMs: 30_000 })
    log(`${rec.label}: stopped (killed=${res.killed} portFree=${res.portFree})`)
  } finally { liveHosts.delete(rec) }
}
async function sweepLiveHosts() {
  for (const rec of [...liveHosts]) { try { await stopHost(rec) } catch { /* ok */ } }
}
/** ps proof: /proc scan for surviving host processes launched on OUR port. */
function survivingPids(port) {
  const out = []
  for (const pid of readdirSync('/proc').filter((n) => /^\d+$/.test(n))) {
    try {
      const cmd = readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ')
      if (cmd.includes('apps/cli/lib/bin.js') && cmd.includes(`--port ${String(port)}`)) out.push({ pid: Number(pid), cmd: cmd.slice(0, 160) })
    } catch { /* gone */ }
  }
  return out
}

// ── preflight ──────────────────────────────────────────────────────────────
async function preflight() {
  // OVERLAY-7 (pin holdout LAW, root 17:2x + center 17:3x): a pin directory may refuse to be
  // mounted by carrying STATUS-PROVISIONAL.txt. That marker exists right now: the identity is
  // PAUSED (center's `check:artifacts:head` at d5454cb23… = RC 1 / verdict=stale / drift=6 on
  // the control/types + pa-control-bridge TS mirrors, corroborated read-only by this lane; the
  // 516ef0f5 tgz therefore mounts a stale TS-compiled face). The kit cannot be talked past it —
  // the run must wait for the root-issued SHA + fresh pack and the removal of that file.
  if (existsSync(PIN_HOLDOUT_FILE)) {
    await dieFatal(`PIN IDENTITY ON HOLD: ${PIN_HOLDOUT_FILE} exists (source-HEAD ${SOURCE_PIN_SHA}).`
      + ' Nothing was created or mounted. Wait for the root-issued pin SHA + freshly packed tgz, regenerate the pin dir from those bytes, and remove the marker.')
  }
  // Pins (r18: ROOT-level package @ SOURCE_PIN_SHA, see packages-pins/<SHA>/MANIFEST-*.txt)
  const tgzHash = sha256File(PIN_TGZ)
  const pluginHash = sha256File(PIN_PLUGIN)
  // PIN-DIR GATE LAW (root 10:37Z supplement + root 11:24 GO):
  // gate on (1) tgz sha256; (2) FULL path-set equality vs manifest-tgz-entries-C.txt
  // (extra AND missing both fail); (3) deterministic C-order (code-unit) digest vs
  // c…. NO locale-aggregation gates. The center's recorded per-file-recipe
  // tree-sha256 is printed INFO-only for cross-check (@a23d: 78349a43…).
  // FORMAT NOTE (root 11:24 pin): 3def was packed with git archive, which adds 102
  // DIRECTORY records to tar listings; the gate law is the 1811 FILE set (MANIFEST:
  // "extraction file-set unchanged"). Both sides are FILE-ONLY filtered (dir records
  // carry a trailing '/'; manifest lines never do — removing those lines removes
  // exactly the dir records). Equal-strength on both sides; not a fixture change.
  const EXPECT_C_DIGEST = 'a7d35916e6a9b1e67bb351ddec116fa4effe11550e24a0d73a08ff6ab9d9a9ea'
  const rawEntries = execFileSync('tar', ['-tzf', PIN_TGZ], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim().split('\n')
  const dirRecords = rawEntries.filter((p) => p.endsWith('/')).length
  const entries = rawEntries.filter((p) => !p.endsWith('/'))
  const manifestC = readFileSync(join(PIN_DIR, 'manifest-tgz-entries-C.txt'), 'utf8').trim().split('\n').sort()
  const entriesC = [...entries].sort() // JS default = UTF-16 code-unit == LC_ALL=C for these paths
  const missing = manifestC.filter((p) => !entriesC.includes(p))
  const extra = entriesC.filter((p) => !manifestC.includes(p))
  const cDigest = createHash('sha256').update(`${entriesC.join('\n')}\n`).digest('hex')
  const shellSortDigest = execFileSync('bash', ['-c', `tar -tzf ${JSON.stringify(PIN_TGZ)} | grep -v '/$' | sort | sha256sum`], { encoding: 'utf8' }).trim().split(/\s+/)[0]
  log(`PIN tgz sha256 = ${tgzHash} (${tgzHash === EXPECT_TGZ_SHA ? 'MATCH' : 'MISMATCH'}); raw tar records=${rawEntries.length} (dir-records=${dirRecords}); file-entries=${entries.length} (${entries.length === EXPECT_ENTRIES ? 'MATCH' : 'MISMATCH'}); pathset vs C-manifest: missing=${missing.length} extra=${extra.length}; C-order digest = ${cDigest} (${cDigest === EXPECT_C_DIGEST ? 'MATCH' : 'MISMATCH'}); locale-sorted INFO = ${shellSortDigest} (list-sort INFO ${shellSortDigest}; center @19d54 per-file-recipe INFO=d8269843… (different recipe — non-gating))`)
  log(`PIN helper plugin.mjs sha256 = ${pluginHash} (${pluginHash === EXPECT_PLUGIN_SHA ? 'MATCH' : 'MISMATCH'})`)
  if (tgzHash !== EXPECT_TGZ_SHA) await dieFatal(`pinned tgz hash mismatch: ${tgzHash}`)
  if (entries.length !== EXPECT_ENTRIES) await dieFatal(`pinned tgz entries ${entries.length} != ${EXPECT_ENTRIES}`)
  if (missing.length !== 0 || extra.length !== 0) await dieFatal(`path-set vs manifest-tgz-entries-C.txt: missing=${missing.slice(0, 5).join(',')} extra=${extra.slice(0, 5).join(',')}`)
  if (cDigest !== EXPECT_C_DIGEST) await dieFatal(`C-order entry-list digest ${cDigest} != ${EXPECT_C_DIGEST}`)
  if (pluginHash !== EXPECT_PLUGIN_SHA) await dieFatal(`pinned plugin.mjs hash mismatch: ${pluginHash}`)
  // helper bytes must equal the 495 source blob (root 10:30: "pin 471475b9…" at 495)
  const blob495 = createHash('sha256').update(execFileSync('git', ['-C', WORKTREE, 'show', `${SOURCE_PIN_SHA}:packages/tools/harness/plugin.mjs`], { maxBuffer: 16 * 1024 * 1024 })).digest('hex')
  log(`pin-blob packages/tools/harness/plugin.mjs sha256 = ${blob495} (${blob495 === EXPECT_PLUGIN_SHA ? 'MATCH' : 'MISMATCH'} vs pin)`)
  if (blob495 !== EXPECT_PLUGIN_SHA) await dieFatal(`pin helper blob ${blob495} != pinned ${EXPECT_PLUGIN_SHA}`)
  // Worktree provenance: INFO ONLY (the center may advance HEAD; authoritative
  // identity = verified pin tgz + verified install surface + helper pin).
  const head = execFileSync('git', ['-C', WORKTREE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const porcelain = execFileSync('git', ['-C', WORKTREE, 'status', '--porcelain'], { encoding: 'utf8' }).trim()
  log(`worktree (interfaces only, INFO) HEAD=${head} porcelainEmpty=${porcelain === ''} sourcePin=${SOURCE_PIN_SHA}`)
  // Frozen install surface: extract-if-missing + per-file verify vs center
  // manifest (471 install-surface hashes) + a-w.
  if (!existsSync(PRODUCTION_ROW_PATH)) {
    mkdirSync(join(HOME, INSTALL_DIR), { recursive: true })
    execFileSync('tar', ['-xzf', PIN_TGZ, '-C', join(HOME, INSTALL_DIR)])
    execFileSync('chmod', ['-R', 'a-w', join(HOME, INSTALL_DIR, 'package')])
    log('install-19d54bd72 extracted from the pinned tgz (chmod a-w applied)')
  }
  const surfaceManifest = readFileSync(join(PIN_DIR, 'manifest-installsurface-hashes.txt'), 'utf8').trim().split('\n')
  for (const [rootLabel, rootPkg] of [[INSTALL_DIR, INSTALL_PKG], ['mount-helper-root', join(HOME, 'mount-helper-root', 'package')]]) {
    const treeHashes = execFileSync('bash', ['-c', `cd ${JSON.stringify(rootPkg)} && find -type f | sort | xargs sha256sum`], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 })
    writeFileSync(join(RUN_DIR, `install-surface-hashes-${rootLabel}.txt`), treeHashes)
    // FORMAT TOLERANCE (a23d pin): the manifest paths carry the tar 'package/'
    // prefix (hashed with the git-archive prefix); the tree walk says './x'.
    // No legitimate file lives under a top-level 'package/' dir inside the
    // extraction, so stripping one leading 'package/' or './' from each side
    // is unambiguous and equal-strength — the per-path hash gate is unchanged.
    const normSurf = (p) => p.replace(/^\.\//, '').replace(/^package\//, '')
    const byFile = new Map(treeHashes.trim().split('\n').map((l) => [normSurf(l.slice(66)), l.slice(0, 64)]))
    let bad = 0, checked = 0
    for (const line of surfaceManifest) {
      const h = line.slice(0, 64), p = normSurf(line.slice(66))
      checked += 1
      if (byFile.get(p) !== h) bad += 1
    }
    log(`${rootLabel} install-surface re-hash: checked=${checked} bad=${bad} (${bad === 0 ? 'MATCHES-PIN' : 'DRIFT'})`)
    if (bad !== 0) await dieFatal(`${rootLabel} install-surface drift vs pin manifest (${bad}/${checked})`)
  }
  for (const [rootLabel, rootDir] of [[`${INSTALL_DIR}/package`, INSTALL_PKG], ['mount-helper-root/package', join(HOME, 'mount-helper-root', 'package')]]) {
    const writable = execFileSync('bash', ['-c', `find ${JSON.stringify(rootDir)} \\( -type f -perm -u+w \\) | wc -l`], { encoding: 'utf8' }).trim()
    log(`${rootLabel} writable files = ${writable}`)
    if (writable !== '0') await dieFatal(`${rootLabel} not fully a-w (writable=${writable})`)
  }
  // Mount surface existence + NEVER-a-worktree guard + helper placement + nearest manifests
  for (const [label, p] of [['host.js', PRODUCTION_ROW_PATH], ['agent-bindings.mjs', GLUE_PATH], ['seam.mjs', SEAM_PATH], ['mounted helper plugin.mjs', P6T6_PLUGIN_PATH]]) {
    if (!existsSync(p)) await dieFatal(`mount surface missing: ${label} ${p}`)
    if (p.includes('.worktrees')) await dieFatal(`mount path under .worktrees — forbidden: ${p}`)
  }
  const mountedHelperHash = sha256File(P6T6_PLUGIN_PATH)
  log(`mounted helper sha256 = ${mountedHelperHash} (${mountedHelperHash === EXPECT_PLUGIN_SHA ? 'MATCH' : 'MISMATCH'} vs pin)`)
  if (mountedHelperHash !== EXPECT_PLUGIN_SHA) await dieFatal(`mounted helper hash ${mountedHelperHash} != pin`)
  {
    const pkgMeta = JSON.parse(readFileSync(join(INSTALL_PKG, 'package.json'), 'utf8'))
    const helperMeta = JSON.parse(readFileSync(join(HOME, 'mount-helper-root', 'package', 'package.json'), 'utf8'))
    // OVERLAY-18 (root 21:30 — the one product-pin omission behind 307c bash-15524 REAL_RC1, preflight,
    // never booted): the bf4e89e1 package legitimately declares TEN approved DSH peers — center
    // 1d2e97dd7 added @deepseek-ai/dsh-schedule under root's 20:25 ruling — while this identity check
    // still demanded exactly nine, so the nearest-manifest gate refused a legal pin. The check becomes
    // the EXACT approved set, read off the fixed bf4e89e1 manifest: every one of the ten names present
    // at its exact pinned version AND no peer outside that list. This is not a blind 9 -> 10 count and
    // it does not tolerate any extra, renamed or unpinned peer (the exact-value map subsumes the old
    // "every version === 0.2.0-rc.2" clause). No safety or business criterion was touched.
    const EXPECT_PEERS = {
      '@deepseek-ai/dsh': '0.2.0-rc.2',
      '@deepseek-ai/dsh-agent': '0.2.0-rc.2',
      '@deepseek-ai/dsh-llm': '0.2.0-rc.2',
      '@deepseek-ai/dsh-mcp-client': '0.2.0-rc.2',
      '@deepseek-ai/dsh-schedule': '0.2.0-rc.2',
      '@deepseek-ai/dsh-scope': '0.2.0-rc.2',
      '@deepseek-ai/dsh-session': '0.2.0-rc.2',
      '@deepseek-ai/dsh-spill-local': '0.2.0-rc.2',
      '@deepseek-ai/dsh-storage-domain': '0.2.0-rc.2',
      '@deepseek-ai/dsh-tool-fs-search': '0.2.0-rc.2',
    }
    const peersExact = (deps) => {
      const names = Object.keys(deps ?? {})
      const want = Object.entries(EXPECT_PEERS)
      return names.length === want.length && want.every(([n, v]) => deps?.[n] === v)
    }
    for (const [label, meta] of [[`${INSTALL_DIR}/package/package.json`, pkgMeta], ['mount-helper-root/package/package.json', helperMeta]]) {
      const peers = Object.entries(meta.peerDependencies ?? {})
      const ok = meta.name === 'dsh-agent-team' && meta.version === '0.1.1-alpha.2' && peersExact(meta.peerDependencies) && (meta.exports?.['./host'] ?? '').endsWith('/plugin/host.js')
      log(`nearest manifest (${label}): ${meta.name}@${meta.version} peers=${peers.length}x${[...new Set(peers.map(([, v]) => v))].join(',')} (${ok ? 'IDENTITY-OK' : 'IDENTITY-BAD'})`)
      if (!ok) await dieFatal(`root identity manifest bad at ${label}`)
    }
  }
  // Skills: root package ships its own .agents/skills — the plugin's parent
  // locator (7-up from the host.js entry dir) lands INSIDE the extracted install surface.
  for (const rootPkg of [INSTALL_PKG, join(HOME, 'mount-helper-root', 'package')]) {
    for (const s of ['team-blueprint-authoring', 'team-leader-operations']) {
      if (!existsSync(join(rootPkg, '.agents', 'skills', s, 'SKILL.md'))) await dieFatal(`bundled skills missing under ${rootPkg}: ${s}`)
    }
  }
  log('skills attribution: bundled .agents/skills resolves from the production entry (auxiliary locator, disclosed)')
  // OFFLINE FULL-DECLARATION AUDIT (root 10:39 item 4): every manifest claim
  // must be TRUE under BOTH mount roots — including the client-composition face
  // that killed run-2026-10-23T10-37-02. Replicates the host's own derivation
  // (test-use packages/client/modules/lib/index.js: nearest package.json of the
  // row entry + exports["./client"] string, joined under the package dir).
  {
    const auditLines = []
    const audit = (ok, line) => { auditLines.push(`${ok ? 'OK  ' : 'FAIL'} ${line}`); if (!ok) return false; return true }
    let auditOk = true
    const registrySrc = readFileSync(join(TESTUSE, 'packages', 'client', 'modules', 'lib', 'index.js'), 'utf8').split('\n')
    const clientRelLine = registrySrc.findIndex((l) => l.includes('const clientRel = clientExportOf')) + 1
    const joinLine = registrySrc.findIndex((l) => l.includes('clientPath: join(dirname(pkgPath), clientRel)')) + 1
    auditOk = audit(clientRelLine > 0 && joinLine > 0, `host registry derivation located: clientExportOf@L${clientRelLine}, join(dirname(pkgPath), clientRel)@L${joinLine}`) && auditOk
    for (const [rootLabel, rootPkg] of [[INSTALL_DIR, INSTALL_PKG], ['mount-helper-root', join(HOME, 'mount-helper-root', 'package')]]) {
      const meta = JSON.parse(readFileSync(join(rootPkg, 'package.json'), 'utf8'))
      for (const f of meta.files ?? []) auditOk = audit(existsSync(join(rootPkg, f)), `${rootLabel}: files entry ${f}`) && auditOk
      for (const [ex, target] of Object.entries(meta.exports ?? {})) {
        const t = typeof target === 'string' ? target : (target?.import ?? target?.default)
        if (typeof t === 'string') auditOk = audit(existsSync(join(rootPkg, t)), `${rootLabel}: exports["${ex}"] -> ${t}`) && auditOk
      }
      const patchRel = meta.dsh?.bundle?.patch
      if (typeof patchRel === 'string') auditOk = audit(existsSync(join(rootPkg, patchRel)), `${rootLabel}: dsh.bundle.patch -> ${patchRel}`) && auditOk
      if (meta.dsh?.client?.platform === 'web') {
        // registry formula, verbatim:
        const cExp = meta.exports?.['./client']
        const clientRel = typeof cExp === 'string' ? cExp : cExp?.default
        const clientPath = join(rootPkg, clientRel ?? '__missing__')
        let st = null
        try { st = statSync(clientPath) } catch { /* ENOENT -> FAIL below */ }
        auditOk = audit(st !== null && st.isFile(), `${rootLabel}: ClientModuleRegistry clientPath = ${clientPath} stat=${st ? 'FILE' : 'MISSING'}`) && auditOk
      }
      // helper relative leg target (../../runtime/dist/... from tools/harness):
      if (rootLabel === 'mount-helper-root') {
        const leg = join(rootPkg, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'mutation', 'index.js')
        auditOk = audit(existsSync(leg), `${rootLabel}: helper dynamic leg target ${leg.replace(HOME + '/', '')}`) && auditOk
        auditOk = audit(sha256File(join(rootPkg, 'packages', 'tools', 'harness', 'plugin.mjs')) === EXPECT_PLUGIN_SHA, `${rootLabel}: helper bytes == pin 471475b9…`) && auditOk
      }
    }
    writeFileSync(join(RUN_DIR, 'declaration-audit.txt'), auditLines.join('\n') + '\n')
    log(`declaration audit: ${auditLines.length} checks (${auditOk ? 'PASS' : 'FAIL'}), written to RUN_DIR/declaration-audit.txt`)
    if (!auditOk) await dieFatal('OFFLINE FULL-DECLARATION AUDIT FAILED (see declaration-audit.txt)')
  }
  // RESOLUTION PROBE (pre-boot): real import of the three production entries +
  // helper + bare-import census from the REAL world layout, child process.
  const probeScript = `
import { pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'
const targets = ${JSON.stringify({ host: PRODUCTION_ROW_PATH, glue: GLUE_PATH, seam: SEAM_PATH, helper: P6T6_PLUGIN_PATH, 'helper-leg': join(HOME, 'mount-helper-root', 'package', 'packages', 'runtime', 'dist', 'packages', 'runtime', 'mutation', 'index.js') })}
const bare = ['@deepseek-ai/dsh-agent','@deepseek-ai/dsh-llm','@deepseek-ai/dsh-mcp-client','@deepseek-ai/dsh-scope','@deepseek-ai/dsh-session','@deepseek-ai/dsh-spill','@deepseek-ai/dsh-spill-local','@deepseek-ai/dsh-storage-domain','@deepseek-ai/dsh-system-prompt','@deepseek-ai/dsh-tool-fs-search','@deepseek-ai/cordis','zod','yaml']
let fail = 0
for (const s of bare) {
  try { await import(s); console.log('DEP-OK ' + s) } catch (e) { fail += 1; console.log('DEP-FAIL ' + s + ' :: ' + (e?.code ?? e?.name) + ' :: ' + String(e?.message).slice(0, 160)) }
}
// @deepseek-ai/dsh = host virtual kernel: no root export, nothing on the mount
// surface imports it bare (census). Presence + exact-version proof instead:
try {
  const m = JSON.parse(readFileSync(process.cwd() + '/../node_modules/@deepseek-ai/dsh/package.json', 'utf8'))
  console.log('DEP-PRESENT @deepseek-ai/dsh version=' + m.version + ' ' + (m.version === '0.2.0-rc.2' ? 'OK' : 'VERSION-BAD'))
  if (m.version !== '0.2.0-rc.2') fail += 1
} catch (e) { fail += 1; console.log('DEP-FAIL @deepseek-ai/dsh :: ' + (e?.code ?? e?.name)) }
for (const [k, p] of Object.entries(targets)) {
  try { await import(pathToFileURL(p).href); console.log('IMPORT-OK ' + k) } catch (e) { fail += 1; console.log('IMPORT-FAIL ' + k + ' :: ' + (e?.code ?? e?.name) + ' :: ' + String(e?.message).slice(0, 200)) }
}
console.log(fail === 0 ? 'PROBE PASS' : 'PROBE FAIL ' + fail)
process.exit(fail === 0 ? 0 : 1)
`
  try {
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', probeScript], { cwd: INSTALL_PKG, encoding: 'utf8', timeout: 180_000, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
    writeFileSync(join(RUN_DIR, 'resolution-probe.txt'), out)
    log(`resolution probe: PASS (${out.trim().split('\n').length - 1} checks)`)
    if (!existsSync(TESTUSE)) await dieFatal(`fsInstance.rootDir (the world-native session workspace root) does not exist: ${TESTUSE}`)
    log(`fsInstance preflight (root 12:20Z): rootDir=${TESTUSE} exists=true; realm-bound (realmId === teamToolPlane.realmId); kind=absolute-path (a5ie public shape; a23d consumers read rootDir ONLY — agent-bindings.mjs:3045/:2815/:2902); no mkdir, no new root, no cwd change`)
  if (FIXTURE === 'write') {
    mkdirSync(join(TESTUSE, 'examples', 'minimal'), { recursive: true })
    writeFileSync(WF_ABS, WF_INIT)
    const st0 = wfState()
    if (st0.sha !== createHash('sha256').update(Buffer.from(WF_INIT)).digest('hex') || st0.size !== Buffer.byteLength(WF_INIT)) await dieFatal('WRITE-FIXTURE preflight: INIT bytes did not land exactly')
    log(`WRITE-FIXTURE (root 13:01Z): file=${WF_REL} synthesized-EXISTS pre-boot (pre-creation is NOT a product newfile pass); INIT sha=${st0.sha} size=${st0.size}; TGT sha=${WF_TGT_SHA} size=${Buffer.byteLength(WF_TGT)}; deny/cancel attempts=${'WF_DENY/WF_CANCEL never-land'}; gitignored pattern examples/*/*.jsonl; leg zero-change baselines = ACTUAL bytes at each leg start (post-allow = TGT)`)
    writeFileSync(join(RUN_DIR, 'fixture-evidence.json'), JSON.stringify({
      relPath: WF_REL, absPath: WF_ABS, mode: FIXTURE,
      init: { bytes: WF_INIT, sha256: st0.sha, size: st0.size },
      target: { bytes: WF_TGT, sha256: WF_TGT_SHA, size: Buffer.byteLength(WF_TGT) },
      denyAttempt: WF_DENY, cancelAttempt: WF_CANCEL,
    }, null, 2))
  }
  if (FIXTURE === 'image') {
    mkdirSync(join(TESTUSE, 'examples', 'minimal', '.sessions'), { recursive: true })
    const png = synthPng(IMG_W, IMG_H)
    writeFileSync(IMG_ABS, png)
    const sha = createHash('sha256').update(png).digest('hex')
    if (statSync(IMG_ABS).size !== png.length) await dieFatal('IMAGE-FIXTURE preflight: PNG size did not land exactly')
    IMG_SRC_SHA = sha
    storeBaseline = storeCensus()
    log(`IMAGE-FIXTURE (root 14:57): synthetic ${IMG_W}x${IMG_H} PNG file=${IMG_REL} sha256=${sha} size=${png.length} pre-boot (gitignored pattern examples/*/.sessions/ — Host .gitignore untouched); store cap override maxImageDimension=1024 via profile patch layer -> EXPECTED store normalization: 1024x${IMG_NORM_H} preview + originalDimensions ${IMG_W}x${IMG_H} on the receipt; attachment-store census baseline = ${storeBaseline.length} objects (pre-run)`)
    writeFileSync(join(RUN_DIR, 'fixture-evidence.json'), JSON.stringify({
      relPath: IMG_REL, absPath: IMG_ABS, mode: FIXTURE,
      synthetic: { width: IMG_W, height: IMG_H, generator: 'kit synthPng (filter-0 RGB scanlines, zlib level 9, single IDAT, deterministic)', sha256: sha, size: png.length },
      imageLimitsAndPolicy: IMG_STORE_CONFIG,
      controlIdentity: 'NEW independent legal positive control (root 21:41): input 1024x768 inside input cap maxImageDimension 1024, INDEPENDENT policy normalizedImageMaxDimension 512 -> expected 512x384. NOT the recorded 2048x1536 over-cap case (2411037 B, sha256 d6bfd5ebba2b067a58d9532c40b4162574075cd6dca14467892a47c16add48b8, still refused IMAGE_DIMENSION_TOO_LARGE), whose raw and hashes stay as the record.',
      seam: 'profile patch override id=attachment-local; whole limit+policy set restated from the fixed Host639 LocalAttachmentStore.Config schema (index.js:971-983, defaults :896-916)',
      expectedNormalization: { width: IMG_NORM_W, height: IMG_NORM_H, originalDimensions: { width: IMG_W, height: IMG_H } },
      storeCensusBaseline: storeBaseline,
    }, null, 2))
  }
  } catch (e) {
    writeFileSync(join(RUN_DIR, 'resolution-probe.txt'), `${e.stdout ?? ''}\n--stderr--\n${e.stderr ?? ''}\n${e.message}`)
    await dieFatal(`RESOLUTION PROBE FAILED pre-boot (see ${join(RUN_DIR, 'resolution-probe.txt')})\n${String(e.stdout ?? '').slice(0, 1200)}`)
  }
  if (!existsSync(HOST_BIN)) await dieFatal(`host bin missing: ${HOST_BIN} (host not built)`)
  // AUTHORIZED probe fix (root ruling 10:03 item 2): the REAL entry check on
  // the designated built checkout (replaces the faulty <testuse>/lib probe).
  const tuHead = execFileSync('git', ['-C', TESTUSE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const tuPorcelain = execFileSync('git', ['-C', TESTUSE, 'status', '--porcelain'], { encoding: 'utf8' }).trim()
  log(`host runtime ${TESTUSE}: HEAD=${tuHead} porcelainEmpty=${tuPorcelain === ''} bin=${existsSync(HOST_BIN)}`)
  if (tuHead !== HOST_BASELINE_SHA) await dieFatal(`host runtime HEAD ${tuHead} != baseline ${HOST_BASELINE_SHA}`)
  if (tuPorcelain !== '') await dieFatal(`host runtime porcelain not empty:\n${tuPorcelain.slice(0, 500)}`)
}

// ── main ───────────────────────────────────────────────────────────────────
async function main() {
  // direct entry only (main is entry-gated): NOW load harness deps + re-validate CLI
  await loadHarness()
  HOST_BASELINE_SHA = TEST_USE_BASELINE_SHA
  if (FIXTURE !== 'todo' && FIXTURE !== 'write' && FIXTURE !== 'image') await dieFatal(`--fixture invalid: ${FIXTURE}`)
  mkdirSync(RUN_DIR, { recursive: true })
  RUN_LOG = join(RUN_DIR, 'run.log')
  log(`RUN IDENTITY (r18 image C2 re-verification of the r17 lexical-seam fix): MOUNT SURFACE = ROOT package pin ${SOURCE_PIN_SHA} tgz ${EXPECT_TGZ_SHA} (${EXPECT_ENTRIES} file records, install-surface gate 481 lines, tree INFO ${EXPECT_SURFACE_SHA} of the install-surface manifest / ${EXPECT_TREE_SHA} of the full per-file manifest); pin law: PACKAGE == COMMITTED TREE at that SHA except package.json pack normalization (measured compared=1821 missingBlobs=0 drift=1, i.e. 1820/1821 byte-identical), glue 24/24 placements with committed-dist-vs-src drift 0 AND tarball-vs-committed-src drift 0, fsSeam present on the dist face (2+1) — all three re-measured in THIS lane off git blobs and the delivered tarball at the pinned SHA, and NO check:artifacts:head is claimed here because it requires a build this lane never ran; full record ${'packages-pins/' + SOURCE_PIN_SHA}/MANIFEST-bf4e89e1.txt; DELTA vs the b23 mount surface (2188f15ce953977c681dedeb079a36ca27ddbbd7) = +8 dist mirrors (governed-families g1-surface-adapters / g3-fsproc-adapters / g6-session-query / g6-session-query-wiring / schedule-adapters / schedule-wiring / team-adapters / team-wiring), 0 removed, 8 changed (package.json pack normalization; control/types .js/.js.map/.d.ts/.d.ts.map; live/agent-bindings.mjs; live/team-tool-plane.mjs; governed-families/image.mjs carrying the provider-identity supply), and C1 is the discriminator for which of those faces the run actually exercises; SCOPE: image verifies the already-reviewed r17 image scope ONLY — the 957 INSPECT/CONTROL rules and the B-MCP gap are UNWIRED candidates on this surface, not enabled; helper row = ${INSTALL_DIR}-adjacent mount-helper-root plugin.mjs == ${EXPECT_PLUGIN_SHA} (file + blob at ${SOURCE_PIN_SHA}); IMAGE fixture invariants: synthetic ${IMG_W}x${IMG_H} PNG under examples/*/.sessions/ (gitignored, Host .gitignore UNTOUCHED), full store limit+policy set restated via profile-patch override of id=attachment-local (INPUT cap maxImageDimension=${IMG_STORE_CONFIG.maxImageDimension}, INDEPENDENT policy normalizedImageMaxDimension=${IMG_STORE_CONFIG.normalizedImageMaxDimension}) -> REAL normalization ${IMG_NORM_W}x${IMG_NORM_H} + originalDimensions on the receipt; image-capable route = shipped catalog model deepseek-flash (inputModalities text+image; assertImageCapableRoute tool-fs/src/read-image.ts:117-130 same position on the governed row); default ask KEPT, original fsroot/15-Team exclusions/19 global denies KEPT, NO user images; PASS BAR: old parameter-permission rows = 0 for read_image, PA PENDING ZERO store objects (direct census; reads only at the audited execution edge = control-flow INFERENCE, never 'independent read 0'), public allow ONE Control consumption + REAL normalized ref + model-visible ORIGINAL dimensions text + image part byte-identical to the stored object, deny/public-abandon ZERO commits, abandon through the p6t6 abandonControlRequest authority (NOT nativeAbort); ROOT LAWS: ONE round; a criterion's failures stop the run AT that criterion (finishCriterion throws once its checks are recorded — checks themselves record, they do not each throw), and OVERLAY-8a/8b additionally stop inside C3 before any further wait so the run never advances to the next criterion or keeps blind-waiting after a side-effecting dead fact, NO todo emission in image mode (asserted on ledger + session storage + model wire at every leg boundary), requestIds always live from the ledger, forbidden ports [${FORBIDDEN_PORTS.join(', ')}], bind-probed and held until start (port-probe.json), world prefix ${WORLD_PREFIX} under tests/homes only, world + install surface RETAINED (this kit contains no rm/prune/df); r1-r17 pins and evidence KEPT byte-for-byte`)
  REALM_ESC = REALM.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // OVERLAY-12 (read-only validation mode, purely additive). `--validate-only` re-verifies the
  // bundle the way preflight does — pin hashes against the kit constants, the helper blob at the
  // pinned SHA, the Host identity, the port plan — and then STOPS. It never creates or extracts
  // anything, never mounts, never binds a port, never boots: so the executor (and this authoring
  // lane) can prove the bundle is coherent before a world exists.
  if (args.includes('--validate-only')) {
    const bad = []
    const say = (k, v) => log(`VALIDATE ${k} = ${v}`)
    const note = (k, v, ok) => { say(k, v); if (ok !== true) bad.push(k) }
    say('world (guard-validated path; NOT created, NOT touched)', `${HOME} exists=${existsSync(HOME)}`)
    note('homes-root', HOMES_ROOT, !HOMES_ROOT.split('/').includes('.worktrees'))
    note('pin-holdout-marker (must be ABSENT)', `${PIN_HOLDOUT_FILE} exists=${existsSync(PIN_HOLDOUT_FILE)}`, !existsSync(PIN_HOLDOUT_FILE))
    note('pin tgz sha', `${sha256File(PIN_TGZ)} vs ${EXPECT_TGZ_SHA}`, sha256File(PIN_TGZ) === EXPECT_TGZ_SHA)
    note('pin entries', `${readFileSync(join(PIN_DIR, 'manifest-tgz-entries-C.txt'), 'utf8').trim().split('\n').length} file records vs ${EXPECT_ENTRIES}`, readFileSync(join(PIN_DIR, 'manifest-tgz-entries-C.txt'), 'utf8').trim().split('\n').length === EXPECT_ENTRIES)
    note('pin dist-manifest sha', `${sha256File(join(PIN_DIR, 'manifest-tgz-dist-hashes.txt'))} vs ${EXPECT_TREE_SHA}`, sha256File(join(PIN_DIR, 'manifest-tgz-dist-hashes.txt')) === EXPECT_TREE_SHA)
    note('pin install-surface sha', `${sha256File(join(PIN_DIR, 'manifest-installsurface-hashes.txt'))} vs ${EXPECT_SURFACE_SHA}`, sha256File(join(PIN_DIR, 'manifest-installsurface-hashes.txt')) === EXPECT_SURFACE_SHA)
    note('pin helper file sha', `${sha256File(PIN_PLUGIN)} vs ${EXPECT_PLUGIN_SHA}`, sha256File(PIN_PLUGIN) === EXPECT_PLUGIN_SHA)
    let blobSha = 'git-show-failed'
    try { blobSha = createHash('sha256').update(execFileSync('git', ['-C', REPO, 'show', `${SOURCE_PIN_SHA}:packages/tools/harness/plugin.mjs`], { maxBuffer: 32e6 })).digest('hex') } catch { /* reported below */ }
    note('helper BLOB at pinned SHA', blobSha, blobSha === EXPECT_PLUGIN_SHA)
    note('interface tree (paths.mjs baseline)', `${WORKTREE} baseline=${HOST_BASELINE_SHA}`, typeof HOST_BASELINE_SHA === 'string' && /^[0-9a-f]{40}$/.test(HOST_BASELINE_SHA))
    let hostHead = 'git-failed', hostDirty = -1
    try { hostHead = execFileSync('git', ['-C', TESTUSE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); hostDirty = execFileSync('git', ['-C', TESTUSE, 'status', '--porcelain'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean).length } catch { /* reported below */ }
    note('Host639 HEAD == baseline', `${TESTUSE} HEAD=${hostHead} porcelain=${hostDirty}`, hostHead === HOST_BASELINE_SHA && hostDirty === 0)
    note('Host639 runtime entry present', `${HOST_BIN} exists=${existsSync(HOST_BIN)}`, existsSync(HOST_BIN))
    let listeners = []
    try { listeners = execFileSync('ss', ['-ltn'], { encoding: 'utf8' }).split('\n').filter((l) => new RegExp(`:(${[...new Set([...FORBIDDEN_PORTS, ...HOST_PORT_CANDIDATES, ...MOCK_PORT_CANDIDATES])].join('|')})\\b`).test(l)).map((l) => l.trim().split(/\s+/)[3]) } catch { /* ss unavailable */ }
    note('port plan (READ-ONLY ss -ltn; this kit binds NOTHING here)', `listeners-in-family=[${listeners.join(' ') || 'none'}] host-candidates=[${HOST_PORT_CANDIDATES.join(',')}] mock-candidates=[${MOCK_PORT_CANDIDATES.join(',')}] forbidden=[${FORBIDDEN_PORTS.join(',')}]`, true)
    say('mount-helper-root (executor-created, verified by preflight)', `${join(HOME, 'mount-helper-root')} exists=${existsSync(join(HOME, 'mount-helper-root'))}`)
    log(`VALIDATE-ONLY ${bad.length === 0 ? 'OK — bundle coherent. Writes: ONLY this run dir\'s own run.log + validate-only.json under the evidence dir. NO world, NO install surface, NO mount, NO port bound, NO Host or mock started.' : `FAILED: ${bad.join('; ')} (same write footprint)`}`)
    writeFileSync(join(RUN_DIR, 'validate-only.json'), JSON.stringify({ at: new Date().toISOString(), bad, home: HOME, homesRoot: HOMES_ROOT, pin: SOURCE_PIN_SHA, hostHead, hostDirty }, null, 2))
    process.exit(bad.length === 0 ? 0 : 1)
  }
  await preflight()

  // ss -ltn proof before launch
  try {
    const ss = execFileSync('ss', ['-ltn'], { encoding: 'utf8' })
    writeFileSync(join(RUN_DIR, 'ss-ltn-before-launch.txt'), ss)
    log('ss -ltn snapshot written (pre-launch)')
  } catch (e) { log(`ss snapshot failed: ${e.message}`) }

  const HOST_PORT = Number(argValue('host-port', 0)) ? await explicitPort(Number(argValue('host-port', 0)), 'host') : await pickPort(HOST_PORT_CANDIDATES, 'host')
  const MOCK_PORT = Number(argValue('mock-port', 0)) ? await explicitPort(Number(argValue('mock-port', 0)), 'mock') : await pickPort(MOCK_PORT_CANDIDATES, 'mock')
  await writePortProbe()
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`
  process.env.DEEPSEEK_API_KEY = `a5m2c2-mock-${NONCE}`
  log(`RUN_STAMP=${RUN_STAMP} hostPort=${HOST_PORT} mockPort=${MOCK_PORT} realm=${REALM}`)
  log(`world=${HOME} install=${INSTALL} testuse=${TESTUSE}`)

  mkdirSync(join(RUN_DIR, 'git-pre'), { recursive: true })
  const testUsePre = await captureGitState(TESTUSE, join(RUN_DIR, 'git-pre'))
  writeFileSync(join(RUN_DIR, 'testuse-pre.json'), JSON.stringify(testUsePre, null, 2))
  log(`H1 pre: testuse head=${testUsePre.head} statusEmpty=${testUsePre.statusEmpty}`)

  await assertWorld()
  writeFileSync(join(BLUEPRINT_DIR, 'a5m2c2-anchor.yaml'), BP_ANCHOR_YAML)

  await releaseHold(MOCK_PORT, 'mock server binds it now')
  const mock = await startMockModel({ port: MOCK_PORT, decide: makeDecide(), log: (line) => log(`mock: ${line}`) })
  if (mock.port !== MOCK_PORT) await dieFatal(`mock landed on ${mock.port}`)
  mockRef = mock

  let host = null
  try {
    host = await bootHost({ label: 'HOST1', port: HOST_PORT, boot: 1, phase: 'create' })
    EVID.hostLogs.push({ phase: 'create', port: HOST_PORT, logPath: host.logPath })

    // L0: boot-leader surface (native todo_write description bytes + deny list)
    const pDisc = await apiPrompt(host.origin, host.cookie, ROOT, `${MK_DISC} Report your tool inventory, then finish.`, 'l0')
    if (!(pDisc.status === 200 && pDisc.body?.result?.ok === true)) await dieFatal(`L0 prompt not admitted: ${pDisc.status} ${jstr(pDisc.body, 200)}`)
    const discReq = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r.body.messages ?? []).includes(MK_DISC) && Array.isArray(r.body?.tools) && r.body.tools.length > 0, 180_000, 'L0 model request')
    if (discReq === null) await dieFatal('L0 model request not observed')
    const surface = (discReq.body.tools ?? []).map((t) => ({ name: t.function?.name ?? t.name ?? String(t), description: t.function?.description ?? t.description ?? '' }))
    const nativeTodo = surface.find((t) => t.name === 'todo_write')
    if (nativeTodo === undefined) await dieFatal(`native surface missing todo_write (${surface.length} tools)`)
    const denyList = surface.map((t) => t.name).filter((n) => !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n) && !TEAM_TOOL_CATALOG.includes(n) && !OWN_LAYER_SPAWN_TOOLS.includes(n))
    // Fixture invariant (per 495 exemplar law: the deny is NEVER a team-tool
    // deny): a team_* name on the denyList means the catalog drifted from the
    // mounted product generation — fail loud HERE, not at team.create.
    const teamLeak = denyList.filter((n) => n.startsWith('team_'))
    if (teamLeak.length !== 0) await dieFatal(`L0 denyList carries team-tool names (catalog drift): ${teamLeak.join(', ')}`)
    // RULING 10:52 item 3(a): per-name audit denyList ⊆ ACTUAL global surface.
    // The 25-name global vocabulary is the host's own bytes (run-2026-10-23T10-42-00
    // api-transcript restrict error "known global tools:", host 639ed015).
    const HOST_GLOBAL_25 = ['ask_user_question', 'bash', 'create_goal', 'edit', 'exit_plan_mode', 'get_goal', 'glob', 'grep', 'interrupt_agent', 'job_kill', 'job_list', 'job_output', 'list_agents', 'present', 'read', 'read_image', 'send_message', 'skill', 'subagent_fork', 'todo_write', 'update_goal', 'web_fetch', 'web_search', 'workflow', 'write']
    const surfaceNames = surface.map((t) => t.name)
    const missingGlobal = HOST_GLOBAL_25.filter((n) => !surfaceNames.includes(n))
    const outsideGlobal = denyList.filter((n) => !HOST_GLOBAL_25.includes(n))
    const catalogVsGlobal = TEAM_TOOL_CATALOG.filter((n) => HOST_GLOBAL_25.includes(n))
    const denyAuditLines = [
      `host actual global vocabulary (25, provenance: run-2026-10-23T10-42-00/api-transcript.json restrict-error bytes, host 639ed015):`,
      ...HOST_GLOBAL_25.map((n) => `  ${n}`),
      `surface contains all 25 globals: ${missingGlobal.length === 0 ? 'YES' : 'MISSING ' + missingGlobal.join(',')}`,
      ...denyList.map((n) => `deny-name ${n} :: in-actual-globals = ${HOST_GLOBAL_25.includes(n) ? 'YES' : 'NO'}`),
      `denyList outside actual globals: ${outsideGlobal.length === 0 ? 'NONE' : outsideGlobal.join(',')}`,
      `team catalog vs globals (must be disjoint): ${catalogVsGlobal.length === 0 ? 'DISJOINT' : 'OVERLAP ' + catalogVsGlobal.join(',')}`,
    ]
    // 3(b): the 15-name catalog provenance — derived AT RUNTIME from the 495
    // tracked exemplar source + the captured rc.2 live fixture, then compared
    // name-for-name with the kit's by-name catalog (no prefix rules anywhere).
    const fiSrc = execFileSync('git', ['-C', WORKTREE, 'show', `${SOURCE_PIN_SHA}:tests/kits/rc2-real-host-smoke/fixture-invariants.mjs`], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
    const fiBlock = fiSrc.slice(fiSrc.indexOf('TEAM_TOOL_CATALOG = Object.freeze(['))
    const fiNames = [...fiBlock.slice(0, fiBlock.indexOf('])')).matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
    const fiFixture = execFileSync('git', ['-C', WORKTREE, 'show', `${SOURCE_PIN_SHA}:tests/kits/rc2-real-host-smoke/fixtures/captured-0.2.0-rc.2/model-request-0.2.0-rc.2-agent-first-turn-0001.json`], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
    const fxTeamNames = [...new Set([...fiFixture.matchAll(/"name":\s*"(team_[a-z_]+)"/g)].map((m) => m[1]))]
    const fiEq = fiNames.length === 15 && fiNames.every((n) => TEAM_TOOL_CATALOG.includes(n)) && TEAM_TOOL_CATALOG.every((n) => fiNames.includes(n))
    const fxCover = TEAM_TOOL_CATALOG.every((n) => fxTeamNames.includes(n))
    denyAuditLines.push(
      `catalog provenance: exemplar fixture-invariants.mjs@${SOURCE_PIN_SHA.slice(0, 7)} L52-68 names=${fiNames.length} equal-to-kit-catalog=${fiEq ? 'YES' : 'NO'}; captured rc.2 fixture model-request-...-0001.json team names=${fxTeamNames.length} covers-all-15=${fxCover ? 'YES' : 'NO (' + TEAM_TOOL_CATALOG.filter((n) => !fxTeamNames.includes(n)).join(',') + ')'}`,
    )
    writeFileSync(join(RUN_DIR, 'preflight-deny-audit.txt'), denyAuditLines.join('\n') + '\n')
    log(`deny audit: globals-on-surface=${missingGlobal.length === 0} deny-subset-globals=${outsideGlobal.length === 0} disjoint=${catalogVsGlobal.length === 0} provenance exemplar=${fiEq} fixture=${fxCover} (RUN_DIR/preflight-deny-audit.txt)`)
    if (missingGlobal.length !== 0) await dieFatal(`actual host global vocabulary drifted from the 25-name capture: missing ${missingGlobal.join(', ')}`)
    if (outsideGlobal.length !== 0) await dieFatal(`denyList names outside actual globals: ${outsideGlobal.join(', ')}`)
    if (catalogVsGlobal.length !== 0) await dieFatal(`team catalog overlaps the global vocabulary: ${catalogVsGlobal.join(', ')}`)
    if (!fiEq || !fxCover) await dieFatal(`team catalog provenance check FAILED (exemplar-equal=${fiEq} fixture-covers=${fxCover})`)
    let nativeImage = null
    if (FIXTURE === 'image') {
      nativeImage = surface.find((t) => t.name === 'read_image')
      if (nativeImage === undefined) await dieFatal(`native surface missing read_image (${surface.length} tools) — the image fixture has nothing to bind`)
    }
    let nativeWrite = null
    if (FIXTURE === 'write') {
      nativeWrite = surface.find((t) => t.name === 'write')
      if (nativeWrite === undefined) await dieFatal(`native surface missing write (${surface.length} tools) — the write fixture has nothing to bind`)
      log(`L0 native write description ${nativeWrite.description.length} bytes (write fixture)`)
    }
    writeFileSync(join(RUN_DIR, 'l0-surface.json'), JSON.stringify({ count: surface.length, names: surface.map((t) => t.name), nativeTodoDescription: nativeTodo.description, ...(nativeWrite === null ? {} : { nativeWriteDescription: nativeWrite.description }), ...(nativeImage === null ? {} : { nativeImageDescription: nativeImage.description, nativeImageParameters: nativeImage.parameters }), denyList }, null, 2))
    log(`L0 surface ${surface.length} tools; native todo_write description ${nativeTodo.description.length} bytes`)
    {
      // root 12:20Z ruling: instance-binding/session consistency — the mount's
      // governed root must BE the session workspace root (same cwd, no second
      // root). Boot session's durable projcache identity.cwd is that evidence.
      const pcPath = join(HOME, 'storages', 'session_projcache', 'sessions', `${ROOT}.json`)
      let pcCwd = null
      try { pcCwd = JSON.parse(readFileSync(pcPath, 'utf8'))?.record?.identity?.cwd ?? null } catch { pcCwd = null }
      log(`fsInstance<->session consistency: boot-session projcache identity.cwd = ${jstr(pcCwd, 120)} (${pcCwd === TESTUSE ? 'EQUALS mount rootDir' : 'MISMATCH'})`)
      if (pcCwd !== TESTUSE) await dieFatal(`fsInstance root/session binding mismatch: projcache cwd ${jstr(pcCwd, 120)} != ${TESTUSE}`)
    }
    writeFileSync(join(BLUEPRINT_DIR, 'a5m2c2-todo.yaml'), savedBlueprintYaml(BP_TODO_ID, denyList))
    if ((await waitForMock(mock, (r) => r.reply?.content === DONE_DISC, 120_000, 'L0 turn')) === null) await dieFatal('L0 turn did not complete')

    // Create the gated team
    const createP = await remoteCallReady(host, 'team.create', { rootSessionId: ROOT_P, blueprintId: BP_TODO_ID }, 'create', 1)
    if (resultError(createP.body) !== null) await dieFatal(`team.create failed: ${jstr(resultError(createP.body), 400)}`)
    log(`team created at ${ROOT_P}`)

    // ── C1/C2/C3/C4 driver: leader creates w1 + async delegates WORK1 ─────
    const p1 = await apiPrompt(host.origin, host.cookie, ROOT_P, `${MK_CREATE} Create worker w1 from template worker, then delegate task W1 asynchronously.`, 'c1')
    if (!(p1.status === 200 && p1.body?.result?.ok === true)) await dieFatal(`C1 leader prompt not admitted: ${p1.status}`)
    if ((await waitForMock(mock, (r) => r.reply?.content === DONE_CREATE, 240_000, 'leader create+delegate')) === null) await dieFatal('leader create+delegate did not complete')

    const row1 = await waitForTodoRow(host, (p) => FIXTURE === 'image' ? p.toolName === 'read_image' : FIXTURE === 'write' ? p.toolName === 'write' : (TODO_CORR_RE().test(String(p.correlation ?? '')) && p.toolName === 'todo_write'), 180_000, `C1 governed ${ROW_TOOL} row`)
    if (row1 === null) {
      check('C1', `a durable governed Control row was created for the member ${ROW_TOOL} call`, false, `recorded rows: ${jstr(readLedger().recorded.map((f) => ({ rid: f.payload.requestId, corr: f.payload.correlation, tool: f.payload.toolName })), 1500)}`)
      finishCriterion('C1') // throws FirstFailureStop (no childSid exists yet on this path; the boundary law runs from the row-bound leg on)
    }
    const W1 = row1.payload.targetInstanceId
    const childSid = childSessionOf(W1)
    if (childSid === null) await dieFatal(`childSessionId for member ${W1} not found in the durable operations table`)
    log(`governed todo row: requestId=${row1.payload.requestId} correlation=${row1.payload.correlation} target=${W1} child=${childSid}`)

    // member model surface: captured native description bytes
    const memberReq = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r.body.messages ?? []).includes(MK_WORK1) && Array.isArray(r.body?.tools) && r.body.tools.some((t) => (t.function?.name ?? t.name) === ROW_TOOL), 180_000, `member model request with ${ROW_TOOL}`)
    if (memberReq === null) {
      check('C1', 'the member model-facing surface carries todo_write', false, 'no member model request with todo_write observed')
      assertNoTodoInImageMode('C1', childSid, 'row-bound')
      finishCriterion('C1')
    }
    const memberTodo = (memberReq.body.tools ?? []).map((t) => t.function ?? t).find((t) => t.name === ROW_TOOL)
    const nativeRef = FIXTURE === 'image' ? nativeImage : FIXTURE === 'write' ? nativeWrite : nativeTodo
    check('C1', `the member surface carries ${ROW_TOOL} with the CAPTURED NATIVE description bytes (== boot-leader native surface text)`,
      typeof memberTodo?.description === 'string' && memberTodo.description === nativeRef.description,
      `member ${String(memberTodo?.description).length}B vs native ${nativeRef.description.length}B; identical=${memberTodo?.description === nativeRef.description}`)
    const rpW = row1.payload.reviewPayload ?? {}
    const tmW = rpW.targetManifest ?? {}
    const memberW = rpW.member ?? {}
    const corrSegs = String(row1.payload.correlation ?? '').split(':')
    const oldGateRows = readLedger().recorded.filter((f) => (f.payload ?? {}).actionName === 'parameter-permission').length
    // root 14:22 ruling: NO write.r internal plan-name matching. Verify THIS live
    // call's real Control requestId, toolName=write, PA-bridge correlation bound to
    // root/member/realm, the COMPLETE manifest target, and the content-bound
    // parametersFingerprint — not a bare includes('plane-write').
    const writeRowBound = row1.payload.toolName === 'write'
      && row1.payload.actionName === 'team-tool-execute'
      && row1.payload.kind === 'leader-approval'
      && /^ctrl-[a-z0-9]+$/.test(String(row1.payload.requestId ?? ''))
      && String(row1.payload.correlation ?? '').startsWith(`pa:tadm:${ROOT_P}:`)
      && corrSegs[3] === row1.payload.targetInstanceId && /^inst-[a-z0-9]+$/.test(String(corrSegs[3]))
      && /:g\d+:plane-write:/.test(String(row1.payload.correlation ?? ''))
      && String(row1.payload.correlation ?? '').endsWith(`${REALM}-1`)
      && memberW.instanceId === row1.payload.targetInstanceId
      && memberW.teamSessionId === ROOT_P
      && rpW.realmId === REALM
      && tmW.familyId === 'B-WRITE' && tmW.operation === 'write-existing-file' && tmW.adapterRevision === 1
      && tmW.existingFileOnly === true
      && tmW.canonicalTarget === WF_ABS
      && tmW.contentFingerprint === `sha256:${WF_TGT_SHA}`
      && (rpW.effects ?? []).some((e) => e.kind === 'write' && e.resource?.canonicalLocator === WF_ABS && e.resource?.realmId === REALM && String(e.resource?.rights) === 'write')
      && /^sha256:[0-9a-f]{64}$/.test(String(rpW.parametersFingerprint ?? ''))
      && oldGateRows === 0
    // root 14:57 image row: the SAME same-call binding law, image fields (plane-image lane,
    // B-IMAGE/read-exact-file/adapterRevision 2, pure-lexical canonicalTarget, declared mediaType,
    // store-min byteCap, read effect locator). No fuzzy lane word.
    const imageRowBound = row1.payload.toolName === 'read_image'
      && row1.payload.actionName === 'team-tool-execute'
      && row1.payload.kind === 'leader-approval'
      && /^ctrl-[a-z0-9]+$/.test(String(row1.payload.requestId ?? ''))
      && String(row1.payload.correlation ?? '').startsWith(`pa:tadm:${ROOT_P}:`)
      && corrSegs[3] === row1.payload.targetInstanceId && /^inst-[a-z0-9]+$/.test(String(corrSegs[3]))
      && /:g\d+:plane-image:/.test(String(row1.payload.correlation ?? ''))
      && String(row1.payload.correlation ?? '').endsWith(`${REALM}-1`)
      && memberW.instanceId === row1.payload.targetInstanceId
      && memberW.teamSessionId === ROOT_P
      && rpW.realmId === REALM
      && tmW.familyId === 'B-IMAGE' && tmW.operation === 'read-exact-file' && tmW.adapterRevision === 2
      && tmW.canonicalTarget === IMG_ABS
      && tmW.declaredMediaType === 'image/png'
      && Number.isInteger(tmW.byteCap) && tmW.byteCap > 0
      && (rpW.effects ?? []).some((e) => e.kind === 'tool-invoke' && e.toolName === 'read_image')
      && (rpW.effects ?? []).some((e) => e.kind === 'read' && e.resource?.canonicalLocator === IMG_ABS && e.resource?.realmId === REALM && String(e.resource?.rights) === 'read')
      && /^sha256:[0-9a-f]{64}$/.test(String(rpW.parametersFingerprint ?? ''))
      && oldGateRows === 0
    check('C1', FIXTURE === 'image'
      ? 'the call ran the GOVERNED row: SAME live call verified end-to-end — real requestId (ctrl-*), toolName=read_image, PA-bridge correlation binding root + member + realm (plane-image lane), complete pure-lexical manifest (B-IMAGE/read-exact-file/rev2/canonicalTarget=fixture/image+png declaredMediaType/store-min byteCap) + read-effect locator, parametersFingerprint (sha256:64hex), and ZERO old parameter-permission rows for read_image (root 14:57: the hand-off EMPIRICALLY opens the old front door at zero)'
      : `the call ran the GOVERNED row: SAME live call verified end-to-end — real requestId (ctrl-*), toolName=write, PA-bridge correlation binding root ${'+'} member ${'+'} realm (plane-write lane), complete manifest target (B-WRITE/write-existing-file/existingFileOnly/canonicalTarget=fixture/contentFingerprint=sha256(WF_TGT)) ${'+'} write-effect locator, content-bound parametersFingerprint (sha256:64hex), and ZERO old parameter-permission rows (root 14:22 criterion; no write.r plan-name matching)`,
      FIXTURE === 'image'
        ? imageRowBound
        : FIXTURE === 'write'
          ? writeRowBound
          : (TODO_CORR_RE().test(String(row1.payload.correlation ?? '')) && row1.payload.toolName === 'todo_write' && String(row1.payload.correlation ?? '').includes(`plane-todo:${REALM}-`)),
      `oldGateRows=${oldGateRows} row=${jstr(row1, 1900)}`)
    assertNoTodoInImageMode('C1', childSid, 'row-bound')
    finishCriterion('C1')

    // C2: zero todo/write while pending (first ensure the member's session
    // log file exists at all — bounded poll; an absent file would make the
    // zero-check vacuous)
    let memberLog = readMemberTodoLog(childSid)
    const fileDeadline = Date.now() + 45_000
    for (;;) {
      memberLog = readMemberTodoLog(childSid)
      if (memberLog.files.length > 0) break
      if (Date.now() >= fileDeadline) break
      await new Promise((r) => setTimeout(r, 1000))
    }
    const leg1Start = FIXTURE === 'write' ? wfState() : null
    if (FIXTURE === 'write') {
      const nowS = wfState()
      check('C2', `while row ${row1.payload.requestId} is PENDING, the fixture file is UNCHANGED vs its bytes at leg start (zero modification; sha+size)`,
        leg1Start.sha !== null && nowS.sha === leg1Start.sha && nowS.size === leg1Start.size && memberLog.files.length > 0,
        `legStart=${JSON.stringify(leg1Start)} now=${JSON.stringify(nowS)} sessionFiles=${memberLog.files.length}`)
    }
    if (FIXTURE === 'image') {
      const pendStore = storeCensus()
      const imgNow = (() => { try { const b = readFileSync(IMG_ABS); return { sha: createHash('sha256').update(b).digest('hex'), size: b.length } } catch { return { sha: null, size: -1 } } })()
      check('C2', `while row ${row1.payload.requestId} is PENDING: ZERO committed attachment objects (store census == pre-run baseline ${storeBaseline.length}) and the source PNG bytes UNCHANGED — DIRECT facts: the store census and the file bytes; reads occur only on the audited execution edge (pre-consumption read = control-flow INFERENCE at the classified edge, never an independent read-counter claim; root 14:57 law)`,
        pendStore.length === storeBaseline.length && imgNow.sha === IMG_SRC_SHA && imgNow.size === statSync(IMG_ABS).size && memberLog.files.length > 0,
        `census=${pendStore.length} baseline=${storeBaseline.length} png=${JSON.stringify(imgNow)} expectedSha=${IMG_SRC_SHA} sessionFiles=${memberLog.files.length}`)
    } else {
      check('C2', `while row ${row1.payload.requestId} is PENDING, the member session log has ZERO todo/write entries`,
        memberLog.rows.length === 0 && memberLog.files.length > 0,
        `todo/write rows=${memberLog.rows.length}; session files=${memberLog.files.length} (${memberLog.files.join(', ').slice(0, 300)})`)
    }
    assertNoTodoInImageMode('C2', childSid, 'pending')
    finishCriterion('C2')

    // C3: public ALLOW over remote v4 -> unique consumption -> exactly one append
    const resA = await remoteCallReady(host, 'team.resolveControl', { teamSessionId: ROOT_P, requestId: row1.payload.requestId, decision: 'allow', note: 'a5m2c2 C3 public allow' }, 'res-c3', 4)
    const dataA = resultData(resA.body)
    check('C3', 'PUBLIC allow over the remote v4 team.resolveControl wire (closed success envelope, host-derived HUMAN decider)',
      resultError(resA.body) === null && dataA?.decision?.requestId === row1.payload.requestId && dataA?.decision?.decision === 'allow' && dataA?.decision?.decider?.kind === 'human',
      `status=${resA.status} data=${jstr(dataA, 500)}`)
    // Root 15:27 (post-r17, no new run authorized): HTTP 200 on the resolve
    // wire is NOT an approval. When the DURABLE decision answers this row
    // TERMINALLY with anything other than 'allow' (r17: an allow REQUEST
    // answered decision=deny), no consumption can ever arrive and no
    // append/model-visible step can follow — stop this criterion NOW and go
    // straight to the first-failure teardown instead of waiting out the
    // 90s ledger wait, the 120s append wait and the model-visible wait for
    // an impossible fact. r17's raw (which waited them out in full, ~6m31s
    // after the first failing judgement) is evidence and is NOT rewritten.
    const terminalA = resultError(resA.body) === null
      && dataA?.decision?.requestId === row1.payload.requestId
      && dataA?.decision?.decision !== 'allow'
    if (terminalA) {
      log(`C3: TERMINAL durable decision ${jstr(dataA?.decision?.decision, 40)} (reason=${jstr(dataA?.decision?.reason ?? null, 120)}) answered on requestId ${row1.payload.requestId} — HTTP ${resA.status} is NOT approval; deliberately NOT running the consumption/append/model-visible waits (root 15:27); stopping now`)
      writeFileSync(join(RUN_DIR, 'control-consumption-evidence.json'), JSON.stringify({
        requestId: row1.payload.requestId,
        requestRow: row1,
        terminalDecisionFromWire: dataA?.decision ?? null,
        note: 'terminal guard (root 15:27): non-allow durable decision observed on the allow leg; consumption/append/model-visible waits deliberately NOT run — this file is the wire raw of that stop',
      }, null, 2))
      finishCriterion('C3')
    }
    const consumed = await waitForLedgerFact(host, 'control-allow-consumed', row1.payload.requestId, 90_000, 'C3 consumption fact')
    const ledA = await remoteControlFacts(host)
    const fileCrossA = readLedger()
    // EVIDENCE LAW artifact (root ruling 3): the CONTROL consumption evidence
    // — the durable ledger facts for row 1 (remote wire + durable-file
    // cross-check), captured separately from the PA-edge witness.
    writeFileSync(join(RUN_DIR, 'control-consumption-evidence.json'), JSON.stringify({
      requestId: row1.payload.requestId,
      requestRow: row1,
      wire: {
        decisions: ledA['control-decision-recorded'].filter((f) => f.payload.requestId === row1.payload.requestId),
        consumptions: ledA['control-allow-consumed'].filter((f) => f.payload.requestId === row1.payload.requestId),
      },
      durableFileCrossCheck: {
        decisions: fileCrossA.decisions.filter((f) => f.payload.requestId === row1.payload.requestId),
        consumptions: fileCrossA.consumptions.filter((f) => f.payload.requestId === row1.payload.requestId),
      },
    }, null, 2))
    check('C3', 'exactly ONE control-allow-consumed durable fact for that requestId',
      consumed !== null && ledA['control-allow-consumed'].filter((f) => f.payload.requestId === row1.payload.requestId).length === 1,
      `consumptions=${jstr(ledA['control-allow-consumed'].filter((f) => f.payload.requestId === row1.payload.requestId), 400)}`)
    // OVERLAY-8a (root 15:27 law GENERALIZED to "stop at the first SUBSTANTIVE failure"): the
    // consumption fact above is the gate for everything below. If it is already false, the
    // append wait and the model-visible wait cannot succeed, so they are NOT run — r17 burned
    // ~6m31s in exactly those chained waits after a fact that was already dead.
    assertNoTodoInImageMode('C3', childSid, 'allow-consumed')
    const consumptionOk = consumed !== null && ledA['control-allow-consumed'].filter((f) => f.payload.requestId === row1.payload.requestId).length === 1
    if (!consumptionOk) {
      writeFileSync(join(RUN_DIR, 'c3-first-failure-stop.json'), JSON.stringify({
        at: new Date().toISOString(), requestId: row1.payload.requestId,
        consumptionFacts: ledA['control-allow-consumed'].filter((f) => f.payload.requestId === row1.payload.requestId),
        decisions: ledA['control-decision-recorded'].filter((f) => f.payload.requestId === row1.payload.requestId),
        note: 'OVERLAY-8a: ONE-consumption fact false -> append wait and model-visible wait deliberately NOT run',
      }, null, 2))
      log('C3 FIRST-SUBSTANTIVE-FAILURE STOP: ONE-consumption fact is false; append/model-visible waits skipped')
      finishCriterion('C3')
    }
    // wait for the effect to surface (per fixture: todo = session append; write = file bytes;
    // image = ATTACHMENT-STORE object. OVERLAY-8b: for IMAGE the kit never polls session
    // todo/write rows — that row cannot exist in image mode, and doing so was a guaranteed
    // 120 s stall on every image run.)
    const appendDeadline = Date.now() + 120_000
    // OVERLAY-17b (root 18:52 narrow scope BLOCK): these helpers were declared INSIDE the first
    // image branch, which closes before the model-visible block below — the second block's references
    // would have thrown ReferenceError on the success path. They now live in the C3 COMMON scope, the
    // only place both image blocks can see them, with behaviour unchanged.
    // OVERLAY-17 (root 8595 card, replacing the OVERLAY-16 predicate shape): a tool/result PAIRED
    // TO THIS CALL carrying is_error === true IS the terminal failure. No 'Error:' prefix and no
    // P_ code is required — the r18 wire happened to carry "Error: refused-image P_…", but the
    // authoritative field is the session message's isError (payload-validation requires it to be a
    // boolean) mapped to the wire's is_error by the provider serializer, and a refusal rendered as
    // plain JSON would otherwise be missed. A P_ code, when present, is recorded as a DIAGNOSTIC
    // only. Binding claim, stated narrowly: the reader matches the tool name + file_path inside the
    // single-call window and then requires the is_error block's tool_use_id to be the ONE
    // read_image(IMG_REL) id seen on the wire so far; that is a unique-id match on the model wire,
    // NOT a row-level binding to the durable requestId (the row carries no tool-call id).
    // ERROR BEATS EFFECT (root card): the terminal check runs BEFORE the store-increment check in
    // this loop, and it is re-checked inside the model-visible wait below — an attachment object
    // appearing next to a failed call must not buy another 180 s of blind waiting.
    const wireImageCallIds = () => {
      const ids = new Set()
      for (const r of mockRef?.requests ?? []) {
        for (const m of (r?.body?.messages ?? [])) {
          if (m?.role !== 'assistant' || !Array.isArray(m.content)) continue
          for (const b of m.content) {
            if (b?.type === 'tool_use' && b?.name === 'read_image' && b?.input?.file_path === IMG_REL) ids.add(b.id)
          }
        }
      }
      return ids
    }
    // Structural pair, C3-local (the shared denialPairSeen used by C4/C5 is untouched): the same
    // call's tool result, accepted on is_error === true alone, whatever the text looks like.
    const pairedErrorThisCall = (msgs) => {
      const uses = new Set()
      for (const m of msgs ?? []) {
        if (m?.role !== 'assistant' || !Array.isArray(m.content)) continue
        for (const b of m.content) {
          if (b?.type === 'tool_use' && b?.name === 'read_image' && b?.input?.file_path === IMG_REL) uses.add(b.id)
        }
      }
      if (uses.size === 0) return null
      for (const m of msgs ?? []) {
        if (m?.role === 'tool' && uses.has(m.tool_call_id ?? '') && m.is_error === true) {
          return { callId: m.tool_call_id, text: toolResultText(m.content ?? '') }
        }
        if (!Array.isArray(m?.content)) continue
        for (const b of m.content) {
          if (b?.type === 'tool_result' && uses.has(b.tool_use_id ?? '') && b.is_error === true) {
            return { callId: b.tool_use_id, text: toolResultText(b.content ?? '') }
          }
        }
      }
      return null
    }
    const sameCallTerminalError = () => {
      const ids = [...wireImageCallIds()]
      if (ids.length !== 1) return { unique: false, observed: ids, hit: null }
      for (const r of mockRef?.requests ?? []) {
        const hit = pairedErrorThisCall(r?.body?.messages ?? [])
        if (hit !== null && hit.callId === ids[0]) return { unique: true, observed: ids, hit }
      }
      return { unique: true, observed: ids, hit: null }
    }
    // The one stop path for a same-call terminal result (raw preserved; C3 failed; nothing
    // downstream runs; teardown still goes through the normal finally).
    const c3TerminalStop = (hit, binding, where) => {
      const codeMatch = /\bP_[A-Z0-9_]{4,}\b/.exec(hit.text)
      writeFileSync(join(RUN_DIR, 'c3-first-failure-stop.json'), JSON.stringify({
        at: new Date().toISOString(),
        requestId: row1.payload.requestId,
        reason: `OVERLAY-17: the same call's tool result is terminal (is_error=true, paired by tool_use_id; ${where}) -> criterion ended immediately; no further effects or waits`,
        sameCallPairing: {
          pairedCallId: hit.callId,
          uniqueImageCallIdOnWireSoFar: true,
          observedImageCallIds: binding?.observed ?? [hit.callId],
          scope: 'model-wire pair on tool name + file_path inside the single-call window; NOT a row-level binding to requestId',
          reader: "mockRef.requests[*].body.messages, accepted on is_error === true alone (no prefix/code requirement); C4/C5's shared denialPairSeen untouched",
        },
        terminalToolResult: { callId: hit.callId, codeIfAny: codeMatch ? codeMatch[0] : null, rawText: hit.text },
        storeCensus: storeCensus(), baseline: storeBaseline,
      }, null, 2))
      check('C3', "the consumed allow reached the model as an image (no is_error tool result paired to this call)", false,
        `callId=${hit.callId} code=${codeMatch ? codeMatch[0] : 'none (not required)'} raw=${jstr(hit.text, 700)}`)
      log(`C3 FIRST-SUBSTANTIVE-FAILURE STOP: same-call terminal tool result is_error=true (callId=${hit.callId}${codeMatch ? ' code=' + codeMatch[0] : ''}; ${where}); store/model-visible waits skipped`)
      finishCriterion('C3')
    }
    if (FIXTURE === 'write') {
      for (;;) {
        if (wfState().sha === WF_TGT_SHA) break
        if (Date.now() >= appendDeadline) break
        await new Promise((r) => setTimeout(r, 1000))
      }
    } else if (FIXTURE === 'image') {
      let terminalImgErr = null
      let terminalBinding = null
      for (;;) {
        const probe = sameCallTerminalError()
        if (probe.hit !== null) { terminalImgErr = probe.hit; terminalBinding = probe; break }
        if (storeCensus().filter((o) => !storeBaseline.some((b) => b.rel === o.rel)).length >= 1) break
        if (Date.now() >= appendDeadline) break
        await new Promise((r) => setTimeout(r, 1000))
      }
      if (terminalImgErr !== null) c3TerminalStop(terminalImgErr, terminalBinding, 'effect wait')
      const gained = storeCensus().filter((o) => !storeBaseline.some((b) => b.rel === o.rel))
      if (gained.length === 0) {
        writeFileSync(join(RUN_DIR, 'c3-first-failure-stop.json'), JSON.stringify({
          at: new Date().toISOString(), requestId: row1.payload.requestId,
          note: 'OVERLAY-8b: allow was consumed but the attachment store gained NO object within the bounded wait -> the model-visible envelope is unreachable; 180 s wait skipped',
          storeCensus: storeCensus(), baseline: storeBaseline,
        }, null, 2))
        check('C3', 'the consumed allow produced EXACTLY ONE new attachment-store object (the normalized raster the model will be shown)', false, `gained=0 baseline=${storeBaseline.length} now=${storeCensus().length}`)
        log('C3 FIRST-SUBSTANTIVE-FAILURE STOP: no store object; model-visible wait skipped')
        finishCriterion('C3')
      }
      log(`C3: attachment store moved (+${storeCensus().filter((o) => !storeBaseline.some((b) => b.rel === o.rel)).length}) before the model-visible wait`)
    } else {
      for (;;) {
        memberLog = readMemberTodoLog(childSid)
        if (memberLog.rows.length >= 1) break
        if (Date.now() >= appendDeadline) break
        await new Promise((r) => setTimeout(r, 1000))
      }
    }
    if (FIXTURE === 'write') {
      const nowB = readFileSync(WF_ABS)
      check('C3', 'the fixture file bytes equal the model-submitted TARGET content EXACTLY (one correct content write)',
        nowB.equals(Buffer.from(WF_TGT)), `sha=${wfState().sha} size=${nowB.length} expected sha=${WF_TGT_SHA} size=${Buffer.byteLength(WF_TGT)} actual-head=${JSON.stringify(nowB.subarray(0, 80).toString('utf8'))}`)
      let fxPrev = {}
      try { fxPrev = JSON.parse(readFileSync(join(RUN_DIR, 'fixture-evidence.json'), 'utf8')) } catch { /* keep */ }
      writeFileSync(join(RUN_DIR, 'fixture-evidence.json'), JSON.stringify({ ...fxPrev, afterAllow: { bytes: nowB.toString('utf8'), sha256: wfState().sha, size: nowB.length } }, null, 2))
    } else if (FIXTURE === 'image') {
      let imgPair = null
      let imgReq = null
      // OVERLAY-17: the same-call terminal tool result ends this wait too. An attachment object may
      // exist while the call still failed (the store write is not the tool's own verdict), so waiting
      // out 180 s for an envelope that can never arrive is not allowed.
      let terminalImgErr2 = null
      let terminalBinding2 = null
      await waitForMock(mock, (r) => {
        // error BEFORE success: an envelope that is present must not mask this call's terminal result.
        const probe = sameCallTerminalError()
        if (probe.hit !== null) { terminalImgErr2 = probe.hit; terminalBinding2 = probe; return true }
        const pair = imageVisiblePair(r.body?.messages ?? [])
        if (pair !== null) { imgPair = pair; imgReq = r; return true }
        return false
      }, 180_000, 'C3 model-visible image result (native two-block envelope with the ORIGINAL-frame clause), or the terminal is_error result paired to this call')
      if (terminalImgErr2 !== null) c3TerminalStop(terminalImgErr2, terminalBinding2, 'model-visible wait')
      if (imgPair === null) {
        check('C3', `the allowed read_image surfaced to the model: callId-paired tool_result text carries <type>image</type> + "downscaled from ${IMG_W}x${IMG_H} px" (the model-visible text names the ORIGINAL frame)`, false, 'no model-visible image tool_result observed')
        finishCriterion('C3')
      }
      const bodyStr = JSON.stringify(imgReq?.body ?? {})
      const wireForm = bodyStr.includes('image_url') ? 'openai image_url' : bodyStr.includes('"type":"image"') ? 'anthropic image block' : bodyStr.includes('data:image') ? 'data-url' : null
      const afterAllowStore = storeCensus()
      const added = afterAllowStore.filter((o) => !storeBaseline.some((b) => b.rel === o.rel))
      const objRel = added.length === 1 ? added[0].rel : null
      const objAbs = objRel === null ? null : join(HOME, 'attachments', 'v1', 'objects', objRel)
      const objBytes = objAbs === null ? null : readFileSync(objAbs)
      const objSha = objBytes === null ? null : createHash('sha256').update(objBytes).digest('hex')
      const nameSha = objRel === null ? null : objRel.split('/').pop()
      const b64InBody = objBytes === null ? false : bodyStr.includes(objBytes.toString('base64'))
      allowStoreRel = objRel
      check('C3', 'the NORMALIZED raster is real and identity-bound (root 14:57 真实normalized ref): exactly ONE new attachment-store object; file-name sha256 == stored-bytes sha256 (store law); the model-visible request carries an image part whose base64 is EXACTLY those stored bytes (the model sees the normalized object, not the source)',
        wireForm !== null && added.length === 1 && objSha !== null && objSha === nameSha && b64InBody,
        `wireForm=${wireForm} added=${jstr(added, 400)} nameSha=${nameSha} objSha=${objSha} objSize=${objBytes?.length ?? -1} b64IdentityInModelRequest=${b64InBody}`)
      check('C3', `the model-visible text carries BOTH frames (模型text原尺寸): normalized "${IMG_NORM_W}x${IMG_NORM_H} px" AND original clause "downscaled from ${IMG_W}x${IMG_H} px" (store receipt originalDimensions rides the envelope verbatim)`,
        imgPair.text.includes(`${IMG_NORM_W}x${IMG_NORM_H} px`) && imgPair.text.includes(`downscaled from ${IMG_W}x${IMG_H} px`) && imgPair.text.includes('<type>image</type>'),
        `callId=${imgPair.callId} text=${jstr(imgPair.text, 600)}`)
      let fxPrevI = {}
      try { fxPrevI = JSON.parse(readFileSync(join(RUN_DIR, 'fixture-evidence.json'), 'utf8')) } catch { /* keep */ }
      writeFileSync(join(RUN_DIR, 'fixture-evidence.json'), JSON.stringify({ ...fxPrevI, afterAllow: { storeCensus: afterAllowStore, addedObject: objRel, objectSha256: objSha, objectSize: objBytes?.length ?? -1, selfConsistent: objSha === nameSha, wireForm, b64IdentityInModelRequest: b64InBody, modelVisibleText: imgPair.text, modelVisibleCallId: imgPair.callId } }, null, 2))
    } else {
      const row1todos = memberLog.rows.length > 0 ? (memberLog.rows[0].data?.todos ?? memberLog.rows[0].payload?.todos ?? memberLog.rows[0].todos ?? null) : null
      check('C3', 'EXACTLY ONE todo/write entry in the member session log',
        memberLog.rows.length === 1, `rows=${memberLog.rows.length} files=${memberLog.files.join(', ')}`)
      check('C3', 'the appended todos list equals the model-submitted list FIELD-FOR-FIELD',
        row1todos !== null && JSON.stringify(row1todos) === JSON.stringify(LIST1),
        `appended=${jstr(row1todos, 600)} submitted=${jstr(LIST1, 600)}`)
    }
    // EVIDENCE LAW artifact (root ruling 3): the native append proof = the
    // ACTUAL session record bytes read back from the world storage file.
    writeFileSync(join(RUN_DIR, 'native-append-evidence.json'), JSON.stringify({
      sessionFiles: memberLog.files,
      todoWriteRows: memberLog.rows,
      submitted: LIST1,
    }, null, 2))
    finishCriterion('C3')
    const leg2Start = FIXTURE === 'write' ? wfState() : null

    // C4: second call (fresh exec token) -> public DENY -> zero append
    const row2 = await waitForTodoRow(host, (p) => FIXTURE === 'image' ? (p.toolName === 'read_image' && p.requestId !== row1.payload.requestId) : FIXTURE === 'write' ? (p.toolName === 'write' && p.requestId !== row1.payload.requestId) : (p.toolName === 'todo_write' && p.requestId !== row1.payload.requestId && TODO_CORR_RE().test(String(p.correlation ?? ''))), 180_000, `C4 second ${ROW_TOOL} row`)
    if (row2 === null) {
      check('C4', 'a second governed row appeared for the second call', false, jstr(readLedger().recorded.map((f) => ({ rid: f.payload.requestId, corr: f.payload.correlation })), 1200))
      finishCriterion('C4')
    }
    if (FIXTURE === 'write' && (row2.payload.reviewPayload ?? {}).parametersFingerprint === (row1.payload.reviewPayload ?? {}).parametersFingerprint) {
      check('C4', 'the second row parametersFingerprint DIFFERS from the first (content-bound plan: WF_DENY payload never reuses the allowed plan grant)', false, `fp1=${(row1.payload.reviewPayload ?? {}).parametersFingerprint} fp2=${(row2.payload.reviewPayload ?? {}).parametersFingerprint}`)
      finishCriterion('C4')
    }
    const resD = await remoteCallReady(host, 'team.resolveControl', { teamSessionId: ROOT_P, requestId: row2.payload.requestId, decision: 'deny', note: 'a5m2c2 C4 public deny' }, 'res-c4', 4)
    check('C4', 'PUBLIC deny over the remote v4 wire (decision=deny durable)',
      resultError(resD.body) === null && resultData(resD.body)?.decision?.decision === 'deny',
      `status=${resD.status} data=${jstr(resultData(resD.body), 400)}`)
    const denyFact = await waitForLedgerFact(host, 'control-decision-recorded', row2.payload.requestId, 60_000, 'C4 deny decision fact')
    const refusalPair = (FIXTURE === 'write' || FIXTURE === 'image')
      ? null
      : await waitForMock(mock, (r) => {
          const msgs = r.body?.messages ?? []
          return msgs.some((m) => ['tool', 'user'].includes(m?.role ?? '') && toolResultText(m?.content ?? '').includes(REFUSAL_MARK))
        }, 180_000, 'C4 member-visible refusal (refusal marker in tool result)')
    let denialSeen = refusalPair !== null ? { text: '(todo-marker leg)', callId: 'n/a' } : null
    if ((FIXTURE === 'write' || FIXTURE === 'image') && denialSeen === null) {
      const hit = await waitForMock(mock, (r) => {
        const want = FIXTURE === 'image' ? { tool: 'read_image', file: IMG_REL } : { tool: 'write', content: WF_DENY }
        const pair = denialPairSeen(r.body?.messages ?? [], want, (t) => t.includes('APPROVAL_DENIED') && t.includes(`durable Control request ${row2.payload.requestId} answered deny`))
        if (pair !== null) denialSeen = pair
        return pair !== null
      }, 180_000, 'C4 member-visible denial (callId-paired is_error tool_result bound to row2 requestId)')
      void hit
    }
    memberLog = readMemberTodoLog(childSid)
    const ledB = await remoteControlFacts(host)
    check('C4', FIXTURE === 'image'
      ? 'the denial surfaced to the member as a tool result for THIS call: callId-paired tool_use(read_image, source PNG)->tool_result is_error=true, text carries APPROVAL_DENIED + the exact row2 requestId "answered deny" (structural protocol; no fuzzy word)'
      : FIXTURE === 'write'
        ? 'the denial surfaced to the member as a tool result for THIS call: callId-paired tool_use(WF_DENY)->tool_result is_error=true, text carries APPROVAL_DENIED + the exact row2 requestId "answered deny" (root 14:29 protocol; no fuzzy prefix word)'
        : 'the refusal surfaced to the member (tool result carries refused-todo)',
      (FIXTURE === 'write' || FIXTURE === 'image') ? denialSeen !== null : refusalPair !== null,
      (FIXTURE === 'write' || FIXTURE === 'image')
        ? (denialSeen === null ? 'no callId-paired is_error tool_result bound to row2 requestId observed' : `callId=${denialSeen.callId} text=${jstr(denialSeen.text, 400)}`)
        : (refusalPair !== null ? 'refusal observed in model-visible tool result' : 'no tool result with refused-todo observed'))
    check('C4', 'ZERO effect for the denied call (session append / fixture bytes unchanged vs leg start), zero consumptions for row 2',
      (FIXTURE === 'image' ? (storeCensus().length === storeBaseline.length + 1 && storeCensus().some((o) => o.rel === allowStoreRel))
        : FIXTURE === 'write' ? (leg2Start.sha === WF_TGT_SHA && wfState().sha === leg2Start.sha && wfState().size === leg2Start.size)
        : memberLog.rows.length === 1)
      && ledB['control-allow-consumed'].filter((f) => f.payload.requestId === row2.payload.requestId).length === 0
      && denyFact !== null,
      `fixture=${FIXTURE === 'image' ? `store=${storeCensus().length}(baseline ${storeBaseline.length}+allow-leg 1; only-leg=${storeCensus().every((o) => o.rel === allowStoreRel)}` : FIXTURE === 'write' ? JSON.stringify(wfState()) : 'n/a'} rows=${memberLog.rows.length} row2consumptions=${ledB['control-allow-consumed'].filter((f) => f.payload.requestId === row2.payload.requestId).length} denyFact=${denyFact !== null}`)
    assertNoTodoInImageMode('C4', childSid, 'public-deny')
    finishCriterion('C4')
    if ((await waitForMock(mock, (r) => r.reply?.content === DONE_WORK1, 120_000, 'WORK1 turn done')) === null) log('WARN: WORK1 turn did not reach DONE (criterion checks above already captured)')

    // C5: third call pending -> abandon via the EXISTING p6t6 fixture
    const p3 = await apiPrompt(host.origin, host.cookie, ROOT_P, `${MK_W3L} Delegate task W3 to w1 asynchronously.`, 'c5')
    if (!(p3.status === 200 && p3.body?.result?.ok === true)) await dieFatal(`C5 delegate prompt not admitted: ${p3.status}`)
    const row3 = await waitForTodoRow(host, (p) => FIXTURE === 'image' ? (p.toolName === 'read_image' && ![row1.payload.requestId, row2.payload.requestId].includes(p.requestId)) : FIXTURE === 'write' ? (p.toolName === 'write' && ![row1.payload.requestId, row2.payload.requestId].includes(p.requestId)) : (p.toolName === 'todo_write' && ![row1.payload.requestId, row2.payload.requestId].includes(p.requestId) && TODO_CORR_RE().test(String(p.correlation ?? ''))), 180_000, 'C5 third row (pending)')
    const leg3Start = FIXTURE === 'write' ? wfState() : null
    if (row3 !== null && FIXTURE === 'write' && [(row1.payload.reviewPayload ?? {}).parametersFingerprint, (row2.payload.reviewPayload ?? {}).parametersFingerprint].includes((row3.payload.reviewPayload ?? {}).parametersFingerprint)) {
      check('C5', 'the third row parametersFingerprint DIFFERS from rows 1-2 (WF_CANCEL payload bound to its own plan)', false, `fp3=${(row3.payload.reviewPayload ?? {}).parametersFingerprint}`)
      finishCriterion('C5')
    }
    if (row3 === null) {
      check('C5', 'a third governed row appeared (pending) to exercise the existing abandon fixture', false, 'no third row')
      finishCriterion('C5')
    }
    const ab = await p6t6Control(HOST_PORT, { action: 'abandon', rootSessionId: ROOT_P, requestId: row3.payload.requestId, reason: 'a5m2c2-c5 cancel-via-existing-fixture' })
    check('C5', 'cancel via the EXISTING p6t6 abandon fixture (production abandonControlRequest authority) answered ok',
      ab.status === 200 && ab.body?.ok === true && ab.body?.value?.requestId === row3.payload.requestId,
      `status=${ab.status} value=${jstr(ab.body?.value, 400)} err=${jstr(ab.body?.code ?? null, 120)}`)
    const abandonFact = await waitForLedgerFact(host, 'control-request-abandoned', row3.payload.requestId, 60_000, 'C5 abandon fact')
    let cancelSeen = null
    const refusal3 = await waitForMock(mock, (r) => {
      const msgs = r.body?.messages ?? []
      if (FIXTURE === 'write' || FIXTURE === 'image') {
        const wantC = FIXTURE === 'image' ? { tool: 'read_image', file: IMG_REL } : { tool: 'write', content: WF_CANCEL }
        const pair = denialPairSeen(msgs, wantC, (t) => t.includes(row3.payload.requestId) && /answered (?:abandoned|unsettled)|APPROVAL_NOT_RESOLVED|PA walk|PA edge|cancelled/i.test(t))
        if (pair !== null) cancelSeen = pair
        return pair !== null
      }
      return msgs.filter((m) => toolResultText(m?.content ?? '').includes(REFUSAL_MARK)).length >= 2
    }, 180_000, (FIXTURE === 'write' || FIXTURE === 'image') ? 'C5 member-visible cancel settle (callId-paired is_error tool_result bound to row3 requestId)' : 'C5 member-visible refusal for row 3')
    memberLog = readMemberTodoLog(childSid)
    const ledC = await remoteControlFacts(host)
    const fileCrossC = readLedger()
    check('C5', 'exactly ONE durable abandon fact for row 3, ZERO consumptions, and the fixture/session effect UNCHANGED vs leg-3 start bytes',
      ledC['control-request-abandoned'].filter((f) => f.payload.requestId === row3.payload.requestId).length === 1
      && ledC['control-allow-consumed'].filter((f) => f.payload.requestId === row3.payload.requestId).length === 0
      && (FIXTURE === 'image' ? (storeCensus().length === storeBaseline.length + 1 && storeCensus().every((o) => o.rel === allowStoreRel))
        : FIXTURE === 'write' ? (leg3Start.sha === WF_TGT_SHA && wfState().sha === leg3Start.sha && wfState().size === leg3Start.size)
        : memberLog.rows.length === 1) && abandonFact !== null,
      `fixture=${FIXTURE === 'write' ? JSON.stringify(wfState()) : 'n/a'} abandonFacts=${ledC['control-request-abandoned'].filter((f) => f.payload.requestId === row3.payload.requestId).length} consumptions=${ledC['control-allow-consumed'].filter((f) => f.payload.requestId === row3.payload.requestId).length} rows=${memberLog.rows.length} durableFileAbandonFacts=${fileCrossC.abandonments.filter((f) => f.payload.requestId === row3.payload.requestId).length}`)
    check('C5', FIXTURE === 'image'
      ? 'the abandoned call surfaced its settle to the member as a tool result for THIS call: callId-paired tool_use(read_image, source PNG)->tool_result is_error=true bound to the exact row3 requestId with the arm-settle protocol wording (abandon via p6t6 abandonControlRequest authority — NOT nativeAbort; layered separately from the durable abandon fact)'
      : FIXTURE === 'write'
        ? 'the abandoned call surfaced its settle to the member as a tool result for THIS call: callId-paired tool_use(WF_CANCEL)->tool_result is_error=true bound to the exact row3 requestId with the arm-settle protocol wording (abandon via p6t6 abandonControlRequest authority — NOT nativeAbort; layered separately from the durable abandon fact)'
        : 'the cancelled call surfaced a refusal to the member (second refused-todo tool result)',
      (FIXTURE === 'write' || FIXTURE === 'image') ? cancelSeen !== null : refusal3 !== null,
      (FIXTURE === 'write' || FIXTURE === 'image')
        ? (cancelSeen === null ? 'no callId-paired is_error tool_result bound to row3 requestId observed' : `callId=${cancelSeen.callId} text=${jstr(cancelSeen.text, 400)}`)
        : (refusal3 !== null ? 'observed' : 'no second refused-todo observed'))
    assertNoTodoInImageMode('C5', childSid, 'public-abandon')
    finishCriterion('C5')

    // ── H1 / H2 ────────────────────────────────────────────────────────────
    await stopHost(host)
    host = null
    mkdirSync(join(RUN_DIR, 'git-post'), { recursive: true })
    const testUsePost = await captureGitState(TESTUSE, join(RUN_DIR, 'git-post'))
    writeFileSync(join(RUN_DIR, 'testuse-post.json'), JSON.stringify(testUsePost, null, 2))
    check('H1', 'test-use repo HEAD == baseline 639ed01539… + porcelain EMPTY before AND after (the run never wrote to the host source tree); :3080 zero-touch BY CONSTRUCTION (no request was ever sent to :3080)',
      testUsePre.head === HOST_BASELINE_SHA && testUsePre.statusEmpty === true && testUsePost.head === HOST_BASELINE_SHA && testUsePost.statusEmpty === true,
      `pre head=${testUsePre.head} empty=${testUsePre.statusEmpty}; post head=${testUsePost.head} empty=${testUsePost.statusEmpty}`)
    finishCriterion('H1')

    const hostFree = await waitForPortFree(HOST_PORT, 15_000)
    await mock.close()
    const mockFree = await waitForPortFree(MOCK_PORT, 15_000)
    await new Promise((r) => setTimeout(r, 2000))
    const survivors = survivingPids(HOST_PORT)
    writeFileSync(join(RUN_DIR, 'ps-proof.json'), JSON.stringify({ hostPort: HOST_PORT, hostFree, mockPort: MOCK_PORT, mockFree, survivingHostPids: survivors }, null, 2))
    check('H2', 'all ports released and NO surviving host/mock process (/proc scan empty)',
      hostFree === true && mockFree === true && survivors.length === 0,
      `hostFree=${hostFree} mockFree=${mockFree} survivors=${JSON.stringify(survivors)}`)
    finishCriterion('H2')
  } catch (error) {
    if (error instanceof FirstFailureStop) {
      await dieFatal(error.message, true)
    }
    await dieFatal(`unhandled: ${String(error?.message ?? error)}\nhost tail:\n${host !== null ? logTail(host.logPath, 30) : '<no host>'}`)
  } finally {
    closeAllProbeHolds('main finally') // root 17:42: uniform close, whatever the outcome above
    await sweepLiveHosts().catch(() => { /* best-effort */ })
    try { await mock.close() } catch { /* already */ }
    try {
      for (const h of EVID.hostLogs) {
        try { writeFileSync(join(RUN_DIR, `host-${h.phase}-port${h.port}.log`), readFileSync(h.logPath, 'utf8')) } catch { /* gone */ }
      }
      writeFileSync(join(RUN_DIR, 'mock.log'), mock.requestLogText?.() ?? JSON.stringify(mock.requests, null, 2))
    } catch { /* best-effort */ }
    try { writeFileSync(join(RUN_DIR, 'api-transcript.json'), JSON.stringify(TRANSCRIPT, null, 2)) } catch { /* best-effort */ }
    if (FIXTURE === 'write') {
      try {
        let fxPrevF = {}
        try { fxPrevF = JSON.parse(readFileSync(join(RUN_DIR, 'fixture-evidence.json'), 'utf8')) } catch { /* keep */ }
        const fb = readFileSync(WF_ABS)
        writeFileSync(join(RUN_DIR, 'fixture-evidence.json'), JSON.stringify({ ...fxPrevF, finalBytesRetained: true, final: { bytes: fb.toString('utf8'), sha256: wfState().sha, size: fb.length }, expectedFinalSha: WF_TGT_SHA }, null, 2))
      } catch { /* best-effort */ }
    }
    dumpSessionLogs('final')
    dumpPaEdgeEvidence()
    scrubDir(RUN_DIR)
    const criteria = Object.values(results)
    const pass = criteria.every((c) => c.pass === true)
    writeFileSync(join(RUN_DIR, 'summary.json'), JSON.stringify({
      kit: 'a5m2-todo-c2', stamp: RUN_STAMP, world: HOME, worldRetained: true, fixture: FIXTURE, ...(FIXTURE === 'write' ? { writeFixture: WF_REL, expectedFinalSha: WF_TGT_SHA } : {}),
      install: INSTALL, pinnedPlugin: P6T6_PLUGIN_PATH,
      worktree: WORKTREE, hostTree: TESTUSE, baseline: HOST_BASELINE_SHA, clientCommit: CLIENT_COMMIT_HASH,
      realm: REALM, ports: { host: HOST_PORT, mock: MOCK_PORT },
      criteria, pass, exitCode: pass ? 0 : 2,
    }, null, 2))
    log(`RESULT: ${pass ? 'PASS' : 'FAIL'} — evidence ${RUN_DIR}`)
    if (!pass) process.exitCode = 2
  }
}

// ENTRY-SAFETY LAW: main() runs ONLY when this file is the direct entry.
// Importing the module must never execute the run (2026-10-23 incident class).
if (ENTRY_DIRECT) {
  main().catch((error) => {
    // root 17:42: an init/entry-time exception must not leave probe listeners behind; exitCode
    // alone is not enough because the sockets are still bound while the loop drains.
    try { closeAllProbeHolds('entry catch') } catch { /* never throws */ }
    console.error(`a5m2-todo-c2: uncaught ${String(error?.stack ?? error)}`)
    process.exitCode = 1
  })
} else {
  console.error('a5m2-todo-c2: imported as a module — main() NOT executed (entry-safety law); no world, no writes, no mounts.')
}
