<script lang="ts">
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";
  import ThemeSwatch from "$ui/components/ThemeSwatch.svelte";
</script>

<Stack direction="row" gap="md" align="center">
  <ThemeSwatch
    label="Monokai Charcoal"
    colors={{
      background: "#272822",
      foreground: "#f8f8f2",
      border: "#3e3d32",
      keyword: "#f92672",
      string: "#e6db74",
      accent: "#a6e22e",
      selection: "#49483e",
    }}
  />
  <Text>Monokai Charcoal</Text>
</Stack>
