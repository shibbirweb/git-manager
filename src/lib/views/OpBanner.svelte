<script lang="ts">
  import { repoStore } from "$lib/stores/repo.svelte";
  import Button from "@git-manager/ui/components/Button.svelte";
  import Notice from "@git-manager/ui/components/Notice.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import { abortOperation, continueOperation, skipRebaseCommit } from "./git/operationActions";

  const op = $derived(repoStore.status?.op);
  const conflicts = $derived(repoStore.conflictCount);
</script>

{#if op && op.kind !== "none"}
  <Notice variant="banner" tone={conflicts > 0 ? "danger" : "info"} icon={conflicts > 0 ? "alert" : "merge"}>
    <Text weight="semibold">{op.description}</Text>
    <Text tone="dim">
      &middot; {conflicts > 0
        ? `${conflicts} ${conflicts === 1 ? "file has" : "files have"} conflicts`
        : "all conflicts resolved"}
    </Text>
    {#snippet action()}
      <Stack direction="row" gap="sm">
        {#if conflicts > 0}
          <Button size="small" variant="primary" onclick={() => repoStore.openConflicts()}>Resolve Conflicts...</Button>
        {:else if op.kind !== "other"}
          <Button size="small" variant="primary" onclick={() => void continueOperation()}>Continue</Button>
        {/if}
        {#if op.kind === "rebase"}
          <Button size="small" onclick={() => void skipRebaseCommit()}>Skip Commit</Button>
        {/if}
        {#if op.kind !== "other"}
          <Button size="small" onclick={() => void abortOperation()}>Abort</Button>
        {/if}
      </Stack>
    {/snippet}
  </Notice>
{/if}
