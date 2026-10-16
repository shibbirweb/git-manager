<script lang="ts">
  import Select from "$ui/components/Select.svelte";
  import Text from "$ui/components/Text.svelte";

  let cursor = $state<"bar" | "block" | "underline">("bar");
  let action = $state<"pick" | "squash" | "drop">("pick");
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
<Select
  label="Rebase action (each choice has a tooltip)"
  size="small"
  bind:value={action}
  options={[
    { value: "pick", label: "pick", title: "Use the commit" },
    { value: "squash", label: "squash", title: "Meld into the commit above, keeping both messages" },
    { value: "drop", label: "drop", title: "Remove the commit" },
  ]}
/>
<Text tone="dim">Cursor: {cursor}</Text>
