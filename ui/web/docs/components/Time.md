# Time

A moment relative to now, kept current: 5 min ago, 5m, or in 3h 20m, with the full date as tooltip.

```ts
import Time from "@git-manager/ui/components/Time.svelte";
```

Group: Layout. Also known as: Relative time, Timestamp, Time ago, Countdown.

## When to use

Use for commit dates, notification times, how long an agent has waited, and when usage resets. Put it in a Text for tone
and size. Live Times share one clock that ticks every 30 seconds only while one is shown; turn `live` off in long static
lists that never stay open for minutes.

## Props

- `time` (`number`, required): The moment, in milliseconds since 1970 (multiply git's seconds by 1000).
- `format` (`"ago" | "age" | "until"`, default `"ago"`): 5 min ago and yesterday (a date after a week), a short age (5m,
  2h), or a countdown (in 3h 20m, now when due).
- `live` (`boolean`, default `true`): Stays current from the shared clock.

## Rules

- Never write a relative time by hand or run a timer for one; use Time.

## Example: A commit's date

```svelte
<Text tone="dim" size="small"><Time time={commit.time * 1000} /></Text>
```

## Example: Usage resets

```svelte
<Text tone="dim">Resets <Time time={window.resetsAt} format="until" /></Text>
```

## Replaces in the app

- `relativeTime() with a now timer in LogView and NotificationBell; formatAge() in AiPanel`
- `resetIn() and updatedText() in AiUsage; relativeTime() in FileHistoryTab, LineHistoryTab, ReflogTab`
- `relativeTime() in BranchCompareTab, InteractiveRebaseDialog, LocalHistoryDialog and PushDialog`

## Logic

- `logic/timeText.ts`
- `logic/clock.svelte.ts`
