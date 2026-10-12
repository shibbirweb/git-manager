<script lang="ts">
  import Avatar from "$ui/components/Avatar.svelte";
  import Stack from "$ui/components/Stack.svelte";
</script>

<Stack direction="row" gap="md" align="center">
  <Avatar text="AL" label="Ada Lovelace" />
  <Avatar text="SF" shape="tile" color="blue" />
  <Avatar text="AP" shape="tile" color="green" />
  <Avatar text="DO" shape="tile" color="magenta" />
  <Avatar text="WB" shape="tile" color="cyan" />
  <Avatar text="GM" shape="tile" color="red" />
</Stack>
