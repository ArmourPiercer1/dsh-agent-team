# Product observation: fresh-home model requests die with REQUEST_EXTENSION

Found by U5 (TestWorldFactory canary) on the pinned Host `639ed015397290b3745d163aafe02ffee4aa3f84` (0.2.0-rc.2), first-boot DSH_HOME (never authenticated, no user config).

## Symptom (measured, run-core-dbg)

Every `session/prompt` turn ends with the assistant error

    DeepSeek request extension preparation failed (REQUEST_EXTENSION)

before ANY provider HTTP dispatch: the mock provider saw **0 requests**
(`mockDigest` empty in the RUN record below), while plugin mount and tool
registration were healthy and the prompt itself was `accepted:true`. Session
titles fall back (`source.kind:"fallback"` in the projcache row), the same
path that swallows the per-turn error into the transcript.

## Root cause location (host source, read-only forensics)

`packages/llm/llm-deepseek/src/request-extensions.ts:28` — every metadata
contributor registered by the two base-bundle LLM-API extensions runs through
`prepareRequestExtensions`; on a fresh unauthenticated home the contributors
(`session-log-deepseek`, `plugin-package-inventory-deepseek`) fail, and the
failure aborts the whole request build. Both contributors therefore make the
FIRST model turn of any fresh home fail, regardless of plugin code.

## Reproduction signal

* BEFORE (contributor rows active): `mockDigest: []` — zero provider requests,
  every turn error = REQUEST_EXTENSION (see `run-core-dbg.json`, case
  `positive-control`).
* AFTER (only those two contributor rows disabled via the PUBLIC per-plugin
  `config.enabled: false` profile-patch flag — the s1-h0-m1 `noext` precedent):
  provider traffic flows, canary chain green (`run-core-dbg2.json`,
  `run-core-r1/r2/r3.json`; mock digests non-empty).

## U5 handling

Worlds append ONLY these two disable rows (disclosed in every RUN record via
`bindings.profileDisclosure`) to their own `cordis.patch.yml`; all tools,
guards and dispatch paths stay mounted. No upstream patch, no private seam.

Companion excerpt: `request-extension-evidence.txt` (fields pulled from the two RUN records).

## Suggested product fix (for the Host owner, not U5 scope)

`prepareRequestExtensions` should degrade per-contributor (drop one failed
contributor + surface a session warning) instead of failing the whole request,
or the two contributors must tolerate the unauthenticated first-boot state.
