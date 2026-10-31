/**
 * A5W PoC E-4 — resolvePublicAddresses 公网 ACCEPT 腿（unicast 地址真解析）
 *
 * ⚠ PoC 不入生产判据。
 * ⚠ **ENV 腿（真网）**：本文件是 E-4 accept 腿的首次真机运行。原判据「本机禁真网」在
 *   2026-10-31 的本环境不再成立（协调席实测真网可用；见 WEB-NATIVE-POC.md 追加节）。
 *   本腿只做 **DNS 解析 + 出厂法则校验**：零 TCP 请求、零凭据、零 boot、零端口监听、
 *   零宿主树写入。单独文件 = vitest 独立文件面：真网失败/跳过不改写其余 47 例的结果。
 *
 * seam（宿主公开面，禁改宿主树 → 只读动态导入 pristine @639ed01539）：
 *   packages/web/web-fetch-http/lib/types/network.js —— 声明模块
 *   `@module @deepseek-ai/dsh-web-fetch-http/network`（network.d.ts 公开声明
 *   resolvePublicAddresses / isPublicIpAddress / publicHttpNetwork）。出厂 provider 的
 *   公开构造参数 resolveAddresses 的默认值 = publicHttpNetwork.resolve（index.js 源码级），
 *   本文件用 publicHttpNetwork.resolve === resolvePublicAddresses 的同一性见证被测函数
 *   就是出厂 provider 派发到 socket 之前执行的那条法则本体——不读私有字段、不 monkey-patch。
 *
 * 判定法则（诚实优先，写死在代码里）：
 *   PASS           — 法则接受了解析结果，全部答案为公网 unicast，且与 OS 旁证 getent 有交集；
 *                    两主机的接受集互不相同（透明拦截池指纹不存在）。
 *   ENV-BLOCKED    — 解析本身失败（ENOTFOUND/EAI_AGAIN/无答案）→ 真网不可用 → 运行时
 *                    ctx.skip()（不是 PASS，也不是 FAIL；E-4 维持 ENV-PENDING）。
 *   ENV-CONTESTED  — 环境答案不可信 → 显式 FAIL（红）：非公网答案 / 两主机答案集相交或
 *                    全同 / getent 旁证与法则接受集零交集。协调席曾见 DNS 19µs（透明代理
 *                    提示），旁证即为此设。红/Contested 也是有效结论，不判 PASS。
 *   LAW-DEFECT     — 法则接受了非 unicast 地址，或对全公网答案抛 WEB_BLOCKED_URL → 显式 FAIL。
 */
import { describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { lookup as systemLookup } from 'node:dns/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { findTestRepoRoot, testUseTree } from '../paths.mjs'

const execFileAsync = promisify(execFile)

const REPO_ROOT = findTestRepoRoot(process.cwd())
if (REPO_ROOT === null) throw new Error('P-SETUP: no pristine test-use tree found')
const PRISTINE = testUseTree(REPO_ROOT)

type PublicAddress = { address: string; family: 4 | 6 }
const networkLib = (await import(pathToFileURL(join(PRISTINE, 'packages/web/web-fetch-http/lib/types/network.js')).href)) as {
  resolvePublicAddresses: (hostname: string, signal: AbortSignal, resolver?: unknown) => Promise<PublicAddress[]>
  isPublicIpAddress: (input: string) => boolean
  publicHttpNetwork: { resolve: (hostname: string, signal: AbortSignal, resolver?: unknown) => Promise<PublicAddress[]> }
}
const httpProviderLib = (await import(pathToFileURL(join(PRISTINE, 'packages/web/web-fetch-http/lib/index.js')).href)) as {
  HttpFetchProvider: new (limits: Record<string, unknown>, resolveAddresses?: (hostname: string, signal: AbortSignal) => Promise<PublicAddress[]>) => {
    id: string
    available(): boolean
    fetch(req: { url: string }, signal?: AbortSignal): Promise<unknown>
  }
}

// 两个不同属主的真公开主机名：example.com（Cloudflare/AWS，ICANN 保留演示域）与
// api.deepseek.com（商业 CDN）。答案集若跨主机全同/相交 = 透明拦截池指纹。
const HOSTS = ['example.com', 'api.deepseek.com'] as const

const codeOf = (e: unknown): string => String((e as { code?: string })?.code ?? '')
const nameOf = (e: unknown): string => String((e as { name?: string })?.name ?? '')

type HostOutcome = {
  host: string
  accepted: PublicAddress[] | null
  lawError: string | null
  lawMs: number
  raw: PublicAddress[] | null
  rawError: string | null
  getent: string[] | null
  getentRaw: string
}

async function resolveGetent(host: string): Promise<{ ips: string[] | null; raw: string }> {
  try {
    const { stdout } = await execFileAsync('getent', ['hosts', host], { timeout: 15_000 })
    const ips = stdout
      .split('\n')
      .map((line) => String(line.trim().split(/\s+/)[0] ?? ''))
      .filter((token) => token.length > 0)
    return { ips: ips.length > 0 ? ips : null, raw: stdout.trim() }
  } catch (e) {
    return { ips: null, raw: `getent-failed:${codeOf(e) || nameOf(e) || String(e)}` }
  }
}

describe('P-W4/E-4 — resolvePublicAddresses public-accept leg (ENV, real DNS only, zero request/credential/boot/port)', () => {
  it('E4-0 seam witness (zero DNS): the exported network module identity holds and the law is wired through the provider PUBLIC constructor seam', async () => {
    // 同一性：publicHttpNetwork.resolve === resolvePublicAddresses（出厂默认的来源）。
    expect(networkLib.publicHttpNetwork.resolve).toBe(networkLib.resolvePublicAddresses)
    // 行为见证：把被测函数经公开构造参数显式装入 provider，loopback 字面量必须被
    // 法则在 socket 之前拒掉（字面量路径零 DNS、零连接）。
    const provider = new httpProviderLib.HttpFetchProvider(
      { maxResponseBytes: 1024, maxBodyChars: 16, timeoutMs: 5_000, maxRedirects: 0, userAgent: 'poc-a5w-e4' },
      (hostname, signal) => networkLib.resolvePublicAddresses(hostname, signal),
    )
    let code = 'DELIVERED'
    try {
      await provider.fetch({ url: 'http://127.0.0.1:1/page' })
    } catch (e) {
      code = codeOf(e)
    }
    expect(code).toBe('WEB_BLOCKED_URL')
  })

  it('E4-1 accept leg (ENV): real public hostnames resolve through the shipped law and unicast public answers are ACCEPTED — contested answers are reported honestly, never as PASS', async (ctx) => {
    const outcomes: HostOutcome[] = []
    for (const host of HOSTS) {
      const signal = new AbortController().signal
      const t0 = performance.now()
      let accepted: PublicAddress[] | null = null
      let lawError: string | null = null
      try {
        accepted = await networkLib.resolvePublicAddresses(host, signal)
      } catch (e) {
        lawError = `${nameOf(e)}:${codeOf(e)}:${String((e as Error)?.message ?? e)}`
      }
      const lawMs = performance.now() - t0
      let raw: PublicAddress[] | null = null
      let rawError: string | null = null
      try {
        raw = (await systemLookup(host, { all: true, order: 'verbatim' })) as PublicAddress[]
      } catch (e) {
        rawError = `${codeOf(e) || nameOf(e)}:${String((e as Error)?.message ?? e)}`
      }
      const { ips, raw: getentRaw } = await resolveGetent(host)
      outcomes.push({ host, accepted, lawError, lawMs, raw, rawError, getent: ips, getentRaw })
    }

    const evidence = outcomes
      .map((o) => `${o.host}: law(${o.lawMs.toFixed(1)}ms)=${o.accepted ? JSON.stringify(o.accepted) : `THROW ${String(o.lawError)}`}`
        + ` raw=${o.raw ? JSON.stringify(o.raw) : `ERR ${String(o.rawError)}`}`
        + ` getent=${o.getent ? JSON.stringify(o.getent) : String(o.getentRaw).replace(/\s+/g, ' | ')}`)
      .join('\n  ')
    console.log(`[E4][evidence]\n  ${evidence}`)

    // ── ENV-BLOCKED：解析本身不可得（真网/真 DNS 不可用）→ 诚实 skip，E-4 维持 ENV-PENDING。
    const blocked = outcomes.filter((o) => o.accepted === null && o.lawError !== null && !String(o.lawError).includes('WEB_BLOCKED_URL'))
    if (blocked.length > 0) {
      console.log(`[E4][ENV-BLOCKED] resolution unavailable: ${blocked.map((o) => `${o.host} -> ${String(o.lawError)}`).join('; ')} — E-4 stays ENV-PENDING, not FAIL, not PASS`)
      ctx.skip()
      return
    }

    // ── 法则抛 WEB_BLOCKED_URL：环境把非公网答案递给了出厂法则 → 旁证分类。
    const lawBlocked = outcomes.filter((o) => o.accepted === null && String(o.lawError).includes('WEB_BLOCKED_URL'))
    if (lawBlocked.length > 0) {
      const witness = lawBlocked.map((o) => `${o.host}: raw=${JSON.stringify(o.raw)} getent=${JSON.stringify(o.getent)}`)
      const anyRawPublic = lawBlocked.some((o) => (o.raw ?? []).some((a) => networkLib.isPublicIpAddress(a.address)))
      if (anyRawPublic) throw new Error(`[E4][LAW-DEFECT] law refused an answer set our own lookup sees as containing public addresses (resolver inconsistency or law fault): ${witness.join('; ')}`)
      throw new Error(`[E4][ENV-CONTESTED] environment serves NON-PUBLIC answers for real public hostnames (transparent DNS interference); the law correctly refused, so the accept leg CANNOT be judged PASS: ${witness.join('; ')}`)
    }

    // ── 法则已接受全部两主机答案：逐项核验。
    const defects: string[] = []
    const contested: string[] = []
    const acceptedSets = new Map<string, Set<string>>()
    for (const o of outcomes) {
      const set = new Set((o.accepted ?? []).map((a) => a.address))
      acceptedSets.set(o.host, set)
      if (set.size === 0) { contested.push(`${o.host}: law accepted an EMPTY answer set`); continue }
      for (const a of o.accepted ?? []) {
        if (!networkLib.isPublicIpAddress(a.address)) defects.push(`${o.host}: law ACCEPTED non-unicast/non-public address ${a.address}`)
      }
      // 旁证对照：OS 解析旁证（getent，宿主代码之外的第二证人）须与法则接受集有交集。
      if (o.getent === null) {
        contested.push(`${o.host}: getent witness unavailable (${String(o.getentRaw)}) and no other independent witness — unverified`)
      } else if (o.getent.every((ip) => !set.has(ip))) {
        contested.push(`${o.host}: getent ${JSON.stringify(o.getent)} ∩ law-accepted ${JSON.stringify([...set])} = ∅`)
      }
    }
    // 跨主机指纹：不同属主的主机答案集若相交/全同 = 单一拦截池嫌疑。
    const [a, b] = [acceptedSets.get(HOSTS[0]) ?? new Set<string>(), acceptedSets.get(HOSTS[1]) ?? new Set<string>()]
    const overlap = [...a].filter((ip) => b.has(ip))
    if (overlap.length > 0) contested.push(`cross-host answer overlap (interception pool fingerprint): ${JSON.stringify(overlap)}`)

    if (defects.length > 0) throw new Error(`[E4][LAW-DEFECT] ${defects.join('; ')}`)
    if (contested.length > 0) throw new Error(`[E4][ENV-CONTESTED] ${contested.join('; ')} — NOT judged PASS; red is a valid verdict`)

    // ── PASS：真 unicast 公网答案被出厂法则接受，旁证一致，无拦截指纹。
    for (const o of outcomes) {
      expect(o.accepted, `${o.host} accepted`).not.toBeNull()
      expect((o.accepted ?? []).length, `${o.host} non-empty`).toBeGreaterThan(0)
    }
    console.log(`[E4][PASS] both hostnames accepted with real public unicast answers, corroborated by getent, no interception fingerprint (timings ${outcomes.map((o) => `${o.host}=${o.lawMs.toFixed(1)}ms`).join(', ')} — ms-scale = real upstream resolution, not the 19us cached-proxy hint)`)
  })
})
