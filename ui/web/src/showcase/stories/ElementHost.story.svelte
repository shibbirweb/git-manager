<script lang="ts">
  import Button from "$ui/components/Button.svelte";
  import Card from "$ui/components/Card.svelte";
  import ElementHost from "$ui/components/ElementHost.svelte";
  import Grid from "$ui/components/Grid.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";

  // One element the "app" made itself, moved between two hosts without being rebuilt.
  const moving = document.createElement("div");
  moving.textContent = "An element the app manages (a terminal keeps its scrollback while it moves)";
  let left = $state<HTMLDivElement | null>(null);
  let right = $state<HTMLDivElement | null>(null);
  let side = $state<"left" | "right">("left");

  $effect(() => {
    const target = side === "left" ? left : right;
    target?.appendChild(moving);
  });
</script>

<Stack direction="row" gap="sm" align="center">
  <Button onclick={() => (side = side === "left" ? "right" : "left")}>Move it</Button>
  <Text tone="dim">The same element moves; nothing inside it starts over.</Text>
</Stack>
<Grid columns="two">
  <Card label="Panel" padded>
    <ElementHost label="Panel slot" surface="editor" clip onready={(element) => void (left = element)} />
  </Card>
  <Card label="Editor tab" padded>
    <ElementHost label="Tab slot" surface="editor" clip onready={(element) => void (right = element)} />
  </Card>
</Grid>
