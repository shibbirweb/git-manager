# StatusIcon

An agent's or task's state: spinner, question mark, check, square or ring.

```ts
import StatusIcon from "$ui/components/StatusIcon.svelte";
```

Group: Feedback.

## When to use

Use beside an agent's name in panels and tabs. `label` is read aloud and shown as the tooltip.

## Props

- `state` (`"starting" | "working" | "waiting" | "done" | "exited" | "idle"`, required): The state.
- `label` (`string`, required): The state in words, such as Needs you.

## Example: Working

```svelte
<StatusIcon state="working" label="Working" />
```

## Replaces in the app

- `src/lib/ai/AgentStateIcon.svelte`
