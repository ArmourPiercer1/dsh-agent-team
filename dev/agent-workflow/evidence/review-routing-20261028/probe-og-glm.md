# Probe: OG GLM — review lane routing liveness

- Repo: /srv/workspace/dsh-plugins/dsh-agent-team (branch master), HEAD = c2b03fc34 (verified)
- Pointer file read: dev/engineering/current-authority.json (1 line)

## (a) Pointer keys + values

- content_digest: sha256:93692d7aeb3b097c3b3467e0a9207f1da5f05c2c1cb324c74d25168b1516a4d4
- snapshot_version: as20261026r1

## (b) scripts/current-authority.mjs (first 60 lines) — one-sentence summary

It is the single pure-read (never writes, creates, or repairs) shared loader for the post-G2-switchover authority model: it reads the editable two-key pointer file `dev/engineering/current-authority.json` ({content_digest, snapshot_version}, exactly those two keys), strictly validates it (key set, version/digest formats, symlink refusal, digest mismatch = structured refusal, with no fallback to graph.yaml or the derived current-state.json view) and resolves it to the immutable snapshot under `dev/engineering/authority-snapshots/`, while enforcing the shared two-current guard that the legacy `current_contract:` block in graph.yaml stays gone.

## (c) Liveness marker

TOOL_ROUND_OK
