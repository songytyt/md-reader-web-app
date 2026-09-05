# Testing policy

Every feature change must include relevant unit tests in the same change.

- Cover the feature's expected behavior and meaningful failure or edge cases.
- Update existing tests when behavior changes.
- Run `npm run test:unit` and the relevant integration or browser suites before handoff.
- Do not consider a feature complete while its relevant tests are missing or failing.
