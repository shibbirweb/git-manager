<!-- The terminal panel's list of terminals, shown when there are several: split groups are joined by tree lines,
     the shown group reads in the text color, a double-click renames and the trash kills. -->
<script lang="ts">
  import Icon from "@nibtree/ui/components/Icon.svelte";
  import IconButton from "@nibtree/ui/components/IconButton.svelte";
  import List from "@nibtree/ui/components/List.svelte";
  import RenameField from "@nibtree/ui/components/RenameField.svelte";
  import Row from "@nibtree/ui/components/Row.svelte";
  import StatusDot from "@nibtree/ui/components/StatusDot.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import TreeLine from "@nibtree/ui/components/TreeLine.svelte";
  import { groupRowPosition, type GroupRowPosition } from "./splitPanes";
  import { type TerminalEntry, terminalStore } from "./terminalStore.svelte";
  import { folderLabel } from "./terminals";

  interface Props {
    /** The terminal whose name is being edited, and whether the typed name can be used. */
    renamingKey: number | null;
    renameInvalid: boolean;
    onstartrename: (terminalKey: number, name: string) => void;
    onrename: (name: string | null) => void;
    onrenameinput: (name: string) => void;
    onmenu: (event: MouseEvent, terminalKey: number) => void;
  }

  let { renamingKey, renameInvalid, onstartrename, onrename, onrenameinput, onmenu }: Props = $props();

  interface ListItem {
    terminal: TerminalEntry;
    position: GroupRowPosition;
  }

  const items = $derived.by((): ListItem[] => {
    const terminals = terminalStore.panelTerminals;
    return terminalStore.panelGroups.flatMap((group) =>
      group.terminalKeys.flatMap((terminalKey) => {
        const terminal = terminals.find((entry) => entry.key === terminalKey);
        return terminal ? [{ terminal, position: groupRowPosition(group, terminalKey) }] : [];
      }),
    );
  });
  const paneKeys = $derived(terminalStore.activeGroupKeys);

  function tooltip(terminal: TerminalEntry): string {
    return `${terminal.name}${terminal.cwd ? `\n${terminal.cwd}` : ""}${terminal.exited ? "\nExited" : ""}`;
  }
</script>

<List
  label="Terminals"
  height="fill"
  {items}
  itemKey={(item) => String(item.terminal.key)}
  selected={terminalStore.activeKey === null ? null : String(terminalStore.activeKey)}
  onselect={(item) => terminalStore.select(item.terminal.key)}
  onactivate={(item) => onstartrename(item.terminal.key, item.terminal.name)}
  oncontextmenu={(event, item) => onmenu(event, item.terminal.key)}
>
  {#snippet row({ terminal, position }, state)}
    <Row selected={state.selected} mark={state.selected} title={tooltip(terminal)}>
      {#if position !== "single"}
        <TreeLine {position} />
      {/if}
      <Icon name="terminal" size="normal" />
      {#if renamingKey === terminal.key}
        <RenameField
          value={terminal.name}
          label="Rename {terminal.name}"
          invalid={renameInvalid}
          {onrename}
          oninput={onrenameinput}
        />
      {:else}
        <Text
          truncate
          size="small"
          tone={terminal.exited ? "faint" : state.selected || paneKeys.includes(terminal.key) ? "default" : "dim"}
        >
          {terminal.name}
        </Text>
        <Text truncate tone="dim" size="compact">{folderLabel(terminal.cwd)}</Text>
      {/if}
      {#if terminal.bell}
        <StatusDot tone="warning" size="small" label="The bell rang" />
      {/if}
      {#snippet actions()}
        <IconButton
          icon="trash"
          iconSize="medium"
          size="micro"
          tone="dim-danger"
          label="Kill {terminal.name}"
          title="Kill Terminal"
          onclick={() => terminalStore.close(terminal.key)}
        />
      {/snippet}
    </Row>
  {/snippet}
</List>
