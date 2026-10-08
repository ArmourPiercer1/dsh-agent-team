# The one red leg of `a4p7-merge-gate.test.ts` is base-equal (no build performed)

The battery runs `a4p7-merge-gate.test.ts` = **26 tests, 1 failed**. The failing leg is
`the composition smoke leg > is green, asserted by arm name and by absence of a skip`.
It refuses in any worktree that has never run `pnpm build`. Per the lane instruction the
refusal is proven base-equal rather than built away (a build would also rewrite
committed `dist` surfaces, which is not this lane's to do).

## Proof 1 — the refusal text is byte-identical at base and in this lane

```
byte-identical: True
length base=604  lane=604
```

The compared span starts at `It read "refused". why:` and ends before the
`The limit of that sentence` clause, i.e. it is the whole diagnostic that decides the
verdict: the missing arm, the missing file, the declared output root, and the install
surfaces that do not carry it.


## Proof 2 — the leg itself names the tree it measured

| run | transcript | HEAD | tracked changed vs HEAD | untracked entries |
|---|---|---|---:|---:|
| base (zero changes) | `08-runtime-testkit-green-baseline.txt` | `e80a00da` | 0 | 1 |
| this lane, pre-rebase | `16-merge-gate-alone-after-stage.txt` | `e80a00da` | 17 | 4 |
| this lane, on the rebased tree (final battery) | `29-final-battery-named-suites-rebased.txt` | `ceecacc2` | 1 | 4 |

The base row is the load-bearing one: the refusal already exists at `HEAD e80a00da`
**with zero tracked files changed**, i.e. before this lane existed at all. The later
rows only add evidence files, and the diagnostic they print is byte-identical to the
base one. Nothing this
lane adds touches the client build surface: `packages/client/dist` does not exist in a
fresh worktree (the leg's own words: `packages/client/dist does not exist (0 file(s) in
it)`, `gitignored and untracked`, `it is in no install surface`), and the lane changed
**zero tracked files** (`git status --porcelain` after staging lists only additions under
`dev/agent-workflow/evidence/a4-pr7/7-5-remainder/`).

