<script lang="ts">
  import LayoutIcon from "$ui/components/LayoutIcon.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";

  const glyphs = [
    { kind: "sidebar-left" as const, active: true, label: "Left shown" },
    { kind: "sidebar-right" as const, active: false, label: "Right hidden" },
    { kind: "commit-single" as const, active: false, label: "One commit box" },
    { kind: "commit-per-repo" as const, active: false, label: "Per repository" },
  ];
</script>

<Stack direction="row" gap="xl" align="center">
  {#each glyphs as glyph (glyph.kind)}
    <Stack direction="row" gap="xs" align="center">
      <LayoutIcon kind={glyph.kind} active={glyph.active} />
      <Text>{glyph.label}</Text>
    </Stack>
  {/each}
</Stack>
