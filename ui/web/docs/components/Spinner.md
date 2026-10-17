# Spinner

A small spinning ring for work in progress.

```ts
import Spinner from "@nibtree/ui/components/Spinner.svelte";
```

Group: Feedback. Also known as: Spinner, Loader.

## When to use

Use beside a label while something loads or runs. Use ProgressBar when the share done is known.

## Props

- `label` (`string`, default `"Loading"`): What is loading, read by screen readers.
- `size` (`"small" | "normal" | "large"`, default `"normal"`): 10, 12 or 18 px; large for loading cards.
- `delayed` (`boolean`, default `false`): Fades in after 250 ms, so quick work does not flash it.

## Example: Loading

```svelte
<Spinner label="Loading the log" />
```

## Replaces in the app

- `<span class="spinner"></span>`
