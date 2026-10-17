<!-- Settings > Keyboard Shortcuts: every command with its keys. Search by name or by pressing
     keys; click the keys to record new ones. The rules (reserved keys, conflicts, saving) live in
     commands/shortcutSettings.ts. -->
<script lang="ts">
  import { tick } from "svelte";
  import { commandSpecs, currentPlatform } from "$lib/commands/commandRuntime";
  import type { Keybinding } from "$lib/commands/keybinding";
  import type { CommandId, CommandSpec } from "$lib/commands/registry";
  import {
    commandsWithKeys,
    type RecordedKeys,
    recordKeys,
    replaceShortcut,
    type ShortcutRow,
    shortcutRows,
    withoutOverride,
    withShortcut,
  } from "$lib/commands/shortcutSettings";
  import { settings } from "$lib/stores/settings.svelte";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import Button from "@nibtree/ui/components/Button.svelte";
  import Checkbox from "@nibtree/ui/components/Checkbox.svelte";
  import Divider from "@nibtree/ui/components/Divider.svelte";
  import Icon from "@nibtree/ui/components/Icon.svelte";
  import IconButton from "@nibtree/ui/components/IconButton.svelte";
  import Input from "@nibtree/ui/components/Input.svelte";
  import Kbd from "@nibtree/ui/components/Kbd.svelte";
  import Pill from "@nibtree/ui/components/Pill.svelte";
  import ShortcutRecorder from "@nibtree/ui/components/ShortcutRecorder.svelte";
  import Spacer from "@nibtree/ui/components/Spacer.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";

  let { filter = "" }: { filter?: string } = $props();

  const platform = currentPlatform();
  const mac = platform === "macos";
  const specs = commandSpecs(platform);

  let query = $state("");
  /** Record Keys: key presses in the search field search by keys. */
  let searchByKeys = $state(false);
  let searchKeys = $state<Keybinding | null>(null);
  let searchText = $state("");
  let changedOnly = $state(false);
  let searchInput = $state<HTMLInputElement | null>(null);
  // The settings search fills the field; typing here afterwards still works.
  $effect(() => {
    query = filter;
  });

  /** The command whose keys are being recorded. */
  let editingId = $state<CommandId | null>(null);
  let pending = $state<RecordedKeys | null>(null);

  const overrides = $derived(settings.keybindings);
  const rows = $derived(
    shortcutRows(specs, overrides, platform, { query, keys: searchByKeys ? searchKeys : null, changedOnly }),
  );
  const changedCount = $derived(Object.keys(overrides).length);
  const editingSpec = $derived(specs.find((spec) => spec.id === editingId) ?? null);
  const pendingConflicts = $derived(
    pending && !pending.problem && editingId
      ? commandsWithKeys(specs, overrides, platform, pending.accelerator, editingId)
      : [],
  );

  function isPlain(event: KeyboardEvent): boolean {
    return !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
  }

  function onSearchKeydown(event: KeyboardEvent): void {
    if (!searchByKeys) {
      return;
    }
    // Every key is a search term here, so nothing else (the menu, the window) runs it.
    event.preventDefault();
    event.stopPropagation();
    if (isPlain(event) && event.key === "Escape") {
      searchByKeys = false;
      return;
    }
    if (isPlain(event) && event.key === "Backspace") {
      searchKeys = null;
      searchText = "";
      return;
    }
    const recorded = recordKeys(event, platform);
    if (recorded) {
      searchKeys = recorded.binding;
      searchText = recorded.text;
    }
  }

  async function toggleSearchByKeys(): Promise<void> {
    searchByKeys = !searchByKeys;
    searchKeys = null;
    searchText = "";
    await tick();
    searchInput?.focus();
  }

  function startEditing(spec: CommandSpec): void {
    editingId = spec.id;
    pending = null;
  }

  function stopEditing(): void {
    editingId = null;
    pending = null;
  }

  /** A key press while recording (the recorder takes Esc itself): Enter saves, other keys are recorded. */
  function onRecord(event: KeyboardEvent): void {
    if (isPlain(event) && event.key === "Enter") {
      if (pending && !pending.problem && pendingConflicts.length === 0) {
        save(false);
      }
      return;
    }
    pending = recordKeys(event, platform) ?? pending;
  }

  /** Saves the recorded keys; `replace` takes them away from the commands that had them. */
  function save(replace: boolean): void {
    const spec = editingSpec;
    if (!spec || !pending || pending.problem) {
      return;
    }
    const next = replace
      ? replaceShortcut(overrides, spec, pending.accelerator, pendingConflicts, platform)
      : withShortcut(overrides, spec, pending.accelerator, platform);
    settings.setKeybindings(next);
    stopEditing();
  }

  function removeKeys(spec: CommandSpec): void {
    settings.setKeybindings(withShortcut(overrides, spec, null, platform));
  }

  function resetKeys(spec: CommandSpec): void {
    settings.setKeybindings(withoutOverride(overrides, spec.id));
  }

  async function resetAll(): Promise<void> {
    const ok = await dialogs.confirm({
      title: "Reset Keyboard Shortcuts",
      message: `Restore the default keys of ${changedCount === 1 ? "1 command" : `${changedCount} commands`}?`,
      confirmLabel: "Reset All",
      danger: true,
    });
    if (ok) {
      stopEditing();
      settings.setKeybindings({});
    }
  }

  function changedTitle(row: ShortcutRow): string {
    return row.defaultText ? `Changed. Default: ${row.defaultText}` : "Changed. Default: none";
  }
</script>

<Stack sticky gap="md" paddingY="lg">
  <Stack direction="row" align="center" gap="md">
    <Stack grow>
      {#if searchByKeys}
        <Input
          width="fill"
          readonly
          bind:element={searchInput}
          value={searchText}
          placeholder="Press keys to search"
          aria-label="Press keys to search"
          onkeydown={onSearchKeydown}
        />
      {:else}
        <Input
          width="fill"
          bind:element={searchInput}
          bind:value={query}
          placeholder="Search by name or keys"
          aria-label="Search shortcuts"
          spellcheck="false"
        />
      {/if}
    </Stack>
    <Button
      size="small"
      variant={searchByKeys ? "accent" : "default"}
      aria-pressed={searchByKeys}
      title="Search by pressing the keys"
      onclick={() => void toggleSearchByKeys()}
    >
      Record Keys
    </Button>
  </Stack>
  <Stack direction="row" align="center" gap="md">
    <Checkbox label="Changed only" bind:checked={changedOnly} />
    <Spacer />
    <Text tone="dim">{rows.length} commands</Text>
    <Button size="small" disabled={changedCount === 0} onclick={() => void resetAll()}>Reset All</Button>
  </Stack>
  <Stack direction="row" align="center" gap="md">
    <Kbd keys={mac ? "⇧ ⇧" : "Shift Shift"} />
    <Text size="small" tone="dim">Search Everywhere. Pressing Shift twice is fixed.</Text>
  </Stack>
</Stack>

<Stack element="ul" gap="none" label="Keyboard shortcuts">
  {#each rows as row (row.spec.id)}
    {@const editing = editingId === row.spec.id}
    <Stack element="li" gap="none" surface={editing ? "alt" : "none"}>
      <Stack direction="row" align="center" gap="mdPlus" paddingX="sm" paddingY="xs">
        <Stack direction="row" align="center" gap="sm" grow>
          <Text truncate title={row.label}><Text tone="dim">{row.spec.category}:</Text> {row.spec.title}</Text>
          {#if row.changed}
            <Pill tone="selected" title={changedTitle(row)}>Changed</Pill>
          {/if}
          {#if row.conflicts.length > 0}
            <Pill tone="warning" variant="outline" title={`Same keys as ${row.conflicts.join(", ")}`}>
              <Icon name="alert" size="compact" /> Conflict
            </Pill>
          {/if}
        </Stack>
        <ShortcutRecorder
          label={row.label}
          keys={row.keysText ?? ""}
          bind:recording={() => editing, (on) => (on ? startEditing(row.spec) : stopEditing())}
          pending={pending?.text ?? null}
          onrecord={onRecord}
          oncancel={stopEditing}
        />
        <Stack direction="row" justify="end" gap="xxs" width="xsmall">
          {#if !editing && row.shortcut}
            <IconButton
              icon="x"
              iconSize="medium"
              size="mini"
              label="Remove the keys"
              onclick={() => removeKeys(row.spec)}
            />
          {/if}
          {#if !editing && row.changed}
            <IconButton
              icon="undo"
              iconSize="medium"
              size="mini"
              label="Reset to the default"
              onclick={() => resetKeys(row.spec)}
            />
          {/if}
        </Stack>
      </Stack>
      {#if editing}
        <Stack direction="row" align="center" justify="between" gap="mdPlus" paddingX="sm" paddingY="xs">
          {#if pending?.problem}
            <Text size="small" tone="warning">{pending.problem}</Text>
          {:else if pendingConflicts.length > 0}
            <Text size="small" tone="warning">
              Also used by {pendingConflicts.map((spec) => `${spec.category}: ${spec.title}`).join(", ")}.
            </Text>
          {:else}
            <Text size="small" tone="dim">{pending ? "Enter saves." : "Press the new keys."} Esc cancels.</Text>
          {/if}
          <Stack direction="row" gap="sm">
            {#if pendingConflicts.length > 0}
              <Button size="small" onclick={() => save(false)}>Keep Both</Button>
              <Button size="small" variant="primary" onclick={() => save(true)}>Replace</Button>
            {:else}
              <Button
                size="small"
                variant="primary"
                disabled={!pending || pending.problem !== null}
                onclick={() => save(false)}
              >
                Save
              </Button>
            {/if}
            <Button size="small" onclick={stopEditing}>Cancel</Button>
          </Stack>
        </Stack>
      {/if}
      <Divider strong={false} />
    </Stack>
  {:else}
    <Stack element="li" paddingX="sm" paddingY="xl">
      <Text tone="dim">No command matches.</Text>
    </Stack>
  {/each}
</Stack>
