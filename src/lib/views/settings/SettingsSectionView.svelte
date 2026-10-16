<!-- The open Settings section. -->
<script lang="ts">
  import type { SettingsSection } from "$lib/stores/settings.svelte";
  import AboutSettings from "./AboutSettings.svelte";
  import AiSettings from "./AiSettings.svelte";
  import AppearanceSettings from "./AppearanceSettings.svelte";
  import CliSettings from "./CliSettings.svelte";
  import EditorFeatureSettings from "./EditorFeatureSettings.svelte";
  import EditorFontSettings from "./EditorFontSettings.svelte";
  import EditorSavingSettings from "./EditorSavingSettings.svelte";
  import EditorTextSettings from "./EditorTextSettings.svelte";
  import FilesSettings from "./FilesSettings.svelte";
  import GitHubSettings from "./GitHubSettings.svelte";
  import GitSettings from "./GitSettings.svelte";
  import KeyboardShortcuts from "./KeyboardShortcuts.svelte";
  import LayoutSettings from "./LayoutSettings.svelte";
  import McpSettings from "./McpSettings.svelte";
  import TerminalBehaviorSettings from "./TerminalBehaviorSettings.svelte";
  import TerminalSettings from "./TerminalSettings.svelte";
  import UpdatesSettings from "./UpdatesSettings.svelte";

  interface Props {
    section: SettingsSection;
    /** The search, when it finds commands in Keyboard Shortcuts. */
    shortcutFilter: string;
    onnavigate: (section: SettingsSection) => void;
    onclose: () => void;
  }

  let { section, shortcutFilter, onnavigate, onclose }: Props = $props();
</script>

{#if section === "appearance"}
  <AppearanceSettings {onnavigate} />
{:else if section === "editor"}
  <EditorFontSettings {onnavigate} />
  <EditorTextSettings />
  <EditorFeatureSettings />
  <EditorSavingSettings />
{:else if section === "merge"}
  <GitSettings {onclose} />
{:else if section === "layout"}
  <LayoutSettings />
{:else if section === "terminal"}
  <TerminalSettings />
  <TerminalBehaviorSettings />
{:else if section === "keyboard"}
  <KeyboardShortcuts filter={shortcutFilter} />
{:else if section === "ai"}
  <AiSettings />
{:else if section === "github"}
  <GitHubSettings />
{:else if section === "automation"}
  <McpSettings {onclose} />
  <CliSettings />
{:else if section === "updates"}
  <UpdatesSettings />
{:else if section === "about"}
  <AboutSettings />
{:else if section === "files"}
  <FilesSettings />
{/if}
