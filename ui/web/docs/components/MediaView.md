# MediaView

A file that is not text: an image with zoom controls, a PDF, or a card for any other file.

```ts
import MediaView from "@git-manager/ui/components/MediaView.svelte";
```

Group: Editor. Also known as: Image, Preview, Binary.

## When to use

Use for files that are not text. Images sit on a checkerboard so transparency shows; the bar zooms out and in, fits or
shows 100%, and Cmd + wheel zooms. Put Reveal in Finder in `actions`. For two versions side by side use MediaCompare.

## Props

- `kind` (`"image" | "pdf" | "binary"`, required): What to show.
- `src` (`string`, default `""`): The file's URL (images and PDFs).
- `name` (`string`, required): The file name, also the image's alt text.
- `info` (`string`, default `""`): Size and type; images add their dimensions.
- `message` (`string`, default `""`): Shown instead of the file, such as Loading... or an error.
- `zoom` (`number | null`, default `null`, bindable): The zoom; null fits the view.
- `actions` (`Snippet`): Buttons at the bar's end, such as Reveal in Finder.

## Example: An image

```svelte
<MediaView kind="image" name="logo.png" src={url} info="18 KB" />
```

## Replaces in the app

- `src/lib/views/files/MediaPreview.svelte`

## Logic

- `logic/zoom.ts`
