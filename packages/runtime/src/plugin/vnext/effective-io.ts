/**
 * effective-io.ts — the three I/O axes, and the only algebra that may narrow them.
 *
 * UTE-06/07/08 in one sentence: what a tool may touch is
 * `EffectiveIO ⊆ AgentCeiling ∩ ToolRestriction`, and the three axes never mix.
 *
 * WHY THREE AXES AND NOT ONE ALLOWLIST. The old route had a single permission surface
 * that conflated "this member may read under /w" with "this member may write under /w"
 * with "this member may reach host api.example.com". Every one of those conflations was a
 * real defect: a read grant became a write grant when a canonicalizer picked the wrong
 * axis, and a network allowlist entry was once compared against a filesystem path. The
 * algebra below keeps them as separate dimensions with separate types, so mixing them is
 * a type error rather than a review question.
 *
 * FAIL-CLOSED IS THE DEFAULT, AND IT IS STRUCTURAL. There is no "any" that appears by
 * omission: `any` must be written by the ceiling AND by the restriction to survive the
 * intersection. An empty ceiling list denies — it never means "unset, allow everything".
 * Malformed input throws (`EffectiveIoError`) rather than being skipped, because a skipped
 * axis is an unenforced axis.
 *
 * @module packages/runtime/src/plugin/vnext/effective-io
 */

import { posix } from 'node:path'

/** The three axes of agent I/O. Never merged; never widened by a sibling. */
export const IO_AXES = Object.freeze(['fs.read', 'fs.write', 'net'] as const)
export type IoAxis = (typeof IO_AXES)[number]

/**
 * A filesystem resource: an exact path, a subtree (that path and everything under it), or
 * `any` (the whole filesystem). `any` is the only form that needs no path.
 */
export type FsResource =
  | { readonly kind: 'any' }
  | { readonly kind: 'exact'; readonly path: string }
  | { readonly kind: 'subtree'; readonly path: string }

/** A network resource: `any` host, an exact host, or a host suffix (`.example.com`). */
export type NetResource =
  | { readonly kind: 'any' }
  | { readonly kind: 'exact'; readonly host: string }
  | { readonly kind: 'subtree'; readonly host: string }

export interface NetPolicy {
  /** Hosts the agent may reach at all. Empty denies every host. */
  readonly allow: readonly NetResource[]
  /** Hosts refused even when allowed. Deny always wins; it is never subtracted from. */
  readonly deny: readonly NetResource[]
}

export interface IoSides {
  readonly read: readonly FsResource[]
  readonly write: readonly FsResource[]
  readonly net: NetPolicy
}

/** One side of the intersection: the agent's ceiling, or one tool's own restriction. */
export interface IoPolicy extends IoSides {
  /** Free-form provenance recorded on the binding so a refusal can name its source. */
  readonly provenance?: string
}

export interface EffectiveIo extends IoSides {
  /** Axes that admitted nothing. A tool bound to an empty axis is refused before it runs. */
  readonly emptyAxes: readonly IoAxis[]
}

export class EffectiveIoError extends TypeError {
  readonly code: string
  constructor (code: string, message: string) {
    super(`effective-io: ${message}`)
    this.name = 'EffectiveIoError'
    this.code = code
  }
}

const fail = (code: string, message: string): never => {
  throw new EffectiveIoError(code, message)
}

/** Normalize a filesystem path for comparison. `..` is refused, never resolved away. */
export function normalizeFsPath (path: unknown): string {
  if (typeof path !== 'string' || path.trim() === '') fail('FS_PATH_INVALID', `a filesystem resource needs a non-empty path, got ${JSON.stringify(path)}`)
  const raw = path as string
  if (raw.includes('\0')) fail('FS_PATH_INVALID', 'a filesystem path may not contain NUL')
  // CHECK BEFORE NORMALIZING. `posix.normalize('/w/../etc')` is `/etc`: normalizing first would
  // erase the very segment that proves the path escaped, turning an escape into a clean path.
  if (raw.split('/').includes('..')) fail('FS_PATH_ESCAPE', `path ${JSON.stringify(raw)} contains a '..' segment; a ceiling is never escaped by normalization`)
  const normalized = posix.normalize(raw)
  if (normalized.split('/').includes('..')) fail('FS_PATH_ESCAPE', `path ${JSON.stringify(raw)} still contains a '..' segment after normalization`)
  return normalized
}

const normalizeHost = (host: unknown): string => {
  if (typeof host !== 'string' || host.trim() === '') fail('NET_HOST_INVALID', `a network resource needs a non-empty host, got ${JSON.stringify(host)}`)
  const h = (host as string).trim().toLowerCase()
  if (!/^[a-z0-9.*_-]+$/.test(h)) fail('NET_HOST_INVALID', `host ${JSON.stringify(host)} is not a hostname or host suffix`)
  return h
}

/** Validate one resource. Called on every input: a policy that cannot be read is refused. */
export function parseFsResource (spec: unknown, where: string): FsResource {
  if (typeof spec === 'string') return { kind: 'subtree', path: normalizeFsPath(spec) }
  if (spec === null || typeof spec !== 'object') fail('FS_RESOURCE_INVALID', `${where}: expected an fs resource, got ${JSON.stringify(spec)}`)
  const r = spec as Record<string, unknown>
  if (r.kind === 'any') return { kind: 'any' }
  if (r.kind === 'exact') return { kind: 'exact', path: normalizeFsPath(r.path) }
  if (r.kind === 'subtree') return { kind: 'subtree', path: normalizeFsPath(r.path) }
  return fail('FS_RESOURCE_INVALID', `${where}: kind must be any|exact|subtree, got ${JSON.stringify(r.kind)}`)
}

export function parseNetResource (spec: unknown, where: string): NetResource {
  if (typeof spec === 'string') return { kind: 'subtree', host: normalizeHost(spec) }
  if (spec === null || typeof spec !== 'object') fail('NET_RESOURCE_INVALID', `${where}: expected a network resource, got ${JSON.stringify(spec)}`)
  const r = spec as Record<string, unknown>
  if (r.kind === 'any') return { kind: 'any' }
  if (r.kind === 'exact') return { kind: 'exact', host: normalizeHost(r.host) }
  if (r.kind === 'subtree') return { kind: 'subtree', host: normalizeHost(r.host) }
  return fail('NET_RESOURCE_INVALID', `${where}: kind must be any|exact|subtree, got ${JSON.stringify(r.kind)}`)
}

/** Parse a whole policy. Unknown keys are refused so a typo cannot silently widen a ceiling. */
export function parseIoPolicy (spec: unknown, where: string): IoPolicy {
  if (spec === null || typeof spec !== 'object') fail('IO_POLICY_INVALID', `${where}: expected a policy object, got ${JSON.stringify(spec)}`)
  const p = spec as Record<string, unknown>
  for (const key of Object.keys(p)) {
    if (!['read', 'write', 'net', 'provenance'].includes(key)) fail('IO_POLICY_UNKNOWN_KEY', `${where}: unknown key ${JSON.stringify(key)} — a misspelled axis must not be ignored`)
  }
  const list = (v: unknown, name: string): unknown[] => {
    if (v === undefined) return []
    if (!Array.isArray(v)) fail('IO_POLICY_INVALID', `${where}.${name} must be an array`)
    return v as unknown[]
  }
  const net = p.net
  if (net !== undefined && net !== null) {
    if (typeof net !== 'object') fail('IO_POLICY_INVALID', `${where}.net must be an object {allow,deny}`)
    const n = net as Record<string, unknown>
    for (const key of Object.keys(n)) {
      if (!['allow', 'deny'].includes(key)) fail('IO_POLICY_UNKNOWN_KEY', `${where}.net: unknown key ${JSON.stringify(key)}`)
    }
  }
  const netObj = (net ?? {}) as Record<string, unknown>
  return {
    read: list(p.read, 'read').map((r, i) => parseFsResource(r, `${where}.read[${i}]`)),
    write: list(p.write, 'write').map((r, i) => parseFsResource(r, `${where}.write[${i}]`)),
    net: {
      allow: list(netObj.allow, 'net.allow').map((r, i) => parseNetResource(r, `${where}.net.allow[${i}]`)),
      deny: list(netObj.deny, 'net.deny').map((r, i) => parseNetResource(r, `${where}.net.deny[${i}]`)),
    },
    ...(typeof p.provenance === 'string' ? { provenance: p.provenance } : {}),
  }
}

/** Does `resource` contain `path`? Exact requires equality; subtree requires a boundary. */
export function fsResourceContains (resource: FsResource, path: string): boolean {
  if (resource.kind === 'any') return true
  const target = normalizeFsPath(path)
  if (resource.kind === 'exact') return target === resource.path
  // A subtree boundary is a PATH boundary: /w/a contains /w/a and /w/a/b, never /w/ab.
  const base = resource.path.replace(/\/+$/, '')
  if (base === '' || base === '/') return target.startsWith('/')
  return target === base || target.startsWith(`${base}/`)
}

/** Does `resource` contain `host`? A suffix must match on a dot boundary. */
export function netResourceContains (resource: NetResource, host: string): boolean {
  if (resource.kind === 'any') return true
  const h = normalizeHost(host)
  if (resource.kind === 'exact') return h === resource.host
  const base = resource.host.replace(/^\./, '')
  return h === base || h.endsWith(`.${base}`)
}

/** The narrower of two filesystem resources, or `undefined` when they do not overlap. */
export function intersectFsResource (a: FsResource, b: FsResource): FsResource | undefined {
  if (a.kind === 'any') return b
  if (b.kind === 'any') return a
  if (a.kind === 'exact' && b.kind === 'exact') return a.path === b.path ? a : undefined
  if (a.kind === 'exact') return fsResourceContains(b, a.path) ? a : undefined
  if (b.kind === 'exact') return fsResourceContains(a, b.path) ? b : undefined
  // Both subtrees: the container wins, and only if one contains the other.
  if (fsResourceContains(a, b.path)) return b
  if (fsResourceContains(b, a.path)) return a
  return undefined
}

export function intersectNetResource (a: NetResource, b: NetResource): NetResource | undefined {
  if (a.kind === 'any') return b
  if (b.kind === 'any') return a
  if (a.kind === 'exact' && b.kind === 'exact') return a.host === b.host ? a : undefined
  if (a.kind === 'exact') return netResourceContains(b, a.host) ? a : undefined
  if (b.kind === 'exact') return netResourceContains(a, b.host) ? b : undefined
  if (netResourceContains(a, b.host)) return b
  if (netResourceContains(b, a.host)) return a
  return undefined
}

/**
 */
const pairFs = (ceil: readonly FsResource[], rest: readonly FsResource[]): FsResource[] => {
  const out: FsResource[] = []
  for (const c of ceil) for (const r of rest) {
    const i = intersectFsResource(c, r)
    if (i !== undefined) out.push(i)
  }
  return dedupeFs(out)
}

const pairNet = (ceil: readonly NetResource[], rest: readonly NetResource[]): NetResource[] => {
  const out: NetResource[] = []
  for (const c of ceil) for (const r of rest) {
    const i = intersectNetResource(c, r)
    if (i !== undefined) out.push(i)
  }
  return dedupeNet(out)
}

const dedupeFs = (list: readonly FsResource[]): FsResource[] => {
  const seen = new Set<string>()
  const unique: FsResource[] = []
  for (const r of list) {
    const key = r.kind === 'any' ? 'any' : `${r.kind}:${r.path}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(r)
  }
  // COLLAPSE CONTAINED RESOURCES. `/w` and `/w/a` are one reach, not two: keeping both makes a
  // later count or comparison say "two grants" when the agent has one. A resource survives only
  // if no OTHER resource in the list already contains it.
  return unique.filter((r) => !unique.some((other) => other !== r && (other.kind === 'any' || (r.kind !== 'any' && (other.kind === 'subtree' && fsResourceContains(other, r.kind === 'exact' ? r.path : r.path))))))
}

const dedupeNet = (list: readonly NetResource[]): NetResource[] => {
  const seen = new Set<string>()
  const out: NetResource[] = []
  for (const r of list) {
    const key = r.kind === 'any' ? 'any' : `${r.kind}:${r.host}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r)
  }
  return out
}

/**
 * Compile the effective policy. This is the ONLY function that may produce an `EffectiveIo`,
 * and it only ever narrows: the result is a subset of both sides on every axis.
 */
export function compileEffectiveIo (ceiling: IoPolicy, restriction: IoPolicy): EffectiveIo {
  const read = pairFs(ceiling.read, restriction.read)
  const write = pairFs(ceiling.write, restriction.write)
  // Denials are kept, not subtracted: an `any` allow minus one host is not representable, and a
  // subtraction that approximated it would either re-grant the host or silently drop the allow.
  // `allowsNet` consults the deny list first, which is a total answer for every shape.
  const netAllow = pairNet(ceiling.net.allow, restriction.net.allow)
  const netDeny = dedupeNet([...ceiling.net.deny, ...restriction.net.deny])
  const emptyAxes: IoAxis[] = []
  if (read.length === 0) emptyAxes.push('fs.read')
  if (write.length === 0) emptyAxes.push('fs.write')
  if (netAllow.length === 0) emptyAxes.push('net')
  return {
    read,
    write,
    net: { allow: netAllow, deny: netDeny },
    emptyAxes,
  }
}

/** The three predicates the runtime consults. Each answers only for its own axis. */
export function allowsRead (io: EffectiveIo, path: string): boolean {
  return io.read.some((r) => fsResourceContains(r, path))
}

export function allowsWrite (io: EffectiveIo, path: string): boolean {
  return io.write.some((r) => fsResourceContains(r, path))
}

export function allowsNet (io: EffectiveIo, host: string): boolean {
  if (io.net.deny.some((d) => netResourceContains(d, host))) return false
  return io.net.allow.some((a) => netResourceContains(a, host))
}
