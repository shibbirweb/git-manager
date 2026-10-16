# EmptyState

The centered message of an empty panel or tab, with an optional icon, hint and action.

```ts
import EmptyState from "@git-manager/ui/components/EmptyState.svelte";
```

Group: Feedback. Also known as: Empty.

## When to use

Use when a list or view has nothing to show. Say what the user can do next in `hint`.

## Props

- `title` (`string`, required): What is empty.
- `hint` (`string`, default `""`): What to do next.
- `icon` (`IconName | null`, default `null`): An icon above the title.
- `iconStyle` (`"plain" | "circle" | "large-circle"`, default `"plain"`): The icon alone, or on a round tinted badge.
- `titleSize` (`"normal" | "large"`, default `"normal"`): A larger title, as on a failed view.
- `titleTone` (`"default" | "dim" | "danger"`, default `"default"`): A dim one-line placeholder (Loading..., Select a
  file) or a red title for errors.
- `overlay` (`boolean`, default `false`): Covers its positioned parent, over the content.
- `delayed` (`boolean`, default `false`): Fades in after 250 ms, so a loading message does not flash when the work is
  quick.
- `iconTone` (`"inherit" | "faint" | "accent" | "success"`, default `"inherit"`): The icon's color; inherit takes the
  text's.
- `strong` (`boolean`, default `false`): A bold title.
- `variant` (`"area" | "panel" | "notice" | "pane"`, default `"area"`): Area: centered in an editor or list. Panel:
  small text at a side panel's top, a big thin icon. Notice: panel in a dashed box, for something to set up. Pane:
  centered in a whole side panel (No git repository).
- `action` (`Snippet`): A button under the text.

## Example: No stashes

```svelte
<EmptyState icon="stash" title="No stashes" hint="Stash changes to set them aside." />
```

## Example: Loading

```svelte
<EmptyState title="Loading diff..." delayed />
```

## Replaces in the app

- `<div class="placeholder">...</div>`
- `<div class="empty">...</div>`
- `the .empty and .notice blocks of src/lib/ai/AiPanel.svelte`
- `<div class="placeholder loading"> with its `appear` animation (ChangesDiff)`
