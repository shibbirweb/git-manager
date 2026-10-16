<script lang="ts">
  import FontSample from "$ui/components/FontSample.svelte";
  import Switch from "$ui/components/Switch.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";

  let ligatures = $state(true);
</script>

<Stack direction="row" gap="xs" align="center">
  <Switch label="Ligatures" bind:checked={ligatures} />
  <Text>Ligatures</Text>
</Stack>
<FontSample
  label="Editor font"
  fontFamily="JetBrains Mono, monospace"
  fontSize={13}
  {ligatures}
  lines={[
    { text: "function greet(name) {" },
    { text: "  return `Hello, ${name}!`; // 0O 1lI => != ===" },
    { text: "}" },
  ]}
/>
<FontSample
  label="Terminal font"
  variant="terminal"
  fontFamily="Menlo, monospace"
  fontSize={12}
  lineHeight={1.2}
  boldWeight={700}
  {ligatures}
  lines={[
    { parts: [{ text: "~/storefront main", dim: true }, { text: " ❯ git log --oneline" }] },
    { parts: [{ text: "a1b2c3d", bold: true }, { text: " fix: a => b != c === d -> e" }] },
    { text: "0O 1lI { } [ ] | && ||" },
  ]}
/>
