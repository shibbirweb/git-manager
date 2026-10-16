<!-- "A new version is available": notes for every release since this one, and a download link.
     A manual check can also open it for a version the user skipped, marked as such. -->
<script lang="ts">
  import Button from "@git-manager/ui/components/Button.svelte";
  import Dialog from "@git-manager/ui/components/Dialog.svelte";
  import Link from "@git-manager/ui/components/Link.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import Tag from "@git-manager/ui/components/Tag.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import ReleaseNotes from "./ReleaseNotes.svelte";
  import { updates } from "./updates.svelte";

  const newest = $derived(updates.newer[0] ?? null);
  const skipped = $derived(updates.newestSkipped);
  const subtitle = $derived.by(() => {
    if (!newest) {
      return "";
    }
    const beta = newest.prerelease ? ". This is a beta release." : ".";
    const more = updates.newer.length > 1 ? ` ${updates.newer.length} releases since yours are listed below.` : "";
    return `You have ${updates.current}${beta}${more}`;
  });

  function close(): void {
    updates.dialogOpen = false;
  }

  function formatDate(value: string | null): string {
    return value
      ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
      : "";
  }
</script>

{#if newest}
  <Dialog
    open
    variant="panel"
    title="Git Manager {newest.version} is available"
    {subtitle}
    icon="arrow-down"
    onclose={close}
  >
    <Stack gap="lg">
      {#if skipped}
        <Text weight="semibold" tone="warning">You skipped this version.</Text>
      {/if}
      {#each updates.newer as release (release.tag)}
        <Stack gap="sm" element="section" label={release.name}>
          <Stack direction="row" align="center" gap="md">
            <Text weight="semibold">{release.name}</Text>
            {#if release.prerelease}
              <Tag tone="warning" size="small">Beta</Tag>
            {/if}
            <Text size="small" tone="dim">{formatDate(release.publishedAt)}</Text>
          </Stack>
          <ReleaseNotes markdown={release.notes} />
        </Stack>
      {/each}
    </Stack>
    {#snippet footnote()}
      <Link onclick={() => void updates.open(newest.url)}>View on GitHub</Link>
    {/snippet}
    {#snippet actions()}
      {#if skipped}
        <Button onclick={() => updates.unskip()} title="Announce this version again">Stop Skipping</Button>
      {:else}
        <Button onclick={() => updates.skip(newest)} title="Do not announce this version again"
          >Skip This Version</Button
        >
      {/if}
      <Button onclick={close}>Later</Button>
      <Button variant="primary" icon="arrow-down" onclick={() => void updates.download(newest)}>Download</Button>
    {/snippet}
  </Dialog>
{/if}
