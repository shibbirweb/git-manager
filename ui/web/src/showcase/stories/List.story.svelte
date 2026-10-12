<script lang="ts">
  import Icon from "$ui/components/Icon.svelte";
  import List from "$ui/components/List.svelte";
  import Row from "$ui/components/Row.svelte";
  import Spacer from "$ui/components/Spacer.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import StatusLetter from "$ui/components/StatusLetter.svelte";
  import Text from "$ui/components/Text.svelte";
  import type { FileKind } from "$ui/logic/fileStatus";

  interface FileItem {
    path: string;
    name: string;
    folder: string;
    kind: FileKind;
  }
  const files: FileItem[] = [
    { path: "src/lib/cart.ts", name: "cart.ts", folder: "src/lib", kind: "modified" },
    { path: "src/lib/tax.ts", name: "tax.ts", folder: "src/lib", kind: "added" },
    { path: "src/old.ts", name: "old.ts", folder: "src", kind: "deleted" },
    { path: "README.md", name: "README.md", folder: "", kind: "modified" },
  ];
  let selectedPath = $state<string | null>(files[0].path);
  let selection = $state<string[]>([files[0].path]);
  let opened = $state("");

  interface TreeItem {
    id: string;
    label: string;
    depth: number;
    heading?: boolean;
  }
  let openIds = $state<string[]>(["local"]);
  const tree = $derived<TreeItem[]>([
    { id: "local", label: "Local", depth: 0 },
    ...(openIds.includes("local")
      ? [
          { id: "main", label: "main", depth: 1 },
          { id: "feature/cart", label: "feature/cart", depth: 1 },
        ]
      : []),
    { id: "remote", label: "Remote", depth: 0 },
    ...(openIds.includes("remote") ? [{ id: "origin/main", label: "origin/main", depth: 1 }] : []),
  ]);
  let selectedBranch = $state<string | null>("main");

  const commits = Array.from({ length: 2000 }, (_, index) => ({
    id: `c${index}`,
    hash: (0x1a2b3c4 + index * 7919).toString(16).slice(0, 7),
    subject: `Commit number ${2000 - index}`,
  }));
  let selectedCommit = $state<string | null>("c0");

  function toggle(item: TreeItem, open: boolean) {
    openIds = open ? [...openIds, item.id] : openIds.filter((id) => id !== item.id);
  }
</script>

<Stack gap="md">
  <Text variant="sectionLabel">listbox, multiple: Cmd or Shift click, Shift and arrows, Cmd+A</Text>
  <List
    label="Changed files"
    items={files}
    itemKey={(file) => file.path}
    multiple
    bind:selected={selectedPath}
    bind:selection
    onactivate={(file) => (opened = file.path)}
  >
    {#snippet row(file, state)}
      <Row selected={state.selected}>
        <StatusLetter kind={file.kind} />
        <Text truncate strike={file.kind === "deleted"}>{file.name}</Text>
        <Text tone="dim" size="small" truncate>{file.folder}</Text>
      </Row>
    {/snippet}
  </List>
  <Text tone="dim" size="small">{selection.length} selected{opened ? `, opened ${opened}` : ""}</Text>

  <Text variant="sectionLabel">tree: Left and Right fold</Text>
  <List
    label="Branches"
    role="tree"
    items={tree}
    itemKey={(item) => item.id}
    level={(item) => item.depth}
    expanded={(item) => (item.depth === 0 ? openIds.includes(item.id) : null)}
    bind:selected={selectedBranch}
    ontoggle={toggle}
    onactivate={(item) => item.depth === 0 && toggle(item, !openIds.includes(item.id))}
  >
    {#snippet row(item, state)}
      <Row
        size="tree"
        selected={state.selected}
        depth={item.depth}
        expanded={item.depth === 0 ? openIds.includes(item.id) : "leaf"}
      >
        {#if item.depth > 0}<Icon name="branch" size="normal" />{/if}
        <Text truncate weight={item.depth === 0 ? "semibold" : undefined}>{item.label}</Text>
      </Row>
    {/snippet}
  </List>

  <Text variant="sectionLabel">virtual: 2,000 rows, only those in view are drawn</Text>
  <List
    label="Commits"
    items={commits}
    itemKey={(commit) => commit.id}
    virtual="relaxed"
    height="medium"
    bind:selected={selectedCommit}
  >
    {#snippet row(commit, state)}
      <Row size="history" selected={state.selected}>
        <Text mono tone="dim" size="compact">{commit.hash}</Text>
        <Text truncate>{commit.subject}</Text>
        <Spacer />
        <Text tone="dim" tabular>#{state.index + 1}</Text>
      </Row>
    {/snippet}
  </List>
</Stack>
