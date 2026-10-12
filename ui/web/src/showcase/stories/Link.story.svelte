<script lang="ts">
  import Link from "$ui/components/Link.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";

  let older = $state(false);
  let pressed = $state(0);
</script>

<Stack gap="sm">
  <Text>Connect your account in <Link onclick={() => (pressed += 1)}>GitHub settings</Link>.</Text>
  <Link size="small" onclick={() => (pressed += 1)}>Refresh usage</Link>
  <Link tone="dim" icon={older ? "chevron-down" : "chevron-right"} onclick={() => (older = !older)}>
    Show older releases
  </Link>
  <Text tone="dim">Pressed {pressed} times</Text>
</Stack>
