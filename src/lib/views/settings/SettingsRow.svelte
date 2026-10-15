<!-- One setting: the library SettingRow, hidden while a search leaves it out and with the search's words marked. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import SettingRow from "@git-manager/ui/components/SettingRow.svelte";
  import { useSettingsGroup, useSettingsSearch } from "./settingsSearchView.svelte";

  interface Props {
    title: string;
    hint?: string;
    stacked?: boolean;
    nested?: boolean;
    toggle?: boolean;
    mark?: Snippet;
    hintContent?: Snippet;
    children: Snippet;
  }

  let {
    title,
    hint = "",
    stacked = false,
    nested = false,
    toggle = false,
    mark,
    hintContent,
    children,
  }: Props = $props();

  const search = useSettingsSearch();
  const group = useSettingsGroup();
</script>

{#if search?.shows(title, group()) ?? true}
  <SettingRow {title} titleMatches={search?.marks(title) ?? []} {hint} {stacked} {nested} {toggle} {mark} {hintContent}>
    {@render children()}
  </SettingRow>
{/if}
