# Testing policy

Every feature change must include relevant unit tests in the same change.

- Cover the feature's expected behavior and meaningful failure or edge cases.
- Update existing tests when behavior changes.
- Run `npm run test:unit` and the relevant integration or browser suites before handoff.
- Do not consider a feature complete while its relevant tests are missing or failing.

# Branch policy

Before starting work for a GitHub issue, read its description and classify the work rather than relying on the issue title or labels alone. Create and switch to a new branch using a conventional, lowercase, hyphen-separated name that includes the issue number:

- `fix/<issue-number>-<short-description>` when the issue describes incorrect, broken, or regressed existing behavior
- `feat/<issue-number>-<short-description>` when the issue requests new functionality or an enhancement
- `chore/<issue-number>-<short-description>` for maintenance or tooling
- `docs/<issue-number>-<short-description>` for documentation-only work
- `refactor/<issue-number>-<short-description>` for code restructuring
- `test/<issue-number>-<short-description>` for test-only work

For example, GitHub issue `#42` reporting broken sidebar scrolling becomes `fix/42-sidebar-scroll`; issue `#57` requesting Markdown export becomes `feat/57-markdown-export`.
