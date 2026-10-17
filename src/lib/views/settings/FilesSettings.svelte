<!-- Settings > Settings Files: where the settings live, and which settings differ from the defaults. -->
<script lang="ts">
  import { settings } from "$lib/stores/settings.svelte";
  import BulletList from "@git-manager/ui/components/BulletList.svelte";
  import Button from "@git-manager/ui/components/Button.svelte";
  import CodeBlock from "@git-manager/ui/components/CodeBlock.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import SettingsRow from "./SettingsRow.svelte";
  import { copyToClipboard } from "./settingsShared";

  /** Records (the MCP tool switches) show as JSON. */
  function preferenceText(value: unknown): string {
    return typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);
  }
</script>

<SettingsRow
  title="Settings folder"
  stacked
  hint={"Nibtree keeps its files here. You can edit `settings.json` by hand; `state.json` remembers " +
    "recent folders and panel sizes."}
>
  <Stack direction="row" gap="md" align="center">
    <CodeBlock variant="value" text={settings.configDir ?? "~/.nibtree"} />
    {#if settings.configDir}
      <Button size="small" onclick={() => void copyToClipboard(`${settings.configDir}/settings.json`)}>
        Copy settings.json Path
      </Button>
    {/if}
  </Stack>
</SettingsRow>
<SettingsRow title="Changed from defaults" stacked>
  <BulletList label="Changed from defaults" items={settings.changedPreferences()} emptyText="Nothing yet">
    {#snippet item(key)}
      <Text element="code" mono>{key}</Text>: {preferenceText(settings.preferences()[key])}
    {/snippet}
  </BulletList>
</SettingsRow>
