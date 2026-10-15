# Tabs

Panel tabs in small capitals with an accent underline, like Terminal / Run / Git Console.

```ts
import Tabs from "@git-manager/ui/components/Tabs.svelte";
```

Group: Navigation. Also known as: Tabs.

## When to use

Use in a panel header to switch its views. Use Segmented for a setting with a few choices.

## Props

- `tabs` (`{ value: T; label: string; title?: string }[]`, required): The tabs in order; `title` is a tooltip, such as
  the tab's shortcut.
- `value` (`T extends string`, required, bindable): The shown tab.
- `label` (`string`, required): Accessible name of the tab list.
- `variant` (`"panel" | "underline"`, default `"panel"`): Panel tabs in small capitals, or normal words with a thick
  line under the chosen one (Search Everywhere's scopes).
- `keepFocus` (`boolean`, default `false`): Tabs over a search field: pressing one leaves the focus in the field, and
  the tabs take no focus.
- `onchange` (`(value: T) => void`): Called when the user picks another tab.

## Example: Bottom panel

```svelte
<Tabs label="Panel views" bind:value={tab} {tabs} />
```

## Replaces in the app

- `<div class="tabs" role="tablist"> in TerminalPanel.svelte`

## Logic

- `logic/roving.ts`
