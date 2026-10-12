# DescriptionList

Label and value pairs in two columns, like a commit's Author, Date and Parents.

```ts
import DescriptionList from "$ui/components/DescriptionList.svelte";
```

Group: Layout.

## When to use

Use for facts about one thing. Mark hashes and paths `mono`; draw links with the `value` snippet.

## Props

- `items` (`{ label: string; value: string; mono?: boolean }[]`, required): The pairs.
- `label` (`string`): Accessible name.
- `value` (`Snippet<[DescriptionItem]>`): Draws a value instead of its text.

## Example: Commit

```svelte
<DescriptionList items={[{ label: "Author", value: author }]} />
```

## Replaces in the app

- `<dl class="meta"> in CommitDetails.svelte`
