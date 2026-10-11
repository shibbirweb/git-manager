# Spinner

A small spinning ring for work in progress.

```ts
import Spinner from "$ui/components/Spinner.svelte";
```

Group: Feedback. Also known as: Spinner, Loader.

## When to use

Use beside a label while something loads or runs. Use ProgressBar when the share done is known.

## Props

- `label` (`string`, default `"Loading"`): What is loading, read by screen readers.
- `size` (`"normal" | "large"`, default `"normal"`): Normal is 12px; large is twice that, for empty panels.

## Example: Loading

```svelte
<Spinner label="Loading the log" />
```

## Replaces in the app

- `<span class="spinner"></span>`
