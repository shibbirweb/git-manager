<!--
  The bottom panel under the editor: tabs and actions in a slim head, the shown group of terminals (split side by
  side) and, with several, the list of terminals on the right (TerminalList). The terminals are mounted by
  TerminalHost and moved into their panes; Workspace gives the panel its frame and height.
-->
<script lang="ts">
  import Divider from "@git-manager/ui/components/Divider.svelte";
  import ElementHost from "@git-manager/ui/components/ElementHost.svelte";
  import IconButton from "@git-manager/ui/components/IconButton.svelte";
  import PaneRow from "@git-manager/ui/components/PaneRow.svelte";
  import RenameField from "@git-manager/ui/components/RenameField.svelte";
  import Row from "@git-manager/ui/components/Row.svelte";
  import SplitPane from "@git-manager/ui/components/SplitPane.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import StatusDot from "@git-manager/ui/components/StatusDot.svelte";
  import Tabs from "@git-manager/ui/components/Tabs.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import Toolbar from "@git-manager/ui/components/Toolbar.svelte";
  import { untrack } from "svelte";
  import { localKeys, withCommandKeys } from "$lib/commands/commandRuntime";
  import ShelfPanel from "$lib/shelf/ShelfPanel.svelte";
  import { MIN_TERMINAL_LIST_WIDTH, settings } from "$lib/stores/settings.svelte";
  import { contextMenu, type MenuItem } from "$lib/ui/menu.svelte";
  import { platformName } from "$lib/update/releases";
  import RunView from "./RunView.svelte";
  import TerminalList from "./TerminalList.svelte";
  import { type PanelTab, terminalStore } from "./terminalStore.svelte";
  import { folderLabel, maxListWidth, validateTerminalName } from "./terminals";

  const isMac = platformName(navigator.userAgent) === "macOS";
  const active = $derived(terminalStore.active);
  const several = $derived(terminalStore.panelTerminals.length > 1);
  const tab = $derived(terminalStore.panelTab);
  const onTerminal = $derived(tab === "terminal");
  const panes = $derived.by(() => {
    const keys = terminalStore.activeGroupKeys;
    const shares = active ? terminalStore.paneSizes(active.group, keys.length) : [];
    return keys.map((terminalKey, index) => ({ key: String(terminalKey), terminalKey, share: shares[index] ?? 1 }));
  });
  const ALL_TABS: { value: PanelTab; label: string }[] = [
    { value: "terminal", label: "Terminal" },
    { value: "run", label: "Run" },
    { value: "gitConsole", label: "Git Console" },
    { value: "shelf", label: "Shelf" },
  ];
  // Run shows once a script ran.
  const tabs = $derived(
    ALL_TABS.filter(
      (item) =>
        (item.value !== "gitConsole" || settings.gitConsole) &&
        (item.value !== "run" || terminalStore.runSessions.length > 0),
    ),
  );
  // Loaded on first use, so with the setting off none of its code is in memory.
  const loadGitConsole = () => import("$lib/console/GitConsoleView.svelte");
  let bodyWidth = $state(0);
  /** The terminal whose name is being edited in place (double-click), and the text typed so far. */
  let renamingKey = $state<number | null>(null);
  let renameDraft = $state("");

  const listMax = $derived(maxListWidth(bodyWidth, MIN_TERMINAL_LIST_WIDTH));
  const listWidth = $derived(Math.min(listMax, Math.max(MIN_TERMINAL_LIST_WIDTH, settings.terminalListWidth)));
  const splitKeys = localKeys(isMac ? "Cmd+\\" : "Ctrl+Shift+5");

  // Terminals of the other groups wait, hidden, in the view area (see TerminalHost).
  function panelSlot(element: HTMLDivElement): () => void {
    untrack(() => terminalStore.setPanelSlot(element));
    return () => {
      untrack(() => {
        if (terminalStore.panelSlot === element) {
          terminalStore.setPanelSlot(null);
        }
      });
    };
  }

  // One callback per terminal: a new one each render would move the terminal out and back in.
  const paneSlots = new Map<number, (element: HTMLDivElement) => () => void>();

  /** A pane of the shown group: its terminal is moved in here. */
  function paneSlot(terminalKey: number): (element: HTMLDivElement) => () => void {
    let slot = paneSlots.get(terminalKey);
    if (!slot) {
      slot = (element) => {
        untrack(() => terminalStore.setPaneSlot(terminalKey, element));
        return () => untrack(() => terminalStore.clearPaneSlot(terminalKey, element));
      };
      paneSlots.set(terminalKey, slot);
    }
    return slot;
  }

  /** The chevron next to "+": every shell found, then the default shell setting. */
  async function openShellMenu(event: MouseEvent): Promise<void> {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const shells = await terminalStore.loadShells();
    const items: MenuItem[] = shells.map((shell) => ({
      label: shell.name,
      hint: shell.path,
      action: () => void terminalStore.create({ shellId: shell.id }),
    }));
    if (items.length === 0) {
      items.push({ label: "No shells found", disabled: true, action: () => undefined });
    }
    items.push(
      { separator: true },
      { label: "New Terminal in Editor Area", action: () => void terminalStore.create({ location: "editor" }) },
      { separator: true },
      { label: "Default Shell...", action: () => settings.openDialog("terminal") },
    );
    contextMenu.open(new MouseEvent("contextmenu", { clientX: rect.left, clientY: rect.bottom + 2 }), items);
  }

  function openTerminalMenu(event: MouseEvent, terminalKey: number): void {
    contextMenu.open(event, terminalStore.menuItems(terminalKey));
  }

  function startRename(terminalKey: number, name: string): void {
    renamingKey = terminalKey;
    renameDraft = name;
  }

  /** Enter or leaving the field keeps a valid name; Esc (null) keeps the old one. */
  function finishRename(name: string | null): void {
    const terminalKey = renamingKey;
    if (terminalKey === null) {
      return;
    }
    renamingKey = null;
    if (name !== null && validateTerminalName(name) === null) {
      terminalStore.rename(terminalKey, name);
    }
    terminalStore.requestFocus(terminalKey);
  }
</script>

{#snippet terminalList()}
  <TerminalList
    {renamingKey}
    renameInvalid={validateTerminalName(renameDraft) !== null}
    onstartrename={startRename}
    onrename={finishRename}
    onrenameinput={(name) => (renameDraft = name)}
    onmenu={openTerminalMenu}
  />
{/snippet}

{#snippet views()}
  <!-- The shown group's panes; terminals of other groups are parked, hidden, in here too. -->
  <ElementHost fill="grow" hidden={!onTerminal} onready={panelSlot}>
    <PaneRow
      {panes}
      focused={terminalStore.activeKey === null ? null : String(terminalStore.activeKey)}
      resizeLabel="Resize split terminals"
      onresize={(index, share, minShare) => {
        if (active) {
          terminalStore.resizePane(active.group, index, share, minShare);
        }
      }}
    >
      {#snippet pane(entry)}
        <ElementHost fill="cover" onready={paneSlot(entry.terminalKey)} />
      {/snippet}
    </PaneRow>
  </ElementHost>
  {#if !onTerminal && terminalStore.panelOpen}
    <Stack gap="none" grow>
      {#if tab === "run"}
        <RunView />
      {:else if tab === "gitConsole" && settings.gitConsole}
        {#await loadGitConsole() then module}
          <module.default />
        {/await}
      {:else if tab === "shelf"}
        <ShelfPanel />
      {/if}
    </Stack>
  {/if}
{/snippet}

<Stack gap="none" grow>
  <Toolbar variant="compact" label="Bottom panel">
    <Tabs {tabs} value={tab} label="Panel views" onchange={(next) => terminalStore.showTab(next)} />
    {#if onTerminal && active && !several}
      <Row
        title="{active.name}{active.cwd ? `\n${active.cwd}` : ''}\nDouble-click to rename"
        oncontextmenu={(event) => openTerminalMenu(event, active.key)}
        ondblclick={() => startRename(active.key, active.name)}
      >
        {#if renamingKey === active.key}
          <RenameField
            value={active.name}
            label="Rename {active.name}"
            invalid={validateTerminalName(renameDraft) !== null}
            onrename={finishRename}
            oninput={(name) => (renameDraft = name)}
          />
        {:else}
          <Text truncate size="small">{active.name}</Text>
          <Text truncate tone="dim" size="small">{folderLabel(active.cwd)}</Text>
        {/if}
        {#if active.bell}
          <StatusDot tone="warning" size="small" label="The bell rang" />
        {/if}
      </Row>
    {/if}
    {#snippet end()}
      {#if onTerminal}
        <IconButton
          icon="plus"
          iconSize="regular"
          size="compact"
          tone="dim"
          label="New Terminal"
          title={withCommandKeys("New Terminal", "terminal.new")}
          onclick={() => void terminalStore.create()}
        />
        <IconButton
          icon="chevron-down"
          iconSize="compact"
          size="chevron"
          tone="dim"
          label="New terminal with shell"
          title="New Terminal With Shell..."
          onclick={(event) => void openShellMenu(event)}
        />
        <IconButton
          icon="split-view"
          iconSize="normal"
          size="compact"
          tone="dim"
          label="Split Terminal"
          title="Split Terminal ({splitKeys})"
          disabled={!active}
          onclick={() => active && void terminalStore.split(active.key)}
        />
        <IconButton
          icon="app-window"
          iconSize="normal"
          size="compact"
          tone="dim"
          label="Move Terminal into Editor Area"
          disabled={!active}
          onclick={() => active && terminalStore.moveToEditor(active.key)}
        />
        <IconButton
          icon="trash"
          iconSize="normal"
          size="compact"
          tone="dim"
          label="Kill Terminal"
          disabled={!active}
          onclick={() => active && terminalStore.close(active.key)}
        />
        <Divider direction="vertical" />
      {/if}
      <IconButton
        icon="x"
        iconSize="regular"
        size="compact"
        tone="dim"
        label="Hide panel"
        title={withCommandKeys("Hide Panel", "view.terminal")}
        onclick={() => terminalStore.hide()}
      />
    {/snippet}
  </Toolbar>

  <SplitPane
    sized="second"
    preset="list"
    label="Resize terminal list"
    inPanel
    bind:extent={bodyWidth}
    max={listMax}
    bind:size={() => listWidth, (width) => (settings.terminalListWidth = width)}
    oncommit={() => settings.save()}
    first={views}
    second={onTerminal && several ? terminalList : undefined}
  />
</Stack>
