<script lang="ts">
  import Segmented from "$ui/components/Segmented.svelte";
  import Text from "$ui/components/Text.svelte";

  let theme = $state<"light" | "dark" | "system">("system");
  let layout = $state<"split" | "inline">("split");
</script>

<Segmented
  label="Theme"
  bind:value={theme}
  options={[
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "System" },
  ]}
/>
<Segmented
  label="Diff layout"
  bind:value={layout}
  options={[
    { value: "split", icon: "split-view", title: "Side by side" },
    { value: "inline", icon: "list-tree", title: "Inline" },
  ]}
/>
<Segmented
  label="File view"
  size="small"
  bind:value={layout}
  options={[
    { value: "split", icon: "split-view", title: "Editor and preview" },
    { value: "inline", icon: "list-tree", title: "Editor only" },
  ]}
/>
<Segmented
  label="Gist visibility"
  variant="joined"
  bind:value={layout}
  options={[
    { value: "split", label: "Secret" },
    { value: "inline", label: "Public" },
  ]}
/>
<Segmented
  label="Signing"
  variant="split"
  bind:value={theme}
  options={[
    { value: "light", label: "Default" },
    { value: "dark", label: "Sign" },
    { value: "system", label: "Don't sign" },
  ]}
/>
<Text tone="dim">Theme: {theme}, layout: {layout}</Text>
