# Boot 7 — authorization record (u7-fsmut suite, ctl-native-write cell)

R2 review (branch task/u7-9a-review-r2-20261026 @ 90751c69f, VERDICT
BLOCKED on ONE item) — the sole remaining blocker for `fsm:ctl-native-write`
offers exactly two honest resolutions: "(a) … ENV_BLOCK … or (b) if your
prepared-but-unbooted fix makes it pass on a real boot, spend a boot (you
have budget) and record the disk evidence."

Main-agent directive (2026-10-26): "Fix round 2 of max 2 … resolve it one
of two ways, honestly: … (b) … spend a boot (you have budget) and record
the disk evidence. … Then update every place that summarises the C2 tally."

Chosen path: (b) — the kit fix (oracle walks the factory hostTree = the
member-native session root measured in boots 5/6, records the run-unique
bytes, then removes its own file to restore the pristine runtime tree)
was committed in 0632c1629 and unit-pinned; a real boot records the cell
with the runner's OWN disk evidence, which is the accepted evidence class
for the write/edit PASS cells.

Budget: the c2/budget-ledger.jsonl holds 6 entries (4 delivery + 2 R1
grant); this run is authorized as boot 7 of the round-2 fix by the R2
review's explicit "(you have budget)" + the main-agent directive above;
the runner is invoked with --max-host-starts 7 and the ledger entry is
appended by the runner itself. No boot 8 in this PR without a new ruling.
