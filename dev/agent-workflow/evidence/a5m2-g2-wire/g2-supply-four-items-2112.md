# Root 21:12 — per-item public-interface sufficiency verdicts (probes run this round)

## WEB — SUFFICIENT public interface (chosen next implementation)
Provider object: the PUBLIC 'web' store service (host.ts ctx.get('web') —
already the deps.web law since round-15). Seam: createG2WebProviderSeam +
brand law ALREADY WRITTEN by the owner plane (team-tool-plane.mjs
:1013-1021: a web injection must carry teamFixedWebProviderLanes, per
mounted name the frozen branded handle). No Core, no new permission
semantics (the plane law defines the acceptance shape today).
First source actions: (1) host producer web half — buildG2TeamSupply:
g2Mount.webProviderLanes armed ONLY from the live 'web' service through
createG2WebProviderSeam (never from env/provider-id flipping — the ruled
boundary); (2) mount web path: webMount -> backends.g2Web = the branded
lanes (replaces the named-gap refusal once supply is real); (3) bindings:
webMount arg line at the SAME createG2TeamMount call (ADDITIVE hunk,
non-overlapping with dcad's reviewed hunks per root's own carve-out).
## consumeBrowserApproval — BLOCKED on a real correlation gap (grounded)
The lease hands consumeApproval the run() callFacts = {toolName,
operation} only (g2-team-mount.mjs :240 region); the plane PA row callId
(plane-g2:<realm>-N) is minted INSIDE the walk (team-tool-plane) and never
reaches the invoke wrapper — a forwarder CANNOT verify per-call consumption
today; minting one that answers 'consumed' without per-call correlation
would WEAKEN the approval law (forbidden), so nothing is faked. Minimal
existing-shape fix candidate for root's view: the row-walk invoke already
knows the callId at consume time (consumeG2ApprovedPlan call site) —
passing the consumed callId into the row's run() callFacts is a ONE-fact
augmentation of the existing facts object (no new semantics).
## Team-scoped mcpResources — still insufficient (public fork absent)
Probes: dsh packages/context is the PROMPT-context package (no fork API);
no public Context.fork/scope found; server-context.ts:29 ctx.inject fiber
pattern remains the only scoped retrieval (composition-internal). Fork
options (a)/(b) stay queued for root.
## B-BROWSER closed table — sufficient (all in-tree), sized as its own round
control types + rule-map surface is in this tree (family-rules picks);
full map + adapters + spec = a full round (21:01/21:02 consumed this one).
