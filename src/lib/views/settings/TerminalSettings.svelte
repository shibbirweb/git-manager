<!-- Settings > Terminal, first part: the shell, the font and the cursor. -->
<script lang="ts">
  import {
    DEFAULT_EDITOR_FONT,
    FONT_SIZE_RANGE,
    normalizeFontFamily,
    normalizeTerminalFontFamily,
    settings,
    TERMINAL_LETTER_SPACING_RANGE,
    TERMINAL_LINE_HEIGHT_RANGE,
    type TerminalCursorStyle,
    type TerminalFontWeight,
  } from "$lib/stores/settings.svelte";
  import { buildTerminalFontFamily, TERMINAL_FONT_PICKS } from "$lib/terminal/fonts";
  import { terminalStore } from "$lib/terminal/terminalStore.svelte";
  import { platformName } from "$lib/update/releases";
  import Button from "@nibtree/ui/components/Button.svelte";
  import Chip from "@nibtree/ui/components/Chip.svelte";
  import FontSample from "@nibtree/ui/components/FontSample.svelte";
  import Input from "@nibtree/ui/components/Input.svelte";
  import Segmented from "@nibtree/ui/components/Segmented.svelte";
  import Select from "@nibtree/ui/components/Select.svelte";
  import Slider from "@nibtree/ui/components/Slider.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import Switch from "@nibtree/ui/components/Switch.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import SettingsGroup from "./SettingsGroup.svelte";
  import SettingsRow from "./SettingsRow.svelte";
  import { set } from "./settingsShared";

  const fontWeights: { value: TerminalFontWeight; label: string }[] = [
    { value: "normal", label: "Normal" },
    { value: "medium", label: "Medium" },
    { value: "bold", label: "Bold" },
  ];
  /** The CSS weights xterm draws normal, medium and bold text with, for the preview. */
  const WEIGHT_NUMBERS: Record<TerminalFontWeight, number> = { normal: 400, medium: 500, bold: 700 };
  const cursorStyles: { value: TerminalCursorStyle; label: string }[] = [
    { value: "block", label: "Block" },
    { value: "bar", label: "Bar" },
    { value: "underline", label: "Underline" },
  ];

  /** The shell list is asked for the first time the Terminal section shows. */
  let shellsLoaded = $state(false);
  $effect(() => {
    void terminalStore.loadShells().then(() => {
      shellsLoaded = true;
    });
  });
  /** Windows has no login shell: its default is the first shell found (PowerShell 7, else Windows PowerShell). */
  const defaultShellLabel = platformName(navigator.userAgent) === "Windows" ? "Default" : "Login shell";
  const loginShell = $derived(terminalStore.shells.find((shell) => shell.isDefault) ?? null);
  const savedShellMissing = $derived(
    settings.terminalShell !== null && !terminalStore.shells.some((shell) => shell.id === settings.terminalShell),
  );
  const shellOptions = $derived([
    { value: "", label: loginShell ? `${defaultShellLabel} (${loginShell.name})` : defaultShellLabel },
    ...terminalStore.shells.map((shell) => ({ value: shell.id, label: `${shell.name} (${shell.path})` })),
    ...(settings.terminalShell && savedShellMissing
      ? [
          {
            value: settings.terminalShell,
            label: `${settings.terminalShell}${shellsLoaded ? " (not found, the login shell is used)" : ""}`,
          },
        ]
      : []),
  ]);

  /** Terminal font list being typed; empty means the editor font. */
  let terminalFontDraft = $state(settings.terminalFontFamily);
  // Reset to Defaults and Try Again change the setting under the field.
  $effect(() => {
    terminalFontDraft = settings.terminalFontFamily;
  });

  function applyTerminalFont(): void {
    const next = normalizeTerminalFontFamily(terminalFontDraft);
    terminalFontDraft = next;
    if (next !== settings.terminalFontFamily) {
      set("terminalFontFamily", next);
    }
  }

  function addTerminalFont(family: string): void {
    const quoted = /\s/.test(family) ? `'${family}'` : family;
    terminalFontDraft = normalizeFontFamily(`${quoted}, ${DEFAULT_EDITOR_FONT}`);
    applyTerminalFont();
  }

  /** What the terminal would render with, for the preview. */
  const previewFont = $derived(
    buildTerminalFontFamily({
      terminalFontFamily: normalizeTerminalFontFamily(terminalFontDraft),
      editorFontFamily: settings.editorFontFamily,
      nerdFontIcons: settings.terminalNerdFontIcons,
    }),
  );
  const SAMPLE = [
    { parts: [{ text: " ~/nibtree   main", dim: true }, { text: " ❯ git log --oneline" }] },
    { parts: [{ text: "a1b2c3d", bold: true }, { text: " fix: a => b != c === d -> e" }] },
    { text: "0O 1lI { } [ ] | && ||" },
  ];
</script>

<SettingsGroup title="Shell">
  <SettingsRow
    title="Default shell"
    hint="New terminals start this shell. The arrow next to + in the terminal panel starts any other one."
  >
    <Select
      label="Default shell"
      options={shellOptions}
      value={settings.terminalShell ?? ""}
      onchange={(shellId) => set("terminalShell", shellId || null)}
    />
  </SettingsRow>
</SettingsGroup>
<SettingsGroup title="Font">
  <SettingsRow title="Font family" hint="A comma-separated list. Leave it empty to use the editor font." stacked>
    <Stack gap="sm">
      <Stack direction="row" gap="sm" align="center">
        <Input
          mono
          width="fill"
          suggestions={[...TERMINAL_FONT_PICKS]}
          spellcheck="false"
          autocomplete="off"
          placeholder="Same as the editor font"
          bind:value={terminalFontDraft}
          onchange={applyTerminalFont}
          onkeydown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              applyTerminalFont();
            }
          }}
          aria-label="Terminal font family"
        />
        {#if settings.terminalFontFamily}
          <Button
            size="small"
            onclick={() => {
              terminalFontDraft = "";
              applyTerminalFont();
            }}
          >
            Use the Editor Font
          </Button>
        {/if}
      </Stack>
      <Stack direction="row" gap="xs" wrap>
        {#each TERMINAL_FONT_PICKS as family (family)}
          <Chip
            variant="pick"
            text={family}
            fontFamily="'{family}', monospace"
            title="Use {family}"
            onclick={() => addTerminalFont(family)}
          />
        {/each}
      </Stack>
      <FontSample
        label="Terminal font preview"
        variant="terminal"
        lines={SAMPLE}
        fontFamily={previewFont}
        fontSize={settings.terminalFontSize}
        fontWeight={WEIGHT_NUMBERS[settings.terminalFontWeight]}
        boldWeight={WEIGHT_NUMBERS[settings.terminalFontWeightBold]}
        letterSpacing={settings.terminalLetterSpacing / (window.devicePixelRatio || 1)}
        lineHeight={settings.terminalLineHeight}
        ligatures={settings.terminalLigatures}
      />
    </Stack>
  </SettingsRow>
  <SettingsRow title="Font size">
    <Slider
      label="Terminal font size"
      min={FONT_SIZE_RANGE.terminal[0]}
      max={FONT_SIZE_RANGE.terminal[1]}
      step={0.5}
      value={settings.terminalFontSize}
      format={(size) => `${size}px`}
      onchange={(size) => set("terminalFontSize", size)}
    />
  </SettingsRow>
  <SettingsRow title="Line height" hint="A multiple of the font's own line height.">
    <Slider
      label="Terminal line height"
      min={TERMINAL_LINE_HEIGHT_RANGE[0]}
      max={TERMINAL_LINE_HEIGHT_RANGE[1]}
      step={0.1}
      value={settings.terminalLineHeight}
      format={(height) => height.toFixed(1)}
      onchange={(height) => set("terminalLineHeight", Math.round(height * 10) / 10)}
    />
  </SettingsRow>
  <SettingsRow title="Letter spacing" hint="Extra pixels between characters.">
    <Slider
      label="Terminal letter spacing"
      min={TERMINAL_LETTER_SPACING_RANGE[0]}
      max={TERMINAL_LETTER_SPACING_RANGE[1]}
      value={settings.terminalLetterSpacing}
      format={(spacing) => `${spacing}px`}
      onchange={(spacing) => set("terminalLetterSpacing", spacing)}
    />
  </SettingsRow>
  <SettingsRow title="Font weight" hint="Medium needs a font that has it, such as SF Mono or JetBrains Mono.">
    <Segmented
      label="Terminal font weight"
      options={fontWeights}
      value={settings.terminalFontWeight}
      onchange={(weight) => set("terminalFontWeight", weight)}
    />
  </SettingsRow>
  <SettingsRow title="Bold text weight" hint="For text that programs print in bold.">
    <Segmented
      label="Terminal bold text weight"
      options={fontWeights}
      value={settings.terminalFontWeightBold}
      onchange={(weight) => set("terminalFontWeightBold", weight)}
    />
  </SettingsRow>
  <SettingsRow
    title="Font ligatures"
    toggle
    hint={"Draw `=>`, `!=` and similar as single glyphs with fonts such as Fira Code or JetBrains Mono. " +
      "A ligature splits where colors change or under the cursor, and fonts whose ligatures change the " +
      "text width can misalign columns. Ligatures draw without GPU acceleration."}
  >
    <Switch
      label="Terminal font ligatures"
      checked={settings.terminalLigatures}
      onchange={(on) => set("terminalLigatures", on)}
    />
  </SettingsRow>
  <SettingsRow title="Icons from patched fonts" toggle>
    {#snippet hintContent()}
      Nerd Font and Powerline symbols used by prompts like Powerlevel10k, Starship and oh-my-posh. Install a Nerd Font
      such as MesloLGS NF, then pick it above, or install Symbols Nerd Font Mono to keep any font.
    {/snippet}
    <Switch
      label="Icons from patched fonts"
      checked={settings.terminalNerdFontIcons}
      onchange={(on) => set("terminalNerdFontIcons", on)}
    />
  </SettingsRow>
</SettingsGroup>
<SettingsGroup title="Cursor">
  <SettingsRow title="Cursor style">
    <Segmented
      label="Terminal cursor style"
      options={cursorStyles}
      value={settings.terminalCursorStyle}
      onchange={(style) => set("terminalCursorStyle", style)}
    />
  </SettingsRow>
  <SettingsRow title="Cursor blink" hint="Blinks while the terminal has focus." toggle>
    <Switch
      label="Cursor blink"
      checked={settings.terminalCursorBlink}
      onchange={(on) => set("terminalCursorBlink", on)}
    />
  </SettingsRow>
</SettingsGroup>
