<!-- What's New: the changelog built into this version, so it works offline. -->
<script lang="ts">
  import Button from "@nibtree/ui/components/Button.svelte";
  import Dialog from "@nibtree/ui/components/Dialog.svelte";
  import Link from "@nibtree/ui/components/Link.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import changelogText from "../../../CHANGELOG.md?raw";
  import { entryFor, releasedEntries } from "./changelog";
  import ReleaseNotes from "./ReleaseNotes.svelte";
  import { updates } from "./updates.svelte";

  const isBetaBuild = $derived((updates.current ?? "").includes("-"));
  // A beta ships the Unreleased notes; a stable build has its own dated section.
  const current = $derived(
    updates.current
      ? isBetaBuild
        ? entryFor(changelogText, "Unreleased")
        : entryFor(changelogText, updates.current)
      : null,
  );
  const older = $derived(
    releasedEntries(changelogText)
      .filter((entry) => entry.version !== updates.current)
      .slice(0, 10),
  );
  let showOlder = $state(false);

  function close(): void {
    updates.whatsNewOpen = false;
  }
</script>

<Dialog
  open
  variant="panel"
  title="What's New in Nibtree {updates.current ?? ''}"
  subtitle={isBetaBuild
    ? "A beta build: these changes are still being tested."
    : "Here is what changed in this version."}
  icon="wand"
  onclose={close}
>
  <Stack gap="lg">
    {#if current?.body}
      <ReleaseNotes markdown={current.body} />
    {:else}
      <Text tone="dim" element="p">No notes were written for this version.</Text>
    {/if}
    {#if older.length > 0}
      <Stack direction="row">
        <Link tone="dim" expanded={showOlder} onclick={() => (showOlder = !showOlder)}>Earlier versions</Link>
      </Stack>
      {#if showOlder}
        {#each older as entry (entry.version)}
          <Stack gap="sm" element="section" label={entry.version}>
            <Stack direction="row" align="baseline" gap="md">
              <Text weight="semibold">{entry.version}</Text>
              <Text size="small" tone="dim">{entry.date ?? ""}</Text>
            </Stack>
            <ReleaseNotes markdown={entry.body} />
          </Stack>
        {/each}
      {/if}
    {/if}
  </Stack>
  {#snippet footnote()}
    <Link onclick={() => void updates.openReleasesPage()}>All releases on GitHub</Link>
  {/snippet}
  {#snippet actions()}
    <Button variant="primary" onclick={close}>Got It</Button>
  {/snippet}
</Dialog>
