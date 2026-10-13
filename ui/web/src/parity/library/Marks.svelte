<!-- The library side of the mark and entry parity cases (cases/marks.ts). -->
<script lang="ts">
  import Avatar from "$ui/components/Avatar.svelte";
  import ChoiceList from "$ui/components/ChoiceList.svelte";
  import Chip from "$ui/components/Chip.svelte";
  import Link from "$ui/components/Link.svelte";
  import Mark from "$ui/components/Mark.svelte";
  import Meter from "$ui/components/Meter.svelte";
  import Pill from "$ui/components/Pill.svelte";
  import StatusDot from "$ui/components/StatusDot.svelte";
  import ZoomBadge from "$ui/components/ZoomBadge.svelte";

  let { id }: { id: string } = $props();
  const run = () => undefined;
</script>

{#if id === "choice-list"}
  <ChoiceList
    label="Stash"
    onpick={run}
    choices={[{ value: "drop", label: "Drop", description: "Delete it.", danger: true }]}
  />
{:else if id === "status-dot"}
  <StatusDot tone="success" />
{:else if id === "chip-pill-mark"}
  <Chip text="2 waiting" tone="warning" onclick={run} />
  <Mark text="CC" />
{:else if id === "font-chip"}
  <Chip variant="pick" text="Menlo" onclick={run} />
{:else if id === "pill"}
  <Pill tone="warning">Unsaved</Pill>
{:else if id === "meter"}
  <Meter label="Web content" value="181 MB" fraction={0.45} />
{:else if id === "zoom-badge"}
  <ZoomBadge text="110%" />
{/if}
