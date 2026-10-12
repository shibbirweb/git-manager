# ZoomBar

An image preview's zoom controls: out, the zoom in percent, in, Fit and 100%.

```ts
import ZoomBar from "$ui/components/ZoomBar.svelte";
```

Group: Editor. Also known as: Zoom.

## When to use

MediaView and MediaCompare draw it; `zoom` is null while the image fits, `fitted` is that zoom.

## Props

- `zoom` (`number | null`, default `null`, bindable): The zoom; null fits.
- `fitted` (`number`, default `1`): The fitting zoom, shown while zoom is null.
- `disabled` (`boolean`, default `false`): Before the image is measured.
- `fitTitle` (`string`, default `"Fit the image in the view"`): Fit's tooltip.
- `actualTitle` (`string`, default `"Show the image at its real size"`): 100%'s tooltip.

## Example: Zoom

```svelte
<ZoomBar bind:zoom {fitted} />
```

## Replaces in the app

- `.bar zoom buttons in MediaPreview.svelte and BinaryPreview.svelte`

## Logic

- `logic/zoom.ts`
