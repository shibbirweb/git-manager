<!-- The library side of the small pieces parity cases (cases/atoms.ts). -->
<script lang="ts">
  import Button from "$ui/components/Button.svelte";
  import EmptyState from "$ui/components/EmptyState.svelte";
  import IconButton from "$ui/components/IconButton.svelte";
  import PaletteRow from "$ui/components/PaletteRow.svelte";
  import Pill from "$ui/components/Pill.svelte";
  import SectionTitle from "$ui/components/SectionTitle.svelte";
  import ShortcutRecorder from "$ui/components/ShortcutRecorder.svelte";
  import Text from "$ui/components/Text.svelte";
  import Toolbar from "$ui/components/Toolbar.svelte";

  let { id }: { id: string } = $props();
  const none = () => undefined;
</script>

{#if id === "rebase-segment"}
  <div style="width: 400px"><SectionTitle variant="band" title="Commits to rebase" /></div>
{:else if id === "branches-group"}
  <div style="width: 400px"><SectionTitle variant="picker" title="Local" /></div>
{:else if id === "history-day"}
  <div style="width: 300px"><SectionTitle variant="day" title="Today" /></div>
{:else if id === "mcp-group"}
  <div style="width: 400px"><SectionTitle variant="divided" title="Git" /></div>
  <Pill tone="warning">write</Pill>
{:else if id === "shortcuts-foot"}
  <div style="width: 500px">
    <Toolbar variant="dialog-footer" label="Shortcuts">
      <Text tone="dim" size="small">Menus with keys.</Text>
      {#snippet end()}<Button size="small">Change Shortcuts</Button>{/snippet}
    </Toolbar>
  </div>
{:else if id === "conflicts-done"}
  <div style="width: 400px; display: flex">
    <EmptyState icon="check" iconStyle="large-circle" iconTone="success" title="All conflicts are resolved." />
  </div>
{:else if id === "recent-remove"}
  <div role="listbox" aria-label="Recent" style="width: 400px">
    <PaletteRow item={{ id: "c", title: "cart.ts" }} selected>
      {#snippet end()}<IconButton icon="x" label="Remove" size="micro" tone="faint" iconSize="compact" />{/snippet}
    </PaletteRow>
  </div>
{:else if id === "keymap-recorder"}
  <ShortcutRecorder label="Commit" keys="⌘K" recording onrecord={none} />
  <ShortcutRecorder label="Push" keys="⌘K" onrecord={none} />
{:else if id === "file-bar-bottom"}
  <div style="width: 400px"><Toolbar variant="file" placement="bottom" label="File">cart.ts</Toolbar></div>
{/if}
