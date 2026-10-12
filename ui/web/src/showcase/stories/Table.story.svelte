<script lang="ts">
  import Table from "$ui/components/Table.svelte";
  import Text from "$ui/components/Text.svelte";
  import type { DataColumn } from "$ui/logic/table";

  const files = [
    { path: "src/lib/cart.ts", kind: "Both modified", resolved: "No" },
    { path: "src/lib/tax.ts", kind: "Deleted by them", resolved: "No" },
    { path: "README.md", kind: "Both added", resolved: "Yes" },
  ];
  const columns: DataColumn[] = [
    { id: "path", label: "Name", width: "fill" },
    { id: "kind", label: "Yours / Theirs", width: "side", tone: "dim" },
    { id: "resolved", label: "Resolved", width: "xsmall", tone: "dim" },
  ];
  let selected = $state<string | null>(files[0].path);
</script>

<Table label="Conflicts" {columns} rows={files} rowKey={(file) => file.path} bind:selected>
  {#snippet cell(file, column)}<Text>{file[column.id as keyof typeof file]}</Text>{/snippet}
</Table>
