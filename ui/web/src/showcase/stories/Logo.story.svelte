<script lang="ts">
  import Logo from "$ui/components/Logo.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";
</script>

<Stack direction="row" gap="lg" align="center">
  <Logo />
  <Stack gap="xxs">
    <Text weight="semibold">Nibtree</Text>
    <Text tone="dim" size="small">0.1.0-beta.8</Text>
  </Stack>
  <Logo size="large" />
</Stack>
