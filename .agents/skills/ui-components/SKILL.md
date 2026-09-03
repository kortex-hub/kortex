---
name: ui-components
description: UI Component Development Guide for Kaiden
---

# UI Component Development Guide for Kaiden

## Core Rules

### 1. Check `@podman-desktop/ui-svelte` before building from scratch

Before creating any new UI component, **always check `@podman-desktop/ui-svelte` first**. This is the shared component library that Kortex builds on. Only build custom components when nothing in this library fits.

**Available components from `@podman-desktop/ui-svelte`:**

| Component                                                                      | Purpose             |
| ------------------------------------------------------------------------------ | ------------------- |
| `Button`, `CloseButton`, `Expandable`                                          | Button variants     |
| `Input`, `NumberInput`, `SearchInput`                                          | Form inputs         |
| `Checkbox`                                                                     | Checkboxes          |
| `Dropdown`, `DropdownMenu`                                                     | Selection menus     |
| `Table`, `TableColumn`, `TableRow`, `TableSimpleColumn`, `TableDurationColumn` | Data tables         |
| `DetailsPage`, `FormPage`, `NavPage`, `Page`                                   | Page layouts        |
| `Modal`                                                                        | Modal dialogs       |
| `Tab`                                                                          | Tab navigation      |
| `Tooltip`                                                                      | Tooltips            |
| `Link`                                                                         | Styled links        |
| `Spinner`, `LinearProgress`                                                    | Loading indicators  |
| `StatusIcon`                                                                   | Status indicators   |
| `EmptyScreen`, `FilteredEmptyScreen`                                           | Empty state views   |
| `ErrorMessage`                                                                 | Error alerts        |
| `Carousel`                                                                     | Carousel            |
| `ListOrganizer`                                                                | List management     |
| `SettingsNavItem`                                                              | Settings navigation |

**Icons** are available from `@podman-desktop/ui-svelte/icons` (see rule 3 below).

**Priority order when building UI:**

1. Use a component from `@podman-desktop/ui-svelte`
2. Use an existing Kortex shared component (see rule 4)
3. Extend an existing component if close but not quite right
4. Only build from scratch as a last resort

### 2. Never use Tailwind colors directly

**Never use raw Tailwind color classes** like `bg-red-500`, `text-gray-700`, `border-blue-300`, etc.

Always use CSS variables from the color-registry so that values can be tuned by themes (light/dark mode and custom themes).

Format: `[var(--pd-<color-name>)]`

```svelte
<!-- WRONG -->
<div class="bg-gray-800 text-white border-purple-500">...</div>

<!-- CORRECT -->
<div class="bg-[var(--pd-content-bg)] text-[var(--pd-content-text)] border-[var(--pd-content-divider)]">...</div>
```

Non-color Tailwind utilities (layout, spacing, sizing, typography, borders, effects) are fine.

### 3. Use the Icon component for all icons

Use the `Icon` component from `@podman-desktop/ui-svelte/icons` instead of inline SVGs, custom icon wrappers, or direct `<Fa>` usage.

```svelte
<script lang="ts">
import { Icon } from '@podman-desktop/ui-svelte/icons';
import { faGear } from '@fortawesome/free-solid-svg-icons';
</script>

<!-- CORRECT -->
<Icon icon={faGear} size="xs" />

<!-- WRONG: inline SVG -->
<svg viewBox="0 0 512 512"><path d="M..."/></svg>

<!-- WRONG: direct Fa usage -->
<Fa icon={faGear} />
```

The Icon component supports:

- FontAwesome `IconDefinition` objects (via `<Fa>` internally)
- Font class icon strings (`fas fa-*`, `far fa-*`, `fab fa-*`, or `-icon` suffix)
- Data URI images (strings starting with `data:image/`)
- Svelte Components

### 4. Reuse existing Kortex Svelte components

If `@podman-desktop/ui-svelte` doesn't have what you need, check Kortex's own shared components before building from scratch:

**Primary shared component locations:**

- `packages/renderer/src/lib/ui/` — Core UI components (~50 components)
- `packages/renderer/src/lib/button/` — Button components
- `packages/renderer/src/lib/table/` — Table components
- `packages/renderer/src/lib/modal/` — Modal dialogs
- `packages/renderer/src/lib/forms/` — Form components
- `packages/renderer/src/lib/dialogs/` — Dialog components
- `packages/renderer/src/lib/appearance/` — Theme/appearance components

**Key reusable components include:**

| Component         | File                            | Purpose                      |
| ----------------- | ------------------------------- | ---------------------------- |
| `Badge`           | `lib/ui/Badge.svelte`           | Status badges and labels     |
| `Button`          | `lib/button/Button.svelte`      | Standard buttons             |
| `DetailsPage`     | `lib/ui/DetailsPage.svelte`     | Detail view layouts          |
| `FormPage`        | `lib/ui/FormPage.svelte`        | Form page layouts            |
| `Label`           | `lib/ui/Label.svelte`           | Form labels                  |
| `SlideToggle`     | `lib/ui/SlideToggle.svelte`     | Toggle switches              |
| `Typeahead`       | `lib/ui/Typeahead.svelte`       | Autocomplete inputs          |
| `StatusDot`       | `lib/ui/StatusDot.svelte`       | Status indicators            |
| `Steps`           | `lib/ui/Steps.svelte`           | Step-by-step wizards         |
| `WarningMessage`  | `lib/ui/WarningMessage.svelte`  | Warning banners              |
| `FileInput`       | `lib/ui/FileInput.svelte`       | File upload inputs           |
| `PasswordInput`   | `lib/ui/PasswordInput.svelte`   | Password fields              |
| `CopyToClipboard` | `lib/ui/CopyToClipboard.svelte` | Clipboard copy functionality |

Always search for existing components before creating new ones. If an existing component is close but not quite right, prefer extending it over duplicating it.

## How the Color Registry Works

Colors are defined in `packages/main/src/plugin/color-registry.ts` in the `initColors()` method, organized by category.

### Finding the right color variable

1. Open `packages/main/src/plugin/color-registry.ts`
2. Find the appropriate category in `initColors()` (e.g. `initButton()`, `initInput()`, `initTable()`)
3. Each category has a prefix constant (e.g. `const button = 'button-';`)
4. The CSS variable name is `--pd-` + prefix + specific name

### Common color categories and prefixes

| Category   | Prefix         | Example variable         | Usage                  |
| ---------- | -------------- | ------------------------ | ---------------------- |
| Content    | `content-`     | `--pd-content-bg`        | Page backgrounds, text |
| Button     | `button-`      | `--pd-button-primary-bg` | Button colors          |
| Input      | `input-field-` | `--pd-input-field-bg`    | Form input colors      |
| Table      | `table-`       | `--pd-table-header-bg`   | Table styling          |
| Modal      | `modal-`       | `--pd-modal-bg`          | Modal dialogs          |
| Card       | `card-`        | `--pd-card-bg`           | Card components        |
| Tab        | `tab-`         | `--pd-tab-active-bg`     | Tab navigation         |
| Status     | `status-`      | `--pd-status-running`    | Status indicators      |
| Navigation | `global-nav-`  | `--pd-global-nav-bg`     | Navigation bars        |

### Example: Styling a new component

```svelte
<script lang="ts">
  import { Button } from '@podman-desktop/ui-svelte';
  import { Icon } from '@podman-desktop/ui-svelte/icons';
  import { faPlus } from '@fortawesome/free-solid-svg-icons';
</script>

<div class="bg-[var(--pd-content-bg)] text-[var(--pd-content-text)] p-4 rounded-lg">
  <h2 class="text-[var(--pd-content-header)]">Title</h2>
  <p class="text-[var(--pd-content-text)]">Description</p>

  <Button on:click={handleAction}>
    <Icon icon={faPlus} size="xs" />
    Add Item
  </Button>
</div>
```
