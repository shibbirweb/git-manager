<script lang="ts">
  import Button from "$ui/components/Button.svelte";
  import CodeBlock from "$ui/components/CodeBlock.svelte";
  import Icon from "$ui/components/Icon.svelte";
  import Input from "$ui/components/Input.svelte";
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

  const commands = Array.from({ length: 300 }, (_, index) => ({
    id: `g${index}`,
    command: `git ${["fetch --prune origin", "status --porcelain=v2", "log -n 50"][index % 3]}`,
    output: Array.from({ length: (index % 4) + 2 }, (_, line) => `line ${line + 1} of command ${index + 1}`).join("\n"),
  }));
  let openCommands = $state<string[]>(["g1"]);
  let selectedCommand = $state<string | null>("g1");

  function toggleCommand(id: string) {
    openCommands = openCommands.includes(id) ? openCommands.filter((other) => other !== id) : [...openCommands, id];
  }

  let query = $state("");
  let filterField = $state<HTMLInputElement | null>(null);
  let picked = $state<string | null>(null);
  let pickedOpen = $state("");
  const found = $derived(files.filter((file) => file.path.toLowerCase().includes(query.toLowerCase())));

  let loaded = $state(100);
  const paged = $derived(commits.slice(0, loaded));
  let pagedSelected = $state<string | null>(null);

  let consoleLines = $state(Array.from({ length: 12 }, (_, index) => ({ id: index, text: `git fetch #${index + 1}` })));

  function runCommand() {
    const id = consoleLines.length;
    consoleLines = [...consoleLines, { id, text: `git status #${id + 1}` }];
  }

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

  <Text variant="sectionLabel">virtual and measured: entries open to different heights (Enter opens)</Text>
  <List
    label="Git commands"
    items={commands}
    itemKey={(entry) => entry.id}
    virtual="normal"
    measure
    height="medium"
    bind:selected={selectedCommand}
    onactivate={(entry) => toggleCommand(entry.id)}
  >
    {#snippet row(entry, state)}
      <Stack gap="none">
        <Row
          selected={state.selected}
          expanded={openCommands.includes(entry.id)}
          onclick={() => toggleCommand(entry.id)}
        >
          <Text mono size="small" truncate>{entry.command}</Text>
        </Row>
        {#if openCommands.includes(entry.id)}
          <CodeBlock label="Output of {entry.command}" text={entry.output} />
        {/if}
      </Stack>
    {/snippet}
  </List>

  <Text variant="sectionLabel">field drive: the field keeps the focus; Up, Down and Enter work the list</Text>
  <Input bind:element={filterField} bind:value={query} placeholder="Type to filter" aria-label="Filter files" />
  <List
    label="Matching files"
    items={found}
    itemKey={(file) => file.path}
    field={filterField}
    fieldKeys="drive"
    bind:selected={picked}
    onactivate={(file) => (pickedOpen = file.path)}
  >
    {#snippet row(file, state)}
      <Row selected={state.selected}><Text truncate>{file.path}</Text></Row>
    {/snippet}
  </List>
  <Text tone="dim" size="small">{pickedOpen ? `Opened ${pickedOpen}` : "Enter opens the highlighted file"}</Text>

  <Text variant="sectionLabel">onnearend: loads 100 more near the end ({loaded} of {commits.length})</Text>
  <List
    label="Paged commits"
    items={paged}
    itemKey={(commit) => commit.id}
    virtual="relaxed"
    height="small"
    bind:selected={pagedSelected}
    onnearend={() => (loaded = Math.min(commits.length, loaded + 100))}
  >
    {#snippet row(commit, state)}
      <Row size="history" selected={state.selected}><Text truncate>{commit.subject}</Text></Row>
    {/snippet}
  </List>

  <Text variant="sectionLabel">follow: stays at the bottom while entries arrive, until you scroll up</Text>
  <Stack direction="row"><Button onclick={runCommand}>Run a command</Button></Stack>
  <List label="Console" role="list" items={consoleLines} itemKey={(line) => String(line.id)} height="small" follow>
    {#snippet row(line)}
      <Row><Text mono size="small">{line.text}</Text></Row>
    {/snippet}
  </List>
</Stack>
