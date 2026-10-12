<script lang="ts">
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";
</script>

<Text variant="heading" element="h2">Heading</Text>
<Text variant="title">Title</Text>
<Text variant="sectionLabel">Section label</Text>
<Text>Body text in the UI size.</Text>
<Text variant="label">A setting's label</Text>
<Text variant="hint">A hint under a setting, in the dim tone.</Text>
<Text variant="caption">A caption</Text>
<Stack direction="row" gap="lg">
  <Text tone="dim">dim</Text>
  <Text tone="faint">faint</Text>
  <Text tone="accent">accent</Text>
  <Text tone="danger">danger</Text>
  <Text tone="success">success</Text>
  <Text tone="warning">warning</Text>
</Stack>
<Text variant="code" selectable>a1b2c3d src/lib/stores/repo.svelte.ts</Text>
<Stack direction="row">
  <Text truncate title="A long path that does not fit">
    /Users/you/projects/a-very-long-folder-name/with/many/levels/that/does/not/fit/in/one/line/at/all.ts
  </Text>
</Stack>
<Stack direction="row" gap="lg">
  <Text tabular>12:04:59 · 1,280 ms</Text>
  <Text strike tone="dim">removed-file.ts</Text>
</Stack>
<Text wrap="anywhere" tone="danger">
  Could not open /Users/you/projects/a-very-long-folder-name/that/never/has/a/space/in/it.ts
</Text>
<Text wrap="pre" mono size="small">{"error: failed to push some refs\nhint: Updates were rejected"}</Text>
