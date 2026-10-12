<script lang="ts">
  import ReorderList from "$ui/components/ReorderList.svelte";
  import Text from "$ui/components/Text.svelte";
  import { movedItems } from "$ui/logic/reorder";

  let commits = $state([
    { id: "a1b2c3d", subject: "Add tax rules" },
    { id: "b2c3d4e", subject: "Round tax to cents" },
    { id: "c3d4e5f", subject: "Fix a typo" },
  ]);
</script>

<ReorderList
  label="Commits to rebase"
  items={commits}
  itemKey={(commit) => commit.id}
  onreorder={(from, to) => (commits = movedItems(commits, from, to))}
>
  {#snippet row(commit)}
    <Text mono tone="dim" size="compact">{commit.id}</Text>
    <Text>{commit.subject}</Text>
  {/snippet}
</ReorderList>
