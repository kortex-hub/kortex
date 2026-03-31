# Kortex Playwright Testing Examples

## Example 1: Core App Test (Using electron-app fixtures)

Tests that don't require provider resources use the base `electron-app` fixtures.

```typescript
// tests/playwright/src/specs/extensions-smoke.spec.ts
import { BADGE_TEXT, builtInExtensions } from 'src/model/core/types';
import { expect, test } from '../fixtures/electron-app';
import { waitForNavigationReady } from '../utils/app-ready';

test.describe('Extensions page navigation', { tag: '@smoke' }, () => {
  test.beforeEach(async ({ page, navigationBar }) => {
    await waitForNavigationReady(page);
    await navigationBar.navigateToExtensionsPage();
  });

  test('[EXT-01] Extension navigation tabs are accessible', async ({ extensionsPage }) => {
    const tabs = extensionsPage.getAllTabs();
    const expectedTabCount = 3;

    expect(tabs).toHaveLength(expectedTabCount);

    for (const tab of tabs) {
      await expect(tab).toBeVisible();
      await expect(tab).toBeEnabled();
    }
  });

  test('[EXT-03] Built-in extensions are visible with correct badges', async ({ extensionsPage }) => {
    const installedPage = await extensionsPage.openInstalledTab();

    for (const extension of builtInExtensions) {
      const extensionLocator = installedPage.getExtension(extension.locator);
      await expect(extensionLocator).toBeVisible();

      const badge = installedPage.getExtensionBadge(extension.locator);
      await expect(badge).toBeVisible();
      await expect(badge).toHaveText(BADGE_TEXT);
    }
  });
});
```

**Key patterns:**

- Import `test` and `expect` from `../fixtures/electron-app`
- Call `waitForNavigationReady(page)` in `beforeEach`
- Use `navigationBar.navigateTo*()` to reach the target page
- Use page object methods for all assertions — no raw locators in tests

---

## Example 2: Provider-Specific Test (Using provider-fixtures)

Tests that need an AI provider use the extended `provider-fixtures`.

```typescript
// tests/playwright/src/specs/provider-specs/chat-smoke.spec.ts
import { TIMEOUTS } from 'src/model/core/types';
import { expect, test } from '../../fixtures/provider-fixtures';
import { waitForNavigationReady } from '../../utils/app-ready';

// Shared beforeEach at file level for all describe blocks
test.beforeEach(async ({ page, navigationBar, chatPage }) => {
  await waitForNavigationReady(page);
  await navigationBar.navigateToChatPage();
  const existingCount = await chatPage.getChatHistoryCount();
  if (existingCount > 0) {
    await chatPage.deleteAllChatHistoryItems();
    await chatPage.verifyChatHistoryEmpty();
    await chatPage.ensureNotificationsAreNotVisible();
  }
});

test.describe.serial('Chat UI elements', { tag: '@smoke' }, () => {
  test('[CHAT-UI-01] All chat UI elements are visible', async ({ chatPage }) => {
    await chatPage.verifyHeaderElementsVisible();
    await chatPage.verifyInputAreaVisible();
    await chatPage.verifySuggestedMessagesVisible();
  });
});

test.describe.serial('Chat history management', { tag: '@smoke' }, () => {
  test('[CHAT-HIST-01] Create and check new chat history item', async ({ chatPage }) => {
    await chatPage.ensureChatSidebarVisible();
    const initialCount = await chatPage.getChatHistoryCount();
    await chatPage.getSuggestedMessages().last().click();
    await expect
      .poll(async () => await chatPage.getChatHistoryCount(), { timeout: TIMEOUTS.MODEL_RESPONSE })
      .toBe(initialCount + 1);
  });
});
```

**Key patterns:**

- Import from `../../fixtures/provider-fixtures` (extends electron-app fixtures)
- `resourceSetup` runs automatically (auto: true) — no explicit call needed
- Use `test.describe.serial()` to group tests by scenario (e.g., history, model selection, editing)
- Use `CHAT-<SCENARIO>-<NUM>` test IDs so each group numbers independently
- Use `expect.poll()` with `TIMEOUTS.MODEL_RESPONSE` for LLM-dependent assertions

---

## Example 3: Multi-Step Workflow with Cleanup

```typescript
test('[CHAT-HIST-02] Create and switch between multiple chat sessions', async ({ chatPage }) => {
  test.slow(); // 3x timeout for complex workflows

  await chatPage.ensureChatSidebarVisible();
  let messageCount = await chatPage.getChatHistoryCount();

  // Cleanup: clear existing data
  if (messageCount > 0) {
    await chatPage.deleteAllChatHistoryItems();
    await chatPage.verifyChatHistoryEmpty();
    messageCount = 0;
  }

  // Act: create multiple sessions
  const chatSessions = [
    { message: 'What is Kubernetes?', expectedIndex: 1 },
    { message: 'Explain Docker containers', expectedIndex: 0 },
  ];

  for (const session of chatSessions) {
    await chatPage.clickNewChat();
    await chatPage.sendMessage(session.message);
    messageCount++;
    await expect
      .poll(async () => await chatPage.getChatHistoryCount(), { timeout: TIMEOUTS.MODEL_RESPONSE })
      .toBe(messageCount);
  }

  // Assert: verify each session preserved
  for (const session of chatSessions) {
    await chatPage.clickChatHistoryItemByIndex(session.expectedIndex);
    await chatPage.verifyConversationMessage(session.message);
  }
});
```

**Key patterns:**

- `test.slow()` for tests that need extended timeout
- Clean state before acting
- Loop-based data-driven steps
- Separate act and assert phases

---

## Example 4: Conditional Test Skipping

```typescript
test('[CHAT-MODEL-01] Switch between all available models', async ({ chatPage }) => {
  const chatModelNames = await chatPage.getChatModelNames();

  // Skip if preconditions aren't met
  if (chatModelNames.length < 2) {
    test.skip(true, 'Skipping test: Less than 2 chat models available');
    return;
  }

  const modelsToTest = chatModelNames.slice(0, 3).reverse();

  for (const modelName of modelsToTest) {
    await chatPage.clickNewChat();
    await chatPage.selectModelByName(modelName);
    const selectedModelName = await chatPage.getSelectedModelName();
    expect(selectedModelName).toBe(modelName);

    const testMessage = `Test message for model: "${selectedModelName}"`;
    await chatPage.sendMessage(testMessage);
    await chatPage.verifyConversationMessage(testMessage);
  }
});
```

**Key patterns:**

- Query dynamic data first, then conditionally skip
- Always provide a skip reason string

---

## Example 5: Cross-Feature Test (Chat + Flows)

```typescript
test('[CHAT-INTG-02] Export chat as Flow', async ({
  chatPage,
  navigationBar,
  flowsPage,
  resource,
  gooseSetup: _gooseSetup, // Trigger fixture without using the value
}) => {
  // Skip for unsupported providers
  test.skip(resource === 'ollama', 'Flows not supported for Ollama');
  test.skip(resource === 'ramalama', 'Flows not supported for RamaLama');

  await navigationBar.navigateToChatPage();
  await chatPage.ensureChatSidebarVisible();
  await chatPage.clickNewChat();

  const prompt = 'write a typescript recursive fibonacci method';
  const expectedPattern = /(\w+)\(\s*(\w+)\s*-\s*1\s*\)\s*\+\s*\1\(\s*\2\s*-\s*2\s*\)/;
  const flowName = 'export-chat-as-flow';

  await chatPage.sendMessage(prompt);
  await chatPage.verifyConversationMessage(prompt);
  await expect
    .poll(async () => await chatPage.verifyModelConversationMessage(expectedPattern), {
      timeout: TIMEOUTS.MODEL_RESPONSE,
      message: 'Model should respond with recursive Fibonacci code pattern',
    })
    .toBeTruthy();

  // Export and verify
  const currentModelName = await chatPage.getSelectedModelName();
  const flowCreatePage = await chatPage.exportAsFlow();
  await flowCreatePage.waitForLoad();
  await expect(flowCreatePage.selectModelDropdown).toContainText(currentModelName);

  await flowCreatePage.createNewFlow(flowName);
  await navigationBar.navigateToFlowsPage();
  await flowsPage.ensureRowExists(flowName, TIMEOUTS.STANDARD, false);

  // Cleanup
  await flowsPage.deleteAllFlows();
});
```

**Key patterns:**

- Destructure fixture with `_` prefix to trigger it without using the value (`gooseSetup: _gooseSetup`)
- Use `resource` fixture to conditionally skip by provider
- Navigate between pages via `navigationBar`
- Use `expect.poll()` with custom `message` for debugging clarity

---

## Example 6: MCP Setup with Environment Gating

```typescript
const hasGithubToken = !!process.env[MCP_SERVERS.github.envVarName];

// Configure MCP servers only when token is available and platform is supported
test.use({
  mcpServers: process.env[MCP_SERVERS.github.envVarName] && process.platform !== 'linux' ? ['github'] : [],
});

test('[CHAT-INTG-01] Verify MCP tool list visibility', async ({ mcpSetup: _mcpSetup, navigationBar, chatPage }) => {
  test.skip(!hasGithubToken, 'GITHUB_TOKEN not set');
  test.skip(isLinux, 'safeStorage issues on Linux');

  await navigationBar.navigateToChatPage();

  await expect(chatPage.toolsSelectionButton).toBeVisible({ timeout: TIMEOUTS.MODEL_RESPONSE });
  await chatPage.ensureToolsSidebarVisible();

  await expect(chatPage.getMcpServerLabel(MCP_SERVERS.github.serverName)).toBeVisible();
  const toolCount = await chatPage.getToolCount();
  expect(toolCount).toBeGreaterThan(1);

  // Filter and verify
  const toolName = 'create_branch';
  await chatPage.filterTools(toolName);
  await expect(chatPage.getToolByName(toolName)).toBeVisible();

  await chatPage.filterToolsInput.clear();
  await expect.poll(async () => chatPage.getToolCount()).toBe(toolCount);
});
```

**Key patterns:**

- Use `test.use()` to configure fixtures at the describe level
- Guard with `test.skip()` for missing env vars or unsupported platforms
- Use constants from `MCP_SERVERS` for server names and env var references

---

## Example 7: Creating a New Page Object

```typescript
// tests/playwright/src/model/pages/my-new-page.ts
import { expect, type Locator, type Page } from '@playwright/test';
import { TIMEOUTS } from 'src/model/core/types';
import { BasePage } from './base-page';

export class MyNewPage extends BasePage {
  // Declare all locators as readonly properties
  readonly heading: Locator;
  readonly createButton: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    super(page);
    // Prefer getByRole, getByLabel, getByText
    this.heading = this.page.getByRole('heading', { name: 'My Feature' });
    this.createButton = this.page.getByRole('button', { name: 'Create New' });
    this.searchInput = this.page.getByLabel('Search');
  }

  // Required: implement waitForLoad
  async waitForLoad(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });
  }

  // Methods encapsulate interactions
  async createItem(name: string): Promise<void> {
    await expect(this.createButton).toBeEnabled();
    await this.createButton.click();
    // ... fill form, submit
  }

  // Return other page objects for navigation
  async openDetailsTab(): Promise<MyDetailsTabPage> {
    return this.openTab(this.detailsTabButton, MyDetailsTabPage);
  }
}
```

---

## Example 8: Adding a Page Object to Fixtures

```typescript
// In electron-app.ts, add to the interface and fixture definitions:

export interface ElectronFixtures {
  // ... existing fixtures ...
  myNewPage: MyNewPage;
}

export const test = base.extend<ElectronFixtures>({
  // ... existing fixtures ...

  myNewPage: async ({ page }, use): Promise<void> => {
    const myNewPage = new MyNewPage(page);
    await use(myNewPage);
  },
});
```

Then add navigation in `NavigationBar`:

```typescript
async navigateToMyNewPage(): Promise<MyNewPage> {
  return this.navigateTo(this.myNewLink, MyNewPage);
}
```

---

## Example 9: Dialog Handling

```typescript
import { handleDialogIfPresent } from '../../utils/app-ready';

// Non-throwing: returns boolean indicating if dialog was found
const dialogHandled = await handleDialogIfPresent(page, {
  dialogName: 'Confirmation',
  buttonName: 'Yes',
  timeout: 5_000,
  waitForDialogToDisappear: true,
});

// Throwing: fails test if dialog is missing
await handleDialogIfPresent(page, {
  dialogName: 'Delete Confirmation',
  buttonName: 'Delete',
  throwErrorOnFailOrMissing: true,
});
```

---

## Example 10: Table Operations (BaseTablePage)

```typescript
// Ensure a row appears (with polling)
await flowsPage.ensureRowExists('my-flow', TIMEOUTS.STANDARD);

// Ensure a row disappears after deletion
await flowsPage.ensureRowDoesNotExist('my-flow', TIMEOUTS.STANDARD);

// Get row count
const count = await flowsPage.countRowsFromTable();

// Get a specific row locator for further assertions
const row = await flowsPage.getRowLocatorByName('my-flow');
await expect(row.getByText('Running')).toBeVisible();

// Partial match
const row = await flowsPage.getTableRowByName('my-flow', false); // exact = false
```
