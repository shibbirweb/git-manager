<script lang="ts">
  import FileIcon from "$ui/components/FileIcon.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";
</script>

<Stack direction="row" gap="lg" align="center">
  <FileIcon view={null} />
  <Text tone="dim">No icon set: the plain file icon. The app passes the Minimal or Material icon as `view`.</Text>
</Stack>
