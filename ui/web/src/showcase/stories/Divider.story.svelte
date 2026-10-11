<script lang="ts">
  import Divider from "$ui/components/Divider.svelte";
  import IconButton from "$ui/components/IconButton.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";
</script>

<Text>Above the line</Text>
<Divider />
<Stack direction="row" align="center" gap="xs">
  <IconButton icon="undo" label="Undo" />
  <IconButton icon="redo" label="Redo" />
  <Divider direction="vertical" />
  <IconButton icon="bold" label="Bold" />
</Stack>
