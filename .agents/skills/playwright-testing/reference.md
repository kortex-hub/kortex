# Kaiden Playwright Testing Reference

## BasePage API

| Method          | Signature                                             | Description                                                                                               |
| --------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `waitForLoad()` | `abstract waitForLoad(): Promise<void>`               | Must be implemented by subclasses. Called automatically by `NavigationBar.navigateTo*()` and `openTab()`. |
| `openTab()`     | `openTab<T>(button, PageClass, timeout?): Promise<T>` | Clicks a tab button, instantiates the target page class, waits for load, and returns it.                  |

## BaseTablePage API

Extends `BasePage`. Constructor requires `(page, tableName)` where `tableName` is the table's `aria-label`.

| Method                    | Signature                                       | Description                                                     |
| ------------------------- | ----------------------------------------------- | --------------------------------------------------------------- |
| `getTableRowByName()`     | `(name, exact?): Promise<Locator \| undefined>` | Returns row matching `aria-label`, or `undefined` if not found. |
| `countRowsFromTable()`    | `(): Promise<number>`                           | Returns number of data rows (excludes header).                  |
| `ensureRowExists()`       | `(name, timeout?, exact?): Promise<void>`       | Polls until row appears. Fails on timeout.                      |
| `ensureRowDoesNotExist()` | `(name, timeout?, exact?): Promise<void>`       | Polls until row disappears. Fails on timeout.                   |
| `getRowLocatorByName()`   | `(name, exact?): Promise<Locator>`              | Returns row locator. Throws if not found.                       |
| `getRowLocatorByIndex()`  | `(index): Promise<Locator>`                     | Returns row by zero-based index. Throws if out of bounds.       |

## NavigationBar API

| Method                       | Returns                   | Description                          |
| ---------------------------- | ------------------------- | ------------------------------------ |
| `navigateToChatPage()`       | `Promise<ChatPage>`       | Navigates to Chat page               |
| `navigateToMCPPage()`        | `Promise<McpPage>`        | Navigates to MCP page                |
| `navigateToFlowsPage()`      | `Promise<FlowsPage>`      | Navigates to Flows page              |
| `navigateToExtensionsPage()` | `Promise<ExtensionsPage>` | Navigates to Extensions page         |
| `navigateToSettingsPage()`   | `Promise<SettingsPage>`   | Navigates to Settings (toggle-aware) |
| `getAllLinks()`              | `Locator[]`               | Returns all navigation link locators |

## App Readiness Utilities (`utils/app-ready.ts`)

| Function                   | Signature                                       | Description                                                                |
| -------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------- |
| `waitForAppReady()`        | `(page, timeout?): Promise<void>`               | Waits for main element, initialization screen, title bar, and welcome page |
| `waitForNavigationReady()` | `(page, timeout?): Promise<void>`               | `waitForAppReady()` + navigation bar visibility                            |
| `handleDialogIfPresent()`  | `(page, options?): Promise<boolean>`            | Handles optional dialogs. Returns `true` if found and handled.             |
| `clearAllToasts()`         | `(page, toastLocator, timeout?): Promise<void>` | Presses Escape and waits for toasts to disappear                           |

### DialogOptions

```typescript
interface DialogOptions {
  dialogName?: string; // Default: 'Confirmation'
  buttonName?: string; // Default: 'Yes'
  timeout?: number; // Default: 5_000
  throwErrorOnFailOrMissing?: boolean; // Default: false
  waitForDialogToDisappear?: boolean; // Default: true
}
```

## Test Artifacts (`utils/test-artifacts.ts`)

| Function                            | Description                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------ |
| `saveTestArtifacts(page, testInfo)` | On failure: saves trace.zip, failure.png, video.webm. On success: stops trace chunk. |

## Types & Constants (`model/core/types.ts`)

### TIMEOUTS

```typescript
TIMEOUTS.PAGE_LOAD; // 90_000  — Page initial load
TIMEOUTS.STANDARD; // 30_000  — Standard operations
TIMEOUTS.SHORT; // 10_000  — Quick checks
TIMEOUTS.MODEL_RESPONSE; // 90_000  — LLM responses
TIMEOUTS.DEFAULT; // 120_000 — App startup
TIMEOUTS.INITIALIZING_SCREEN; // 180_000 — Initialization
TIMEOUTS.NON_DEVTOOLS_WINDOW; // 60_000 — Electron window
TIMEOUTS.RETRY_DELAY; // 1_000   — Between retries
TIMEOUTS.MAX_RETRIES; // 3       — Max retry count
```

### Enums

```typescript
enum Button { STOP, START, DELETE }
enum State { ACTIVE, DISABLED }
enum ExtensionStatus { RUNNING, STOPPED, UNKNOWN }
enum PreferenceOption { APPEARANCE, EDITOR, EXIT_ON_CLOSE, ... }
```

### Data Constants

```typescript
builtInExtensions; // Array of { name, locator } for all built-in extensions
resources; // Map of resource IDs to { displayName, hasCreateButton }
PROVIDERS; // Map of provider IDs to { envVarName, resourceId, ... }
MCP_SERVERS; // Map of MCP server IDs to { envVarName, serverName }
SELECTORS; // DOM selectors for app shell elements
```

## Fixture Interfaces

### ElectronFixtures (test-scoped)

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

### WorkerFixtures (worker-scoped, provider-fixtures only)

```typescript
interface WorkerFixtures {
  workerElectronApp: ElectronApplication;
  workerPage: Page;
  workerNavigationBar: NavigationBar;
  resource: ResourceId; // 'gemini' | 'openai' | 'ollama' | 'ramalama' | 'openshift-ai'
  resourceSetup: void; // Auto: true — creates/deletes provider resource
  mcpServers: MCPServerId[]; // Default: ['github']
  mcpSetup: void; // Auto: false — must reference in test to trigger
  gooseSetup: void; // Auto: false — must reference in test to trigger
}
```

## Playwright Config Projects

| Project             | testMatch                                     | Condition              | resource   |
| ------------------- | --------------------------------------------- | ---------------------- | ---------- |
| `Kaiden-App-Core`   | `**/*.spec.ts` (ignores provider-specs)       | Always                 | —          |
| `Gemini-Provider`   | `**/provider-specs/*.spec.ts`                 | `GEMINI_API_KEY` set   | `gemini`   |
| `OpenAI-Provider`   | `**/provider-specs/*.spec.ts`                 | `OPENAI_API_KEY` set   | `openai`   |
| `Ollama-Provider`   | `**/provider-specs/*.spec.ts` (ignores flows) | `OLLAMA_ENABLED` set   | `ollama`   |
| `RamaLama-Provider` | `**/provider-specs/*.spec.ts` (ignores flows) | `RAMALAMA_ENABLED` set | `ramalama` |

## Locator Cheatsheet

```typescript
// Roles
page.getByRole('button', { name: 'Submit' });
page.getByRole('heading', { name: 'Title', level: 2 });
page.getByRole('link', { name: 'Home' });
page.getByRole('row').and(page.getByLabel('row-name'));
page.getByRole('dialog', { name: 'Confirm', exact: true });
page.getByRole('navigation', { name: 'AppNavigation' });
page.getByRole('region', { name: 'content' });
page.getByRole('table', { name: 'Flows' });

// Forms
page.getByLabel('Email');
page.getByPlaceholder('Search...');

// Text
page.getByText('Welcome', { exact: true });

// Test IDs
page.getByTestId('submit-btn');

// Filtering
locator.filter({ hasText: 'keyword' });
locator.filter({ has: page.getByRole('button') });

// Nth
locator.first();
locator.last();
locator.nth(2);
```

## Assertion Cheatsheet

```typescript
// Visibility
await expect(locator).toBeVisible();
await expect(locator).toBeHidden();
await expect(locator).not.toBeVisible();

// State
await expect(locator).toBeEnabled();
await expect(locator).toBeDisabled();

// Content
await expect(locator).toHaveText('exact text');
await expect(locator).toContainText('partial');
await expect(locator).toHaveValue('input value');
await expect(locator).toHaveCount(3);

// Viewport
await expect(locator).toBeInViewport();

// Polling (async operations)
await expect.poll(async () => await getCount(), { timeout: 90_000 }).toBe(5);
await expect
  .poll(async () => await check(), {
    timeout: TIMEOUTS.MODEL_RESPONSE,
    message: 'Description for debugging',
  })
  .toBeTruthy();

// Synchronous
expect(value).toBe(expected);
expect(value).toBeTruthy();
expect(array).toHaveLength(3);
expect(count).toBeGreaterThan(0);
```

## CLI Commands

```bash
# Run all tests
pnpm run test:e2e

# Run specific project
npx playwright test --project="Kaiden-App-Core"

# Run specific file
npx playwright test tests/playwright/src/specs/extensions-smoke.spec.ts

# Run tests matching name
npx playwright test -g "CHAT-01"

# Debug mode (step through)
npx playwright test --debug

# UI mode (interactive)
npx playwright test --ui

# Show HTML report
pnpm run test:e2e:report

# View trace file
npx playwright show-trace path/to/trace.zip
```

## Environment Variables

| Variable             | Purpose                                              |
| -------------------- | ---------------------------------------------------- |
| `GEMINI_API_KEY`     | Gemini provider API key                              |
| `OPENAI_API_KEY`     | OpenAI provider API key                              |
| `OLLAMA_ENABLED`     | Enable Ollama provider tests                         |
| `RAMALAMA_ENABLED`   | Enable RamaLama provider tests                       |
| `OPENSHIFT_AI_TOKEN` | OpenShift AI authentication                          |
| `GITHUB_TOKEN`       | MCP GitHub server token                              |
| `KAIDEN_BINARY`      | Path to production binary (vs dev mode)              |
| `CI`                 | CI environment flag (enables retries, mock keychain) |
| `KAIDEN_HOME_DIR`    | Test config directory (auto-set by fixtures)         |
