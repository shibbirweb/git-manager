<script lang="ts">
  import Card from "$ui/components/Card.svelte";
  import MediaCompare from "$ui/components/MediaCompare.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import before from "../../../../../src-tauri/icons/128x128.png?url";
  import after from "../../../../../src-tauri/icons/128x128@2x.png?url";

  let zoom = $state<number | null>(null);
</script>

<Card label="Compare">
  <Stack>
    <MediaCompare
      bind:zoom
      sides={[
        { label: "HEAD", kind: "image", src: before, info: "128 x 128 px, 9 KB" },
        { label: "Working tree", kind: "image", src: after, info: "256 x 256 px, 18 KB" },
      ]}
    />
  </Stack>
</Card>
<Card label="Added file">
  <MediaCompare
    sides={[
      { label: "HEAD", kind: "none", message: "The file does not exist in this version." },
      { label: "Working tree", kind: "image", src: after },
    ]}
  />
</Card>
