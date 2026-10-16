# SideNav

A vertical list of sections with the open one marked, like the Settings sections.

```ts
import SideNav from "@git-manager/ui/components/SideNav.svelte";
```

Group: Navigation. Also known as: Sidebar navigation.

## When to use

Use beside a page of sections. A `danger` item (such as Reset) shows in red.

## Props

- `items` (`{ id: string; label: string; icon?: IconName; danger?: boolean }[]`, required): The sections.
- `variant` (`"settings" | "large" | "links"`, default `"settings"`): Settings' sections, the Welcome page's (36px), or
  dim links with icons.
- `active` (`string | null`, default `null`, bindable): The open section's id.
- `label` (`string`, required): Accessible name.
- `emptyText` (`string`, default `""`): Shown when there are no items (a search found no section).
- `onselect` (`(id: string) => void`): A section was picked.

## Example: Settings

```svelte
<SideNav label="Settings sections" {items} bind:active />
```

## Replaces in the app

- `<button class="nav-item"> in SettingsDialog`
