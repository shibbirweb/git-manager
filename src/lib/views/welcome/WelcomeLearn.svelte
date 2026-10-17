<!-- Welcome > Learn: the documentation, the shortcuts and what is new. -->
<script lang="ts">
  import { helpDialogs } from "$lib/help/helpDialogs.svelte";
  import { WIKI_URL } from "$lib/update/releases";
  import { updates } from "$lib/update/updates.svelte";
  import ResourceLink from "@nibtree/ui/components/ResourceLink.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
</script>

<Stack gap="xl" paddingX="xxl" paddingY="xxl" maxWidth="page">
  <Text element="h2" variant="pageTitle">Learn</Text>
  <Stack gap="sm">
    <ResourceLink
      icon="book"
      title="Documentation"
      description="A guide to every feature, on the GitHub wiki."
      onclick={() => void updates.open(WIKI_URL)}
    />
    <ResourceLink
      icon="keyboard"
      title="Keyboard Shortcuts"
      description="Every key, grouped by menu, with a filter."
      onclick={() => helpDialogs.openShortcuts()}
    />
    <ResourceLink
      icon="bell"
      title="What's New"
      description="The changes in this version."
      onclick={() => (updates.whatsNewOpen = true)}
    />
  </Stack>
</Stack>
