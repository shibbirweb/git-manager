<!-- Welcome > Customize: the theme, the color theme, font sizes and rounded panels, without opening Settings. -->
<script lang="ts">
  import { FONT_SIZE_RANGE, settings, type ThemeSetting } from "$lib/stores/settings.svelte";
  import Link from "@git-manager/ui/components/Link.svelte";
  import Segmented from "@git-manager/ui/components/Segmented.svelte";
  import SettingRow from "@git-manager/ui/components/SettingRow.svelte";
  import Slider from "@git-manager/ui/components/Slider.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import Switch from "@git-manager/ui/components/Switch.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import ColorThemePicker from "../settings/ColorThemePicker.svelte";

  const THEMES: { value: ThemeSetting; label: string }[] = [
    { value: "system", label: "System" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ];
</script>

<Stack gap="xl" paddingX="xxl" paddingY="xxl" maxWidth="page">
  <Text element="h2" variant="pageTitle">Customize</Text>
  <Stack gap="none">
    <SettingRow title="Theme" plain>
      <Segmented label="Theme" options={THEMES} value={settings.theme} onchange={(theme) => settings.setTheme(theme)} />
    </SettingRow>
    <!-- The picker names its mode itself (Light theme, Dark theme), so it needs no row title. -->
    <Stack paddingY="lg">
      {#key settings.colorMode}
        <ColorThemePicker
          mode={settings.colorMode}
          selectedId={settings.colorMode === "dark" ? settings.darkColorTheme : settings.lightColorTheme}
          active
          onSelect={(themeId) => settings.setColorTheme(settings.colorMode, themeId)}
        />
      {/key}
    </Stack>
    <SettingRow title="Interface font size" plain>
      <Slider
        label="Interface font size"
        min={FONT_SIZE_RANGE.ui[0]}
        max={FONT_SIZE_RANGE.ui[1]}
        step={0.5}
        value={settings.uiFontSize}
        format={(size) => `${size}px`}
        onchange={(size) => settings.setPreference("uiFontSize", size)}
      />
    </SettingRow>
    <SettingRow title="Editor font size" plain>
      <Slider
        label="Editor font size"
        min={FONT_SIZE_RANGE.editor[0]}
        max={FONT_SIZE_RANGE.editor[1]}
        step={0.5}
        value={settings.editorFontSize}
        format={(size) => `${size}px`}
        onchange={(size) => settings.setPreference("editorFontSize", size)}
      />
    </SettingRow>
    <SettingRow title="Rounded panels" plain toggle>
      <Switch
        label="Rounded panels"
        checked={settings.roundedPanels}
        onchange={(on) => settings.setPreference("roundedPanels", on)}
      />
    </SettingRow>
  </Stack>
  <Stack direction="row">
    <Link onclick={() => settings.openDialog()}>All settings...</Link>
  </Stack>
</Stack>
