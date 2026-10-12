<script lang="ts">
  import Button from "$ui/components/Button.svelte";
  import IconButton from "$ui/components/IconButton.svelte";
  import Spacer from "$ui/components/Spacer.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";
</script>

<Stack direction="row" align="center" gap="sm">
  <Text weight="semibold">Shelf</Text>
  <Text tone="dim">storefront</Text>
  <Spacer />
  <Button size="small">Shelve Changes...</Button>
  <IconButton icon="refresh" label="Refresh" size="small" />
</Stack>
