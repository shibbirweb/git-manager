<!-- Settings > Editor, second part: editing features, the margin line and tabs. -->
<script lang="ts">
  import { commandKeys } from "$lib/commands/commandRuntime";
  import { DEFAULT_RULER_COLUMN, EDITOR_RULER_RANGE, pickRulerColumn, settings } from "$lib/stores/settings.svelte";
  import {
    DEFAULT_TAB_LIMIT_NUMBER,
    NO_TAB_LIMIT,
    pickTabLimit,
    SINGLE_TAB,
    TAB_LIMIT_RANGE,
  } from "$lib/stores/tabLimit";
  import { UNLOAD_TAB_MINUTES } from "$lib/stores/tabSleep";
  import Segmented from "@git-manager/ui/components/Segmented.svelte";
  import Switch from "@git-manager/ui/components/Switch.svelte";
  import MemoryFlag from "./MemoryFlag.svelte";
  import NumberSetting from "./NumberSetting.svelte";
  import { EDITOR_FEATURE_ROWS } from "./settingsRows";
  import SettingsGroup from "./SettingsGroup.svelte";
  import SettingsRow from "./SettingsRow.svelte";
  import { numberChoices, set } from "./settingsShared";

  const recentFilesKeys = commandKeys("edit.recentFiles") ?? "Recent Files";
  /** The last margin column, so turning the line on again brings it back. */
  let lastRuler = $state(settings.editorRulerColumn || DEFAULT_RULER_COLUMN);
  $effect(() => {
    if (settings.editorRulerColumn > 0) {
      lastRuler = settings.editorRulerColumn;
    }
  });

  function applyRuler(typed: number | null): void {
    const column = typed === null ? 0 : pickRulerColumn(typed);
    const next = column > 0 ? column : settings.editorRulerColumn || DEFAULT_RULER_COLUMN;
    if (next !== settings.editorRulerColumn) {
      set("editorRulerColumn", next);
    }
  }

  type TabLimitChoice = "none" | "single" | "number";
  const tabLimitChoices: { value: TabLimitChoice; label: string }[] = [
    { value: "none", label: "No limit" },
    { value: "single", label: "Single tab" },
    { value: "number", label: "Limit" },
  ];
  const tabLimitChoice = $derived<TabLimitChoice>(
    settings.tabLimit === NO_TAB_LIMIT ? "none" : settings.tabLimit === SINGLE_TAB ? "single" : "number",
  );
  const tabLimitHint = $derived(
    tabLimitChoice === "none"
      ? "Open as many file tabs as you like."
      : tabLimitChoice === "single"
        ? "Opening a file replaces the one on screen, for working on one file at a time."
        : "Past the limit, opening a file closes the file tab you used least recently.",
  );
  /** The last number of tabs, so choosing Limit again brings it back. */
  let lastTabLimit = $state(settings.tabLimit > SINGLE_TAB ? settings.tabLimit : DEFAULT_TAB_LIMIT_NUMBER);
  $effect(() => {
    if (settings.tabLimit > SINGLE_TAB) {
      lastTabLimit = settings.tabLimit;
    }
  });

  function chooseTabLimit(choice: TabLimitChoice): void {
    const limit = pickTabLimit(lastTabLimit);
    if (choice === "none") {
      set("tabLimit", NO_TAB_LIMIT);
    } else if (choice === "single") {
      set("tabLimit", SINGLE_TAB);
    } else {
      set("tabLimit", limit > SINGLE_TAB ? limit : DEFAULT_TAB_LIMIT_NUMBER);
    }
  }

  function applyTabLimit(typed: number | null): void {
    const limit = typed === null ? settings.tabLimit : pickTabLimit(Math.max(TAB_LIMIT_RANGE[0], typed));
    if (limit !== settings.tabLimit) {
      set("tabLimit", limit);
    }
  }
</script>

<SettingsGroup title="Editing features" hint="Turning a feature off removes it from open editors and frees its memory.">
  {#each EDITOR_FEATURE_ROWS as row (row.key)}
    <SettingsRow title={row.label} hint={row.hint} toggle>
      <Switch label={row.label} checked={settings[row.key]} onchange={(on) => set(row.key, on)} />
    </SettingsRow>
    {#if row.key === "editorCompletion" && settings.editorCompletion}
      <SettingsRow
        title="Show completion while typing"
        hint="Off, only Ctrl+Space opens the list. Markdown and plain text always wait for Ctrl+Space."
        nested
        toggle
      >
        <Switch
          label="Show completion while typing"
          checked={settings.editorCompletionOnTyping}
          onchange={(on) => set("editorCompletionOnTyping", on)}
        />
      </SettingsRow>
    {/if}
  {/each}
  <SettingsRow title="Right margin line" hint="A thin line at a column in editors, diffs and the merge tool." toggle>
    <Switch
      label="Right margin line"
      checked={settings.editorRulerColumn > 0}
      onchange={(on) => set("editorRulerColumn", on ? pickRulerColumn(lastRuler) || DEFAULT_RULER_COLUMN : 0)}
    />
  </SettingsRow>
  {#if settings.editorRulerColumn > 0}
    <SettingsRow title="Margin column" hint="From {EDITOR_RULER_RANGE[0]} to {EDITOR_RULER_RANGE[1]}." nested>
      <NumberSetting
        label="Margin column"
        value={settings.editorRulerColumn}
        min={EDITOR_RULER_RANGE[0]}
        max={EDITOR_RULER_RANGE[1]}
        onapply={applyRuler}
      />
    </SettingsRow>
  {/if}
</SettingsGroup>
<SettingsGroup title="Tabs">
  <SettingsRow title="Reopen tabs on start" toggle>
    {#snippet hintContent()}
      Open the files a folder or workspace had in tabs last time, also when you open it again later. Each file loads
      when you first show its tab.
    {/snippet}
    <Switch
      label="Reopen tabs on start"
      checked={settings.reopenTabsOnStart}
      onchange={(on) => set("reopenTabsOnStart", on)}
    />
  </SettingsRow>
  <SettingsRow
    title="Recent Files"
    toggle
    hint={`${recentFilesKeys} lists the files you worked on last, and Quick Open and Search Everywhere show them ` +
      "first. Each workspace keeps up to 50 in state.json. Off, it only says it is off."}
  >
    {#snippet mark()}<MemoryFlag setting="recentFiles" />{/snippet}
    <Switch label="Recent Files" checked={settings.recentFiles} onchange={(on) => set("recentFiles", on)} />
  </SettingsRow>
  <SettingsRow title="Split editor" toggle>
    {#snippet hintContent()}
      Show groups of tabs side by side or stacked with Window > Split Right and Split Down. Turning it off moves every
      tab into one group.
    {/snippet}
    <Switch label="Split editor" checked={settings.splitEditor} onchange={(on) => set("splitEditor", on)} />
  </SettingsRow>
  <SettingsRow
    title="Wrap tabs"
    hint="Show tabs that do not fit on more rows instead of scrolling them sideways."
    toggle
  >
    <Switch label="Wrap tabs" checked={settings.wrapTabs} onchange={(on) => set("wrapTabs", on)} />
  </SettingsRow>
  <SettingsRow title="Tab limit" hint="{tabLimitHint} Tabs with unsaved changes and pinned tabs always stay open.">
    {#snippet mark()}<MemoryFlag setting="tabLimit" />{/snippet}
    <Segmented label="Tab limit" options={tabLimitChoices} value={tabLimitChoice} onchange={chooseTabLimit} />
  </SettingsRow>
  {#if tabLimitChoice === "number"}
    <SettingsRow
      title="Most file tabs"
      hint="From {TAB_LIMIT_RANGE[0]} to {TAB_LIMIT_RANGE[1]}. Commit, history and terminal tabs do not count."
      nested
    >
      <NumberSetting
        label="Most file tabs"
        value={settings.tabLimit}
        min={TAB_LIMIT_RANGE[0]}
        max={TAB_LIMIT_RANGE[1]}
        onapply={applyTabLimit}
      />
    </SettingsRow>
  {/if}
  {#if tabLimitChoice === "single"}
    <SettingsRow
      title="Single tab title"
      hint="With only one tab open, show its name in the middle of the strip instead of a tab."
      nested
      toggle
    >
      <Switch label="Single tab title" checked={settings.singleTabTitle} onchange={(on) => set("singleTabTitle", on)} />
    </SettingsRow>
  {/if}
  <SettingsRow title="Unload hidden tabs" toggle>
    {#snippet hintContent()}
      A file tab you have not looked at for a while gives its editor back, about 4 MB each. The tab stays, and opening
      it again goes back to the same place, but its undo history starts over. Tabs with unsaved changes are never
      unloaded.
    {/snippet}
    <Switch
      label="Unload hidden tabs"
      checked={settings.unloadHiddenTabs}
      onchange={(on) => set("unloadHiddenTabs", on)}
    />
  </SettingsRow>
  {#if settings.unloadHiddenTabs}
    <SettingsRow title="Unload after" hint="How long a tab stays out of sight before it is unloaded." nested>
      <Segmented
        label="Unload after"
        options={numberChoices(UNLOAD_TAB_MINUTES, (minutes) => `${minutes} min`)}
        value={String(settings.unloadHiddenTabsMinutes)}
        onchange={(minutes) => set("unloadHiddenTabsMinutes", Number(minutes) as (typeof UNLOAD_TAB_MINUTES)[number])}
      />
    </SettingsRow>
  {/if}
</SettingsGroup>
