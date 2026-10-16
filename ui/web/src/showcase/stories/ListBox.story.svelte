<script lang="ts">
  import IconButton from "$ui/components/IconButton.svelte";
  import ListBox from "$ui/components/ListBox.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";

  const remotes = [
    { name: "origin", url: "git@github.com:you/storefront.git" },
    { name: "upstream", url: "https://github.com/shop/storefront.git" },
  ];
  const commits = [
    { hash: "a1b2c3d", subject: "Round tax to cents", author: "Ada Lovelace" },
    { hash: "9f8e7d6", subject: "Add the cart page", author: "Alan Turing" },
  ];
</script>

<ListBox label="Remotes">
  {#each remotes as remote (remote.name)}
    <Stack direction="row" align="center" gap="sm" padding="sm">
      <Stack grow gap="xxs">
        <Text weight="semibold">{remote.name}</Text>
        <Text tone="dim" size="small" truncate title={remote.url}>{remote.url}</Text>
      </Stack>
      <IconButton icon="trash" label="Remove {remote.name}" size="small" iconSize="compact" />
    </Stack>
  {/each}
</ListBox>
<ListBox label="Commits to push" minHeight="list" maxHeight="medium">
  {#each commits as commit (commit.hash)}
    <Stack direction="row" align="center" gap="sm" paddingX="sm" paddingY="xs">
      <Stack grow><Text truncate>{commit.subject}</Text></Stack>
      <Text tone="dim" size="small">{commit.author}</Text>
      <Text mono tone="faint" size="small">{commit.hash}</Text>
    </Stack>
  {/each}
</ListBox>
