# ImageCanvas

An image on a checkerboard, centered and scrollable, drawn at a scale of its real size.

```ts
import ImageCanvas from "@git-manager/ui/components/ImageCanvas.svelte";
```

Group: Editor. Also known as: Image, Checkerboard.

## When to use

MediaView and MediaCompare are built on it. It reports sizes and asks to zoom on Cmd + wheel.

## Props

- `src` (`string`, required): The image URL.
- `alt` (`string`, required): The image's description.
- `scale` (`number | null`, default `null`): Times the real size; null lets the browser size it.
- `element` (`HTMLDivElement | null`, default `null`, bindable): The scroll box, for synced scrolling.
- `onmeasure` (`(natural, box) => void`): The image's real size and the box's size.
- `onzoom` (`(direction: 1 | -1) => void`): Cmd or Ctrl + wheel, or a pinch.
- `onscroll` (`() => void`): The box scrolled.
- `onerror` (`() => void`): The image could not load.

## Example: Canvas

```svelte
<ImageCanvas src={url} alt="logo" scale={zoom} />
```

## Replaces in the app

- `.canvas in MediaPreview.svelte and BinaryPreview.svelte`

## Logic

- `logic/zoom.ts`
