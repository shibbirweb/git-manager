<script lang="ts">
  import { tick } from "svelte";
  import Collapsible from "$ui/components/Collapsible.svelte";
  import FileRow from "$ui/components/FileRow.svelte";
  import ListRegion from "$ui/components/ListRegion.svelte";
  import Stack from "$ui/components/Stack.svelte";

  // Two groups the app arranges itself; the arrow keys move over the rows of both.
  const groups = [
    { title: "Staged", files: ["src/main.ts", "README.md"] },
    { title: "Changes", files: ["src/app.css", "src/lib/api.ts", "package.json"] },
  ];
  const rows = groups.flatMap((group) => group.files.map((file) => `${group.title}:${file}`));
  let current = $state(rows[0]);
  let list = $state<ListRegion | null>(null);

  function rowId(row: string): string {
    return `story-region-${rows.indexOf(row)}`;
  }

  async function onkeydown(event: KeyboardEvent): Promise<void> {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    event.preventDefault();
    const index = rows.indexOf(current) + (event.key === "ArrowDown" ? 1 : -1);
    current = rows[Math.max(0, Math.min(rows.length - 1, index))];
    await tick();
    list?.reveal();
  }
</script>

<Stack direction="row" height="auto">
  <Stack maxHeight="small" scroll="y" grow>
    <ListRegion label="Changed files" activeId={rowId(current)} paddingY="xs" {onkeydown} bind:this={list}>
      {#each groups as group (group.title)}
        <Collapsible title={group.title} count={group.files.length}>
          {#each group.files as file (file)}
            {@const row = `${group.title}:${file}`}
            <FileRow
              kind="modified"
              name={file.split("/").pop() ?? file}
              directory={file.split("/").slice(0, -1).join("/")}
              id={rowId(row)}
              selected={row === current}
              keepFocus
              onselect={() => {
                current = row;
                list?.focus();
              }}
            />
          {/each}
        </Collapsible>
      {/each}
    </ListRegion>
  </Stack>
</Stack>
