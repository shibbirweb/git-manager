# Notification

One notification like the JetBrains IDEs draw it: the kind's icon, a bold title, where it came from, the detail and an
action link.

```ts
import Notification from "@git-manager/ui/components/Notification.svelte";
```

Group: Feedback. Also known as: Notification, Balloon, Toast, Alert.

## When to use

ToastHost draws each toast as a balloon; a notification list draws each message as a row with its time. Use Notice for a
lasting message inside a view, and CornerCard for a view's own small prompt.

## Props

- `kind` (`"info" | "success" | "warning" | "error"`, required): The icon and its color: i, a check, a triangle or a
  mark in a circle.
- `title` (`string`, required): The message, such as Pushed.
- `detail` (`string | null`, default `null`): More text under it, such as git's output; selectable and scrolled when
  long.
- `source` (`string | null`, default `null`): Where it came from, such as the repository, in dim text.
- `time` (`number | null`, default `null`): When it came, in milliseconds since 1970; a row shows it after the source,
  as 5 min ago.
- `actionLabel` (`string | null`, default `null`): A link under the text, such as Undo.
- `variant` (`"balloon" | "row"`, default `"balloon"`): Balloon: a floating card with a shadow (a toast). Row: flat, for
  a list.
- `unread` (`boolean`, default `false`): An accent dot after the title, for a message not seen yet.
- `onaction` (`() => void`): The link was pressed.
- `ondismiss` (`() => void`): Shows a close button that appears on hover; pressed.
- `onhold` (`(held: boolean) => void`): The pointer or the focus came in (true) or left (false), so a toast can stay
  while it is read.

## Rules

- Keep the title short; put git's output in `detail`, not the title.

## Example: A failed push

```svelte
<Notification kind="error" title="Push failed" detail={stderr} source="kb_dashboard"
  ondismiss={() => close()} />
```

## Example: In a list

```svelte
<Notification variant="row" kind="success" title="Pushed" time={entry.time} unread={!entry.read} />
```

## Replaces in the app

- `the message rows of src/lib/notifications/NotificationBell.svelte`
- `the .toast block of ToastHost`

## Logic

- `logic/toastModel.ts`
