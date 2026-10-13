# FileIcon

A file's type icon, resolved by the app from the chosen icon set and passed in as `view`.

```ts
import FileIcon from "@git-manager/ui/components/FileIcon.svelte";
```

Group: Feedback.

## When to use

Use beside file names. Without a view it shows the plain file icon, or nothing when `plain` is false.

## Props

- `view` (`{ kind: "image"; src: string } | { kind: "mask"; className: string } | null`, required): The icon the app's
  resolver picked.
- `size` (`IconSize`, default `"normal"`): A named icon size.
- `plain` (`boolean`, default `true`): Show the plain file icon when there is no view.

## Example: In a row

```svelte
<FileIcon view={fileIcons.resolve(name)} />
```

## Replaces in the app

- `src/lib/fileIcons/FileTypeIcon.svelte (resolve in the app, draw with FileIcon)`
