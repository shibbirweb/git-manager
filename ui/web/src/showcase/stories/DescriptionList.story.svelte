<script lang="ts">
  import DescriptionList from "$ui/components/DescriptionList.svelte";
</script>

<DescriptionList
  label="Commit"
  items={[
    { label: "Commit", value: "a1b2c3d4e5f6", mono: true },
    { label: "Author", value: "Ada Lovelace <ada@example.com>" },
    { label: "Date", value: "11 Oct 2026, 10:24" },
    { label: "Parents", value: "9f8e7d6", mono: true },
  ]}
/>
