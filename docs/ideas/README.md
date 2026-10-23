# docs/ideas — inbox for构想 without execution authority

An Idea here:

* may describe any future behaviour, tool, or reorganisation;
* grants **no** work authority, no contract status, and no test exemption;
* is not required to have implementation, a RUN, or a passing check — and the
  document checks must therefore never fail an Idea for lacking runtime
  evidence (that false-red is what kills a proposal inbox);
* matures by citation: a decision is taken in `.agents/notes/`, an approval is
  recorded in `dev/engineering/registry.yaml`, and the durable statement gets a
  stable id in `docs/contracts/engineering-baseline/ids.yaml`. The Idea file
  stays as the origin record.

File form: `IDEA-<scope>-<nnnn>-<slug>.md` with the `IDEA-*` id listed in
`ids.yaml` (`kind: idea`) so references resolve. No frontmatter contract beyond
`id` and `status: idea` is enforced.
