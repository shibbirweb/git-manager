# HighlightText

Text with its matched characters shown, in bold accent or with a tinted background.

```ts
import HighlightText from "@git-manager/ui/components/HighlightText.svelte";
```

Group: Editor. Also known as: Highlight, Mark.

## When to use

Use for search and quick open results. Ranges are [start, end) character offsets.

## Props

- `text` (`string`, required): The text.
- `ranges` (`[number, number][]`, required): Matched ranges.
- `variant` (`"strong" | "mark" | "search"`, default `"strong"`): Bold accent (quick open), a tinted background (search
  results) or a warning tint (Settings search, a filter over labels).

## Example: Quick open

```svelte
<HighlightText text={path} ranges={match.ranges} />
```

## Replaces in the app

- `<b> in QuickOpen and RecentFiles`
- `<mark> in TextResult`

## Logic

- `logic/highlight.ts`
