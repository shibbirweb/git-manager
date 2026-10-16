<script lang="ts">
  import Button from "$ui/components/Button.svelte";
  import CornerCard from "$ui/components/CornerCard.svelte";
  import TerminalView from "$ui/components/TerminalView.svelte";
</script>

<TerminalView label="Agent" height="small" onready={(terminal) => terminal.write("Session finished.")}>
  <CornerCard message="The agent ended.">
    {#snippet action()}<Button size="small">Restart</Button>{/snippet}
  </CornerCard>
</TerminalView>
