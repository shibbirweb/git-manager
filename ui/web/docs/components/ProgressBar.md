# ProgressBar

A thin bar for a share of a whole, like each process's memory in the status bar details.

```ts
import ProgressBar from "@git-manager/ui/components/ProgressBar.svelte";
```

Group: Feedback. Also known as: Progress.

## When to use

Use when the share is known (0 to 1). Use Spinner while the amount is unknown.

## Props

- `value` (`number`, required): The share, 0 to 1; out-of-range and NaN values are clamped.
- `label` (`string`, required): Accessible name.
- `tone` (`"accent" | "danger" | "warning" | "success"`, default `"accent"`): Fill color.

## Example: Memory share

```svelte
<ProgressBar value={bytes / total} label="Web content memory" />
```

## Replaces in the app

- `<div class="bar"><div class="fill" style="width: ..."></div></div>`
