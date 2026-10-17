<!-- Settings > Terminal, last part: behavior, keys and rendering. -->
<script lang="ts">
  import { commandKeys, localKeys } from "$lib/commands/commandRuntime";
  import { clampTerminalScrollback, settings, TERMINAL_SCROLLBACK_RANGE } from "$lib/stores/settings.svelte";
  import Switch from "@nibtree/ui/components/Switch.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import MemoryFlag from "./MemoryFlag.svelte";
  import NumberSetting from "./NumberSetting.svelte";
  import SettingsGroup from "./SettingsGroup.svelte";
  import SettingsRow from "./SettingsRow.svelte";
  import { clickModifier, onMac, set } from "./settingsShared";

  function applyScrollback(typed: number | null): void {
    const next = typed === null ? settings.terminalScrollback : clampTerminalScrollback(typed);
    if (next !== settings.terminalScrollback) {
      set("terminalScrollback", next);
    }
  }
</script>

<SettingsGroup title="Behavior">
  <SettingsRow title="Scrollback">
    {#snippet mark()}<MemoryFlag setting="terminalScrollback" />{/snippet}
    {#snippet hintContent()}
      Lines kept for scrolling back, {TERMINAL_SCROLLBACK_RANGE[0].toLocaleString()} to
      {TERMINAL_SCROLLBACK_RANGE[1].toLocaleString()}. A full terminal uses about 2 KB per line in a wide window: about
      10 MB at 5,000 lines and 200 MB at 100,000.
    {/snippet}
    <NumberSetting
      label="Terminal scrollback lines"
      value={settings.terminalScrollback}
      min={TERMINAL_SCROLLBACK_RANGE[0]}
      max={TERMINAL_SCROLLBACK_RANGE[1]}
      step={1000}
      onapply={applyScrollback}
    />
  </SettingsRow>
  <SettingsRow title="Copy on selection" hint="Selecting text copies it to the clipboard." toggle>
    <Switch
      label="Copy on selection"
      checked={settings.terminalCopyOnSelect}
      onchange={(on) => set("terminalCopyOnSelect", on)}
    />
  </SettingsRow>
  <SettingsRow
    title="Find in terminal"
    hint="{localKeys(onMac ? 'Cmd+F' : 'Ctrl+Shift+F')} searches the output. Off, the search code is never loaded."
    toggle
  >
    <Switch label="Find in terminal" checked={settings.terminalFind} onchange={(on) => set("terminalFind", on)} />
  </SettingsRow>
  <SettingsRow
    title="Clickable file paths"
    toggle
    hint={`${clickModifier}+click a path such as \`src/app.ts:12:5\` to open it at that line. Only files ` +
      "inside an open folder become links."}
  >
    <Switch
      label="Clickable file paths"
      checked={settings.terminalFileLinks}
      onchange={(on) => set("terminalFileLinks", on)}
    />
  </SettingsRow>
  <SettingsRow
    title="Drop files to type their paths"
    hint="Dropping files on a terminal types their paths, quoted for the shell."
    toggle
  >
    <Switch
      label="Drop files to type their paths"
      checked={settings.terminalDropPaths}
      onchange={(on) => set("terminalDropPaths", on)}
    />
  </SettingsRow>
  <SettingsRow
    title="Visual bell"
    hint="A short flash when the shell rings the bell, or a dot on a terminal that is out of sight."
    toggle
  >
    <Switch
      label="Visual bell"
      checked={settings.terminalVisualBell}
      onchange={(on) => set("terminalVisualBell", on)}
    />
  </SettingsRow>
  <SettingsRow title="Smooth scrolling" hint="Animates scrolling with the mouse wheel." toggle>
    <Switch
      label="Smooth scrolling"
      checked={settings.terminalSmoothScrolling}
      onchange={(on) => set("terminalSmoothScrolling", on)}
    />
  </SettingsRow>
  <SettingsRow
    title="Option as Meta key"
    hint="macOS: Option+B, Option+F and other emacs keys work in the shell. Off, Option types characters such as å."
    toggle
  >
    <Switch
      label="Option as Meta key"
      checked={settings.terminalOptionAsMeta}
      onchange={(on) => set("terminalOptionAsMeta", on)}
    />
  </SettingsRow>
  <SettingsRow title="Keyboard">
    {#snippet hintContent()}
      {commandKeys("view.terminal") ?? "View > Terminal"} shows or hides the terminal,
      {commandKeys("terminal.new") ?? "New Terminal"} opens a new one.
      {#if onMac}
        In a terminal, Cmd+C copies the selection, Cmd+V pastes, Cmd+K clears, Cmd+F finds and Cmd+\ splits; other Cmd
        shortcuts still work.
      {:else}
        In a terminal, Ctrl+Shift+C copies the selection, Ctrl+Shift+V pastes, Ctrl+Shift+F finds and Ctrl+Shift+5
        splits; the app's shortcuts still work, and other Ctrl keys go to the shell.
      {/if}
    {/snippet}
    {""}
  </SettingsRow>
</SettingsGroup>
<SettingsGroup title="Rendering">
  <SettingsRow title="GPU acceleration" toggle>
    {#snippet mark()}<MemoryFlag setting="terminalGpuAcceleration" />{/snippet}
    {#snippet hintContent()}
      Recommended. Draws with WebGL, which keeps busy output smooth and uses less CPU. It uses about 70 MB more for the
      first terminal, mostly graphics memory, and about 10 MB for each other one. With font ligatures on, the regular
      renderer is used.
    {/snippet}
    <Switch
      label="GPU acceleration"
      checked={settings.terminalGpuAcceleration}
      onchange={(on) => set("terminalGpuAcceleration", on)}
    />
  </SettingsRow>
  <SettingsRow
    title="Unicode 11 widths"
    hint="Emoji and wide characters take the right number of columns. Applies to output printed after the change."
    toggle
  >
    <Switch
      label="Unicode 11 widths"
      checked={settings.terminalUnicode11}
      onchange={(on) => set("terminalUnicode11", on)}
    />
  </SettingsRow>
</SettingsGroup>
