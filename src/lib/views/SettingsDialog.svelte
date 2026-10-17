<!-- Settings dialog. Every change is applied immediately and saved to ~/.nibtree/settings.json. Each section is
     its own file under settings/; this one holds the frame, the section list, the search and the load errors. -->
<script lang="ts">
  import { untrack } from "svelte";
  import { commandSpecs, currentPlatform } from "$lib/commands/commandRuntime";
  import { shortcutRows } from "$lib/commands/shortcutSettings";
  import { settings, type SettingsSection } from "$lib/stores/settings.svelte";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import Button from "@nibtree/ui/components/Button.svelte";
  import Dialog from "@nibtree/ui/components/Dialog.svelte";
  import Notice from "@nibtree/ui/components/Notice.svelte";
  import SearchField from "@nibtree/ui/components/SearchField.svelte";
  import SideNav from "@nibtree/ui/components/SideNav.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import SettingsSectionView from "./settings/SettingsSectionView.svelte";
  import { searchWords, textMatches } from "./settings/settingsSearch";
  import { provideSettingsSearch, SettingsSearchView } from "./settings/settingsSearchView.svelte";

  const sections: { id: SettingsSection; label: string }[] = [
    { id: "appearance", label: "Appearance" },
    { id: "editor", label: "Editor" },
    { id: "merge", label: "Git" },
    { id: "layout", label: "Layout" },
    { id: "terminal", label: "Terminal" },
    { id: "ai", label: "AI" },
    { id: "keyboard", label: "Keyboard Shortcuts" },
    { id: "github", label: "GitHub" },
    { id: "automation", label: "Automation" },
    { id: "updates", label: "Updates" },
    { id: "files", label: "Settings Files" },
    { id: "about", label: "About" },
  ];
  const sectionLabels = Object.fromEntries(sections.map((item) => [item.id, item.label])) as Record<
    SettingsSection,
    string
  >;

  const search = new SettingsSearchView();
  search.sectionLabels = sectionLabels;
  search.section = settings.dialogSection;
  provideSettingsSearch(search);

  let searchQuery = $state("");
  const shortcutPlatform = currentPlatform();
  const shortcutSpecs = commandSpecs(shortcutPlatform);
  $effect(() => {
    search.words = searchWords(searchQuery);
  });
  /** Commands the Keyboard Shortcuts list shows for this search. */
  const foundShortcuts = $derived(
    search.searching
      ? shortcutRows(shortcutSpecs, settings.keybindings, shortcutPlatform, {
          query: searchQuery,
          keys: null,
          changedOnly: false,
        }).length
      : 0,
  );
  const visibleSections = $derived(
    search.searching
      ? sections.filter(
          (item) =>
            textMatches(item.label, search.words) ||
            search.found.some((entry) => entry.section === item.id) ||
            (item.id === "keyboard" && foundShortcuts > 0),
        )
      : sections,
  );
  /** Nothing matches anywhere, so the open section has nothing to show. */
  const sectionUnmatched = $derived(search.searching && !visibleSections.some((item) => item.id === search.section));

  // Stay on the open section while it still matches; otherwise show the first one that does.
  $effect(() => {
    const first = visibleSections[0];
    if (first && !visibleSections.some((item) => item.id === untrack(() => search.section))) {
      search.section = first.id;
    }
  });

  function close(): void {
    settings.dialogOpen = false;
  }

  async function reset(): Promise<void> {
    const ok = await dialogs.confirm({
      title: "Reset Settings",
      message: "Restore every setting to its default value?",
      confirmLabel: "Reset",
      danger: true,
    });
    if (ok) {
      settings.resetPreferences();
      toast.success("Settings reset to defaults");
    }
  }

  async function resetState(): Promise<void> {
    const ok = await dialogs.confirm({
      title: "Reset state.json",
      message:
        "Replace state.json with a fresh file? The recent folders, last session and panel sizes saved in it are lost.",
      confirmLabel: "Reset",
      danger: true,
    });
    if (ok) {
      settings.resetState();
      toast.success("state.json was reset");
    }
  }
</script>

<Dialog
  open
  title="Settings"
  variant="split"
  movable
  contentTitle={sectionLabels[search.section]}
  dismissible={!dialogs.active}
  onclose={close}
>
  {#snippet sidebar()}
    <SearchField bind:value={searchQuery} placeholder="Search settings" label="Search settings" autofocus />
    <SideNav
      label="Settings sections"
      items={visibleSections}
      active={search.section}
      emptyText="Nothing found"
      onselect={(sectionId) => (search.section = sectionId as SettingsSection)}
    />
    <Stack grow>{""}</Stack>
    <SideNav
      label="Reset"
      items={[{ id: "reset", label: "Reset to Defaults", danger: true }]}
      onselect={() => void reset()}
    />
  {/snippet}
  {#if settings.loadError || settings.stateLoadError}
    <Stack gap="sm" paddingX="xxl" paddingY="xs">
      {#if settings.loadError}
        <Notice tone="danger">
          <Text weight="semibold">settings.json could not be read</Text>, so defaults are in use and it will not be
          overwritten.
          <Text tone="dim" selectable element="div">{settings.loadError}</Text>
          {#snippet action()}
            <Button size="small" onclick={() => void settings.reload()}>Try Again</Button>
          {/snippet}
        </Notice>
      {/if}
      {#if settings.stateLoadError}
        <Notice tone="danger">
          <Text weight="semibold">state.json could not be read</Text>, so recent folders and panel sizes start empty and
          it will not be overwritten.
          <Text tone="dim" selectable element="div">{settings.stateLoadError}</Text>
          {#snippet action()}
            <Stack direction="row" gap="sm">
              <Button size="small" onclick={() => void settings.reloadState()}>Try Again</Button>
              <Button size="small" variant="danger" onclick={() => void resetState()}>Reset</Button>
            </Stack>
          {/snippet}
        </Notice>
      {/if}
    </Stack>
  {/if}
  {#if sectionUnmatched}
    <Stack paddingX="xxl" paddingY="xs">
      <Text tone="dim" element="p">No settings match "{searchQuery.trim()}".</Text>
    </Stack>
  {:else}
    {#key search.section}
      <Stack grow scroll="y" paddingX="xxl" paddingY="xs" role="region" label="Settings content">
        <SettingsSectionView
          section={search.section}
          shortcutFilter={foundShortcuts > 0 ? searchQuery : ""}
          onnavigate={(sectionId) => (search.section = sectionId)}
          onclose={close}
        />
      </Stack>
    {/key}
  {/if}
</Dialog>
