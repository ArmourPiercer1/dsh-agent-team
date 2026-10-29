// M0-CLOSURE machine-v2 PURE CANDIDATE — 非产品 API、未冻结；中心合同=M0-A-LIFECYCLE-CONTRACT-v1.1(208ba98c…)。
// enum 与 schema/records 三方一致（本文件与 schema 同源生成，勿手改单侧）。
export type Acc = 'F' | 'W1' | 'W2';
export type Req = 'N-A-TOOL' | 'REQ' | 'REQ-COND' | 'REQ-COND-win32';
export type CurrentRoute = 'ASSEMBLY_STATIC' | 'DOMAIN_INTERSECTION_SELF_DETERMINED' | 'EXCLUDED_BY_SETUP' | 'HOST_REALM_INHERITED' | 'HOST_REALM_UNMOUNTED_OPTIN' | 'ISOLATION_SURFACE' | 'MCP_MOUNT_RECONCILE_CHAIN' | 'NESTED_COMPOSITE_PTC' | 'OWN_LAYER' | 'PLANE_ALIAS' | 'PLANE_FIXED_MOUNT' | 'PLANE_TAKEOVER' | 'PRODUCT_ARM_DORMANT_HOST_LIVE';
export type TargetGovernedRoute = 'DOMAIN_INTERSECTION_SELF_DETERMINED' | 'GOVERNED_ASSEMBLY_STATIC' | 'GOVERNED_COMPOSITE_SECOND_LAYER' | 'GOVERNED_MOUNT_RECONCILE' | 'GOVERNED_ON_DECLARED_MOUNT' | 'GOVERNED_OWN_LAYER' | 'GOVERNED_PRODUCT_ARM_TO_LIVE' | 'GOVERNED_TAKEOVER_HOST_BODY' | 'GOVERNED_TAKEOVER_OR_EQUIVALENT' | 'ISOLATION_GUARANTEED';
export type Scope = 'alias' | 'assembly' | 'host-conditional' | 'host-conditional-modelSelection' | 'host-dynamic-mcp-scope' | 'host-experimental-bundle-off' | 'host-preset-conditional' | 'host-preset-conditional-win32' | 'host-preset-cordis-only' | 'host-preset-off' | 'host-preset-on' | 'host-preset-on-setup-excluded-on-strict' | 'host-sdk-app-env-only' | 'host-unmounted-optin-package' | 'host-unmounted-shipped' | 'own-layer' | 'plane-fixed' | 'plane-host-impl' | 'plane-takeover' | 'surface';
export interface RouteRecord {
  readonly name: string; readonly scope: Scope; readonly fc: string;
  readonly currentRoute: CurrentRoute; readonly targetGovernedRoute: TargetGovernedRoute;
  readonly targetCeiling?: string; readonly acc: Acc; readonly req: Req; readonly reqSrc: string;
  readonly eff: readonly string[]; readonly prov: string; readonly life: string; readonly attr: string; readonly idx: string;
  readonly gap?: string; readonly routeFormPending?: string; readonly openDeliverable?: string; readonly note?: string;
}
// ---- 生命周期（严格状态图 + 身份/消费关系；中心 v1.1 §2/§4 之机器侧）----
export type Branch = 'ask' | 'all-allow';
export type State = 'RECEIVED' | 'CLASSIFIED' | 'REJECTED' | 'ALL_ADMITTED' | 'ASK_WAIT' | 'ASK_VERIFIED' | 'ASK_RESERVED' | 'PREPARING' | 'PREPARED' | 'PREPARE_FAILED' | 'DISPATCHED' | 'LEASE_UNCONFIRMED' | 'SETTLED' | 'UNCONFIRMED' | 'STALE' | 'CANCELLED';
export type TerminalState = 'REJECTED' | 'PREPARE_FAILED' | 'LEASE_UNCONFIRMED' | 'SETTLED' | 'UNCONFIRMED' | 'STALE' | 'CANCELLED';
export interface HostTokenRef { readonly fixtureRef: 'trusted-test-fixture'; readonly serialized: false } // 仅测试可信 fixture 引用；不证明真实 Host/不可伪造身份/OS 安全/C2
export interface BindingRef { readonly bindingId: string; readonly bindingRevisionCurrent: true; readonly status: 'ACTIVE' }
export interface GrantRef { readonly grantId: string; readonly logicalQuestionId?: string; readonly paCallIdEqCorrelation?: true; readonly effectsFingerprint: string; readonly issuedTo: { readonly invocationCorrelation: string }; readonly presenter?: { readonly trustedFromDecider: true }; readonly grantFromPriorProcess?: never }
export interface ControlRef { readonly request: { readonly invocationCorrelation: string; readonly requestId: string }; readonly decision: { readonly decisionSequence: number; readonly decision: 'allow' | 'deny' } }
export interface ConsumptionProof { readonly requestId: string; readonly decisionSequence: number } // root+requestId+decisionSequence（现码无 consumptionId 字段）
export interface LifecycleTrace {
  readonly branch: Branch; readonly invocationCorrelation: string; readonly hostCallId: string;
  readonly hostToken: HostTokenRef; readonly binding: BindingRef;
  readonly member: { readonly teamSessionId: string; readonly instanceId: string }; readonly realmId: string;
  readonly requestedEffects: { readonly fingerprint: string };
  readonly control?: ControlRef;              // ask-only；all-allow 携带=E_FORGED_APPROVAL
  readonly grant?: GrantRef; readonly consumptionProof?: ConsumptionProof;
  readonly freshValidation?: { readonly generationsRechecked: true; readonly bindingRevisionCurrent: true; readonly cancelRequested: false };
  readonly paConsume?: { readonly grantId: string; readonly ledgerChanged: true; readonly secondUse?: never };
  readonly bodyStarted?: boolean; readonly paConsumed?: boolean; readonly cleanupScoped?: boolean; readonly refundClaimed?: boolean;
  readonly cancel?: { readonly point: 'before-pa-consume' | 'after-pa-consume'; readonly ledgerUnchanged: boolean };
  readonly generationsOrScopeDriftObserved?: boolean; readonly leaseSettleEvidence?: unknown;
  readonly states: readonly State[]; readonly terminal: TerminalState;
}
export interface CheckerVerdict {
  readonly fixtureSuitePass: boolean;   // fixture 套件（负例 exact 多重集匹配、正例零错误）
  readonly candidateShapePass: boolean; // 被审 route-records-v3c.json 形状/覆盖
  readonly freezeEligible: false;       // P1/P4 未闭；恒 false，与两 PASS 分立
  readonly freezeReasons: readonly string[];
  readonly fixtureResults: readonly { readonly file: string; readonly pass: boolean; readonly expected: readonly string[]; readonly actual: readonly string[] }[];
  readonly candidateErrors: readonly string[];
}
