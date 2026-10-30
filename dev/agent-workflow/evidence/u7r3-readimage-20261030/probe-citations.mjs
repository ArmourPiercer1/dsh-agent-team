#!/usr/bin/env node
/**
 * u7r3-readimage-20261030 — citation probe (evidence-only, read-only).
 * Prints the exact line cited by every H:/P: reference in POC-REPORT.md and
 * greps each claim's marker text, so a reviewer can audit every file:line
 * without opening two trees by hand. Exit non-zero on any missing marker.
 * Run from this directory: `node probe-citations.mjs`.
 */
import { readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

// this file lives at <repoRoot>/dev/agent-workflow/evidence/u7r3-readimage-20261030/
const REPO = decodeURIComponent(new URL('../../../..', import.meta.url).pathname).replace(/\/$/, '')
// the pinned test-use checkout is gitignored and lives in the MAIN workspace
// (worktrees don't carry it) — walk up like the wfpoc probe did.
function findHost(start) {
  let dir = start
  for (;;) {
    const candidate = join(dir, 'tests/deepseek-harness-test-use')
    if (existsSync(join(candidate, 'packages/fs/tool-fs/src/index.ts'))) return candidate
    const up = join(dir, '..')
    if (up === dir) return candidate
    dir = up
  }
}
const HOST = findHost(REPO)
let hostHead = 'UNKNOWN'; let hostPorcelain = null
try {
  hostHead = execFileSync('git', ['-C', HOST, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  hostPorcelain = execFileSync('git', ['-C', HOST, 'status', '--porcelain'], { encoding: 'utf8' }).trim()
} catch { /* report as UNKNOWN below */ }

console.log(`product root: ${REPO}`)
console.log(`product HEAD: ${execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()}`)
console.log(`host checkout: ${HOST}`)
console.log(`host HEAD: ${hostHead}`)
console.log(`host porcelain: ${hostPorcelain === null ? 'UNKNOWN' : hostPorcelain === '' ? '(empty)' : hostPorcelain}`)
console.log(`utc: ${new Date().toISOString()}`)
console.log('='.repeat(72))

let failures = 0
const show = (label, root, file, line, marker) => {
  const abs = join(root, file)
  let text = '(file missing)'
  if (existsSync(abs)) {
    const lines = readFileSync(abs, 'utf8').split('\n')
    text = lines[line - 1] ?? '(line beyond EOF)'
  } else failures += 1
  const hit = marker === undefined ? true : text.includes(marker)
  if (marker !== undefined && !hit) failures += 1
  console.log(`${hit ? 'OK ' : 'MISS'} ${label}:${file}:${line}${marker === undefined ? '' : `  [${marker}]`}\n     ${text.trim().slice(0, 160)}`)
}

console.log('--- H: host tree @ pin ---')
show('H', HOST, 'packages/fs/tool-fs/src/index.ts', 22, "inject")
show('H', HOST, 'packages/fs/tool-fs/src/index.ts', 70, "ctx.inject(['attachments']")
show('H', HOST, 'packages/fs/tool-fs/src/index.ts', 71, 'applyReadImageTool')
show('H', HOST, 'packages/fs/tool-fs/src/read-image.ts', 210, "name: 'read_image'")
show('H', HOST, 'packages/fs/tool-fs/src/read-image.ts', 253, 'no attachment service is mounted')
show('H', HOST, 'packages/fs/tool-fs/src/read-image.ts', 262, 'byteCap = Math.min')
show('H', HOST, 'packages/fs/tool-fs/src/read-image.ts', 273, 'attachments.saveImage')
show('H', HOST, 'packages/fs/tool-fs/src/read-image.ts', 279, 'IMAGE_DIMENSION_TOO_LARGE')
show('H', HOST, 'packages/fs/tool-fs/src/read-image.ts', 285, 'IMAGE_TOO_MANY_PIXELS')
show('H', HOST, 'packages/attachment/attachment/src/index.ts', 48, 'attachments: AttachmentStore')
show('H', HOST, 'packages/attachment/attachment/src/index.ts', 53, 'abstract class AttachmentStore extends Service')
show('H', HOST, 'packages/attachment/attachment/src/index.ts', 59, 'imageLimits')
show('H', HOST, 'packages/attachment/attachment/src/index.ts', 158, 'abstract saveImage')
show('H', HOST, 'packages/attachment/attachment/src/index.ts', 167, 'abstract readImage')
show('H', HOST, 'packages/attachment/attachment-local/package.json', 31, 'sharp')
show('H', HOST, 'packages/bundle/base/cordis.patch.yml', 138, 'attachment-local')
show('H', HOST, 'packages/bundle/base/cordis.patch.yml', 281, 'tool-fs')
show('H', HOST, 'packages/bundle/web-app/cordis.patch.yml', 469, 'tool-fs')
show('H', HOST, 'packages/bundle/web-app/presets/standard.patch.yml', 26, 'tool-fs')
show('H', HOST, 'packages/bundle/web-app/presets/ptc.patch.yml', 26, 'tool-fs')
show('H', HOST, 'packages/bundle/web-app/presets/cordis.patch.yml', 29, 'tool-fs')
show('H', HOST, 'docs/tool-catalog.md', 31, 'read_image')
show('H', HOST, 'packages/core/tools/src/index.ts', 747, 'already registered')
show('H', HOST, 'packages/core/tools/src/index.ts', 1202, 'own registrations last, shadowing')

console.log('--- P: product tree @ branch HEAD ---')
show('P', REPO, 'tests/paths.mjs', 71, 'TEST_USE_BASELINE_SHA')
show('P', REPO, 'packages/runtime/src/plugin/live/team-tool-plane.mjs', 300, "'read_image'")
show('P', REPO, 'packages/runtime/src/plugin/live/team-tool-plane.mjs', 378, "read_image: Object.freeze(['read_image'])")
show('P', REPO, 'packages/runtime/src/plugin/live/team-tool-plane.mjs', 407, 'PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED')
show('P', REPO, 'packages/runtime/src/plugin/live/team-tool-plane.mjs', 1602, 'const hostService =')
show('P', REPO, 'packages/runtime/src/plugin/live/team-tool-plane.mjs', 2048, 'hostServices.ctx = agentCtx')
show('P', REPO, 'packages/runtime/src/plugin/live/team-tool-plane.mjs', 2052, 'agentCtx.tools.register')
show('P', REPO, 'packages/runtime/src/plugin/live/agent-bindings.mjs', 2306, 'presets.mount(agentCtx')
show('P', REPO, 'packages/runtime/src/plugin/live/agent-bindings.mjs', 2558, 'applyBuiltInToolDeny')
show('P', REPO, 'packages/runtime/src/plugin/live/agent-bindings.mjs', 2648, 'config?.teamToolPlane')
show('P', REPO, 'packages/runtime/src/plugin/live/agent-bindings.mjs', 2842, 'placement-feed rows=')
show('P', REPO, 'packages/tools/families/fs.mjs', 50, 'enabled: (cap) => hasRoot(cap)')
show('P', REPO, 'packages/tools/families/fs.mjs', 51, 'READ_IMAGE_NATIVE_NAME')
show('P', REPO, 'packages/tools/families/fs.mjs', 76, "cap.hostService('attachments')")
show('P', REPO, 'packages/tools/families/fs.mjs', 136, 'PLANE_FS_FAMILY_INCOMPLETE')
show('P', REPO, 'packages/tools/fs-family/src/image-executor.mjs', 130, 'attachment-service-unmounted')
show('P', REPO, 'packages/tools/fs-family/src/image-executor.mjs', 152, 'byteCap = Math.min')
show('P', REPO, 'packages/tools/fs-family/src/image-executor.mjs', 168, "kind: 'domain-ref'")
show('P', REPO, 'packages/tools/fs-family/src/image-executor.mjs', 227, 'refused whole')
show('P', REPO, 'packages/tools/fs-family/src/image-executor.mjs', 245, 'attachments.saveImage')
show('P', REPO, 'packages/tools/fs-family/src/image-read-port.mjs', 88, 'maxBytes + 1')
show('P', REPO, 'packages/tools/fs-family/src/image-row.mjs', 78, "type: 'image'")
show('P', REPO, 'packages/domain/tool-governance/src/effects.ts', 43, 'domain-ref')
show('P', REPO, 'packages/runtime/tool-admission/admission-kernel.ts', 703, 'RESOURCE_EFFECT_KINDS')
show('P', REPO, 'packages/runtime/tool-admission/approval-case.ts', 179, 'export function evaluateEffectSetExpansion')
show('P', REPO, 'packages/domain/authority-envelope/src/authority-envelope.ts', 505, 'CEILING_NO_AUTHORITY')
show('P', REPO, 'packages/runtime/test/u7-9a-fs-mutation-c1.test.ts', 763, 'I-6')
show('P', REPO, 'packages/runtime/test/u7-9a-fs-mutation-c1.test.ts', 772, 'I-7')
show('P', REPO, 'packages/runtime/test/u7-9a-fs-mutation-c1.test.ts', 805, 'I-10')
show('P', REPO, 'packages/runtime/test/u7-9a-fs-mutation-c1.test.ts', 824, 'I-12')
show('P', REPO, 'packages/runtime/test/u7-9a-fs-mutation-c1.test.ts', 837, 'I-13')
show('P', REPO, 'tests/kits/rc2-real-host-smoke/rc2-real-host-smoke.mjs', 155, "'read_image'")
show('P', REPO, 'tests/kits/rc2-real-host-smoke/rc2-real-host-smoke.mjs', 739, 'tool-fs')

console.log('='.repeat(72))
console.log(failures === 0 ? 'ALL CITATIONS VERIFIED' : `${failures} CITATION(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
