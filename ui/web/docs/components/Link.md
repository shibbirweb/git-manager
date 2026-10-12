# Link

A button that looks like a link, for a small action in text or under a list.

```ts
import Link from "$ui/components/Link.svelte";
```

Group: Actions. Also known as: Link, Text button, Anchor.

## When to use

accent for actions (Open settings); dim for a quiet disclosure (Show older releases).

## Props

- `tone` (`"accent" | "dim"`, default `"accent"`): Accent link or quiet text.
- `size` (`"inherit" | "small"`, default `"inherit"`): The surrounding text's size, or 12 px.
- `mono` (`boolean`, default `false`): Code-like words, such as a parent commit's hash.
- `icon` (`IconName | null`, default `null`): An icon before the words.
- `expanded` (`boolean | null`, default `null`): A fold chevron instead of the icon, for a toggle like Earlier versions.
- `disabled` (`boolean`, default `false`): Cannot be pressed.
- `title` (`string`): A tooltip.
- `onclick` (`(event: MouseEvent) => void`): Pressed.
- `children` (`Snippet`, required): The words.

## Example: Settings

```svelte
<Link onclick={openSettings}>All settings</Link>
```

## Example: Disclosure

```svelte
<Link tone="dim" expanded={showOlder} onclick={() => (showOlder = !showOlder)}>Earlier versions</Link>
```

## Replaces in the app

- `.link in McpToolsDialog, GitHubSignInForm, Welcome, AiUsage`
- `.inline-link in SettingsDialog`
- `.older-toggle in WhatsNewDialog`
