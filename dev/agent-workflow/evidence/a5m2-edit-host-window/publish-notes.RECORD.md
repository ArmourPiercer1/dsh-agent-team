# Publish/Install notes (record, append-only) — G3 lane

## 2026-10-24 — dsh-sandbox is NOT in the root package (CENTER/root ruling, booked)

The root package ships WITHOUT `dsh-sandbox`. Consequences booked for any
future install-side verification (e.g. an INSTALL C2):

- the standard package must be **genuinely resolvable** and the runtime
  supply **actually provided by the real Host** — an install C2 proves
  closure only against the deployed artifact, never against a dev tree;
- `dsh-sandbox` (and any similar runtime dependency) must be declared
  per the DEPLOYMENT-support statement as `peer` / `optionalPeer` exactly
  as the deployment contract says — not by what happens to resolve today;
- **NO accidental hoist, NO borrowing from the mother tree**: a resolution
  that only works because some ancestor `node_modules` happens to carry the
  package is a FAILURE of the closure proof, not evidence of health (same
  lesson class as the f86 coldimport gate: the re-packed artifact is the
  acceptance surface; zero-drift against the source tree is not proof).

Nothing else in this lane changes; windows 1–7 evidence stays frozen; boot
awaits the root's GO.
