<!-- Settings > Appearance: theme, panels, the file toolbar, the interface font size and file icons. -->
<script lang="ts">
  import { commandKeys } from "$lib/commands/commandRuntime";
  import {
    FILE_ICON_CHOICES,
    FILE_TOOLBAR_CHOICES,
    FILE_TOOLBAR_SWITCHES,
    FONT_SIZE_RANGE,
    settings,
    type SettingsSection,
    type ThemeSetting,
  } from "$lib/stores/settings.svelte";
  import Link from "@git-manager/ui/components/Link.svelte";
  import Segmented from "@git-manager/ui/components/Segmented.svelte";
  import Slider from "@git-manager/ui/components/Slider.svelte";
  import Switch from "@git-manager/ui/components/Switch.svelte";
  import MemoryFlag from "./MemoryFlag.svelte";
  import SettingsRow from "./SettingsRow.svelte";
  import { set } from "./settingsShared";

  interface Props {
    onnavigate: (section: SettingsSection) => void;
  }

  let { onnavigate }: Props = $props();

  const themes: { value: ThemeSetting; label: string }[] = [
    { value: "system", label: "System" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ];
  const iconChoices = FILE_ICON_CHOICES.map((choice) => ({ ...choice, title: choice.hint }));
</script>

<SettingsRow title="Theme">
  {#snippet hintContent()}
    System follows the macOS appearance. Color themes are in
    <Link onclick={() => onnavigate("editor")}>Editor</Link>.
  {/snippet}
  <Segmented label="Theme" options={themes} value={settings.theme} onchange={(theme) => set("theme", theme)} />
</SettingsRow>
<SettingsRow title="Rounded panels" toggle>
  {#snippet hintContent()}
    Show the sidebars, editors and the bottom panel as rounded panels with space between them. Works with every color
    theme.
  {/snippet}
  <Switch label="Rounded panels" checked={settings.roundedPanels} onchange={(on) => set("roundedPanels", on)} />
</SettingsRow>
<SettingsRow title="File toolbar">
  {#snippet hintContent()}
    The bar with a file's path, badges and buttons: above the code, under it, or hidden. Pick its parts below. Without
    the path, {commandKeys("edit.navigationBar") ?? "Jump to Navigation Bar"} shows the Navigation Bar over the editor.
  {/snippet}
  <Segmented
    label="File toolbar"
    options={FILE_TOOLBAR_CHOICES}
    value={settings.fileToolbar}
    onchange={(place) => set("fileToolbar", place)}
  />
</SettingsRow>
<!-- One switch per part; with the toolbar hidden only the Markdown formatting row (its own row) still applies. -->
{#each FILE_TOOLBAR_SWITCHES as part (part.key)}
  {#if settings.fileToolbar !== "none" || part.key === "fileToolbarMarkdownFormat"}
    <SettingsRow title={part.label} hint={part.hint} nested toggle>
      <Switch label={part.label} checked={settings[part.key]} onchange={(on) => set(part.key, on)} />
    </SettingsRow>
  {/if}
{/each}
<SettingsRow title="Interface font size" hint="Menus, lists and buttons.">
  <Slider
    label="Interface font size"
    min={FONT_SIZE_RANGE.ui[0]}
    max={FONT_SIZE_RANGE.ui[1]}
    step={0.5}
    value={settings.uiFontSize}
    format={(size) => `${size}px`}
    onchange={(size) => set("uiFontSize", size)}
  />
</SettingsRow>
<SettingsRow title="File icons">
  {#snippet mark()}<MemoryFlag setting="fileIcons" />{/snippet}
  {#snippet hintContent()}
    Icons by file type in the Files panel, the Changes list and commit file lists. Also in View > File Icons. Minimal
    and Material Icons use more memory, Material Icons the most. An icon set loads only while it is chosen.
  {/snippet}
  <Segmented
    label="File icons"
    options={iconChoices}
    value={settings.fileIcons}
    onchange={(level) => set("fileIcons", level)}
  />
</SettingsRow>
