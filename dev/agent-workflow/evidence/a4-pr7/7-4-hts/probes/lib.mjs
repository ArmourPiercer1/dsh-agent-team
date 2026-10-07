// Shared helpers for the §7.4 (C-tools+harness) throwaway evidence probes.
//
// Every probe in this directory answers the same question without booting a host:
// what is the EXACT Blueprint document this harness embeds, does the PRODUCTION
// parser accept it, and is the version line plus the two Alpha.4 authority
// carriers load-bearing for that parser? The document is never retyped here — it
// is sliced out of the harness source and evaluated, so the probe cannot drift
// from the file it is certifying.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function findRepo(from) {
  let dir = from
  while (dir !== dirname(dir)) {
    try {
      readFileSync(resolve(dir, 'scripts/verify-blueprint-version-clean.mjs'), 'utf8')
      return dir
    } catch {
      dir = dirname(dir)
    }
  }
  throw new Error('probe: cannot walk up to the repository root')
}

export const REPO = findRepo(dirname(fileURLToPath(import.meta.url)))

/** The production parser, as the committed dist artifact the harnesses load. */
export async function loadParser() {
  return import(resolve(REPO, 'packages/runtime/dist/packages/domain/blueprint/src/index.js'))
}

export const read = (rel) => readFileSync(resolve(REPO, rel), 'utf8')

/**
 * Evaluate one `const NAME = [ ...lines ].join('\n')` document builder exactly as
 * the harness file writes it. The array literal is sliced from the file; every
 * identifier it interpolates is declared by evaluating that file's own `const`
 * line, so no value is retyped in this probe.
 */
export function documentFromConst(source, constName, deps = []) {
  const startMarker = `const ${constName} = [`
  const start = source.indexOf(startMarker)
  if (start === -1) throw new Error(`probe: no \`${startMarker}\` in the harness source`)
  const end = source.indexOf("].join('\\n')", start)
  if (end === -1) throw new Error(`probe: unterminated array carrier for ${constName}`)
  const arrayText = source.slice(start + startMarker.length - 1, end + 1)
  const startLine = source.slice(0, start).split('\n').length
  const endLine = source.slice(0, end).split('\n').length
  const decls = deps.map((name) => {
    const m = new RegExp(`^const ${name} = .*$`, 'm').exec(source)
    if (m === null) throw new Error(`probe: cannot find \`const ${name}\` in the harness source`)
    return m[0]
  })
  // `new Function` on the file's own text: the same array expression, the same
  // const declarations, no host, no side effects.
  const build = new Function(`${decls.join('\n')}\nreturn (${arrayText}).join('\\n')`)
  return { doc: build(), slicedFrom: { constName, startLine, endLine } }
}

/**
 * Evaluate one `function NAME(...) { ... }` document builder (brace-matched) and
 * call it with the probe's arguments. Same discipline: the function text is the
 * file's own bytes.
 */
export function callDocumentFunction(source, fnName, args) {
  const marker = `function ${fnName}(`
  const start = source.indexOf(marker)
  if (start === -1) throw new Error(`probe: no \`function ${fnName}\` in the harness source`)
  let depth = 0
  let i = source.indexOf('{', start)
  const from = i
  for (; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    else if (source[i] === '}') {
      depth -= 1
      if (depth === 0) break
    }
  }
  const fnText = source.slice(start, i + 1)
  const build = new Function(`return (${fnText})`)()
  return { doc: build(...args), slicedFrom: { fnName, startLine: source.slice(0, start).split('\n').length } }
}

/** The parser's answer to a forged version or a deleted carrier. */
export function refusal(bp, label, source) {
  try {
    bp.parseBlueprint(source)
    return { label, outcome: 'PARSED (no refusal)' }
  } catch (error) {
    return {
      label,
      outcome: 'refused',
      code: error?.code ?? error?.name,
      message: String(error?.message ?? error).split('\n')[0],
    }
  }
}

export function dropCarrier(source, key) {
  const lines = source.split('\n')
  const i = lines.indexOf(`${key}:`)
  if (i === -1) throw new Error(`no "${key}:" carrier line in the document`)
  if (lines[i + 1] !== '  rules: []') throw new Error(`unexpected shape after ${key}: ${lines[i + 1]}`)
  return [...lines.slice(0, i), ...lines.slice(i + 2)].join('\n')
}

/** The prescribed parser controls, run over one document. */
export function parserControls(bp, doc) {
  const out = [
    refusal(bp, 'as-authored', doc),
    refusal(bp, 'version forged to 9', doc.replace(/^schemaVersion:.*$/m, 'schemaVersion: 9')),
  ]
  for (const key of ['teamHardEnvelope', 'permissionMutationEnvelope']) {
    try {
      out.push(refusal(bp, `${key} carrier deleted`, dropCarrier(doc, key)))
    } catch (error) {
      out.push({ label: `${key} carrier deleted`, outcome: `no such carrier in this document: ${error.message}` })
    }
  }
  return out
}

/** What the probe prints for one document: identity + version + carriers. */
export function identity(parsed) {
  return {
    schemaVersion: parsed.schemaVersion,
    blueprintId: parsed.blueprintId,
    revision: parsed.revision,
    contentHash: parsed.contentHash,
    permissionMutationEnvelope: parsed.permissionMutationEnvelope,
    teamHardEnvelope: parsed.teamHardEnvelope,
  }
}
