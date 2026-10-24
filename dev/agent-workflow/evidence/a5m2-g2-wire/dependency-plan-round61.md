# A5M2-G2-WIRE round-61 — dependency delta PLAN (root 07:0x: source/read-only ONLY; lock executes ONLY after root's explicit budget ruling)

## What this commit is
The MINIMAL manifest delta declaring the two host-graph modules the search lane's
supply imports, per root 07:0x: `@deepseek-ai/dsh-launch-environment` and
`@deepseek-ai/dsh-tool-web` added to BOTH `package.json` (root) and
`packages/runtime/package.json` under `dependencies`, exact pins
`0.2.0-rc.2` — the file's existing convention (every other `@deepseek-ai`
entry is an exact `0.2.0-rc.2` pin in `dependencies`; peerDependencies is
empty in runtime; `devDependencies` carries only the cordis type set).
NO lock change, NO install, NO build in this commit.

## Read-only public version facts (measured this turn)
- Installed public versions (639 host tree package.json): `@deepseek-ai/dsh-tool-web =
  0.2.0-rc.2`, `@deepseek-ai/dsh-launch-environment = 0.2.0-rc.2`.
  (Real published faces previously verified on the COMPILED roots: tool-web lib exports
  `WEB_SEARCH_MAX_RESULTS = 8`; launch-environment lib exports `launchEnvironmentOf`
  arity 1, `snapshot.get(name) -> {value} | undefined`.)
- Standard install graph membership: `@deepseek-ai/dsh@0.2.0-rc.2` (already a root
  dependency) declares BOTH packages as its own dependencies — they ARE part of the
  standard install graph; the missing piece was only a DIRECT declaration.
- Lane `pnpm-lock.yaml` ALREADY resolves both at the exact version:
  snapshot entries `'@deepseek-ai/dsh-launch-environment@0.2.0-rc.2'` (:1579) and
  `'@deepseek-ai/dsh-tool-web@0.2.0-rc.2'` (:2598), plain keys (no peer-suffix
  variants), dependency closures fully resolved. The runtime importer block resolves
  every existing `@deepseek-ai` dep at `0.2.0-rc.2` (generation matches).

## Expected lock delta after the (future, approved) regeneration — METADATA ONLY
`importers.packages.runtime.dependencies` + root importer gain TWO entries each:

    '@deepseek-ai/dsh-launch-environment':
      specifier: 0.2.0-rc.2
      version: 0.2.0-rc.2(@deepseek-ai/cordis@4.0.4)     # as resolved for the existing snapshot
    '@deepseek-ai/dsh-tool-web':
      specifier: 0.2.0-rc.2
      version: 0.2.0-rc.2(...)                           # exactly the existing snapshot's peer context

`packages:` section: NO new entries (both snapshots already present). No version
bumps, no new packages, no range invention.

## Command that WOULD regenerate the lock (DO NOT RUN without root's budget ruling)
    pnpm install --lockfile-only
(honest caveat: even --lockfile-only may contact the registry for package METADATA;
it writes no node_modules.)

## Cache / budget estimate (measured + honest limits)
- Global pnpm store exists pre-existing: `/home/user/.local/share/pnpm/store/v11`
  ≈ 2.0 G measured this turn (center quoted 3.7 G; both figures pre-existing — nothing
  this delta adds to the store unless tarballs are absent).
- STORE MEMBERSHIP UNVERIFIABLE READ-ONLY: the v11 index.db carries no greppable
  package-name strings (measured: zero matches even for the bare name) — so I cannot
  claim the two 0.2.0-rc.2 tarballs are cached, only that their lock resolutions exist.
- Worst-case download budget (upper bound): the two package footprints are 456 KB
  (tool-web incl. src) and 140 KB (launch-environment) — registry tarballs are
  strictly SMALLER (dist-only); all transitive dependencies are already in the lock
  and, per the center's full-install builds (which resolved cordis/spill 0.2.0-rc.2),
  already unpacked somewhere on this host. Expected new bytes: ≲ 0.5 MB; disk delta
  in node_modules = two symlink farms into existing/added store entries.

## Status of the const:string specifier indirection (host.ts :2633/:2742)
Per root 07:0x it is a NON-SOLUTION placeholder: it stays ONLY so the tree keeps
compiling; it is NEVER to be cited as dependency resolution. AFTER the lock lands
(post-approval), it is replaced in ONE commit by the plain dynamic-import specifiers
(the honest compiled form), host mirrors regenerated IN that same commit, gates:
runtime tsc.build RC=0 + lane suites + touched-spec tsc + glue + mirror-bytes check.
(Not touched in THIS commit: zero build this round means comment edits would drift
the committed mirrors — the placeholder wording is corrected in the post-lock commit.)

## Accepted and kept from round-60
TS2554 two-arg call shape (both call sites pass ctx) + regenerated host mirrors —
accepted by root; unchanged here.
