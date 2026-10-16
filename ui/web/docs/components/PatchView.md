# PatchView

A patch in monospace with added and removed lines tinted, hunk headers in the accent color.

```ts
import PatchView from "@git-manager/ui/components/PatchView.svelte";
```

Group: Editor. Also known as: Patch, Unified diff.

## When to use

Use to show git diff output read-only, such as one commit's change to a line range. For a real diff use DiffView.

## Props

- `patch` (`string`, default `""`): git diff output.
- `lines` (`PatchLine[] | null ({ kind; text })`, default `null`): Lines already split, instead of `patch`.
- `note` (`string`, default `""`): A last hunk-styled line, such as the patch being cut short.
- `label` (`string`, required): Accessible name.

## Example: A change

```svelte
<PatchView label="Patch" patch={diffText} />
```

## Replaces in the app

- `.patch in src/lib/views/git/LineHistoryTab.svelte`

## Logic

- `logic/patchLines.ts`
