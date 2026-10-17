<!-- Shown while the active repository is bisecting: how far along it is, the marks for the
     checked out commit and, once git names it, the first bad commit. -->
<script lang="ts">
  import { repoStore } from "$lib/stores/repo.svelte";
  import Button from "@nibtree/ui/components/Button.svelte";
  import Notice from "@nibtree/ui/components/Notice.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import { bisectStore } from "./bisect.svelte";
  import { markBisect, resetBisect, showFirstBad } from "./bisectActions";
  import { bisectBannerText } from "./bisectBanner";

  const repoRoot = $derived(repoStore.repo?.root ?? null);
  const fingerprint = $derived(repoRoot ? (repoStore.statuses[repoRoot]?.bisect ?? null) : null);
  const bisect = $derived(fingerprint !== null ? bisectStore.forRepo(repoRoot) : null);
  const busy = $derived(repoStore.busy !== null);
  const currentShort = $derived(bisect?.current?.slice(0, 8) ?? null);

  $effect(() => {
    if (repoRoot) {
      void bisectStore.sync(repoRoot, fingerprint);
    }
  });
</script>

{#if bisect}
  <Notice variant="banner" tone={bisect.firstBad !== null ? "success" : "warning"} icon="bug">
    <Text weight="semibold" truncate>{bisectBannerText(bisect)}</Text>
    {#if !bisect.firstBad && currentShort}
      <Text tone="dim">&middot; testing <Text mono>{currentShort}</Text></Text>
    {/if}
    {#snippet action()}
      <Stack direction="row" gap="sm">
        {#if bisect.firstBad}
          <Button size="small" variant="primary" onclick={() => showFirstBad(repoRoot)}>Show Commit</Button>
        {:else}
          <Button
            size="small"
            disabled={busy}
            onclick={() => void markBisect("good")}
            title="The checked out commit works"
          >
            Good
          </Button>
          <Button
            size="small"
            disabled={busy}
            onclick={() => void markBisect("bad")}
            title="The checked out commit has the problem"
          >
            Bad
          </Button>
          <Button
            size="small"
            disabled={busy}
            onclick={() => void markBisect("skip")}
            title="This commit cannot be tested"
          >
            Skip
          </Button>
        {/if}
        <Button
          size="small"
          disabled={busy}
          onclick={() => void resetBisect()}
          title="End the bisect and go back to {bisect.start}"
        >
          Reset
        </Button>
      </Stack>
    {/snippet}
  </Notice>
{/if}
