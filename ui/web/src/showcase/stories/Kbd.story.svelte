<script lang="ts">
  import Kbd from "$ui/components/Kbd.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";
</script>

<Stack direction="row" align="center" gap="sm">
  <Text>Search Everywhere</Text>
  <Kbd keys="⇧⇧" />
  <Text>Go to File</Text>
  <Kbd keys="⌘P" />
</Stack>
