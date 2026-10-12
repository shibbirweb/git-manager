<script lang="ts">
  import Mark from "$ui/components/Mark.svelte";
  import Stack from "$ui/components/Stack.svelte";
</script>

<Stack direction="row" gap="sm" align="center">
  <Mark text="CC" title="Claude Code" />
  <Mark text="CX" title="Codex" />
  <Mark text="GE" title="Gemini CLI" />
  <Mark text="CC" size="small" title="Claude Code" />
</Stack>
