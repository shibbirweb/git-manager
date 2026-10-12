# Logo

The app's logo: the merge mark on an accent tile.

```ts
import Logo from "$ui/components/Logo.svelte";
```

Group: Feedback. Also known as: Brand, App icon.

## When to use

Use in the Welcome page's brand (normal) and greeting and in About (large).

## Props

- `size` (`"normal" | "medium" | "large" | "soft"`, default `"normal"`): 40, 48 (About) or 72 px, or a 56 px tinted
  tile.
- `label` (`string`, default `"Git Manager"`): Read by screen readers.

## Example: Greeting

```svelte
<Logo size="large" />
```

## Replaces in the app

- `.logo in Welcome.svelte`
- `.about-logo in SettingsDialog.svelte`
