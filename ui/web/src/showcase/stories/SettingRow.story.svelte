<script lang="ts">
  import SearchField from "$ui/components/SearchField.svelte";
  import Segmented from "$ui/components/Segmented.svelte";
  import SettingRow from "$ui/components/SettingRow.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Switch from "$ui/components/Switch.svelte";

  let wrap = $state(false);
  let layout = $state<"split" | "inline">("split");
  let wrapMarkdown = $state(true);
  let query = $state("wrap");

  function matches(title: string): [number, number][] {
    const at = query.trim() ? title.toLowerCase().indexOf(query.trim().toLowerCase()) : -1;
    return at < 0 ? [] : [[at, at + query.trim().length]];
  }
</script>

<Stack gap="none">
  <SearchField label="Search settings" placeholder="Search settings" bind:value={query} />
  <SettingRow title="Word wrap" titleMatches={matches("Word wrap")} hint="Wrap long lines in editors and diffs.">
    <Switch label="Word wrap" bind:checked={wrap} />
  </SettingRow>
  <SettingRow
    title="Also in Markdown"
    titleMatches={matches("Also in Markdown")}
    hint="Wrap Markdown files even when word wrap is off."
    nested
  >
    <Switch label="Wrap Markdown" bind:checked={wrapMarkdown} />
  </SettingRow>
  <SettingRow title="Diff layout" titleMatches={matches("Diff layout")} hint="Side by side or one column.">
    <Segmented
      label="Diff layout"
      bind:value={layout}
      options={[
        { value: "split", label: "Side by side" },
        { value: "inline", label: "Inline" },
      ]}
    />
  </SettingRow>
</Stack>
