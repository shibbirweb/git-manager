<!-- A titled group of settings rows; a search keeps it while its title or one of its rows matches. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import SectionTitle from "@nibtree/ui/components/SectionTitle.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import { provideSettingsGroup, useSettingsSearch } from "./settingsSearchView.svelte";

  interface Props {
    title: string;
    hint?: string;
    children: Snippet;
  }

  let { title, hint = "", children }: Props = $props();

  const search = useSettingsSearch();
  provideSettingsGroup(() => title);
</script>

{#if search?.shows(title, null) ?? true}
  <SectionTitle variant="group" {title} titleMatches={search?.marks(title) ?? []} heading={4} />
  {#if hint}
    <Text size="small" tone="faint" element="p">{hint}</Text>
  {/if}
{/if}
{@render children()}
