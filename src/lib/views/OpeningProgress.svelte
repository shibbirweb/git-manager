<!-- Progress while a folder opens: the scan for repositories can take a while in a big folder, and there is
     nothing else to show yet. -->
<script lang="ts">
  import LoadingOverlay from "@nibtree/ui/components/LoadingOverlay.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";

  /** Shown only for slow opens, so a quick one does not flash. */
  const SHOW_AFTER_MS = 150;
  const SLOW_AFTER_MS = 4000;

  let visible = $state(false);
  let slow = $state(false);

  $effect(() => {
    const opening = repoStore.opening !== null;
    if (!opening) {
      visible = false;
      slow = false;
      return;
    }
    const showTimer = setTimeout(() => (visible = true), SHOW_AFTER_MS);
    const slowTimer = setTimeout(() => (slow = true), SLOW_AFTER_MS);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(slowTimer);
    };
  });
</script>

{#if repoStore.opening && visible}
  <LoadingOverlay
    title={repoStore.opening.title}
    step={repoStore.opening.step}
    hint={slow ? "Big folders take a moment. Folders such as node_modules are skipped." : ""}
  />
{/if}
