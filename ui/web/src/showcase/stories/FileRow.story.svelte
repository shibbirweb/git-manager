<script lang="ts">
  import FileRow from "$ui/components/FileRow.svelte";
  import Stack from "$ui/components/Stack.svelte";

  let selected = $state("cart");
  let include = $state(true);
  const actions = [
    { icon: "discard" as const, title: "Discard Changes", danger: true, run: () => undefined },
    { icon: "plus" as const, title: "Stage", run: () => undefined },
  ];
</script>

<Stack gap="none">
  <FileRow
    kind="modified"
    name="cart.ts"
    directory="src/lib"
    selected={selected === "cart"}
    {actions}
    onselect={() => (selected = "cart")}
  />
  <FileRow
    kind="added"
    name="tax.ts"
    directory="src/lib"
    selected={selected === "tax"}
    onselect={() => (selected = "tax")}
  />
  <FileRow kind="deleted" name="old.ts" directory="src" badge="LFS" />
  <FileRow kind="renamed" name="price.ts" directory="src" note="was cost.ts" />
  <FileRow kind="untracked" name="notes.md" bind:checked={include} />
  <FileRow kind={null} name="README.md" nested />
</Stack>
