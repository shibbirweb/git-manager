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
<Text tone="dim">Cursor: {cursor}</Text>
