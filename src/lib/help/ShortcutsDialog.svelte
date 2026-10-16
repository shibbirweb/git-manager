<!-- Help > Keyboard Shortcuts: every shortcut, from the menu bar's own definition plus the ones no
     menu shows (shortcuts.ts). Lazy-loaded by App.svelte and mounted only while open. -->
<script lang="ts">
  import Button from "@git-manager/ui/components/Button.svelte";
  import Dialog from "@git-manager/ui/components/Dialog.svelte";
  import EmptyState from "@git-manager/ui/components/EmptyState.svelte";
  import Kbd from "@git-manager/ui/components/Kbd.svelte";
  import Row from "@git-manager/ui/components/Row.svelte";
  import SearchField from "@git-manager/ui/components/SearchField.svelte";
  import SectionTitle from "@git-manager/ui/components/SectionTitle.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import Toolbar from "@git-manager/ui/components/Toolbar.svelte";
  import { platformFromUserAgent } from "$lib/menu/menuSpec";
  import { settings } from "$lib/stores/settings.svelte";
  import { SHORTCUTS_URL } from "$lib/update/releases";
  import { updates } from "$lib/update/updates.svelte";
  import { helpDialogs } from "./helpDialogs.svelte";
  import { filterShortcuts, shortcutSections } from "./shortcuts";

  let filter = $state("");

  const sections = shortcutSections(platformFromUserAgent(navigator.userAgent), settings.keybindings);
  const shown = $derived(filterShortcuts(sections, filter));
  const total = sections.reduce((sum, section) => sum + section.rows.length, 0);
  const count = $derived(shown.reduce((sum, section) => sum + section.rows.length, 0));

  function close(): void {
    helpDialogs.shortcutsOpen = false;
  }

  function changeShortcuts(): void {
    close();
    settings.openDialog("keyboard");
  }
</script>

<Dialog open variant="panel" width="xlarge" title="Keyboard Shortcuts" onclose={close}>
  {#snippet toolbar()}
    <Toolbar variant="dialog" label="Filter">
      <Stack grow>
        <SearchField
          label="Filter shortcuts"
          placeholder="Filter by action or key, for example: terminal, commit, F7"
          width="fill"
          bind:value={filter}
          autofocus
        />
      </Stack>
      <Text size="small" tone="dim" tabular>{filter.trim() ? `${count} of ${total}` : `${total} shortcuts`}</Text>
    </Toolbar>
  {/snippet}
  <Stack gap="lg">
    {#each shown as section (section.title)}
      <Stack gap="none" element="section" label={section.title}>
        <SectionTitle title={section.title} variant="caps" heading={3} />
        {#each section.rows as row (`${row.label}-${row.keys.join(",")}`)}
          <Row size="entry" line>
            <Stack grow gap="none">
              <Text>{row.label}</Text>
              {#if row.context}
                <Text size="small" tone="dim">{row.context}</Text>
              {/if}
            </Stack>
            <Stack direction="row" align="center" gap="sm">
              {#each row.keys as combo, index (combo)}
                {#if index > 0}
                  <Text size="xsmall" tone="dim">or</Text>
                {/if}
                <Kbd keys={combo} />
              {/each}
            </Stack>
          </Row>
        {/each}
      </Stack>
    {:else}
      <EmptyState variant="panel" title="No shortcut matches the filter." titleTone="dim" />
    {/each}
  </Stack>
  {#snippet footnote()}
    <Text size="small" tone="dim">The Edit, Code and View items with keys work where the menu shows them enabled.</Text>
  {/snippet}
  {#snippet actions()}
    <Button size="small" onclick={changeShortcuts}>Change Shortcuts</Button>
    <Button size="small" onclick={() => void updates.open(SHORTCUTS_URL)}>Open Online Version</Button>
  {/snippet}
</Dialog>
