<script lang="ts">
  import Button from "$ui/components/Button.svelte";
  import CommandPalette from "$ui/components/CommandPalette.svelte";
  import type { PaletteItem } from "$ui/logic/palette";
  import Text from "$ui/components/Text.svelte";

  const files = ["src/lib/cart.ts", "src/lib/tax.ts", "src/main.ts", "README.md", "package.json"];
  let open = $state(false);
  let query = $state("");
  let picked = $state("nothing yet");

  function toItem(path: string): PaletteItem {
    const name = path.slice(path.lastIndexOf("/") + 1);
    const at = name.toLowerCase().indexOf(query.toLowerCase());
    return {
      id: path,
      title: name,
      folder: path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "",
      icon: "file",
      ranges: query && at >= 0 ? [[at, at + query.length]] : [],
      section: "Files",
    };
  }

  const items = $derived(files.filter((path) => path.toLowerCase().includes(query.toLowerCase())).map(toItem));
</script>

<Button onclick={() => (open = true)}>Go to File...</Button>
<Text tone="dim">Picked: {picked}</Text>
<CommandPalette
  bind:open
  bind:query
  {items}
  label="Go to File"
  placeholder="File name"
  status="{items.length} files"
  onpick={(item) => {
    picked = item.id;
    open = false;
  }}
>
  {#snippet head()}<Text weight="semibold">Go to File</Text>{/snippet}
  {#snippet footer()}<Text size="small" tone="faint">Enter opens, Esc closes</Text>{/snippet}
</CommandPalette>
