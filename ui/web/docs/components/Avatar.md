# Avatar

Initials in a round accent circle (an account) or a rounded tile in a palette color (a project).

```ts
import Avatar from "@git-manager/ui/components/Avatar.svelte";
```

Group: Feedback. Also known as: Avatar, Initials.

## When to use

Use circle for a signed-in account and tile for projects; give the same name the same color.

## Props

- `text` (`string`, required): One or two letters.
- `shape` (`"circle" | "tile"`, default `"circle"`): 32 px circle or 36 px tile.
- `color` (`"accent" | "blue" | "green" | "magenta" | "cyan" | "red"`, default `"accent"`): The fill.
- `label` (`string`): Read by screen readers, such as the full name.

## Example: A project

```svelte
<Avatar text="SF" shape="tile" color="cyan" />
```

## Replaces in the app

- `.avatar in GitHubSignInForm`
- `.badge-* project tiles in Welcome`
