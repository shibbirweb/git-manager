<script lang="ts">
  import Breadcrumbs from "$ui/components/Breadcrumbs.svelte";
  import Text from "$ui/components/Text.svelte";

  let open = $state<number | null>(null);
</script>

<Breadcrumbs
  label="File path"
  crumbs={[
    { label: "storefront", icon: "folder-git", kind: "repo" },
    { label: "src" },
    { label: "lib" },
    { label: "cart.ts", icon: "file", kind: "file" },
  ]}
  {open}
  onselect={(index) => (open = open === index ? null : index)}
/>
<Text tone="dim">Click a crumb to mark it open.</Text>
