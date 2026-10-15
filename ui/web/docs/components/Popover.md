# Popover

A panel anchored to its trigger, like the AI usage panel; Esc or an outside click closes it.

```ts
import Popover from "@git-manager/ui/components/Popover.svelte";
```

Group: Overlays. Also known as: Popover, Dropdown panel.

## When to use

Use for details or a few choices next to a control. Use Menu for a list of commands.

## Props

- `open` (`boolean`, default `false`, bindable): Shown or hidden.
- `label` (`string`, required): Accessible name of the panel.
- `placement` (`"above" | "below"`, default `"below"`): Which side of the trigger; above in the status bar.
- `align` (`"start" | "end"`, default `"start"`): Which edge of the trigger it lines up with.
- `width` (`"auto" | "small" | "medium" | "large"`, default `"auto"`): Fits the content, or 256, 300 or 360 px.
- `padding` (`"menu" | "panel" | "form"`, default `"menu"`): 4px for menu-like lists, 12 by 14px for detail panels, 12px
  and a column of fields for a small form (Commit Options).
- `textSize` (`"normal" | "small"`, default `"normal"`): Small (12px) for the status bar's popovers.
- `layer` (`"anchor" | "window"`, default `"anchor"`): Under its trigger in the page, or floating over the window and
  kept inside it, so a scrolling or narrow panel cannot cut it off (Commit Options).
- `autofocus` (`boolean`, default `false`): Its first field takes the focus when it opens, and Esc gives the focus back
  to the trigger, for a small form.
- `trigger` (`Snippet<[{ toggle: () => void; open: boolean }]>`, required): The button that opens it.
- `children` (`Snippet`, required): The panel's content.

## Example: Status bar details

```svelte
<Popover label="AI usage" placement="above" align="end">
  {#snippet trigger({ toggle, open })}
    <IconButton icon="bot" label="AI usage" active={open} onclick={toggle} />
  {/snippet}
  ...
</Popover>
```

## Replaces in the app

- `<div class="details" role="dialog"> in StatusBar`
- `<div class="menu"> in KeepAwake and AiUsage`
- `<div class="panel" role="dialog"> with its fixed place in CommitOptionsPopover.svelte`

## Logic

- `logic/popoverPlace.ts`
