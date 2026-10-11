<script lang="ts">
  import MenuButton from "$ui/components/MenuButton.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";

  let last = $state("nothing yet");
  const run = (name: string) => () => (last = name);
</script>

<Stack direction="row" align="center" gap="md">
  <MenuButton
    label="Repository actions"
    items={[
      { label: "Fetch", action: run("Fetch") },
      { label: "Pull", action: run("Pull") },
      { label: "Push", action: run("Push") },
    ]}
  />
  <MenuButton
    label="Branch"
    text="main"
    icon="branch"
    items={[
      { label: "New Branch...", action: run("New Branch") },
      { label: "Checkout...", action: run("Checkout") },
    ]}
  />
  <Text tone="dim">Ran: {last}</Text>
</Stack>
