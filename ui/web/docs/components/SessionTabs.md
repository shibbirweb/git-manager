# SessionTabs

A strip of running sessions: state icon in its color, name and close; the selected one underlined.

```ts
import SessionTabs from "$ui/components/SessionTabs.svelte";
```

Group: Navigation. Also known as: Runs, Session strip.

## When to use

Use above Run's output to switch between script runs.

## Props

- `sessions` (`{ key; name; icon; tone?: success|danger|dim; title? }[]`, required): The sessions.
- `value` (`string | null`, default `null`, bindable): The selected session's key.
- `label` (`string`, required): Accessible name.
- `onselect` (`(key: string) => void`): A session was selected.
- `onclose` (`(key: string) => void`): Shows close buttons; one was pressed.
- `oncontextmenu` (`(key: string, event: MouseEvent) => void`): Right-click, for its Menu.

## Example: Runs

```svelte
<SessionTabs label="Runs" {sessions} bind:value onclose={stop} />
```

## Replaces in the app

- `.sessions in src/lib/terminal/RunView.svelte`
