# Spacer

Takes the free room in a row, so what comes after it sits at the far end.

```ts
import Spacer from "@nibtree/ui/components/Spacer.svelte";
```

Group: Layout. Also known as: Spacer, Flex fill.

## When to use

Use in a Row, a Toolbar or a row Stack: a title, a Spacer, then the buttons. With only two groups, Stack's
justify="between" does the same.

## Props


## Example: Panel bar

```svelte
<Stack direction="row" align="center"><Text>Shelf</Text><Spacer /><Button>Shelve</Button></Stack>
```

## Replaces in the app

- `.spacer in about 35 app files`
