# SymbolBadge

A one-letter badge for a code symbol's kind, in the syntax color of its group.

```ts
import SymbolBadge from "@nibtree/ui/components/SymbolBadge.svelte";
```

Group: Feedback. Also known as: Symbol kind.

## When to use

Use before symbols in search results.

## Props

- `letter` (`string`, required): C, I, F, K...
- `tone` (`"type" | "interface" | "function" | "constant"`, required): The group's syntax color.
- `title` (`string`): The kind's name, such as Class.

## Example: Class

```svelte
<SymbolBadge letter="C" tone="type" title="Class" />
```

## Replaces in the app

- `.badge in SymbolResult.svelte and QuickOpen.svelte`
