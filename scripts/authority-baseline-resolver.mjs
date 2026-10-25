#!/usr/bin/env node
// S2 §7.4 census PREPARATION — thin baseline resolver. NOT the census itself and NOT
// wired into any workflow: it only answers "which baseline does THIS explicitly named,
// digest-verified snapshot carry". Git existence/ancestry stay with the census's existing
// pre-checks, and MASTER_SHA's legacy graph read is unchanged until a future, separately
// reviewed switch. No fallback of any kind: no graph read, no derived mirror, no default.
//
//   node scripts/authority-baseline-resolver.mjs --snapshot <file> --expected-digest sha256:<hex>
// success: exit 0, stdout EXACTLY one line "<baseline sha>\n", stderr empty
// failure: non-zero exit, stdout EMPTY, stderr one named reason
import { loadCandidateAuthority } from './authority-candidate-source.mjs';

const args = process.argv.slice(2);
const si = args.indexOf('--snapshot');
const di = args.indexOf('--expected-digest');
if (si === -1 || di === -1 || (si > -1 && di > -1 && args.length !== 4)) {
  process.stderr.write('RESOLVER_ARGS: usage: --snapshot <file> --expected-digest sha256:<hex> (both required together; nothing is inferred, no default snapshot exists)\n');
  process.exit(2);
}
const c = loadCandidateAuthority({ file: args[si + 1], expectedDigest: args[di + 1] });
if (!c.ok) {
  process.stderr.write(`${c.refused}${c.detail ? `: ${c.detail}` : ''} — baseline is published only from a fully verified snapshot; no graph or derived fallback is consulted\n`);
  process.exit(2);
}
process.stdout.write(`${c.six.baseline}\n`);
