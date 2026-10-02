# Image and PDF Preview

Click an image or a PDF in the [Files panel](Files-Panel.md), or open one with [Search Everywhere](Search-Everywhere.md), and it opens in a preview tab instead of the "Binary file, not shown" message. In a [diff](Diffs.md), a changed image or PDF shows its old and new version side by side.

![An image in the preview](../images/media-preview-image.png)

*An image fitted to the tab, with the zoom buttons, its size in pixels and the file size.*

## Which files

- **Images:** PNG, JPEG, GIF, WebP, BMP, ICO and AVIF.
- **PDF** documents.

SVG files are text, so they open in the editor, where you can change them. Their pictures show in the [Markdown preview](Markdown-Editor.md).

## Images

The image starts **fitted** to the tab. A small image keeps its real size; a big one shrinks until it fits. The bar above it has:

- **Zoom out** and **Zoom in** (the minus and plus buttons), with the zoom in between, such as **62%**.
- **Fit** to fit the image in the tab again, and **100%** to show it at its real size.
- The image's width and height in pixels and the file size.
- **Reveal in Finder** to show the file in Finder.

You can also zoom with a pinch on the trackpad, or with Cmd and the mouse wheel. A checkerboard behind the image shows its transparent parts.

## PDF documents

PDFs use the viewer that is built into macOS, the same one Safari uses. Scroll through the pages, select and copy text, and use its own zoom. The bar above shows the file size and **Reveal in Finder**, which also lets you open the document in Preview.

![A PDF in the preview](../images/media-preview-pdf.png)

*A PDF in its tab, shown by the built-in viewer.*

## In a diff

When a diff in Changes, the Log, a commit tab or a compare tab is about an image or a PDF, it shows the old version on the left and the new one on the right, with the diff's labels above them.

- Each side shows its size in pixels and its file size.
- **Fit**, **100%** and the zoom buttons change both images at once, and so do a pinch or Cmd with the mouse wheel. Fit uses one scale for both, so a bigger image looks bigger.
- Scrolling one side scrolls the other.
- A PDF shows in two viewers side by side.
- A new file says **Not in** and the left label (for example **Not in HEAD**) on the left; a deleted file says **Deleted** on the right.

Shelved changes and files in [Git LFS](Git-LFS.md) keep their usual message: the shelf keeps a binary file only as a patch, and LFS diffs show the two sizes.

## Memory

A preview only holds the file while its tab is on screen. When you switch to another tab or close it, the picture or document is let go, and Git Manager reads the file again when you come back. So a folder full of big photos or manuals does not fill your memory. The part of the app that shows previews is small and loads the first time you open one.

The app hands the file straight to the viewer, so it is never copied into the page. A big PDF is read in pieces as you scroll, where the viewer asks for that.

There are limits so a single file cannot use too much memory: 50 MB for an image, and 100 MB for a PDF that has to be read at once (an older version from git always does). Bigger files show a message instead.

Only files inside the folders open in the window can be previewed.

## When the file changes

If the file changes on disk, for example after `git pull` or when another app saves it, the preview reloads it.

## Related

- [Editor and Tabs](Editor-and-Tabs.md)
- [Files Panel](Files-Panel.md)
- [Diffs](Diffs.md)
