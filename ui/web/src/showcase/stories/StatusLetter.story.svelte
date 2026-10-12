<script lang="ts">
  import Stack from "$ui/components/Stack.svelte";
  import StatusLetter from "$ui/components/StatusLetter.svelte";
  import Text from "$ui/components/Text.svelte";
  import type { FileKind } from "$ui/logic/fileStatus";

  const kinds: FileKind[] = ["added", "modified", "deleted", "renamed", "untracked", "conflicted", "typechange"];
</script>

<Stack direction="row" gap="lg">
  {#each kinds as kind (kind)}
    <Stack direction="row" gap="xs" align="center"><StatusLetter {kind} /><Text tone="dim">{kind}</Text></Stack>
  {/each}
</Stack>
