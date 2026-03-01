# Quinn QA - Automate

**Goal**: Generate automated API and E2E tests for implemented code, and perform live browser verification using agent-browser.

**Scope**: This workflow generates tests AND executes live browser-based E2E testing. It does **not** perform code review or story validation (use Code Review `CR` for that).

## Instructions

### Step 0: Detect Test Framework & Tools

Check project for existing test framework:

- Look for `package.json` dependencies (playwright, jest, vitest, cypress, etc.)
- Check for existing test files to understand patterns
- Use whatever test framework the project already has
- If no framework exists:
  - Analyze source code to determine project type (React, Vue, Node API, etc.)
  - Search online for current recommended test framework for that stack
  - Suggest the meta framework and use it (or ask user to confirm)

**Check agent-browser availability:**

```bash
agent-browser --version
```

- If not installed: `npm install -g agent-browser && agent-browser install`
- agent-browser enables live browser control without needing a test framework
- Install it when: the project has a UI, no E2E framework is set up, or quick smoke testing is needed

### Step 1: Identify Features

Ask user what to test:

- Specific feature/component name
- Directory to scan (e.g., `src/components/`)
- Or auto-discover features in the codebase

### Step 2: Generate API Tests (if applicable)

For API endpoints/services, generate tests that:

- Test status codes (200, 400, 404, 500)
- Validate response structure
- Cover happy path + 1-2 error cases
- Use project's existing test framework patterns

### Step 3: E2E Tests (if UI exists)

Use **agent-browser** for live browser verification. Follow this pattern:

#### 3a. Start the application

Ensure the dev server is running (start it if needed, e.g., `npm run dev`).

#### 3b. Navigate and discover

```bash
# Open the page to test
agent-browser open http://localhost:PORT/path
agent-browser wait --load networkidle

# Get accessibility tree with element refs (@e1, @e2, ...)
agent-browser snapshot -i
```

Review the snapshot output to identify interactive elements by their refs.

#### 3c. Interact using semantic locators

Prefer semantic locators over CSS selectors:

```bash
# By ARIA role + accessible name
agent-browser find role button click --name "Submit"
agent-browser find role textbox fill "user@example.com" --name "Email"

# By visible text
agent-browser find text "Sign In" click

# By label
agent-browser find label "Password" fill "secret123"

# By snapshot ref (from Step 3b output)
agent-browser click @e2
agent-browser fill @e5 "input value"

# After page changes, refresh snapshot
agent-browser snapshot -i
```

#### 3d. Assert outcomes

```bash
# Verify element is visible
agent-browser is visible ".success-banner"

# Check text content matches expected
agent-browser get text "h1"

# Verify navigation occurred
agent-browser get url

# Take annotated screenshot for traceability
agent-browser screenshot tests/e2e/screenshots/feature-happy-path.png --annotate
```

#### 3e. Cover required scenarios per feature

For each feature, test:

1. **Happy path** — normal flow completes and shows expected outcome
2. **Error state** — invalid input shows appropriate error message
3. **Edge case** — empty state, boundary value, or key navigation path

#### 3f. Persist as test files (optional, if test framework exists)

After verifying flows live with agent-browser, translate to persistent test files:

- Convert interactions to Playwright/Cypress/Vitest-browser syntax
- Keep tests linear and simple — no helper abstractions
- Mirror the semantic locators used above
- Assert visible outcomes only
- No hardcoded waits (`waitForSelector`, `waitForTimeout` are OK; `sleep` is not)

### Step 4: Run Tests

- **agent-browser flows**: Already executed in Step 3 — results are available via screenshots and command output
- **Generated test files**: Run with the project's test command (e.g., `npx playwright test`, `npm test`)
- Fix any failures immediately before proceeding

### Step 5: Create Summary

Output markdown summary:

```markdown
# Test Automation Summary

## Generated Tests

### API Tests
- [x] tests/api/endpoint.spec.ts - Endpoint validation

### E2E Tests (agent-browser live)
- [x] Login flow — happy path (screenshot: tests/e2e/screenshots/login-happy-path.png)
- [x] Login flow — invalid credentials error message

### E2E Tests (generated files)
- [x] tests/e2e/feature.spec.ts - User workflow

## Coverage
- API endpoints: 5/10 covered
- UI features: 3/8 covered

## Next Steps
- Run generated tests in CI
- Add more edge cases as needed
```

## Keep It Simple

**Do:**

- Use agent-browser for immediate live verification
- Use semantic locators (roles, labels, visible text)
- Focus on happy path + critical errors
- Write readable, maintainable test files
- Run all tests to verify they pass
- Take screenshots for key flow steps

**Avoid:**

- Complex fixture composition
- Over-engineering
- Unnecessary abstractions
- Hardcoded waits or sleeps
- CSS selectors when semantic locators are available

**For Advanced Features:**

If the project needs:

- Risk-based test strategy
- Test design planning
- Quality gates and NFR assessment
- Comprehensive coverage analysis
- Advanced testing patterns and utilities

→ **Install Test Architect (TEA) module**: <https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/>

## Output

Save summary to: `{implementation_artifacts}/tests/test-summary.md`

**Done!** Tests verified live with agent-browser and summary saved.
