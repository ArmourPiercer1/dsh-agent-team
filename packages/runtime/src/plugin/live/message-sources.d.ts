/**
 * Producer-owned MessageSource kinds of the `dsh-agent-team` plugin
 * (Session Format v4, DSH 0.1.7).
 *
 * The live glue (agent-bindings.mjs — plain JS, outside the tsc
 * program) creates Leader wake-up user messages carrying this plugin's
 * own producer kind; Session Format v4 retires the shared
 * `kind: 'plugin'` wrapper (v4 admission rejects it with
 * 'format v4 message requires a producer-owned source kind'). This
 * declaration merging registers that kind in the harness's
 * merge-extensible `MessageSourceMap` so typed consumers of
 * `createUserMessage` accept it (upstream extension pattern: each
 * producer declares its own `kind` in its own module).
 *
 * `plugin:dsh-agent-team` is the exact kind the official DSH v3→v4
 * session migration maps the historical v3
 * `{ kind: 'plugin', plugin: 'dsh-agent-team' }` rows to
 * (@deepseek-ai/dsh-session-format-v3-to-v4 `producerKind`: the plugin
 * name is in neither the renamed set nor the same-name set), so
 * legacy Session history and newly-created messages share one
 * producer identity.
 */
import type { ContextFormed } from '@deepseek-ai/dsh-llm'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    /**
     * Model-visible input delivered to a Leader by the live glue —
     * currently the work-completion wake (`[team-work-settled
     * requestToken=...]`-leading notification).
     */
    'plugin:dsh-agent-team': {
      readonly kind: 'plugin:dsh-agent-team'
    } & ContextFormed
  }
}
