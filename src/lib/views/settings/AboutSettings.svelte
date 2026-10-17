<!-- Settings > About: the version and links to star, report a bug, request a feature and read the release notes. -->
<script lang="ts">
  import { updates } from "$lib/update/updates.svelte";
  import type { IconName } from "@git-manager/ui/icons";
  import Logo from "@git-manager/ui/components/Logo.svelte";
  import ResourceLink from "@git-manager/ui/components/ResourceLink.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import { useSettingsSearch } from "./settingsSearchView.svelte";

  const search = useSettingsSearch();
  const links: { icon: IconName; title: string; description: string; open: () => void }[] = [
    {
      icon: "star",
      title: "Star on GitHub",
      description: "Like Nibtree? A star helps other people find it.",
      open: () => void updates.openRepository(),
    },
    {
      icon: "bug",
      title: "Report a Bug",
      description: "Opens a GitHub issue with your version and system filled in.",
      open: () => void updates.reportBug(),
    },
    {
      icon: "lightbulb",
      title: "Request a Feature",
      description: "Suggest an idea or an improvement.",
      open: () => void updates.requestFeature(),
    },
    {
      icon: "history",
      title: "Release Notes",
      description: "What changed in this version.",
      open: () => (updates.whatsNewOpen = true),
    },
  ];
</script>

<Stack gap="lg" paddingY="lg">
  <Stack direction="row" gap="lg" align="center">
    <Logo size="medium" />
    <Stack gap="xxs">
      <Text variant="title">Nibtree</Text>
      <Text tone="dim">Version {updates.current ?? "unknown"} &middot; {updates.channel} channel</Text>
    </Stack>
  </Stack>
  <Stack gap="sm">
    {#each links as link (link.title)}
      {#if search?.shows(link.title, null) ?? true}
        <ResourceLink
          variant="card"
          icon={link.icon}
          title={link.title}
          description={link.description}
          onclick={link.open}
        />
      {/if}
    {/each}
  </Stack>
</Stack>
