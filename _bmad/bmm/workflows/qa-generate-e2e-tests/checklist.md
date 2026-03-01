# Quinn Automate - Validation Checklist

## Setup

- [ ] Test framework detected (or selected and installed)
- [ ] agent-browser available (`agent-browser --version`) — install if UI exists

## Test Generation

- [ ] API tests generated (if applicable)
- [ ] E2E tests generated (if UI exists)
- [ ] Tests use standard test framework APIs
- [ ] Tests cover happy path
- [ ] Tests cover 1-2 critical error cases

## agent-browser Live Verification (if UI exists)

- [ ] Application running locally before tests execute
- [ ] `agent-browser snapshot -i` used to discover elements before interaction
- [ ] Semantic locators used (role, text, label) over CSS selectors
- [ ] Happy path flow executed and visually confirmed
- [ ] Error states triggered and confirmed (e.g., validation messages visible)
- [ ] Screenshots taken for key steps (`--annotate` flag used)
- [ ] No `agent-browser wait <ms>` hardcoded sleeps — use condition-based waits

## Test Quality

- [ ] All generated tests run successfully
- [ ] Tests use proper locators (semantic, accessible)
- [ ] Tests have clear descriptions
- [ ] No hardcoded waits or sleeps
- [ ] Tests are independent (no order dependency)

## Output

- [ ] Test summary created (includes agent-browser live results)
- [ ] Screenshots saved to `tests/e2e/screenshots/`
- [ ] Generated test files saved to appropriate directories
- [ ] Summary includes coverage metrics

## Validation

Run the tests using your project's test command.

**Expected**: All tests pass ✅

---

**Need more comprehensive testing?** Install [Test Architect (TEA)](https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/) for advanced workflows.
