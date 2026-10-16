# CornerCard

A small card in a view's bottom right corner with a message and a button, like The agent ended.

```ts
import CornerCard from "@git-manager/ui/components/CornerCard.svelte";
```

Group: Feedback. Also known as: Toast in view.

## When to use

Put it in a TerminalView's children (or another positioned view).

## Props

- `message` (`string`, required): The message.
- `action` (`Snippet`): A button, such as Restart.

## Example: Ended

```svelte
<CornerCard message="The agent ended.">...</CornerCard>
```

## Replaces in the app

- `.agent-ended in src/lib/terminal/TerminalView.svelte`
