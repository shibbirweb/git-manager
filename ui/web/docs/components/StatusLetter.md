# StatusLetter

A changed file's status letter in its color: A, M, D, R, U, C or T.

```ts
import StatusLetter from "$ui/components/StatusLetter.svelte";
```

Group: Feedback.

## When to use

Use before a file name wherever changes are listed. FileRow already shows it.

## Props

- `kind` (`"added" | "modified" | "typechange" | "deleted" | "renamed" | "untracked" | "conflicted" | null`, required):
  The change; null for a conflict.

## Example: Modified

```svelte
<StatusLetter kind="modified" />
```

## Replaces in the app

- `<span class="letter kind-...">M</span> in FileRow.svelte`

## Logic

- `logic/fileStatus.ts`
