# Pinned Host excerpts (verbatim, unmodified)

Source: `deepseek-ai/deepseek-harness` @ `639ed015397290b3745d163aafe02ffee4aa3f84`
(`dsh-v0.2.0-rc.2`). Permalinks:

- https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/packages/core/agent-loop/src/inbox.ts
- https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/packages/core/agent-loop/src/agent.ts

Only the blocks the design relies on are quoted (fair-use review evidence);
the full files are not vendored.

## inbox.ts — two durable lists, claim, replace/remove

```ts
// inbox.ts:22,30
'next-turn': z.array(z.custom<UserMessage>()).readonly(),
...
init: (): InboxState => ({ 'next-turn': [], 'next-step': [] }),
```

```ts
// inbox.ts:92-113
  get hasPending(): boolean {
    const state = this.current()
    return state['next-turn'].length > 0 || state['next-step'].length > 0
  }

  clear(): void {
    this.splice('next-step', 0, this.nextStep.length, [])
    this.splice('next-turn', 0, this.nextTurn.length, [])
  }

  claim(target: InboxTarget, turn: number): UserMessage[] {
    const claimed = this.mutate('next-step', 0, this.nextStep.length, [], false)
    if (target === 'next-turn') claimed.push(...this.mutate('next-turn', 0, 1, [], false))
    for (const message of claimed) this.dispatch.emit('agent/inbox/claimed', { message, turn })
    return claimed
  }
```

```ts
// inbox.ts:134-156
  replace(messageId: MessageId, newMessage: UserMessage): boolean {
    const location = this.locate(messageId)
    if (location === undefined) return false
    this.splice(location.target, location.index, 1, [newMessage])
    return true
  }

  remove(messageId: MessageId): boolean {
    const location = this.locate(messageId)
    if (location === undefined) return false
    this.splice(location.target, location.index, 1, [])
    return true
  }
```

## agent.ts — wake, claim at the step boundary, turn loop

```ts
// agent.ts:155-164
    const wakingAfterAbort = ... 
    const resolvedTarget = wakingAfterAbort ? 'next-turn' : target
    ...
    this.send(input, 'next-turn', true)
```

```ts
// agent.ts:254-271
      while (await this.turn()) {}
...
  private async preStep(target: InboxTarget, position: { turn: number; step: number }): Promise<PreparedStep> {
    ...
    const claimed = this.inbox.claim(target, position.turn)
```

```ts
// agent.ts:295-305
  private async turn(): Promise<boolean> {
    ...
    const turn = phase.turn + 1
    ...
    this.session.append('turn/start', { turn })
```
