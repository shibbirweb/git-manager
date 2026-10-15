<!-- Shown where a view needs a git repository but the workspace has none. -->
<script lang="ts">
  import { repoStore } from "$lib/stores/repo.svelte";
  import Button from "@git-manager/ui/components/Button.svelte";
  import EmptyState from "@git-manager/ui/components/EmptyState.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";

  let { compact = false }: { compact?: boolean } = $props();
</script>

<EmptyState
  variant={compact ? "pane" : "area"}
  icon="folder-git"
  iconTone="faint"
  strong
  title={compact ? "No repository" : "This folder has no git repository"}
  hint={compact ? "" : "Initialize one here, or add a repository inside the folder and scan again."}
>
  {#snippet action()}
    <Stack direction="row" gap="md" justify="center">
      <Button
        variant="primary"
        size={compact ? "small" : "normal"}
        onclick={() => repoStore.workspace && void repoStore.initRepository(repoStore.workspace.root)}
      >
        Initialize Repository
      </Button>
      <Button size={compact ? "small" : "normal"} onclick={() => void repoStore.rediscover()}>Scan Again</Button>
    </Stack>
  {/snippet}
</EmptyState>
