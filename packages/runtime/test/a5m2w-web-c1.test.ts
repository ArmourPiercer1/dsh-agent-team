/**
 * a5m2w-web-c1.test.ts — M2-WEB-01 (web 族) formal C1: B-WEB classify & manifest.
 *
 * Contract: docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/
 * M0-B-FAMILY-TARGET-CONTRACTS.md §B-WEB — 目标 I + N(每实际目的地/搜索
 * provider) + D(存在独立域时) + S(query/fetch exact URL operation)。
 * S 臂裁定（CENTER/root 2026-10-23）：闭集里没有 `service` kind，S **不另立
 * effect kind** —— exact-operation 许可由 `I = tool-invoke@<精确 definition>`
 * 承载，目的地另立 `N = connect@network-destination(scheme://host[:port])`；
 * URL/query 摘要与 maxRedirects/maxBytes/timeoutMs 进 manifest（非 PA kind），
 * payloadFingerprint 作 operation 指纹。本套件把这条裁定钉进冻结解析器。
 *
 * 全部断言走 tool-governance 的冻结解析面（parseRequestedEffectSet /
 * parseResourceRef）——不新造平行体系，不新增 kind，不新增 PA 类型。
 * 运行形态实证（unknown 顶层键当前不拒且照常执行）在
 * dev/agent-workflow/evidence/alpha5/m2-web/ runner 的 P3/P4 腿；本文件的
 * 第 8 腿以静态 witness 钉住"当前形态"（描述形态，不判正确）。
 *
 * @module test/a5m2w-web-c1
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseRequestedEffectSet, parseResourceRef, EFFECT_KINDS } from '../../domain/tool-governance/src/index.js'
import { findTestRepoRoot, testUseTree, TEST_USE_BASELINE_SHA } from '../../../tests/paths.mjs'

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const REALM = 'realm-m2w'

/** The REAL configured DeepSeek search endpoint origin (host web-search-deepseek
 *  provider.ts:34 DEEPSEEK_DEFAULT_BASE_URL='https://api.deepseek.com/anthropic/v1'
 *  + provider.ts:217 `${baseURL}/messages`). 目的地取真实 config 的 origin，
 *  endpoint path 不进资源身份 —— 这正是"搜索不是固定网址 fetch 假实现"的
 *  classify 面：search 的 N 目的地是 provider 端点，与结果 URL 两层分离。 */
const DS_ORIGIN = 'https://api.deepseek.com'

function codesOf(result: { ok: false; problems: readonly { code: string }[] } | { ok: true }): string[] {
  return result.ok ? [] : result.problems.map((p) => p.code)
}

const netRef = (locator: string, rights: readonly string[] = ['connect']) => ({
  realmId: REALM, kind: 'network-destination', canonicalLocator: locator, rights,
})

describe('a5m2w web C1 — B-WEB classify/manifest over the frozen closed set', () => {
  it('C1-1 positive: the web_fetch operation effect set parses (I + N, closed verbs)', () => {
    const parsed = parseRequestedEffectSet([
      { kind: 'tool-invoke', toolName: 'web_fetch', resource: null },
      { kind: 'connect', resource: netRef('https://example.org') },
    ])
    expect(parsed.ok, JSON.stringify(codesOf(parsed as never))).toBe(true)
    if (!parsed.ok) return
    // 解析器把数组入参规整为 canonical 排序后的集合（非输入序）——按集合断言。
    const kinds = new Set(parsed.value.effects.map((e) => e.kind))
    expect(kinds.size).toBe(2)
    expect(kinds.has('tool-invoke')).toBe(true)
    expect(kinds.has('connect')).toBe(true)
    const connect = parsed.value.effects.find((e) => e.kind === 'connect')
    expect(connect && (connect as { resource: { rights: readonly string[] } }).resource.rights).toEqual(['connect'])
  })

  it('C1-2 positive: search arm binds the REAL provider origin (no fixed-URL fake; loopback syntax is a legal resource SHAPE)', () => {
    // search N = 真实 config 解析出的 provider origin（DS_ORIGIN，见顶部注释 path:line）。
    const parsed = parseRequestedEffectSet([
      { kind: 'tool-invoke', toolName: 'web_search', resource: null },
      { kind: 'connect', resource: netRef(DS_ORIGIN) },
    ])
    expect(parsed.ok, JSON.stringify(codesOf(parsed as never))).toBe(true)
    // 两层对象的 classify 面：结果 URL 从不出现在 effect set 里（它不是被
    // connect 的目的地）；provider origin 才是。
    if (parsed.ok) {
      const locators = parsed.value.effects
        .filter((e) => e.kind === 'connect')
        .map((e) => (e as { resource: { canonicalLocator: string } }).resource.canonicalLocator)
      expect(locators).toEqual([DS_ORIGIN])
    }
    // 语法面：loopback locator 在治理层是合法 resource 形状（生产 provider 的
    // loopback 拒在 policy 层 web-fetch-http；Team envelope 的 private 无条件拒
    // 由 web-gateway 臂承载，批次 2）——此处只钉 shape，不判 allow。
    const shape = parseResourceRef(netRef('http://127.0.0.1:3187'))
    expect(shape.ok).toBe(true)
  })

  it('C1-3 forged: connect bound to a filesystem resource → refused at the FIRST gate (resource rights-matrix)', () => {
    const parsed = parseRequestedEffectSet([
      { kind: 'tool-invoke', toolName: 'web_fetch', resource: null },
      { kind: 'connect', resource: { realmId: REALM, kind: 'absolute-path', canonicalLocator: '/etc/passwd', rights: ['connect'] } },
    ])
    expect(parsed.ok).toBe(false)
    // 实测钉住（2026-10-23 首跑红→正）：fs kind 携带 connect 权利在 RESOURCE_RIGHT_MATRIX
    // （resource.ts:67-75）就被拒（'rights-matrix'），根本到不了 effect 级
    // 'effect-resource-mismatch'——闭环比 effect 级检查更紧：connect 权利只有
    // network-destination 可携带，冒名臂在第一道闸即死。web envelope 的 N 臂因此
    // 没有"合法权利+错误 kind"的中间形态可伪造。
    expect(codesOf(parsed as never)).toContain('rights-matrix')
  })

  it('C1-4 locator law: a network destination never carries a path → locator-rejected', () => {
    const parsed = parseRequestedEffectSet([
      { kind: 'connect', resource: netRef('https://api.deepseek.com/anthropic/v1/messages') },
    ])
    expect(parsed.ok).toBe(false)
    expect(codesOf(parsed as never)).toContain('locator-rejected')
  })

  it('C1-5 S-ruling: no `service` kind is mintable — the closed set stays closed', () => {
    expect(EFFECT_KINDS).not.toContain('service' as never)
    const parsed = parseRequestedEffectSet([
      { kind: 'service', service: 'web_fetch/query', resource: null },
    ])
    expect(parsed.ok).toBe(false)
    expect(codesOf(parsed as never)).toContain('value-outside-closed-set')
  })

  it('C1-6 domain-ref (D arm): carries domainAuthorityId and NO resource', () => {
    const good = parseRequestedEffectSet([
      { kind: 'tool-invoke', toolName: 'web_fetch', resource: null },
      { kind: 'domain-ref', domainAuthorityId: 'dom-example', resource: null },
    ])
    expect(good.ok, JSON.stringify(codesOf(good as never))).toBe(true)
    const bad = parseRequestedEffectSet([
      { kind: 'domain-ref', domainAuthorityId: 'dom-example', resource: netRef('https://example.org') },
    ])
    expect(bad.ok).toBe(false)
    expect(codesOf(bad as never)).toContain('field-type')
  })

  it('C1-7 tool-invoke (I arm) carries no resource', () => {
    const parsed = parseRequestedEffectSet([
      { kind: 'tool-invoke', toolName: 'web_fetch', resource: netRef('https://example.org') },
    ])
    expect(parsed.ok).toBe(false)
    expect(codesOf(parsed as never)).toContain('field-type')
  })

  it('C1-8 cross-check (BASE.C1 family): host parameter ROOT is open at the pin — current shape, pinned as witness', () => {
    // todo 卡先例："顶层不声明 ⇒ 未知顶层键不拒且写入照常发生"。web 同形核对：
    // (a) 编译面 —— 参数根编译为 implicit open object，root 无 additionalProperties。
    // (b) 消费者面 —— tool-web 的 parameters DSL 为逐属性映射，根上无处声明关闭。
    // 本腿是 drift witness（钉"当前形态"，不判正确）：若上游日后 root 收口，
    // 本 witness 翻红，须重裁并在矩阵 ⑦ 更新记录。
    const hostRoot = findTestRepoRoot(REPO)
    expect(hostRoot, 'pinned host checkout reachable').toBeTruthy()
    const tree = testUseTree(hostRoot as string)
    const sha = execFileSync('git', ['-C', tree, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    expect(sha, `host tree moved (${sha}) — re-check the shape, do not silently pass`)
      .toBe(TEST_USE_BASELINE_SHA)
    const schemaSrc = readFileSync(`${tree}/packages/core/tools/src/schema.ts`, 'utf8')
    const fn = schemaSrc.slice(
      schemaSrc.indexOf('export function parameterSchemaSpecToJsonSchema'),
      schemaSrc.indexOf('export class ToolArgsError'),
    )
    expect(fn.length).toBeGreaterThan(80)
    // doc 注释在函数之上（实测首跑钉住）：witness 分两段——注释归属 + 函数体无 root 覆盖。
    const commentAt = schemaSrc.indexOf('implicit open parameter object')
    const fnAt = schemaSrc.indexOf('export function parameterSchemaSpecToJsonSchema')
    expect(commentAt).toBeGreaterThanOrEqual(0)
    expect(commentAt).toBeLessThan(fnAt)
    expect(fnAt - commentAt).toBeLessThan(300) // the comment sits directly above this function
    expect(fn.includes('additionalProperties'), 'root openness drifted — re-adjudicate C1-8').toBe(false)
    // (b) 消费者面：web 二工具的 parameters 均为逐属性映射（根声明不出现在 DSL）。
    const fetchSrc = readFileSync(`${tree}/packages/web/tool-web/src/fetch.ts`, 'utf8')
    const searchSrc = readFileSync(`${tree}/packages/web/tool-web/src/search.ts`, 'utf8')
    const fetchParams = fetchSrc.slice(fetchSrc.indexOf('parameters: {'), fetchSrc.indexOf('output: {'))
    const searchParams = searchSrc.slice(searchSrc.indexOf('parameters: {'), searchSrc.indexOf('output: {'))
    expect(fetchParams).toContain("url: { type: 'string', required: true")
    expect(searchParams).toContain('queries: {')
    expect(fetchParams.includes('additionalProperties'), 'web_fetch parameters gained a root override — re-adjudicate').toBe(false)
    expect(searchParams.includes('additionalProperties'), 'web_search parameters gained a root override — re-adjudicate').toBe(false)
  })
})
