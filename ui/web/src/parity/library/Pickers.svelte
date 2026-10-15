<!-- The library side of the picker and layout parity cases (cases/pickers.ts). -->
<script lang="ts">
  import CornerCard from "$ui/components/CornerCard.svelte";
  import Button from "$ui/components/Button.svelte";
  import CrumbPopup from "$ui/components/CrumbPopup.svelte";
  import DragGhost from "$ui/components/DragGhost.svelte";
  import OptionList from "$ui/components/OptionList.svelte";
  import PaneRow from "$ui/components/PaneRow.svelte";
  import PopupRow from "$ui/components/PopupRow.svelte";
  import RenameField from "$ui/components/RenameField.svelte";
  import ReorderList from "$ui/components/ReorderList.svelte";
  import Select from "$ui/components/Select.svelte";
  import SplitGrid from "$ui/components/SplitGrid.svelte";
  import SplitHandle from "$ui/components/SplitHandle.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Table from "$ui/components/Table.svelte";
  import Text from "$ui/components/Text.svelte";
  import type { DataColumn } from "$ui/logic/table";

  let { id }: { id: string } = $props();
  const none = () => undefined;
  const actions = [{ value: "squash", label: "squash" }];
  const columns: DataColumn[] = [
    { id: "name", label: "Name", width: "fill" },
    { id: "ours", label: "Yours", width: "side" },
    { id: "theirs", label: "Theirs", width: "side" },
  ];
  const conflicts = [{ name: "cart.ts", ours: "Modified", theirs: "Deleted" }];
  const themes = [
    {
      label: "Dark",
      options: [
        { id: "monokai", name: "Monokai" },
        { id: "dark", name: "Dark" },
      ],
    },
  ];
  const halves = [
    { id: "a", rect: { x: 0, y: 0, width: 0.5, height: 1 } },
    { id: "b", rect: { x: 0.5, y: 0, width: 0.5, height: 1 } },
  ];
  const split = [{ id: "s", direction: "right" as const, rect: { x: 0, y: 0, width: 1, height: 1 }, ratio: 0.5 }];
</script>

{#if id === "conflicts-table"}
  <Table label="Conflicts" {columns} rows={conflicts} rowKey={(row) => row.name} selected="cart.ts">
    {#snippet cell(row, column)}{row[column.id as keyof typeof row]}{/snippet}
  </Table>
{:else if id === "drag-ghost"}
  <DragGhost text="3 files" x={0} y={0} />
{:else if id === "rename-field"}
  <RenameField value="zsh" onrename={none} />
  <RenameField value="build" invalid onrename={none} />
{:else if id === "corner-card"}
  <CornerCard message="Agent exited">
    {#snippet action()}<Button size="small">Restart</Button>{/snippet}
  </CornerCard>
{:else if id === "pane-row"}
  <div style="position: relative; height: 120px">
    <PaneRow
      panes={[
        { key: "a", share: 1 },
        { key: "b", share: 1 },
      ]}
      focused="b"
    >
      {#snippet pane()}{/snippet}
    </PaneRow>
  </div>
{:else if id === "crumb-popup"}
  <CrumbPopup
    label="src"
    placeholder="Type to search"
    entries={[
      { id: "cart", name: "cart.ts", tone: "modified" },
      { id: "tax", name: "tax.ts", tone: "added" },
      { id: "lib", name: "lib", folder: true },
    ]}
    onpick={none}
  />
{:else if id === "split-handle"}
  <div style="position: relative; height: 80px"><SplitHandle label="Resize the sides" /></div>
{:else if id === "split-grid"}
  <div style="display: flex; flex-direction: column; height: 120px">
    <SplitGrid groups={halves} splitters={split}>
      {#snippet group()}{/snippet}
    </SplitGrid>
  </div>
{/if}
