<!-- Settings > Updates: the version, automatic checks, the channel, release notes and a skipped version. -->
<script lang="ts">
  import { settings } from "$lib/stores/settings.svelte";
  import { updates } from "$lib/update/updates.svelte";
  import Button from "@nibtree/ui/components/Button.svelte";
  import CodeBlock from "@nibtree/ui/components/CodeBlock.svelte";
  import Segmented from "@nibtree/ui/components/Segmented.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import Switch from "@nibtree/ui/components/Switch.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import SettingsRow from "./SettingsRow.svelte";
  import { set } from "./settingsShared";

  const channels: { value: "auto" | "stable" | "beta"; label: string }[] = [
    { value: "auto", label: "Automatic" },
    { value: "stable", label: "Stable" },
    { value: "beta", label: "Beta" },
  ];

  function checkedLabel(): string {
    if (updates.checking) {
      return "Checking...";
    }
    if (updates.error) {
      return `Last check failed: ${updates.error}`;
    }
    if (!updates.checkedAt) {
      return "Not checked yet";
    }
    const minutes = Math.round((Date.now() - updates.checkedAt) / 60000);
    const when = minutes < 1 ? "just now" : minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} h ago`;
    if (updates.newer.length === 0) {
      return `Checked ${when}: up to date`;
    }
    return `Checked ${when}: ${updates.newer[0].version} is available${updates.newestSkipped ? " (skipped)" : ""}`;
  }
</script>

<SettingsRow title="Version" hint={checkedLabel()}>
  <Stack direction="row" gap="md" align="center">
    <CodeBlock variant="value" text={updates.current ?? "unknown"} />
    <Button size="small" onclick={() => void updates.check(true)} disabled={updates.checking}>Check Now</Button>
  </Stack>
</SettingsRow>
<SettingsRow
  title="Check for updates automatically"
  hint="Asks GitHub for new releases every few hours. Nothing is downloaded or installed without you."
  toggle
>
  <Switch
    label="Check for updates automatically"
    checked={settings.checkForUpdates}
    onchange={(on) => set("checkForUpdates", on)}
  />
</SettingsRow>
<SettingsRow title="Update channel">
  {#snippet hintContent()}
    Stable gets finished releases only. Beta also gets pre-releases with new features to try early. Automatic follows
    betas only when this build is a beta. Now following: <Text weight="semibold">{updates.channel}</Text>.
  {/snippet}
  <Segmented
    label="Update channel"
    options={channels}
    value={settings.updateChannel}
    onchange={(channel) => {
      set("updateChannel", channel);
      void updates.check(false);
    }}
  />
</SettingsRow>
<SettingsRow title="Release notes" hint="What changed in this version, from the changelog built into the app.">
  <Stack direction="row" gap="md">
    <Button size="small" onclick={() => (updates.whatsNewOpen = true)}>What's New</Button>
    <Button size="small" onclick={() => void updates.openReleasesPage()}>All Releases</Button>
  </Stack>
</SettingsRow>
{#if settings.skippedVersion}
  <SettingsRow title="Skipped version" hint="{settings.skippedVersion} is not announced.">
    <Button size="small" onclick={() => updates.unskip()}>Announce Again</Button>
  </SettingsRow>
{/if}
