<!-- Settings > Editor, second part: the editor font's size, weight and spacing, indentation, whitespace and the
     cursor. -->
<script lang="ts">
  import {
    CARET_EXTRA_RANGE,
    defaultPreferences,
    EDITOR_CURSOR_BLINKING_CHOICES,
    EDITOR_CURSOR_STYLE_CHOICES,
    EDITOR_CURSOR_WIDTH_RANGE,
    EDITOR_FONT_WEIGHT_RANGE,
    EDITOR_LINE_HEIGHT_RANGE,
    FONT_SIZE_RANGE,
    fontWeightName,
    RENDER_WHITESPACE_CHOICES,
    settings,
    TAB_SIZES,
  } from "$lib/stores/settings.svelte";
  import Button from "@git-manager/ui/components/Button.svelte";
  import Chip from "@git-manager/ui/components/Chip.svelte";
  import FontSample from "@git-manager/ui/components/FontSample.svelte";
  import Input from "@git-manager/ui/components/Input.svelte";
  import Link from "@git-manager/ui/components/Link.svelte";
  import Segmented from "@git-manager/ui/components/Segmented.svelte";
  import Select from "@git-manager/ui/components/Select.svelte";
  import Slider from "@git-manager/ui/components/Slider.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import Switch from "@git-manager/ui/components/Switch.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import ColorThemePicker from "./ColorThemePicker.svelte";
  import MemoryFlag from "./MemoryFlag.svelte";
  import { CARET_EXTRA_ROWS } from "./settingsRows";
  import SettingsRow from "./SettingsRow.svelte";
  import { numberChoices, set } from "./settingsShared";

  const whitespaceHint = $derived(
    RENDER_WHITESPACE_CHOICES.find((choice) => choice.value === settings.renderWhitespace)?.hint ?? "",
  );
  const blinkingHint = $derived(
    EDITOR_CURSOR_BLINKING_CHOICES.find((choice) => choice.value === settings.editorCursorBlinking)?.hint ?? "",
  );
</script>

<SettingsRow title="Editor font size" hint="Code in the editor, diffs and the merge tool.">
  <Slider
    label="Editor font size"
    min={FONT_SIZE_RANGE.editor[0]}
    max={FONT_SIZE_RANGE.editor[1]}
    step={0.5}
    value={settings.editorFontSize}
    format={(size) => `${size}px`}
    onchange={(size) => set("editorFontSize", size)}
  />
</SettingsRow>
<SettingsRow title="Editor font weight">
  {#snippet hintContent()}
    How thick code is drawn. Light (300) looks calm on dark themes. Needs a font with several weights, such as JetBrains
    Mono or SF Mono; other fonts use their closest weight.
  {/snippet}
  <Slider
    label="Editor font weight"
    min={EDITOR_FONT_WEIGHT_RANGE[0]}
    max={EDITOR_FONT_WEIGHT_RANGE[1]}
    step={100}
    value={settings.editorFontWeight}
    valueWidth="wide"
    format={fontWeightName}
    resetValue={defaultPreferences.editorFontWeight}
    onchange={(weight) => set("editorFontWeight", weight)}
  />
</SettingsRow>
<SettingsRow title="Line spacing">
  {#snippet hintContent()}
    Space between lines of code, as a multiple of the font size. The default is {defaultPreferences.editorLineHeight}.
  {/snippet}
  <Slider
    label="Line spacing"
    min={EDITOR_LINE_HEIGHT_RANGE[0]}
    max={EDITOR_LINE_HEIGHT_RANGE[1]}
    step={0.05}
    value={settings.editorLineHeight}
    format={(height) => height.toFixed(2)}
    resetValue={defaultPreferences.editorLineHeight}
    onchange={(height) => set("editorLineHeight", Math.round(height * 100) / 100)}
  />
</SettingsRow>
<SettingsRow title="Change font size with Ctrl + mouse wheel" toggle>
  {#snippet hintContent()}
    Hold Control (or Command) and scroll over an editor, diff or merge pane to make the code bigger or smaller. A
    trackpad pinch works too.
  {/snippet}
  <Switch
    label="Change font size with Ctrl + mouse wheel"
    checked={settings.mouseWheelZoom}
    onchange={(on) => set("mouseWheelZoom", on)}
  />
</SettingsRow>
<SettingsRow
  title="Font ligatures"
  toggle
  hint={"Draw `=>`, `!=`, `===` and similar as single glyphs. Needs a font with ligatures such as " +
    "Fira Code, JetBrains Mono or Cascadia Code; Menlo has none."}
>
  <Switch label="Font ligatures" checked={settings.fontLigatures} onchange={(on) => set("fontLigatures", on)} />
</SettingsRow>
<SettingsRow title="Syntax highlighting" toggle>
  {#snippet hintContent()}
    Color code by its language in editors, diffs, the merge tool and Markdown code blocks. Off, code is plain text and
    no language grammar is loaded, which saves memory with big files. Fold arrows and bracket pair colors need it;
    sticky scroll then follows the indentation.
  {/snippet}
  {#snippet mark()}<MemoryFlag setting="syntaxHighlighting" />{/snippet}
  <Switch
    label="Syntax highlighting"
    checked={settings.syntaxHighlighting}
    onchange={(on) => set("syntaxHighlighting", on)}
  />
</SettingsRow>
<SettingsRow
  title="Tab size"
  hint="Spaces per indent level, and the width of a tab, for files whose indentation is not detected."
>
  <Segmented
    label="Tab size"
    options={numberChoices(TAB_SIZES, String)}
    value={String(settings.tabSize)}
    onchange={(size) => set("tabSize", Number(size) as (typeof TAB_SIZES)[number])}
  />
</SettingsRow>
<SettingsRow
  title="Detect indentation"
  hint="Indent like the file already does: tabs or spaces, and how many. Also in View > Detect Indentation."
  toggle
>
  <Switch
    label="Detect indentation"
    checked={settings.detectIndentation}
    onchange={(on) => set("detectIndentation", on)}
  />
</SettingsRow>
<SettingsRow
  title="Render whitespace"
  hint="{whitespaceHint} Spaces show as dots and tabs as arrows, in editors, diffs and the merge tool."
>
  {#snippet mark()}<MemoryFlag setting="renderWhitespace" />{/snippet}
  <Segmented
    label="Render whitespace"
    options={RENDER_WHITESPACE_CHOICES}
    value={settings.renderWhitespace}
    onchange={(choice) => set("renderWhitespace", choice)}
  />
</SettingsRow>
<SettingsRow
  title="Word wrap"
  hint="Wrap long lines in the file editor. Diffs and the merge tool never wrap so their panes stay aligned."
  toggle
>
  <Switch label="Word wrap" checked={settings.wordWrap} onchange={(on) => set("wordWrap", on)} />
</SettingsRow>
<SettingsRow title="Cursor style" hint="The shape of the cursor in editors, diffs and the merge tool.">
  <Select
    label="Cursor style"
    options={EDITOR_CURSOR_STYLE_CHOICES}
    value={settings.editorCursorStyle}
    onchange={(style) => set("editorCursorStyle", style)}
  />
</SettingsRow>
{#if settings.editorCursorStyle === "line"}
  <SettingsRow title="Cursor width" hint="How thick the Line cursor is, in pixels. The default is 2.">
    <Slider
      label="Cursor width"
      min={EDITOR_CURSOR_WIDTH_RANGE[0]}
      max={EDITOR_CURSOR_WIDTH_RANGE[1]}
      value={settings.editorCursorWidth}
      format={(width) => `${width} px`}
      resetValue={defaultPreferences.editorCursorWidth}
      onchange={(width) => set("editorCursorWidth", width)}
    />
  </SettingsRow>
{/if}
<SettingsRow title="Cursor blinking" hint="{blinkingHint} The cursor stays visible while you type.">
  <Select
    label="Cursor blinking"
    options={EDITOR_CURSOR_BLINKING_CHOICES}
    value={settings.editorCursorBlinking}
    onchange={(blinking) => set("editorCursorBlinking", blinking)}
  />
</SettingsRow>
<SettingsRow title="Smooth caret animation" hint="The cursor glides to its new place instead of jumping." toggle>
  <Switch
    label="Smooth caret animation"
    checked={settings.editorCursorSmoothCaret}
    onchange={(on) => set("editorCursorSmoothCaret", on)}
  />
</SettingsRow>
{#each CARET_EXTRA_ROWS as extra (extra.key)}
  <SettingsRow title={extra.label} hint={extra.hint}>
    <Slider
      label={extra.label}
      min={CARET_EXTRA_RANGE[0]}
      max={CARET_EXTRA_RANGE[1]}
      value={settings[extra.key]}
      format={(pixels) => `${pixels} px`}
      resetValue={0}
      onchange={(pixels) => set(extra.key, pixels)}
    />
  </SettingsRow>
{/each}
