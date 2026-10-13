# MediaCompare

Two versions of an image or PDF side by side, with one shared zoom and synced scrolling.

```ts
import MediaCompare from "@git-manager/ui/components/MediaCompare.svelte";
```

Group: Editor. Also known as: Image diff, Binary diff.

## When to use

Use for a binary file's change. A side without a file shows its message, such as Added here.

## Props

- `sides` (`[side, side] ({ label; kind: image|pdf|none; src?; info?; message? })`, required): Old and new.
- `zoom` (`number | null`, default `null`, bindable): The shared zoom; null fits both.

## Example: A logo change

```svelte
<MediaCompare sides={[before, after]} bind:zoom />
```

## Replaces in the app

- `src/lib/diff/BinaryPreview.svelte`

## Logic

- `logic/zoom.ts`
