<!-- Settings > Editor, last part: saving, local history, and Markdown preview and blame. -->
<script lang="ts">
  import { api } from "$lib/api";
  import { AUTO_SAVE_DELAY_RANGE } from "$lib/editor/autoSave";
  import { localHistory } from "$lib/localHistory/localHistory.svelte";
  import { usageText } from "$lib/localHistory/localHistoryModel";
  import { defaultPreferences, type MarkdownViewMode, settings } from "$lib/stores/settings.svelte";
  import type { AutoSaveMode } from "$lib/stores/settingsData";
  import type { LocalHistoryUsage } from "$lib/types";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import Button from "@git-manager/ui/components/Button.svelte";
  import Segmented from "@git-manager/ui/components/Segmented.svelte";
  import Switch from "@git-manager/ui/components/Switch.svelte";
  import MemoryFlag from "./MemoryFlag.svelte";
  import NumberSetting from "./NumberSetting.svelte";
  import { SAVE_CLEANUP_ROWS } from "./settingsRows";
  import SettingsGroup from "./SettingsGroup.svelte";
  import SettingsRow from "./SettingsRow.svelte";
  import { clickModifier, numberChoices, optionKey, set } from "./settingsShared";

  const autoSaveChoices: { value: AutoSaveMode; label: string; hint: string }[] = [
    { value: "off", label: "Off", hint: "Files are saved only when you save them." },
    { value: "afterDelay", label: "After a delay", hint: "Save a short pause after the last edit." },
    {
      value: "onFocusChange",
      label: "On focus change",
      hint: "Save when you leave the editor: another tab, another panel or another app.",
    },
  ];
  const autoSaveHint = $derived(
    (autoSaveChoices.find((choice) => choice.value === settings.autoSave)?.hint ?? "") +
      (settings.autoSave === "off" ? "" : " Conflicted files are only saved by hand."),
  );

  const markdownModes: { value: MarkdownViewMode; label: string }[] = [
    { value: "editor", label: "Editor only" },
    { value: "split", label: "Editor and preview" },
    { value: "preview", label: "Rich editor" },
  ];

  function applyAutoSaveDelay(typed: number | null): void {
    const [min, max] = AUTO_SAVE_DELAY_RANGE;
    const delay = typed === null ? settings.autoSaveDelayMs : Math.min(max, Math.max(min, Math.round(typed)));
    if (delay !== settings.autoSaveDelayMs) {
      set("autoSaveDelayMs", delay);
    }
  }

  // How much local history is kept, read again whenever it changes.
  let historyUsage = $state.raw<LocalHistoryUsage | null>(null);
  $effect(() => {
    void localHistory.version;
    api
      .localHistoryUsage()
      .then((usage) => {
        historyUsage = usage;
      })
      .catch(() => {
        historyUsage = null;
      });
  });

  async function clearLocalHistory(): Promise<void> {
    const ok = await dialogs.confirm({
      title: "Clear Local History?",
      message: "Every kept version of every file is removed. This cannot be undone.",
      confirmLabel: "Clear",
      danger: true,
    });
    if (ok) {
      await localHistory.clear();
    }
  }
</script>

<SettingsGroup title="Saving">
  <SettingsRow title="Auto save" hint={autoSaveHint}>
    <Segmented
      label="Auto save"
      options={autoSaveChoices}
      value={settings.autoSave}
      onchange={(mode) => set("autoSave", mode)}
    />
  </SettingsRow>
  {#if settings.autoSave === "afterDelay"}
    <SettingsRow
      title="Delay"
      nested
      hint={`Milliseconds after the last edit, from ${AUTO_SAVE_DELAY_RANGE[0]} to ${AUTO_SAVE_DELAY_RANGE[1]}. ` +
        `The default is ${defaultPreferences.autoSaveDelayMs}.`}
    >
      <NumberSetting
        label="Auto save delay in milliseconds"
        value={settings.autoSaveDelayMs}
        min={AUTO_SAVE_DELAY_RANGE[0]}
        max={AUTO_SAVE_DELAY_RANGE[1]}
        step={100}
        onapply={applyAutoSaveDelay}
      />
    </SettingsRow>
  {/if}
  <SettingsRow title="Remember unsaved changes" toggle>
    {#snippet hintContent()}
      Keep the text of new files and unsaved edits when you close the window or quit, and bring the tabs back with it
      next time. Off, closing asks before unsaved changes are lost.
    {/snippet}
    <Switch
      label="Remember unsaved changes"
      checked={settings.rememberUnsaved}
      onchange={(on) => set("rememberUnsaved", on)}
    />
  </SettingsRow>
  {#each SAVE_CLEANUP_ROWS as row (row.key)}
    <SettingsRow title={row.label} hint={row.hint} toggle>
      <Switch label={row.label} checked={settings[row.key]} onchange={(on) => set(row.key, on)} />
    </SettingsRow>
  {/each}
</SettingsGroup>
<SettingsGroup title="Local History">
  <SettingsRow title="Keep local history" toggle>
    {#snippet hintContent()}
      Keeps a version of a file on every save, when it changes outside the app and before Discard, Rollback or Revert.
      Files over 1 MB are skipped. Open it from a tab's menu or File, Show Local History.
    {/snippet}
    <Switch
      label="Keep local history"
      checked={settings.localHistoryEnabled}
      onchange={(on) => set("localHistoryEnabled", on)}
    />
  </SettingsRow>
  <SettingsRow title="Keep versions for" hint="Each file keeps its newest 50 versions." nested>
    <Segmented
      label="Keep versions for"
      options={numberChoices([1, 3, 7, 14, 30], (days) => (days === 1 ? "1 day" : `${days} days`))}
      value={String(settings.localHistoryDays)}
      onchange={(days) => set("localHistoryDays", Number(days))}
    />
  </SettingsRow>
  <SettingsRow title="Size limit" hint="The oldest versions go first when all of them need more space." nested>
    <Segmented
      label="Local history size limit"
      options={numberChoices([50, 200, 500, 1000], (sizeMb) =>
        sizeMb >= 1000 ? `${sizeMb / 1000} GB` : `${sizeMb} MB`,
      )}
      value={String(settings.localHistorySizeMb)}
      onchange={(sizeMb) => set("localHistorySizeMb", Number(sizeMb))}
    />
  </SettingsRow>
  <SettingsRow title="Stored" hint={usageText(historyUsage) || "In ~/.gitmanager/local-history."} nested>
    <Button
      size="small"
      variant="danger"
      disabled={historyUsage?.snapshots === 0}
      onclick={() => void clearLocalHistory()}
    >
      Clear Local History
    </Button>
  </SettingsRow>
</SettingsGroup>
<SettingsGroup title="Preview and blame">
  <SettingsRow title="Markdown preview">
    {#snippet mark()}<MemoryFlag setting="markdownViewMode" />{/snippet}
    {#snippet hintContent()}
      How Markdown files open. Each file can switch with the buttons at the top right of its editor and keeps its choice
      until the app restarts.
    {/snippet}
    <Segmented
      label="Markdown preview"
      options={markdownModes}
      value={settings.markdownViewMode}
      onchange={(mode) => set("markdownViewMode", mode)}
    />
  </SettingsRow>
  <SettingsRow title="Current line blame" toggle>
    {#snippet hintContent()}
      Show the author, age and commit of the cursor line at its end. {clickModifier}+click it to show the commit in the
      Log; add {optionKey} to copy the commit hash.
    {/snippet}
    <Switch
      label="Current line blame"
      checked={settings.currentLineBlame}
      onchange={(on) => set("currentLineBlame", on)}
    />
  </SettingsRow>
  <SettingsRow title="Blame gutter" toggle>
    {#snippet mark()}<MemoryFlag setting="blameGutter" />{/snippet}
    {#snippet hintContent()}
      A column with the commit, author and age of every block of lines. Also toggled with the Blame button in the path
      bar and the diff toolbar.
    {/snippet}
    <Switch label="Blame gutter" checked={settings.blameGutter} onchange={(on) => set("blameGutter", on)} />
  </SettingsRow>
</SettingsGroup>
