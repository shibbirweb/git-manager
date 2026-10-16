<script lang="ts">
  import BulletList from "$ui/components/BulletList.svelte";
  import Text from "$ui/components/Text.svelte";

  const changed = [
    { key: "editorFontSize", value: "14" },
    { key: "theme", value: "dark" },
  ];
</script>

<BulletList items={changed} label="Changed settings" emptyText="Nothing yet">
  {#snippet item(entry)}<Text mono>{entry.key}</Text>: {entry.value}{/snippet}
</BulletList>
<BulletList items={[] as string[]} label="Nothing changed" emptyText="Nothing yet">
  {#snippet item(entry)}{entry}{/snippet}
</BulletList>
