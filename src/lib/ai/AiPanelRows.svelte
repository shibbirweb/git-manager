<!-- The AI panel's tree: folder headings, a row per project, a card per worktree with its agents inside, and loose
     agents. The panel keeps the keys and the selection; these rows only draw it and report clicks. -->
<script lang="ts">
  import { terminalTabPath } from "$lib/terminal/terminalTabs";
  import Card from "@git-manager/ui/components/Card.svelte";
  import Icon from "@git-manager/ui/components/Icon.svelte";
  import IconButton from "@git-manager/ui/components/IconButton.svelte";
  import Badge from "@git-manager/ui/components/Badge.svelte";
  import Mark from "@git-manager/ui/components/Mark.svelte";
  import Row from "@git-manager/ui/components/Row.svelte";
  import SectionTitle from "@git-manager/ui/components/SectionTitle.svelte";
  import Spacer from "@git-manager/ui/components/Spacer.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import Tag from "@git-manager/ui/components/Tag.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import AgentStateIcon from "./AgentStateIcon.svelte";
  import { stateLabel } from "./agentStatus";
  import { agentById } from "./agents";
  import { agentMark, formatAge, type ProjectSection } from "./panelView";
  import type { PanelRow } from "./projects";

  interface Props {
    sections: ProjectSection[];
    selectedKey: string | null;
    /** The tab on screen, so the agent shown there is marked. */
    activeTab: string | null;
    now: number;
    rowId: (rowKey: string) => string;
    onactivate: (row: PanelRow) => void;
    oncontextmenu: (event: MouseEvent, row: PanelRow) => void;
    /** Start an agent in this folder (the + of a worktree or a plain folder). */
    onstart: (event: MouseEvent, folderPath: string) => void;
    onmore: (event: MouseEvent, row: PanelRow) => void;
    onnewtask: (repoRoot: string) => void;
  }

  let { sections, selectedKey, activeTab, now, rowId, onactivate, oncontextmenu, onstart, onmore, onnewtask }: Props =
    $props();

  function folderName(folderPath: string): string {
    return folderPath.slice(folderPath.lastIndexOf("/") + 1);
  }
</script>

{#snippet agentRow(row: Extract<PanelRow, { kind: "session" }>)}
  {@const session = row.session}
  <Row
    size="tree"
    item="treeitem"
    id={rowId(row.key)}
    selected={selectedKey === row.key || activeTab === terminalTabPath(session.terminalKey)}
    title="{session.name}: {stateLabel(session.state)}{session.title ? `\n${session.title}` : ''}"
    onclick={() => onactivate(row)}
    oncontextmenu={(event) => oncontextmenu(event, row)}
  >
    <AgentStateIcon state={session.state} />
    <Mark size="small" text={agentMark(session.agentId)} title={agentById(session.agentId)?.label ?? session.agentId} />
    <Stack direction="row" align="baseline" gap="sm" grow>
      <Text truncate>{session.title || session.name}</Text>
      <Text size="xsmall" tone="dim" truncate giveWay>
        {session.title ? session.name : stateLabel(session.state)}
      </Text>
    </Stack>
    <Text size="xsmall" tone="dim" tabular>{formatAge(now - session.changedAt)}</Text>
  </Row>
{/snippet}

{#each sections as section (section.key)}
  <Stack gap="xs" paddingY="xxs">
    {#if section.folder}
      <SectionTitle variant="caps" title={section.folder} />
    {/if}
    {#if section.row}
      {@const row = section.row}
      {@const folds = row.project.isRepo || row.sessionCount > 0}
      <Row
        size="section"
        item="treeitem"
        id={rowId(row.key)}
        selected={selectedKey === row.key}
        expanded={folds ? row.expanded : "leaf"}
        onclick={() => onactivate(row)}
        oncontextmenu={(event) => oncontextmenu(event, row)}
      >
        <Icon name={row.project.isRepo ? "folder-git" : "folder"} size="normal" />
        <Text weight="semibold" truncate title={row.project.root}>{row.project.name}</Text>
        {#if !row.project.isRepo}
          <Tag size="small" title="A workspace folder: agents start in it, without a worktree">folder</Tag>
        {/if}
        {#if row.sessionCount > 0}
          <Badge
            count={row.sessionCount}
            tone="quiet"
            size="small"
            label="{row.sessionCount} {row.sessionCount === 1 ? 'agent' : 'agents'}"
          />
        {/if}
        {#snippet actions()}
          {#if row.project.isRepo}
            <IconButton
              icon="plus"
              iconSize="medium"
              size="small"
              title="New task in {row.project.name}: a worktree and an agent"
              label="New task in {row.project.name}"
              onclick={() => onnewtask(row.project.root)}
            />
          {:else}
            <IconButton
              icon="plus"
              iconSize="medium"
              size="small"
              label="Start an agent in {row.project.name}"
              onclick={(event) => onstart(event, row.project.root)}
            />
          {/if}
        {/snippet}
      </Row>
    {/if}

    {#each section.cards as card (card.row.key)}
      {@const row = card.row}
      <Stack paddingLeft="lgPlus">
        <Card selected={selectedKey === row.key} dim={row.missing} label={row.label}>
          <Row
            size="tree"
            item="treeitem"
            id={rowId(row.key)}
            title={row.tooltip}
            onclick={() => onactivate(row)}
            oncontextmenu={(event) => oncontextmenu(event, row)}
          >
            {#if card.state}
              <AgentStateIcon state={card.state} />
            {:else}
              <Icon name="branch" size="compact" tone="faint" />
            {/if}
            <Text weight="medium" truncate>{row.label}</Text>
            {#if row.isMain}
              <Tag size="small" title="The repository's own folder (the main worktree)">primary</Tag>
            {/if}
            {#if row.missing}
              <Tag size="small" tone="warning" title="The worktree's folder is gone">missing</Tag>
            {/if}
            <Spacer />
            {#snippet actions()}
              {#if !row.missing}
                <IconButton
                  icon="plus"
                  iconSize="medium"
                  size="small"
                  label="Start an agent in {row.label}"
                  onclick={(event) => onstart(event, row.path)}
                />
              {/if}
              <IconButton
                icon="more"
                iconSize="medium"
                size="small"
                title="More actions"
                label="More actions for {row.label}"
                onclick={(event) => onmore(event, row)}
              />
            {/snippet}
          </Row>
          <Stack direction="row" align="center" gap="xs" paddingLeft="xxl" paddingX="md">
            <Icon name="folder" size="small" tone="faint" />
            <Text size="xsmall" tone="dim" truncate title={row.path}>{folderName(row.path)}</Text>
          </Stack>
          {#each card.sessions as session (session.key)}
            {@render agentRow(session)}
          {/each}
        </Card>
      </Stack>
    {/each}

    {#if section.sessions.length > 0}
      <Stack paddingLeft="lgPlus">
        <Card>
          {#each section.sessions as session (session.key)}
            {@render agentRow(session)}
          {/each}
        </Card>
      </Stack>
    {/if}
  </Stack>
{/each}
