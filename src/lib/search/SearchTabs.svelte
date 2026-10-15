<!-- The tab strip of the Search Everywhere popup; Tab and Shift+Tab are handled by the field. -->
<script lang="ts">
  import Tabs from "@git-manager/ui/components/Tabs.svelte";
  import { withCommandKeys } from "$lib/commands/commandRuntime";
  import { SEARCH_TABS, type SearchTab } from "./searchTabs";

  let { tab, onSelect }: { tab: SearchTab; onSelect: (tab: SearchTab) => void } = $props();

  // Derived, so a changed shortcut shows in the tooltips.
  const tabs = $derived(
    SEARCH_TABS.map((info) => ({
      value: info.id,
      label: info.label,
      title: info.commandId ? withCommandKeys(info.label, info.commandId) : `${info.label} (Double Shift)`,
    })),
  );
</script>

<Tabs label="Search in" variant="underline" keepFocus value={tab} {tabs} onchange={onSelect} />
