<script lang="ts">
  import OptionList from "$ui/components/OptionList.svelte";
  import Text from "$ui/components/Text.svelte";
  import ThemeSwatch from "$ui/components/ThemeSwatch.svelte";

  const dark = { background: "#272822", foreground: "#f8f8f2", border: "#3e3d32", keyword: "#f92672" };
  const light = { background: "#ffffff", foreground: "#24292f", border: "#d0d7de", keyword: "#cf222e" };
  const extra = { string: "#e6db74", accent: "#a6e22e", selection: "#49483e" };
  const groups = [
    { label: "Light", options: [{ id: "light", name: "Light", colors: { ...light, ...extra } }] },
    {
      label: "Dark",
      options: [
        { id: "dark", name: "Dark", colors: { ...dark, ...extra } },
        { id: "monokai", name: "Monokai Charcoal", colors: { ...dark, ...extra } },
      ],
    },
  ];
  let value = $state<string | null>("monokai");
</script>

<OptionList label="Color theme" {groups} optionKey={(theme) => theme.id} bind:value>
  {#snippet option(theme)}
    <ThemeSwatch label={theme.name} colors={theme.colors} />
    <Text>{theme.name}</Text>
  {/snippet}
</OptionList>
