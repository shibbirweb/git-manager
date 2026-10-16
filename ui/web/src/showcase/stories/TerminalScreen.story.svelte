<script lang="ts">
  import CornerCard from "$ui/components/CornerCard.svelte";
  import Button from "$ui/components/Button.svelte";
  import Segmented from "$ui/components/Segmented.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import TerminalScreen from "$ui/components/TerminalScreen.svelte";

  // The frame alone: the app opens its own xterm in the host; here it stays empty to show the states and overlays.
  let status = $state<"starting" | "ready" | "failed">("starting");
  let bell = $state(0);
  let ended = $state(true);
</script>

<Stack direction="row" gap="md" align="center">
  <Segmented
    label="State"
    bind:value={status}
    options={[
      { value: "ready", label: "Ready" },
      { value: "starting", label: "Starting" },
      { value: "failed", label: "Failed" },
    ]}
  />
  <Button size="small" onclick={() => (bell += 1)}>Ring the Bell</Button>
  <Button size="small" onclick={() => (ended = !ended)}>Corner Card</Button>
</Stack>
<TerminalScreen
  height="medium"
  {status}
  {bell}
  message={status === "failed" ? "zsh could not start" : "Starting zsh..."}
  detail="No such file or directory"
  onretry={() => (status = "starting")}
>
  {#if ended}
    <CornerCard message="Agent exited">
      {#snippet action()}<Button size="small" onclick={() => (ended = false)}>Restart</Button>{/snippet}
    </CornerCard>
  {/if}
</TerminalScreen>
