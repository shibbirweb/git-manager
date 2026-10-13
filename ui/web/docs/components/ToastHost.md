# ToastHost

Draws toasts in the bottom right corner: a colored edge for the kind, title, detail and buttons.

```ts
import ToastHost from "@git-manager/ui/components/ToastHost.svelte";
```

Group: Overlays. Also known as: Toast, Sonner, Snackbar.

## When to use

Render one per window with a store's items. The library's createToasts() is a simple store; the app's toast store also
records the notification history and renders through ToastHost the same way.

## Props

- `items` (`ToastItem[] (logic/toastModel.ts)`, required): The toasts to show, oldest first.
- `ondismiss` (`(id: number) => void`, required): Close one (the x button).
- `onaction` (`(id: number) => void`): Run a toast's button, then close it.

## Example: With the library store

```svelte
const toasts = createToasts();
<ToastHost items={toasts.items} ondismiss={toasts.dismiss} onaction={toasts.runAction} />
```

## Replaces in the app

- `Toasts.svelte (the store stays toast.svelte.ts)`

## Logic

- `logic/toastModel.ts`
