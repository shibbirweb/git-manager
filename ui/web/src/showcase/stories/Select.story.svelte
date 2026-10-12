<script lang="ts">
  import Select from "$ui/components/Select.svelte";
  import Text from "$ui/components/Text.svelte";

  let cursor = $state<"bar" | "block" | "underline">("bar");
</script>

<Select
  label="Cursor style"
  bind:value={cursor}
  options={[
    { value: "bar", label: "Bar" },
    { value: "block", label: "Block" },
    { value: "underline", label: "Underline" },
  ]}
/>
<Select
  label="Repository"
  size="small"
  width="medium"
  bind:value={cursor}
  options={[
    { value: "bar", label: "storefront" },
    { value: "block", label: "api-gateway" },
  ]}
/>
<Text tone="dim">Cursor: {cursor}</Text>
