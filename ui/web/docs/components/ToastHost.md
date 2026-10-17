# ToastHost

Draws toasts as Notification balloons in the bottom right corner, above the status bar and beside the right activity
bar.

```ts
import ToastHost from "@nibtree/ui/components/ToastHost.svelte";
```

Group: Overlays. Also known as: Toast, Sonner, Snackbar, Balloon.

## When to use

Render one per window with a store's items. The library's createToasts() is a simple store; the app's toast store also
records the notification history and renders through ToastHost the same way.

## Props

- `items` (`ToastItem[] (logic/toastModel.ts)`, required): The toasts to show, oldest first.
- `ondismiss` (`(id: number) => void`, required): Close one (the x button).
- `onaction` (`(id: number) => void`): Run a toast's link, then close it.
- `onhold` (`(id: number, held: boolean) => void`): The pointer is over a toast (true) or left it, so the store keeps it
  while it is read.

## Rules

- Keep a toast open while the pointer is over it: pass the store's hold to `onhold`.

## Example: With the library store

```svelte
const toasts = createToasts();
<ToastHost items={toasts.items} ondismiss={toasts.dismiss} onaction={toasts.runAction}
  onhold={toasts.hold} />
```

## Replaces in the app

- `Toasts.svelte (the store stays toast.svelte.ts)`

## Logic

- `logic/toastModel.ts`
