<script lang="ts">
  import Button from "$ui/components/Button.svelte";
  import Card from "$ui/components/Card.svelte";
  import MediaView from "$ui/components/MediaView.svelte";
  import Text from "$ui/components/Text.svelte";
  import appIcon from "../../../../../src-tauri/icons/128x128@2x.png?url";

  let zoom = $state<number | null>(null);
</script>

<Text tone="dim">Zoom: {zoom === null ? "fit" : `${Math.round(zoom * 100)}%`} (Cmd + wheel zooms too)</Text>
<Card label="Image">
  <MediaView kind="image" name="icon.png" src={appIcon} info="18 KB" bind:zoom>
    {#snippet actions()}<Button size="tiny">Reveal in Finder</Button>{/snippet}
  </MediaView>
</Card>
<Card label="Binary file">
  <MediaView kind="binary" name="storefront.sqlite" info="SQLite database, 2.4 MB" />
</Card>
