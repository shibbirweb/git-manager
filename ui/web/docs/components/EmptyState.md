# EmptyState

The centered message of an empty panel or tab, with an optional icon, hint and action.

```ts
import EmptyState from "$ui/components/EmptyState.svelte";
```

Group: Feedback. Also known as: Empty.

## When to use

Use when a list or view has nothing to show. Say what the user can do next in `hint`.

## Props

- `title` (`string`, required): What is empty.
- `hint` (`string`, default `""`): What to do next.
- `icon` (`IconName | null`, default `null`): An icon above the title.
- `action` (`Snippet`): A button under the text.

## Example: No stashes

```svelte
<EmptyState icon="stash" title="No stashes" hint="Stash changes to set them aside." />
```

## Replaces in the app

- `<div class="placeholder">...</div>`
- `<div class="empty">...</div>`
