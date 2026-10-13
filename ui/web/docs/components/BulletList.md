# BulletList

A short bulleted list of facts, such as the settings changed from their defaults.

```ts
import BulletList from "@git-manager/ui/components/BulletList.svelte";
```

Group: Feedback. Also known as: List, Bullets.

## When to use

Render each item in `item`; an empty list shows `emptyText`.

## Props

- `items` (`T[]`, required): The items.
- `label` (`string`): Accessible name.
- `emptyText` (`string`, default `""`): Shown when there are none.
- `item` (`Snippet<[T]>`, required): Draws one item.

## Example: Changed

```svelte
<BulletList items={keys} emptyText="Nothing yet">{#snippet item(key)}{key}{/snippet}</BulletList>
```

## Replaces in the app

- `.changed in SettingsDialog.svelte`
