<script lang="ts">
  import Stack from "$ui/components/Stack.svelte";
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
  let selection = $state<string[]>([files[0].path]);
</script>

<Stack gap="md">
  <Table label="Conflicts" {columns} rows={files} rowKey={(file) => file.path} bind:selected>
    {#snippet cell(file, column)}<Text>{file[column.id as keyof typeof file]}</Text>{/snippet}
  </Table>
  <Text tone="dim" size="small">Multiple: Cmd-click or Shift-click selects several ({selection.length} selected).</Text>
  <Table label="Conflicts, several" {columns} rows={files} rowKey={(file) => file.path} multiple bind:selection>
    {#snippet cell(file, column)}<Text>{file[column.id as keyof typeof file]}</Text>{/snippet}
  </Table>
</Stack>
