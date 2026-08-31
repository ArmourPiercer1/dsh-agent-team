// G8-R3 reviewer-3 e2e — ts-loader resolve hook (shared by the row child
// process and the parent driver process).
//
// Node `module.register` resolve hook: for a specifier that ends in `.js`
// (file: URL, relative path, or absolute Windows path) whose on-disk
// sibling is actually a `.ts` file, rewrite to the `.ts` file so Node's
// native type stripping executes the repo TypeScript. The `existsSync`
// gate means built `.mjs`/`.js` files and bare specifiers pass through
// untouched, from any parentURL (repo packages import each other with
// `.js`-suffixed relative specifiers; the harness row imports repo TS by
// absolute file URL).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

function tsFor(specifier, context) {
  if (typeof specifier !== 'string' || !specifier.endsWith('.js')) return null
  let base
  try {
    if (specifier.startsWith('file://')) {
      base = fileURLToPath(specifier)
    } else if (specifier.startsWith('./') || specifier.startsWith('../')) {
      if (typeof context.parentURL !== 'string') return null
      base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier)
    } else if (process.platform === 'win32' && /^[A-Za-z]:[\\/]/.test(specifier)) {
      base = path.resolve(specifier)
    } else {
      return null
    }
  } catch {
    return null
  }
  const tsPath = base.slice(0, -3) + '.ts'
  try {
    if (!fs.existsSync(tsPath) || fs.statSync(tsPath).isDirectory()) return null
  } catch {
    return null
  }
  return pathToFileURL(tsPath).href
}

export async function resolve(specifier, context, nextResolve) {
  const tsUrl = tsFor(specifier, context)
  if (tsUrl !== null) return { url: tsUrl, shortCircuit: true }
  return nextResolve(specifier, context)
}
