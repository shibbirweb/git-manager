# ShortcutRecorder

A command's keys that can be changed: click, press the new keys, Esc cancels.

```ts
import ShortcutRecorder from "@nibtree/ui/components/ShortcutRecorder.svelte";
```

Group: Forms. Also known as: Hotkey input.

## When to use

Use in the Keyboard Shortcuts list. The app turns the key press into keys and checks it.

## Props

- `keys` (`string`, required): The current keys from commandKeys(id); empty shows None.
- `recording` (`boolean`, default `false`, bindable): Listening for the new keys.
- `pending` (`string | null`, default `null`): What was just pressed, shown while recording.
- `label` (`string`, required): The command's name.
- `onrecord` (`(event: KeyboardEvent) => void`, required): A key press while recording.
- `oncancel` (`() => void`): Esc while recording.

## Example: A command

```svelte
<ShortcutRecorder label="Commit" keys={commandKeys("commit")} {onrecord} />
```

## Replaces in the app

- `.keys and .recorder in KeyboardShortcuts.svelte`
