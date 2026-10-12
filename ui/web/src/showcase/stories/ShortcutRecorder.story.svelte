<script lang="ts">
  import ShortcutRecorder from "$ui/components/ShortcutRecorder.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";

  let keys = $state("⌘K");
  let recording = $state(false);
</script>

<Stack direction="row" align="center" justify="between">
  <Text>Commit</Text>
  <ShortcutRecorder
    label="Commit"
    {keys}
    bind:recording
    onrecord={(event) => {
      const parts = [event.metaKey ? "⌘" : "", event.shiftKey ? "⇧" : "", event.altKey ? "⌥" : ""];
      keys = `${parts.join("")}${event.key.length === 1 ? event.key.toUpperCase() : event.key}`;
      recording = false;
    }}
  />
</Stack>
