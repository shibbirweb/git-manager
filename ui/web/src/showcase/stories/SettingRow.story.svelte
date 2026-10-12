<script lang="ts">
  import Segmented from "$ui/components/Segmented.svelte";
  import SettingRow from "$ui/components/SettingRow.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Switch from "$ui/components/Switch.svelte";

  let wrap = $state(false);
  let layout = $state<"split" | "inline">("split");
  let wrapMarkdown = $state(true);
</script>

<Stack gap="none">
  <SettingRow title="Word wrap" hint="Wrap long lines in editors and diffs.">
    <Switch label="Word wrap" bind:checked={wrap} />
  </SettingRow>
  <SettingRow title="Also in Markdown" hint="Wrap Markdown files even when word wrap is off." nested>
    <Switch label="Wrap Markdown" bind:checked={wrapMarkdown} />
  </SettingRow>
  <SettingRow title="Diff layout" hint="Side by side or one column.">
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
