> **Copied into tracked evidence dated 2026-10-31** (same run, same day): this file is that run's `README.md`
> renamed to `feasibility-report.md`; the body below is verbatim from it. Provenance of what is NOT here, by design:
> the raw `boot*.log` bodies and the schedule-probe JSONs (v2–v5) were kept out to hold this directory small — every
> command/output line they carry that any durable record cites is reproduced verbatim in `MEASURED-LINES.txt` beside
> this file, and the two raw captures worth keeping whole are here (`probe-out.json`, `preflight-check.txt`). The
> one in-body forward reference to `world-deleted.txt` (§3) is quoted verbatim in `MEASURED-LINES.txt` §7. The run
> itself executed in the lane's run-scratch; after this copy the report, the two raw captures and the quoted lines
> are all tracked, so no durable record depends on anything untracked.

# A6 PRI2 — pristine DSH test-runtime feasibility: measured facts

Machine: this host. Worktree: `.worktrees/alpha6-pri2` (branch `alpha6/lane2-pri2-timed-wake-20261031`).
Date: 2026-10-31. Nothing in this run wrote a tracked file or touched `/home/armourpiercer/deepseek-harness`.

## 1. Go/no-go (TEST_METHODS §1)

GO. §1 names the source generically — `git clone --local --no-hardlinks <只读 baseline 树> tests/deepseek-harness-test-use`
— and requires only: `--local --no-hardlinks`, `checkout --detach <TEST_USE_BASELINE_SHA>`, `git status --porcelain` empty
after landing, and the §9 native-asset re-check. It never restricts the source to `/srv/workspace/...` (that path appears
only in §9's asset-source rule). No clause forbids a local same-SHA read-only clone.

## 2. Materialization

| step | result |
| --- | --- |
| clone | exit 0, `real 0m1.862s`, detached @ `639ed015397290b3745d163aafe02ffee4aa3f84`, porcelain 0 |
| install | `INSTALL_EXIT=0`, `Done in 17.5s using pnpm v11.7.0` (workspace pin + `--ignore-scripts`) |
| build | `BUILD_EXIT=0`, `build: built linux-x64/bin/glibc/system.node`, `build: recorded 347 client artifact(s) with 2 public value(s)` |
| §9 preflight `--check` | exit 1 — `probe: before-provision=unusable -> after-provision=unusable`, `backend: unusable (usable: false)`, `launcher: ABSENT`, `porcelain: empty (assets are gitignored)` |
| size after install+build | `2.6G` (`tests/deepseek-harness-test-use`, gitignored at `.gitignore:12`) |

`landlock-run` exists nowhere on this machine; the locally compiled `system.node` is `17352` bytes / sha `75450f92…`, not the
pinned `17360` bytes / `54a9c25c…`, so §9 assets cannot be self-provisioned here. **This did not block boot** — the host
served HTTP, mounted plugin rows, and answered remote calls.

## 3. Boot chain (port 3181, `HOST_PORT_BANDS`; 3180 never touched; 3080 never touched)

Marker technique: `exec -a a6pri2<role>probe3181 node apps/cli/lib/bin.js web --port 3181 --no-open` with
`DSH_HOME=<worktree>/tests/homes/a6pri2-20261031T11-33-49Z`. Boot lines (verbatim, one per boot):

```
dsh web: http://127.0.0.1:3181/?token=Tt1axKXncul__Gqs9aY3G_w6mCekz50xdAOHptA1kKo   (boot 1, bare world)
dsh web: http://127.0.0.1:3181/?token=xSu-oYZqvUfsF84nFaV522KS9O1o5M1JUPks6TIl69Y   (schedule bundle on)
dsh: warning: 1 entry did not activate
a6pri2-wake-probe-v3 (file:///…/a6pri2-wake-probe-v3.mjs): pending (waiting for service: schedule)
dsh web: http://127.0.0.1:3181/?token=dZhVclGqchLLfg31IZxM7WWOqEq7nP9Zs2hsR0RUsSQ   (default profile)
[dsh-agent-team] remote mount: MOUNTED channel=/team-remote (late, after 106ms — the connection service appeared after the mount step)
```

HTTP: `no_token_status=401`, `token_status=303`, `stable_3080_status=401` (untouched).
World `a6pri2-20261031T11-33-49Z` deleted at teardown per §7 (temporary world) — see `world-deleted.txt`.

## 4. L-1a / L-1b (immediate wake carrier) — RECEIVED, both

Probe row mounted only through `profiles/web/cordis.patch.yml`; opened its own domain through the injected
`ctx.storageDomain` facility, wrote `rows/probe-key-1`, subscribed twice (`{global:true}` and no 3rd arg):

```
l1a {subscribed:true, received:[{domain:"a6pri2wakeuprobe",table:"rows",key:"probe-key-1",operation:"put"}], error:null}
l1b {subscribed:true, received:[{domain:"a6pri2wakeuprobe",table:"rows",key:"probe-key-1",operation:"put"}], error:null}
write {ok:true}
```

The memo's stated ENV gap is closed by a fresh clone: the cordis runtime IS in the baseline tree at `vendor/cordis/`, and
`on()`'s third argument is documented there — `vendor/cordis/src/events.ts:114-116` `global?: boolean` = "Receive the event
regardless of context filter checks", applied at `:171-173`
`.filter(hook => hook.global || !filter || filter.call(thisArg, hook.ctx))`. With no filter on the emitting context, a
non-global listener receives. So `global: true` is not required for this event at this SHA.

## 5. Floor-delayed carrier — NO plugin-reachable source

1. Default web profile: a row that `inject: ['schedule']` never activates — `pending (waiting for service: schedule)`.
2. With `@deepseek-ai/dsh-experimental-schedule-bundle` switched on in the world's profile, `ctx.schedule` exists
   (`ctorName: "ScheduleService"`), methods = `catalog, create, delete, emitChanged, getDomain, history, initialized, list,
   serialize, stopSessionTasks, update` — no handler/callback registration.
3. Live `ctx.schedule.create(sessionId, {after_seconds: 3})` resolved durably
   (`{id:"schedule-eee44769-…", kind:"after", afterSeconds:3, scheduledAt:"2026-10-31T11:45:17.987Z"}`); the only
   plugin-visible event was ONE payload-less `schedule/changed` at create time (11:45:15.016); **nothing arrived at the due
   instant** 11:45:17.987 (`pluginReceivedWakeCallback:false`).
4. Source of the due action: `packages/schedule/schedule/src/runtime.ts:101-123` — `ctx.sessionController.resolveAgent(task.sessionId)`
   → `createUserMessage({source:{kind:'schedule'}})` → `resolved.agent.followup(message)`. Session-bound user-role turn, not
   a plugin callback.
5. Context census over the baseline tree (162 `interface Context` members): the only time-shaped names are
   `schedule, jobs, jobController, ptcRuntime, webhookRuntime, vmTimeoutMs`; `ctx.jobs` = `LocalJobRegistry`
   (`start/wait/kill/…`, no delayed start — no `scheduledAt|notBefore|startAt|delayMs|runAt` in `packages/jobs/jobs/src`).

## 6. Real ControlService resolve path — REACHABLE on this machine

The lane's own built row `packages/runtime/dist/packages/runtime/src/plugin/host.js` mounted through the patch seam only.
Config discovery, each refusal verbatim from the row's own validator:

```
dsh-agent-team row config: must be a plain object
dsh-agent-team row config: generation must be a positive integer
dsh-agent-team row config: deniedSelection must be a plain object or null
dsh-agent-team row config: mcpServer must be { name, port: number|null } or null
```

With the `tests/kits/pr-d-control-real-host` config shape: `[dsh-agent-team] remote mount: MOUNTED channel=/team-remote`,
and over the wire (token → 303 + set-cookie):

```
POST /team-remote/team.getLedgerPage v1 {teamSessionId, afterSequence:0, limit:20}
HTTP 200 {"result":{"ok":true,"value":{"data":{"entries":[],"nextAfterSequence":null,"total":0}, … "contractVersion":1 …}}}

POST /team-remote/team.resolveControl v4 {teamSessionId, requestId:"control-a6pri2-does-not-exist", decision:"allow", note:…}
HTTP 200 {"result":{"ok":false,"error":{"code":"CONTROL_REQUEST_NOT_FOUND",
  "message":"ControlService: no durable control request 'control-a6pri2-does-not-exist' in team 'session-a6pri2-probe-root' (a decision without a request)",
  "details":{"method":"team.resolveControl","endpoint":"team.resolveControl","contractVersion":4,"reason":"domain-error",
  "cause":{"code":"CONTROL_REQUEST_NOT_FOUND","details":{"rootSessionId":"session-a6pri2-probe-root","requestId":"control-a6pri2-does-not-exist"}}}}}}
```

Not driven: creating a real pending request (needs a member ask-lane tool use under a model, i.e. the kit's mock-model
fixture). Not reachable as written: `packages/runtime/test/a6-pr-i1b-admission.test.ts` — that file exists only in
`.worktrees/alpha6-pri1b`, its ENV-REFUSED leg asserts the absences in its own repo root, and the real-host pair it names
is not implemented as legs anywhere; writing them = editing a tracked test file (not permitted in this session).

## 7. Cleanup proofs

- `pkill -f 'a6pri2[…]'` → `no live a6pri2*`, `NO_TEST_USE_PROCESSES`
- `ss -ltn | grep :3181` → `PORT_3181_FREE=yes`; `:3080` still listening, untouched
- host repo `/home/armourpiercer/deepseek-harness`: BEFORE `HEAD=639ed01539… PORCELAIN=0`, AFTER identical
- worktree: `git status --porcelain | wc -l` = `0`, `git diff --stat` empty
- world deleted (§7); clone retained (gitignored `.gitignore:12`), `2.6G`, still detached @ pin, porcelain 0

One incident, disclosed: a background boot started without an explicit `DSH_HOME` inherited `/home/armourpiercer/.dsh` and
attempted `writeFileSync('/home/armourpiercer/.dsh/profiles/web/cordis.yml')` → `EROFS` + workspace-write sandbox denial,
exit 1. Zero bytes were written; every subsequent boot set `DSH_HOME` explicitly.
