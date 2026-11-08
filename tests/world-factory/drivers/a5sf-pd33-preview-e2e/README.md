# `a5sf-pd33-preview-e2e` — the Alpha.5 Preview end-to-end driver

One World per boot, the shipped opt-in `a5sf-governed-member` preset, a scripted
mock model, real guards. Two boots (`--boots 2`) must agree case by case; the
readiness report cites both.

```bash
node tests/world-factory/drivers/a5sf-pd33-preview-e2e/run-boot.mjs --plan          # host-free composition check
node tests/world-factory/drivers/a5sf-pd33-preview-e2e/run-boot.mjs --arms e2e --boots 1
node tests/world-factory/drivers/a5sf-pd33-preview-e2e/run-boot.mjs --boots 2        # the measured pair
A5SF_PD33_MUTATE=no-realm node tests/world-factory/drivers/a5sf-pd33-preview-e2e/run-boot.mjs --arms e2e --boots 1   # negative control
```

## The scenario (one composition)

- **Leader** — one turn delegates to every template; a second turn `team_collect`s
  two of them by request token and lists the members.
- **`a` (Member A)** — `read` → `grep` → `glob` → `write` → `edit` → `bash` → `skill` →
  `present`, then three authorization attempts (fs read out of lane, `web_fetch` to
  another origin, `bash` write to `..`), then the seven deferred names.
- **`b` (Member B)** — real `web_fetch` (fixture, body verbatim), one `web_search`,
  an out-of-lane `skill`, `read_image` behind a `text` route, then a goal that runs
  >= 3 automatic rounds and converges through `complete`.
- **`s1`** stop during a round · **`s2`** boundary burst + `/goal pause` ·
  **`cold`** SIGTERM/restart/`team_follow_up`/`/goal resume` ·
  **`stop2`** the Leader archives a *running* Member (`team_archive_member`).

## What is real vs instrumentation

Real: preset rows, realm compiler, fs/shell/web/skill/present guards, goal service,
upstream goal-round driver, Team router + lifecycle, the Host process, the sockets.
Instrumentation: the model (`packages/tools/harness/mock-deepseek.mjs`), the two
local HTTP fixtures, the base-`web` tripwire (`pd33-base-web-tripwire.mjs`), and the
two WorldFactory tools (`u5_canary`, `u6fs_probe`) that appear on every surface —
the roster discloses them, no preset row is rewritten.

## Honesty rules baked into the judges

- no clause is satisfied by a claim in prose: every clause reads a counter, a fact or
  a durable log line;
- `web_search` has TWO shipped states and the case follows the measured one;
- the shell case measures the **disclosed** boundary (the guard admits the spawn by
  its declared roots; the OS profile stops an out-of-lane write) and says so in the
  clause detail rather than asserting the service axis refused it;
- `read_image` is refused through the route gate; the case requires 0 facts and
  0 bytes so a fallthrough to the fs face cannot pass.
