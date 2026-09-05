# reviewer-1 raw gate outputs (independent re-runs, spawn-restricted sandbox equivalents)

Worktree: `.worktrees/RMR-REV1` (detached @ 677b029, clean at start; install = `pnpm install --frozen-lockfile` exit 0, 463 pkgs, pnpm 11.7.0).
Sandbox: spawn-restricted (node child-process spawn EPERM) — same documented equivalents as R135 (tsc direct, `scripts/run-tests.mjs`, in-process eslint, pwsh-side git).

## 1. TYPECHECK (node node_modules/typescript/lib/tsc.js -p packages/<p>/tsconfig.json)

```
TYPECHECK contracts => exit 0 (1s)
TYPECHECK domain    => exit 0 (1s)
TYPECHECK storage   => exit 0 (1s)
TYPECHECK remote    => exit 0 (1s)
TYPECHECK tools     => exit 0 (1s)
TYPECHECK client    => exit 0 (2s)
TYPECHECK legacy    => TS5058: packages\legacy\tsconfig.json does not exist (exit 1)
TYPECHECK testkit   => exit 0 (1s)
TYPECHECK runtime   => exit 0 (2s)
```

`legacy` layout check (NOT introduced by this diff — `git ls-tree 5adc8b9 packages/legacy/` shows the same at base: package.json, README.md, session-reader/, teammates-adapter*, tsconfig.build.json — NO tsconfig.json):

```
node tsc.js -p packages/legacy/tsconfig.build.json   => exit 0
```

→ effective 9/9 (8 via tsconfig.json + legacy via its only tsconfig, tsconfig.build.json).

## 2. BUILD (node tsc.js -p packages/<p>/tsconfig.build.json)

```
BUILD contracts => exit 0 (0s)
BUILD domain    => exit 0 (0s)
BUILD storage   => exit 0 (0s)
BUILD remote    => exit 0 (0s)
BUILD tools     => exit 0 (1s)
BUILD client    => exit 0 (2s)
BUILD legacy    => exit 0 (0s)
BUILD testkit   => exit 0 (0s)
BUILD runtime   => exit 0 (2s)
```

Client composition shim: `node scripts/build-client-composition.mjs packages/client packages/client/composition-shim` →
`85 modules, 11 css files … client-bundle.js (845690 B)` (size = committed baseline).

## 3. ARTIFACT FRESHNESS (after the full rebuild above)

```
git status --porcelain -- packages/runtime/dist packages/client/composition-shim
→ 511 entries, ALL " M" (worktree-vs-index), 0 untracked, 0 deleted

git diff --ignore-cr-at-eol --stat -- packages/runtime/dist packages/client/composition-shim
→ (empty: zero files differ once CR-at-EOL is ignored)
```

Byte-level finding: committed dist blobs are stored CRLF (proven by git status semantics under `core.autocrlf=true` + no repo `.gitattributes`: clean(LF worktree file)=LF ≠ index blob ⇒ index/HEAD blob = CRLF; the pre-existing state at base 5adc8b9 — files untouched by this diff drift identically, e.g. `packages/runtime/dist/packages/contracts/src/schema-version.js`); tsc emits LF. Line-ending counts: worktree host.js (rebuilt) = 40973 B / 771 bare LF; committed (smudged worktree) = 41744 B (= 40973 + 771 CR). Content identical after CR normalization for ALL 511 files, including the 11 changed by the diff and the composition-shim.
Worktree restored to clean afterwards (`git checkout -- packages/runtime/dist packages/client/composition-shim` → status 0 entries; only untracked `packages/testkit/test/.tmp-fault/` test scratch remains, per protocol).

## 4. TEST (node scripts/run-tests.mjs — full suite)

```
run-tests (plain-node vitest-equivalent): 2448 passed, 4 failed, 2452 total, 16636 ms
```

The 4 failures — all pre-existing shim-matcher TypeErrors in files the diff does NOT touch:

```
FAIL packages\client\test\client-plugin-mount.test.ts (1/26 tests)
     ✗ … scenario A › registers the sidebar.footer.action entry …
       TypeError: expect(...).toBeNull is not a function
           at …/client-plugin-mount.test.ts:651:64

FAIL packages\runtime\test\pbf-default-artifact-urls.test.ts (3/9 tests)
     ✗ … source layout: the second candidate is the package seam
       TypeError: expect(...).toHaveLength is not a function
           at …/pbf-default-artifact-urls.test.ts:76:24
     ✗ … the validator accepts a shipped-form config (no glueUrl/seamUrl)
       TypeError: expect(...).toBeUndefined is not a function
           at …/pbf-default-artifact-urls.test.ts:85:31
     ✗ … withDefaultWorkspace derives the launch directory when absent (bundle row, D9)
       TypeError: expect(...).toBeUndefined is not a function
           at …/pbf-default-artifact-urls.test.ts:116:40
```

New + pin worlds (all PASS):

```
PASS packages\storage\test\rmr-create-or-open.test.ts (5 tests)
PASS packages\runtime\test\rmr-remote-mount-race.test.ts (7 tests)
PASS packages\runtime\test\rmr-create-or-open-boot.test.ts (3 tests)
PASS packages\runtime\test\t12b2-resume-separation.test.ts (5 tests)
PASS packages\runtime\test\t12m4-remote-mount.test.ts (9 tests)
PASS packages\runtime\test\p8s5a-production-assembly.test.ts (7 tests)
PASS packages\testkit\test\p4t6-session-event-scan.test.ts (10 tests)
```

(The test run's own stderr demonstrates the new observability live: `remote mount: MOUNTED channel=/team-remote (late, after 109ms …)`, `… did not appear within 200ms …`, `FAILED — … appeared malformed …`, and `bootstrap FAILED: TeamDomainError: team_domain already exists (schema_meta holds 8 stamp row(s)) …` for the strict-create negative world.)

## 5. LINT (node node_modules/eslint/bin/eslint.js . — eslint 9.39.5, in-process)

```
FAIL, exit 1 — 8 errors, 0 warnings:

packages/runtime/src/plugin/host.ts
  593:9  error  'pollTimer' is never reassigned. Use 'const' instead      prefer-const
  594:9  error  'deadlineTimer' is never reassigned. Use 'const' instead  prefer-const

packages/runtime/test/rmr-create-or-open-boot.test.ts
  165:26  error  Unexpected any. Specify a different type               @typescript-eslint/no-explicit-any
  220:1   error  'team1' is never reassigned. Use 'const' instead       prefer-const
  221:1   error  'binding1' is never reassigned. Use 'const' instead    prefer-const
  222:1   error  'members1' is never reassigned. Use 'const' instead    prefer-const
  227:1   error  'createdAt1' is never reassigned. Use 'const' instead  prefer-const
  233:1   error  'team2' is never reassigned. Use 'const' instead       prefer-const
```

Re-run on just the two files: identical 8 errors, exit 1 (reproducible). Config: repo `eslint.config.mjs` = `js.configs.recommended` + `tseslint.configs.recommended` (both rules are enabled there). NOTE: contradicts the R135 gate-summary claim "LINT … exit 0".

## 6. SMOKE (node scripts/composition-smoke.mjs)

```
PASS host plugin (packages/runtime): name="dsh-agent-team", apply fails loud on degenerate context (ready code=TEAM_PLUGIN_CONFIG_INVALID)
PASS client plugin (packages/client): name="dsh-agent-team-client", apply fails loud on degenerate context
PASS composition-smoke
→ exit 0
```

Negative probe now prints the new observability line (root cause C):
`[dsh-agent-team] bootstrap FAILED: TeamPluginError: dsh-agent-team row config: must be a plain object` (stack through the COMMITTED dist host.js — proves the shipped artifact carries the fix).

## 7. LIVE VERTICAL (port 3181, fresh DSH_HOME `references/.dsh-test-rmr-rev1-20260905-183908`)

Setup: profile files (cordis.yml, cordis.patch.yml, package.json, pnpm-*yaml, .dsh-module-fallback) copied from the diag-405 reference world (node_modules excluded — healer materializes); install surface = this worktree's `package.json`, `cordis.patch.yml`, `packages/client/composition-shim`, `packages/runtime/dist`, `packages/runtime/root-binding`, `packages/runtime/src/plugin/upstream-resolver.mjs` into `<home>/profiles/web/node_modules/dsh-agent-team/`; reference `settings.yaml` only — NO sessions/, storages/, .credentials.yaml, .anonymous-user-id (first-ever-boot state). Installed host.js = 41744 B (committed CRLF bytes = the committed artifact), bundle `bootPhase: "create-or-open"`.
CLI: `D:\AgentDev\deepseek-harness\apps\cli\lib\bin.js` (read-only use, as permitted), `$env:DSH_HOME=<home>`.

### FIRST boot (fresh medium) — terminal, verbatim:

```
dsh web: http://127.0.0.1:3181/?token=YoJhvObsrTcjyOXXrHbUpBx70BQcaaGit5RcYDRa-AM
[dsh-agent-team] remote mount: MOUNTED channel=/team-remote
```

(no `bootstrap FAILED` line)

Wire probe (token exchange): `GET /?token=…` → `HTTP/1.1 303 See Other` + `set-cookie: dsh-auth-D1gu4AUZ6XwohD5r0eN4-fmFNLAOCeA62Dj465JieJs=v1.eyJ2ZXJzaW9uIjoxLCJhdXRob3JpdHkiOiIxMjcuMC4wLjE6MzE4MSIsImlzc3VlZEF0IjoxNzg4NjA0ODY2MjU2LCJleHBpcmVzQXQiOjE3OTExOTY4NjYyNTZ9.…; Max-Age=2592000; Path=/; …; HttpOnly; SameSite=Strict` (full: vertical-token-exchange-firstboot.txt)

`POST /team-remote/catalog.list` (cookie, body `{"type":"client-request","rpcId":"rev1-1","method":"catalog.list","payload":{"version":1,"params":{}}}`) →

```
HTTP/1.1 200 OK
content-type: application/json
Vary: Accept-Encoding
Date: Sat, 05 Sep 2026 10:41:06 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"type":"server-response","rpcId":"rev1-1","result":{"ok":true,"value":{"data":{"blueprints":[{"blueprintId":"my-team-bp-1","revisions":[1]}]},"provenance":{"origin":"team-remote","method":"catalog.list","endpoint":"catalog.list","contractVersion":1,"requestToken":null,"projectionGeneration":null,"effectSequence":null}}}}
```

Medium after first boot: `storages/team_domain.json` — `unit {"name":"team_domain","version":1}`; schema_meta 8 stamps (stampedAt 2026-09-05T10:39:30.167Z–10:39:31.448Z); team_sessions `team-root` row `createdAt 2026-09-05T10:39:31.725Z` (blueprint my-team-bp-1, generation 2); member_instances exactly the Leader (inst-leader, createdAt 10:39:32.281Z); session_bindings team-root; compatibility/operations/ledger one row each. (fresh medium → INITIALIZED + identity MINTED = resolved `create` branch)

Kill: job killed; `curl 127.0.0.1:3181` → **000**.

### RESTART (same home, stamped medium) — terminal, verbatim:

```
dsh web: http://127.0.0.1:3181/?token=ovkWXcPsl1ams5XyxeAwDES0nQDCRZuInQKOWwMmbII
[dsh-agent-team] remote mount: MOUNTED channel=/team-remote
```

(no `bootstrap FAILED` line — the pre-fix returning-home path threw the swallowed TEAM_DOMAIN_EXISTS here)

Wire probe: `GET /?token=…` → 303 + set-cookie (vertical-token-exchange-restart.txt); `POST /team-remote/catalog.list` (same body) →

```
HTTP/1.1 200 OK
… (identical shape)
{"type":"server-response","rpcId":"rev1-1","result":{"ok":true,"value":{"data":{"blueprints":[{"blueprintId":"my-team-bp-1","revisions":[1]}]}}…
```

(After restart: schema_meta stampedAt values UNCHANGED at 10:39:30–31Z = adopt, never re-stamp; TeamSession createdAt UNCHANGED at 10:39:31.725Z = identity loaded, NOT re-minted → stamped medium → ADOPTED + resolved `resume` branch)

Teardown: server killed; final probe 3181 = **000**. Home left on disk as evidence.
