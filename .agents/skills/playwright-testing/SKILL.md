# Playwright Test Automation Guide for Kortex

## Core Principles

1. **Page Object Model (POM)**: Every page/component gets its own class. Tests never touch raw locators directly.
2. **Resilient locators**: Use accessible selectors — `getByRole`, `getByLabel`, `getByText` — before falling back to `getByTestId` or CSS.
3. **Explicit waits**: Use `expect` with auto-retry or `expect.poll()` for async operations. Never use arbitrary `setTimeout` delays.
4. **Serial execution**: Use `test.describe.serial()` for interdependent tests (e.g., create → verify → delete flows).
5. **Fixture-based setup/teardown**: Resources, MCP servers, and Goose are managed via Playwright fixtures with automatic cleanup.
6. **Clear failures**: Every assertion should produce a readable error. Use descriptive test IDs (`[FEATURE-NUM]`).

## Project Structure

```
tests/playwright/
├── playwright.config.ts              # Test projects, timeouts, reporters
├── package.json
├── tsconfig.json
├── src/
│   ├── fixtures/
│   │   ├── electron-app.ts           # Core Electron app + page object fixtures
│   │   └── provider-fixtures.ts      # Provider resource/MCP/Goose setup (worker-scoped)
│   ├── model/
│   │   ├── core/
│   │   │   └── types.ts              # Enums, constants, interfaces, TIMEOUTS
│   │   ├── navigation/
│   │   │   └── navigation.ts         # NavigationBar — navigates to all major pages
│   │   └── pages/
│   │       ├── base-page.ts          # Abstract base: waitForLoad(), openTab()
│   │       ├── base-table-page.ts    # Table operations: row lookup, polling, counting
│   │       ├── chat-page.ts          # Chat UI interactions (40+ methods)
│   │       ├── flows-page.ts         # Flow management with table operations
│   │       ├── flows-create-page.ts  # Flow creation workflow
│   │       ├── flows-details-page.ts # Flow details view
│   │       ├── settings-page.ts      # Main settings hub
│   │       ├── mcp-page.ts           # MCP server management
│   │       ├── extensions-page.ts    # Extension browsing
│   │       └── *-tab-page.ts         # Sub-page/tab objects
│   ├── specs/
│   │   ├── dashboard.spec.ts         # App startup and navigation
│   │   ├── extensions-smoke.spec.ts  # Extension management
│   │   ├── settings-smoke.spec.ts    # Settings pages
│   │   └── provider-specs/           # Provider-specific tests
│   │       ├── chat-smoke.spec.ts    # Chat functionality (gold standard)
│   │       ├── flows-smoke.spec.ts   # Flow execution
│   │       └── mcp-smoke.spec.ts     # MCP servers
│   └── utils/
│       ├── app-ready.ts              # waitForAppReady(), waitForNavigationReady(), handleDialogIfPresent()
│       └── test-artifacts.ts         # Trace, screenshot, video capture on failure
└── output/                           # Generated reports and artifacts
```

## Naming Conventions

| Artifact       | Pattern                          | Example                          |
| -------------- | -------------------------------- | -------------------------------- |
| Page object    | `*-page.ts`                      | `chat-page.ts`                   |
| Tab sub-page   | `*-tab-page.ts`                  | `settings-resources-tab-page.ts` |
| Spec file      | `*-smoke.spec.ts` or `*.spec.ts` | `extensions-smoke.spec.ts`       |
| Test ID        | `[FEATURE-SCENARIO-NUM]`         | `[CHAT-HIST-01]`, `[EXT-03]`     |
| Provider specs | `provider-specs/*.spec.ts`       | `chat-smoke.spec.ts`             |
| Fixtures       | camelCase with purpose           | `resourceSetup`, `mcpSetup`      |

## Page Object Conventions

### Extending BasePage

All page objects extend `BasePage` and must implement `waitForLoad()`:

```typescript
import { BasePage } from './base-page';

export class MyPage extends BasePage {
  readonly heading: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = this.page.getByRole('heading', { name: 'My Page' });
  }

  async waitForLoad(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });
  }
}
```

### Extending BaseTablePage

For pages with data tables, extend `BaseTablePage` to get row lookup, polling, and counting for free:

```typescript
import { BaseTablePage } from './base-table-page';

export class MyTablePage extends BaseTablePage {
  constructor(page: Page) {
    super(page, 'My Table'); // aria-label of the table
  }

  async waitForLoad(): Promise<void> {
    await expect(this.table).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });
  }
}
```

Inherited methods: `getTableRowByName()`, `countRowsFromTable()`, `ensureRowExists()`, `ensureRowDoesNotExist()`, `getRowLocatorByName()`, `getRowLocatorByIndex()`.

### Tab Navigation via openTab()

Use `openTab()` to switch between tabs and return the new page object:

```typescript
async openInstalledTab(): Promise<InstalledTabPage> {
  return this.openTab(this.installedTabButton, InstalledTabPage);
}
```

## Locator Priority

Use this order when selecting elements:

1. `getByRole('button', { name: 'Submit' })` — accessibility-focused, preferred
2. `getByLabel('Email')` — form elements
3. `getByText('Welcome')` — visible content
4. `getByTestId('submit-btn')` — semantic fallback
5. CSS selectors — last resort only

## Fixture System

### Core Fixtures (`electron-app.ts`)

```typescript
interface ElectronFixtures {
  electronApp: ElectronApplication;
  page: Page;
  navigationBar: NavigationBar;
  settingsPage: SettingsPage;
  flowsPage: FlowsPage;
  mcpPage: McpPage;
  extensionsPage: ExtensionsPage;
  chatPage: ChatPage;
}
```

Import as: `import { test, expect } from '../fixtures/electron-app';`

### Provider Fixtures (`provider-fixtures.ts`)

Worker-scoped fixtures for provider-specific tests:

- **`resource`**: Selectable provider ID (`gemini`, `openai`, `ollama`, `ramalama`)
- **`resourceSetup`**: Auto-creates/deletes inference provider resources (auto: true)
- **`mcpSetup`**: Configures MCP servers with env-var-based credentials (auto: false)
- **`gooseSetup`**: Installs Goose CLI tool (auto: false)

Import as: `import { test, expect } from '../../fixtures/provider-fixtures';`

### When to use which fixture file

- **Core app tests** (extensions, settings, dashboard): Use `electron-app.ts`
- **Provider-specific tests** (chat, flows, MCP): Use `provider-fixtures.ts`

## Timeout Constants

Defined in `src/model/core/types.ts`:

```typescript
const TIMEOUTS = {
  PAGE_LOAD: 90_000, // Page initial load
  STANDARD: 30_000, // Standard operations
  SHORT: 10_000, // Quick checks
  MODEL_RESPONSE: 90_000, // LLM responses (especially local models)
  DEFAULT: 120_000, // App startup / general default
  INITIALIZING_SCREEN: 180_000, // App initialization
  NON_DEVTOOLS_WINDOW: 60_000, // Electron window detection
  RETRY_DELAY: 1_000, // Retry interval
  MAX_RETRIES: 3, // Max retry attempts
} as const;
```

## App Readiness Utilities

Located in `src/utils/app-ready.ts`:

| Function                               | Purpose                                                  |
| -------------------------------------- | -------------------------------------------------------- |
| `waitForAppReady(page)`                | Waits for main element, initialization screen, title bar |
| `waitForNavigationReady(page)`         | Waits for app + navigation bar to be visible             |
| `handleDialogIfPresent(page, options)` | Safely handles optional confirmation dialogs             |
| `clearAllToasts(page, toastLocator)`   | Dismisses all toast notifications                        |

**Always call `waitForNavigationReady(page)` in `beforeEach`** for specs that navigate.

## Test Configuration

### Playwright Config (`playwright.config.ts`)

- **Workers**: 1 (serial execution for Electron)
- **Timeout**: 180 seconds per test
- **Retries**: 1 in CI, 0 locally
- **Action timeout**: 15 seconds
- **Reporters**: HTML, JSON, JUnit, list

### Test Projects

| Project                 | Tests                           | Condition                   |
| ----------------------- | ------------------------------- | --------------------------- |
| `Kortex-App-Core`       | All specs except provider-specs | Always runs                 |
| `Gemini-Provider`       | provider-specs                  | Requires `GEMINI_API_KEY`   |
| `OpenAI-Provider`       | provider-specs                  | Requires `OPENAI_API_KEY`   |
| `Ollama-Provider`       | provider-specs (except flows)   | Requires `OLLAMA_ENABLED`   |
| `RamaLama-Provider`     | provider-specs (except flows)   | Requires `RAMALAMA_ENABLED` |
| `OpenShift-AI-Provider` | provider-specs                  | Currently disabled          |

## Running Tests

```bash
# Run all E2E tests (build + test)
pnpm run test:e2e

# Run tests only (must build first)
pnpm run test:e2e:run

# Run specific project
npx playwright test --project="Kortex-App-Core"

# Run specific spec
npx playwright test tests/playwright/src/specs/extensions-smoke.spec.ts

# Debug mode
npx playwright test --debug

# Show report
pnpm run test:e2e:report
```

## Conditional Test Skipping

```typescript
// Skip based on resource type
test.skip(resource === 'ollama', 'Flows not supported for Ollama');

// Skip based on available data
if (modelCount < 2) {
  test.skip(true, 'Skipping test: Less than 2 models available');
  return;
}

// Skip based on environment
test.skip(!hasGithubToken, 'GITHUB_TOKEN not set');
test.skip(isLinux, 'safeStorage issues on Linux');

// Mark as expected failure
if (!isCI) {
  test.fail();
}

// Mark as slow (3x timeout)
test.slow();
```

## Artifact Capture

On test failure, `saveTestArtifacts()` automatically captures:

- **Trace**: `trace.zip` — full Playwright trace with screenshots, snapshots, and sources
- **Screenshot**: `failure.png` — full-page screenshot at failure point
- **Video**: `video.webm` — recording of the test run
