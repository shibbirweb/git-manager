# Meter

How much of something is used: a label and value over a bar.

```ts
import Meter from "@git-manager/ui/components/Meter.svelte";
```

Group: Feedback. Also known as: Meter, Usage bar, Gauge.

## When to use

memory: memory details; usage: AI usage windows (warning and danger tones); mini: a bar in a status item.

## Props

- `fraction` (`number`, required): 0 to 1.
- `label` (`string`, default `""`): What is measured.
- `value` (`string`, default `""`): The amount, on the right.
- `detail` (`string`, default `""`): A small line under the bar, such as when it resets.
- `variant` (`"memory" | "usage" | "mini"`, default `"memory"`): The bar's size and track.
- `tone` (`"accent" | "warning" | "danger"`, default `"accent"`): The fill's color.

## Example: Memory

```svelte
<Meter label="Web content" value="181 MB" fraction={0.45} />
```

## Replaces in the app

- `.process and .bar in StatusBar memory details`
- `.window, .wide-bar and .bar in AiUsage`
