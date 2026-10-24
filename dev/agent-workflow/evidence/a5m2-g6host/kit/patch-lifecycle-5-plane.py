p = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5m2-wire-g6/packages/runtime/src/plugin/live/team-tool-plane.mjs'
s = open(p).read()
n = 0
def rep(old, new, count=1):
    global s, n
    assert s.count(old) == count, f'MISS/AMBIG({s.count(old)}): ' + old[:80].replace('\n', '\\n')
    s = s.replace(old, new, count)
    n += 1

# inject law: the PUBLIC Provider lifecycle observer + pinned generation are
# REQUIRED parts of the closed sessionQuery inject contract (root ruling 3).
rep("""              : !g6IsRec(sessionQueryInjectRaw.declaredMount) || !g6IsRec(sessionQueryInjectRaw.declaredMount.searchBackend)
                ? 'declaredMount.searchBackend {present:true} | {present:false, evidence} is required — the search rows ride the deployment\\'s real evidence either way'
                : undefined""",
"""              : !g6IsRec(sessionQueryInjectRaw.declaredMount) || !g6IsRec(sessionQueryInjectRaw.declaredMount.searchBackend)
                ? 'declaredMount.searchBackend {present:true} | {present:false, evidence} is required — the search rows ride the deployment\\'s real evidence either way'
                // Root ruling 3 (lane increment 1): currentness rides the
                // PUBLIC Provider lifecycle — an arm WITHOUT the observer
                // cannot be built at all (fail closed; no per-read identity
                // law exists any more to fall back to).
                : !g6IsRec(sessionQueryInjectRaw.lifecycle) || typeof sessionQueryInjectRaw.lifecycle.currentGeneration !== 'function'
                  ? 'lifecycle { currentGeneration() } is required — the PUBLIC Provider lifecycle observer (the host-side ctx.inject([\\'sessionQuery\\']) fiber); currentness unknowable must never become allow-by-default'
                  : !Number.isInteger(sessionQueryInjectRaw.generation)
                    ? 'generation (a non-negative integer) is required — the ACTIVE Provider generation the mount pins; every lifecycle refusal quotes it against the live one'
                    : undefined""")
rep("""      declaredMount: sessionQueryInjectRaw.declaredMount,
      ...(sessionQueryInjectRaw.maxSearchResults === undefined ? {} : { maxSearchResults: sessionQueryInjectRaw.maxSearchResults }),
    })""",
"""      declaredMount: sessionQueryInjectRaw.declaredMount,
      lifecycle: sessionQueryInjectRaw.lifecycle,
      generation: sessionQueryInjectRaw.generation,
      ...(sessionQueryInjectRaw.maxSearchResults === undefined ? {} : { maxSearchResults: sessionQueryInjectRaw.maxSearchResults }),
    })""")
rep("""        teamCeiling: sessionQueryInject.teamCeiling,
        declaredMount: sessionQueryInject.declaredMount,
        ...(sessionQueryInject.maxSearchResults === undefined ? {} : { maxSearchResults: sessionQueryInject.maxSearchResults }),""",
"""        teamCeiling: sessionQueryInject.teamCeiling,
        declaredMount: sessionQueryInject.declaredMount,
        lifecycle: sessionQueryInject.lifecycle,
        generation: sessionQueryInject.generation,
        ...(sessionQueryInject.maxSearchResults === undefined ? {} : { maxSearchResults: sessionQueryInject.maxSearchResults }),""")

open(p, 'w').write(s)
print(f'team-tool-plane G6 inject law: {n} operations')
