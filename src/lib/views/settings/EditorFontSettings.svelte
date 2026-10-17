<!-- Settings > Editor, first part: the color themes and the editor font family with its preview. -->
<script lang="ts">
  import {
    DEFAULT_EDITOR_FONT,
    MONOSPACE_FONTS,
    normalizeFontFamily,
    settings,
    type SettingsSection,
  } from "$lib/stores/settings.svelte";
  import Button from "@nibtree/ui/components/Button.svelte";
  import Chip from "@nibtree/ui/components/Chip.svelte";
  import FontSample from "@nibtree/ui/components/FontSample.svelte";
  import Input from "@nibtree/ui/components/Input.svelte";
  import Link from "@nibtree/ui/components/Link.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import ColorThemePicker from "./ColorThemePicker.svelte";
  import SettingsRow from "./SettingsRow.svelte";
  import { set } from "./settingsShared";

  interface Props {
    onnavigate: (section: SettingsSection) => void;
  }

  let { onnavigate }: Props = $props();

  /** Font list being typed; applied on Enter or when the field loses focus. */
  let fontDraft = $state(settings.editorFontFamily);

  function applyFont(): void {
    const next = normalizeFontFamily(fontDraft);
    fontDraft = next;
    if (next !== settings.editorFontFamily) {
      set("editorFontFamily", next);
    }
  }

  function addFont(family: string): void {
    const quoted = /\s/.test(family) ? `'${family}'` : family;
    fontDraft = normalizeFontFamily(`${quoted}, ${DEFAULT_EDITOR_FONT}`);
    applyFont();
  }

  const SAMPLE = [
    { text: "function greet(name: string) {" },
    { text: "  return `Hello, ${name}!`; // 0O 1lI => != ===" },
    { text: "}" },
  ];
</script>

<SettingsRow title="Color theme" stacked>
  {#snippet hintContent()}
    One for light and one for dark mode. Light, Dark or System is set in
    <Link onclick={() => onnavigate("appearance")}>Appearance</Link>.
  {/snippet}
  <Stack direction="row" gap="lg" wrap>
    <Stack grow>
      <ColorThemePicker
        mode="light"
        selectedId={settings.lightColorTheme}
        active={settings.colorMode === "light"}
        onSelect={(themeId) => settings.setColorTheme("light", themeId)}
      />
    </Stack>
    <Stack grow>
      <ColorThemePicker
        mode="dark"
        selectedId={settings.darkColorTheme}
        active={settings.colorMode === "dark"}
        onSelect={(themeId) => settings.setColorTheme("dark", themeId)}
      />
    </Stack>
  </Stack>
</SettingsRow>
<SettingsRow
  title="Editor font family"
  stacked
  hint={"A comma-separated list. The first installed font is used; `monospace` is always added as the " +
    "last fallback."}
>
  <Stack gap="sm">
    <Stack direction="row" gap="sm" align="center">
      <Input
        mono
        width="fill"
        suggestions={[...MONOSPACE_FONTS]}
        spellcheck="false"
        autocomplete="off"
        bind:value={fontDraft}
        onchange={applyFont}
        onkeydown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            applyFont();
          }
        }}
        aria-label="Editor font family"
      />
      {#if settings.editorFontFamily !== DEFAULT_EDITOR_FONT}
        <Button
          size="small"
          onclick={() => {
            fontDraft = DEFAULT_EDITOR_FONT;
            applyFont();
          }}
        >
          Reset
        </Button>
      {/if}
    </Stack>
    <Stack direction="row" gap="xs" wrap>
      {#each MONOSPACE_FONTS as family (family)}
        <Chip
          variant="pick"
          text={family}
          fontFamily="'{family}', monospace"
          title="Use {family}"
          onclick={() => addFont(family)}
        />
      {/each}
    </Stack>
    <FontSample
      label="Editor font preview"
      lines={SAMPLE}
      fontFamily={normalizeFontFamily(fontDraft)}
      fontSize={settings.editorFontSize}
      fontWeight={settings.editorFontWeight}
      lineHeight={settings.editorLineHeight}
    />
  </Stack>
</SettingsRow>
