<script lang="ts">
  import CodeEditor from "$ui/components/CodeEditor.svelte";
  import Segmented from "$ui/components/Segmented.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Switch from "$ui/components/Switch.svelte";
  import Text from "$ui/components/Text.svelte";

  let value = $state(
    [
      'import { greet } from "./greet";',
      "",
      "// Say hello to everyone on the list.",
      "export function welcome(names: string[]): string[] {",
      "  return names.map((name) => greet(name));",
      "}",
      "",
    ].join("\n"),
  );
  let language = $state<"ts" | "plain">("ts");
  let wrap = $state(false);
</script>

<Stack direction="row" gap="lg" align="center">
  <Segmented
    label="Language"
    bind:value={language}
    options={[
      { value: "ts", label: "TypeScript" },
      { value: "plain", label: "Plain" },
    ]}
  />
  <Stack direction="row" gap="xs" align="center">
    <Switch label="Wrap" bind:checked={wrap} />
    <Text>Wrap</Text>
  </Stack>
  <Text tone="dim">{value.split("\n").length} lines</Text>
</Stack>
<CodeEditor label="welcome.ts" {language} {wrap} height="medium" bind:value />
