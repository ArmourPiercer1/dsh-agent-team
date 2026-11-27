[dated settlement, 2026-11-27T18:05:00Z]

Settlement for 6a231e686 (trial content c11ac09a3).

This is the round-128 settlement. It is the **trial candidate** settlement: the branch now carries an
installable trial tag, and this comment states exactly what that does and does not mean. Nothing here is
candidate acceptance and nothing is `PRODUCT-PROVEN`.

**Owner ruling recorded (OWNER-DECISIONS.md round 128): TRIAL ≠ RELEASE.** A trial tag
(`vX.Y.Z-trial.N`) may be published, installed, tried and rolled back **without** the version freeze; its
obligation is install → boot → documented surfaces → rollback, each measured in an isolated `DSH_HOME`.
A trial run never implies `PRODUCT-PROVEN`, may not be quoted as candidate-acceptance evidence, and does not
shorten the release protection rule (frozen candidate SHA + version gate **Required and green at that SHA**
+ verified `version-gate-receipt.json`, `VERSION-GATE.md` §6). `CANDIDATE-REPORT.md` states the same split
at the top; `docs/TRIAL-GUIDE.md` is the owner-facing procedure.

**The trial tag.** `v0.3.0-trial.1` (annotated, object `51da2a892…`) is on **`c11ac09a3`**, the commit that
carries `docs/TRIAL-GUIDE.md`. Exact owner command:

```
pnpm dsh plugin --profile web add github:ArmourPiercer1/dsh-agent-team#v0.3.0-trial.1
```

**Why rc.5 now installs (and why the claim is still truthful).** `version` = `0.3.0-trial.1`;
`engines.dsh` = `0.2.0-rc.2 || 0.2.2-rc.5`; all 18 `@deepseek-ai/dsh*` peers carry that **byte-identical**
enumeration of the only two hosts this branch has MEASURED. No comparator, no wildcard, no `allow-version`
exemption, no peer left on an exact pin. The 18 exact `0.2.0-rc.2` pins moved from `peerDependencies` to
`devDependencies` (checkout build/test host selection, not a compatibility claim); the lock still resolves
all 18 to `0.2.0-rc.2` (`0` occurrences of `0.2.2-rc.5`). `@deepseek-ai/dsh-web-search-exa` stays the only
`@deepseek-ai/*` regular dependency (host-absent, exact pin, PD-37 intact). Truth table against the REAL
evaluators of both hosts (r128-trial/03): shipped **ACCEPTs exactly 0.2.0-rc.2 and 0.2.2-rc.5 on both
evaluators**, REFUSEs `0.1.7-rc.1 / 0.2.0 / 0.2.3-alpha.2` with `exempted=false`; the exact-pin control
accepts only rc.2 — the relaxation is load-bearing, not decorative.

**Measured, in isolation** (`dev/agent-workflow/evidence/r128-trial/`; `DSH_HOME` inside the workspace,
port 3180, never `:3080`, never `~/.dsh`):

- **Phase A (local spec):** `add file:$PWD` exit 0 → profile dep + `dsh.profile.bundles` + `--dump-config`
  both bundle rows + profile `node_modules/@deepseek-ai` = only the web-search dep; governed profile layer
  with the v4 Leader+Worker+Officer blueprint boots with no error, and `catalog.list` serves
  `trial-team` (`schemaVersion: 4`, `migrationState: current`) next to the v3 anchor.
- **Phase C (the tag, profile wiped):** install exit 0 (22.6 s); installed identity `0.3.0-trial.1` with the
  declared engines; the lock resolves
  `…/tar.gz/c11ac09a3c74a8e9452ca6a9adf817511c5d07e9` — **lock-resolved commit == tag peel**; boot smoke on
  3180 (`/` 401, two bundled skills registered, `/team-remote` MOUNTED, SIGTERM → exit 0, process gone);
  `plugin remove` → dependency gone, bundles back to `base+web-app`, package gone, 0 bundle rows, **host
  still boots** (405 on `/team-remote`, no registration, SIGTERM → 0).
- Pack face: 1976 files, every required install-face target present (`cordis.patch.yml`,
  `packages/runtime/dist`, client composition shim, `packages/runtime/root-binding`,
  `upstream-resolver.mjs`, `.agents/skills`), 0 missing `exports` targets.

**Local gate block at this tree.** `dispatch-tests --leg ute-vnext-a1 --run` tests=268 pass=267 fail=0
skip=1 exit 0; `test-catalog --max-uncollected 41 --max-excluded 7` findings=0 (790 tests, 38 uncollected,
14 excluded); `ute-cut-closure --check` pass; `ute-p0-assets --check` pass; `docs-sync --check` 194 docs
findings=0; `place-dist-glue` 36 byte-identical; `eb3-ci-required` pass workflows=11; bound vitest
`plugin-dsh-compat` **14/14**; UTE G1 argv **89/89**; `eb3-run-manifest` pass records=765 findings=0;
`ci-pr-gate --full --census-captures 2` **PASS 10/10** (`refused=0 refusedlegs=none`), census captured
twice with identical identity sets. `check-install-manifest` remains **RED at 11, base-equal** (same 11
against the pre-change manifest; all are pre-existing computed-specifier rejections in committed dist; lock
leg PASS) — reported red, not claimed green. Six negative controls on the relaxed checker are in
`r128-trial/05` (comparator peer, engine comparator, engine subset, engine extra, peer drift, no-engine;
the peer-drift control is the one that caught the first, conditional form of the byte-identity rule).

**Disclosed, not hidden.** (1) One boot attempt targeted the inherited `DSH_HOME=$HOME/.dsh` because a
helper defaulted to `${DSH_HOME:-…}`; the host aborted at `prepareProfile` with
`EROFS … /home/armourpiercer/.dsh/profiles/web/cordis.yml`. It READ the stable home and its first WRITE was
refused by the read-only mount: no file changed, no process stayed up, `:3080` was never contacted. The
helper now refuses any home under `$HOME/.dsh` before starting the host (`r128-trial/README.md` §2).
(2) The `ci-pr-gate` install leg needed `CI=true` + the tree's own writable pnpm store (read-only `HOME`
here); both failed attempts are kept (`10a`, `10b`) and the green verdict is `pass=10 fail=0 skip=0`.
(3) Not measured: a full Member turn with a real model credential, MCP/subagent end-to-end,
macOS/Windows governed tier — the trial guide says so to the owner too.

**Not done / not claimed.** No capability row moves; nothing is `PRODUCT-PROVEN`; no release tag of the
release line; no version-gate receipt; PR #822 stays **DRAFT**; no merge; no deploy; `CORE PATCH BUDGET = 0`;
`:3080` and `~/.dsh` untouched; no existing tag moved; gated history not rewritten.
