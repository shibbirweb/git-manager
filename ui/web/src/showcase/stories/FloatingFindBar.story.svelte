<script lang="ts">
  import Card from "$ui/components/Card.svelte";
  import FloatingFindBar from "$ui/components/FloatingFindBar.svelte";
  import TerminalView from "$ui/components/TerminalView.svelte";

  let query = $state("error");
  let open = $state(true);
</script>

<Card label="Terminal">
  <TerminalView label="Terminal" height="small" onready={(terminal) => terminal.write("build error: missing tax.ts")}>
    {#if open}
      <FloatingFindBar
        bind:query
        counter={query ? "1 of 1" : ""}
        problem={query === "nothing"}
        onclose={() => (open = false)}
      />
    {/if}
  </TerminalView>
</Card>
