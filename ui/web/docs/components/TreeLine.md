# TreeLine

The connector in front of a grouped row, like split terminals in the terminal list.

```ts
import TreeLine from "@nibtree/ui/components/TreeLine.svelte";
```

Group: Layout. Also known as: Connector, Tree guide.

## When to use

Put it first in each row of a group: first, middle and last.

## Props

- `position` (`"first" | "middle" | "last"`, required): The row's place in its group.

## Example: Group

```svelte
<TreeLine position="first" />
```

## Replaces in the app

- `.tree in src/lib/terminal/TerminalPanel.svelte`
