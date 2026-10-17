<!--
  Recent Files (Cmd+E): the files shown in the editor, most recent first, with
  the one before the file on screen selected, so Cmd+E then Enter goes back to it. Typing
  filters the list, Cmd+E again shows the edited files only and Delete takes a file off the
  list. Mounted only while open (Workspace.svelte); the list lives in recentFilesStore.svelte.ts.
-->
<script lang="ts">
  import CommandPalette from "@nibtree/ui/components/CommandPalette.svelte";
  import IconButton from "@nibtree/ui/components/IconButton.svelte";
  import Kbd from "@nibtree/ui/components/Kbd.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import ToggleButton from "@nibtree/ui/components/ToggleButton.svelte";
  import { partsToRanges } from "@nibtree/ui/logic/highlight";
  import type { PaletteItem } from "@nibtree/ui/logic/palette";
  import { onMount, untrack } from "svelte";
  import { currentPlatform, localKeys, shortcutFor } from "$lib/commands/commandRuntime";
  import { formatAccelerator, matchesAccelerator } from "$lib/commands/keybinding";
  import { fileIcons } from "$lib/fileIcons/fileIcons.svelte";
  import { navigation } from "$lib/stores/navigation.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { workspaceChanges } from "$lib/views/files/explorerLook";
  import { initialRecentSelection, recentFileRows } from "./recentFilesModel";
  import { recentFilesStore } from "./recentFilesStore.svelte";

  const platform = currentPlatform();
  const mac = platform === "macos";
  /** The key that opened the popup; pressed again it switches to the edited files. */
  const ownKey = shortcutFor("edit.recentFiles");
  const ownKeyLabel = ownKey ? formatAccelerator(ownKey, platform) : null;
  /** Read once: the file on screen when the popup opened. */
  const activePath = untrack(() => repoStore.openFilePath);

  let palette = $state<ReturnType<typeof CommandPalette> | null>(null);
  let field = $state<HTMLInputElement | null>(null);
  let query = $state("");
  let editedOnly = $state(false);

  const folders = $derived(repoStore.workspace?.folders ?? []);
  const rows = $derived(recentFileRows(recentFilesStore.files, folders, query, editedOnly));
  /** Git status colors, as in the Files panel. */
  const tones = $derived(workspaceChanges(repoStore.repos, repoStore.statuses));
  const items = $derived(
    rows.map((row): PaletteItem => {
      const name = partsToRanges(row.file.nameParts);
      const folder = partsToRanges(row.file.folderParts);
      return {
        id: row.file.path,
        title: name.text,
        ranges: name.ranges,
        fileIcon: fileIcons.resolve?.(row.file.name) ?? null,
        tone: tones.tone(row.file.path),
        dirty: repoStore.isDirty(row.file.path),
        folder: folder.text,
        folderRanges: folder.ranges,
        tooltip: row.file.path,
      };
    }),
  );
  /** On an empty query, the file before the one on screen, so the key then Enter goes back to it. */
  const preferred = $derived(rows[initialRecentSelection(rows, activePath, query)]?.file.path ?? null);
  const title = $derived(editedOnly ? "Recently Edited Files" : "Recent Files");
  const emptyText = $derived.by(() => {
    if (query.trim() !== "") {
      return "No recent files match";
    }
    return editedOnly ? "No edited files yet" : "No recent files yet. Files you open show up here.";
  });

  onMount(() => () => recentFilesStore.release());

  function cancel(): void {
    recentFilesStore.close();
    recentFilesStore.restoreFocus();
  }

  /** `toSide` (Cmd+Enter) opens it in the other editor group, as in Quick Open. */
  async function open(filePath: string, toSide: boolean): Promise<void> {
    recentFilesStore.close();
    if (!(await navigation.fileExists(filePath))) {
      recentFilesStore.remove(filePath);
      recentFilesStore.restoreFocus();
      const name = filePath.slice(filePath.lastIndexOf("/") + 1);
      toast.info("File not found", `${name} no longer exists and was taken off Recent Files.`);
      return;
    }
    await navigation.openFileAt(filePath, null, null, { pin: true, toSide });
  }

  /** Delete: takes the file off the list; the same place stays highlighted. */
  function remove(filePath: string): void {
    recentFilesStore.remove(filePath);
    field?.focus();
  }

  function toggleEdited(): void {
    editedOnly = !editedOnly;
    field?.focus();
  }

  /** Delete removes a row only when it would not delete text in the field. */
  function deletesRow(event: KeyboardEvent): boolean {
    if (event.key === "Delete" && !event.altKey && !event.shiftKey) {
      return (
        field === null || (field.selectionStart === field.value.length && field.selectionEnd === field.value.length)
      );
    }
    // Cmd+Backspace on a Mac keyboard without a Delete key, when there is nothing to erase.
    return mac && event.key === "Backspace" && event.metaKey && query === "";
  }

  /** The key that opened the popup toggles Edited only; Delete removes the highlighted file; Tab stays. */
  function onkeydown(event: KeyboardEvent): void {
    if (event.isComposing) {
      return;
    }
    const highlighted = palette?.highlighted() ?? null;
    if (ownKey !== null && matchesAccelerator(event, ownKey, platform)) {
      event.preventDefault();
      toggleEdited();
    } else if (deletesRow(event) && highlighted) {
      event.preventDefault();
      remove(highlighted.id);
    } else if (event.key === "Tab") {
      event.preventDefault();
    }
    if (event.defaultPrevented || event.key === "Enter" || event.key === "Escape") {
      // The window's own keys must not see them too.
      event.stopPropagation();
    }
  }
</script>

{#snippet head()}
  <Stack direction="row" align="center" gap="md">
    <Stack grow><Text weight="semibold" truncate>{title}</Text></Stack>
    <ToggleButton
      variant="filter"
      icon={editedOnly ? "check" : null}
      text="Edited only"
      label="Edited only"
      title="Show only the files edited in the app"
      keepFocus
      bind:pressed={() => editedOnly, () => toggleEdited()}
    />
    {#if ownKeyLabel}<Kbd keys={ownKeyLabel} />{/if}
  </Stack>
{/snippet}

{#snippet removeButton(item: PaletteItem)}
  <IconButton
    icon="x"
    size="micro"
    iconSize="compact"
    keepFocus
    label="Remove {item.title} from Recent Files"
    title="Remove from Recent Files"
    onclick={(event) => {
      event.stopPropagation();
      remove(item.id);
    }}
  />
{/snippet}

{#snippet footer()}
  <Stack direction="row" gap="lg" wrap>
    <Text size="small" tone="dim"><Kbd keys={localKeys("Enter")} /> open</Text>
    <Text size="small" tone="dim"><Kbd keys={localKeys("CmdOrCtrl+Enter")} /> open to the side</Text>
    <Text size="small" tone="dim"><Kbd keys={mac ? "⌘⌫" : localKeys("Delete")} /> remove</Text>
  </Stack>
{/snippet}

<CommandPalette
  bind:this={palette}
  bind:field
  label={title}
  placeholder="Type to filter"
  fieldSize="compact"
  bind:query
  {items}
  {preferred}
  {emptyText}
  {head}
  {footer}
  rowEnd={removeButton}
  onpick={(item, event) => void open(item.id, mac ? event.metaKey : event.ctrlKey)}
  {onkeydown}
  onclose={cancel}
/>
