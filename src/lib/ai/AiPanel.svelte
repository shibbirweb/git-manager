<!-- The AI panel in the right sidebar, like Orca's: a section per project, a card per worktree with the agents
     working in it, a filter and New Agent on top. Rows come from projects.ts, cards from panelView.ts, menus from
     panelActions.ts. -->
<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { withCommandKeys } from "$lib/commands/commandRuntime";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { terminalTabPath } from "$lib/terminal/terminalTabs";
  import Icon from "$lib/ui/Icon.svelte";
  import { contextMenu } from "$lib/ui/menu.svelte";
  import PanelHead from "$lib/views/PanelHead.svelte";
  import { pickAndOpenRepo } from "$lib/views/repoPicker";
  import AgentStateIcon from "./AgentStateIcon.svelte";
  import { stateLabel } from "./agentStatus";
  import { agentById } from "./agents";
  import { aiStore } from "./aiStore.svelte";
  import { newTask, rowMenu } from "./panelActions";
  import { agentMark, attentionCounts, filterRows, formatAge, groupRows } from "./panelView";
  import { type PanelRow, panelRows, workspaceProjects } from "./projects";
  import { agentPrograms, agentSessions, focusSession, startMenu } from "./sessions.svelte";

  let filter = $state("");
  let selectedKey = $state<string | null>(null);
  let listEl = $state<HTMLDivElement | null>(null);
  /** Ticks every 30 s while the panel is open, for the ages. */
  let now = $state(Date.now());

  const projects = $derived(workspaceProjects(repoStore.workspace?.folders ?? [], repoStore.repos));
  const repoRoots = $derived(projects.filter((project) => project.isRepo).map((project) => project.root));
  const sessions = $derived(agentSessions());
  // A filter looks through collapsed projects too.
  const rows = $derived(
    filterRows(panelRows(projects, aiStore.worktrees, sessions, filter.trim() ? new Set() : aiStore.collapsed), filter),
  );
  const sections = $derived(groupRows(rows));
  /** Rows the keyboard moves through, in screen order. */
  const navigable = $derived(rows.filter((row) => row.kind !== "folder"));
  const counts = $derived(attentionCounts(sessions));
  const activeTab = $derived(repoStore.groups.find((group) => group.id === repoStore.focusedGroupId)?.active ?? null);
  /** Where New Agent starts: the active repository, else the first project. */
  const defaultFolder = $derived(repoStore.repo?.root ?? projects[0]?.root ?? null);
  const noAgents = $derived(agentPrograms.found !== null && agentPrograms.installed().length === 0);

  // The worktree lists follow the projects; the active repository's refs carry a worktree fingerprint,
  // so a worktree added in a terminal shows up with the next refresh of its repository.
  $effect(() => {
    const roots = repoRoots;
    void repoStore.refs;
    untrack(() => void aiStore.loadWorktrees(roots));
  });

  onMount(() => {
    void agentPrograms.load();
    const timer = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(timer);
  });

  function refresh(): void {
    void aiStore.loadWorktrees(repoRoots);
    void agentPrograms.load(true);
  }

  function openStartMenu(event: MouseEvent, folderPath: string): void {
    event.stopPropagation();
    contextMenu.openBelow(event.currentTarget as HTMLElement, startMenu(folderPath));
  }

  function openRowMenu(event: MouseEvent, row: PanelRow): void {
    event.stopPropagation();
    selectedKey = row.key;
    contextMenu.openBelow(event.currentTarget as HTMLElement, rowMenu(row));
  }

  function onContextMenu(event: MouseEvent, row: PanelRow): void {
    const items = rowMenu(row);
    if (items.length > 0) {
      selectedKey = row.key;
      contextMenu.open(event, items);
    }
  }

  function activate(row: PanelRow): void {
    selectedKey = row.key;
    if (row.kind === "session") {
      focusSession(row.session.terminalKey);
    } else if (row.kind === "project") {
      aiStore.toggle(row.key);
    }
  }

  function showFirstWaiting(): void {
    const waiting = sessions.find((session) => session.state === "waiting");
    if (waiting) {
      focusSession(waiting.terminalKey);
    }
  }

  function select(index: number): void {
    const row = navigable[index];
    if (row) {
      selectedKey = row.key;
      listEl?.querySelector(`[data-key="${CSS.escape(row.key)}"]`)?.scrollIntoView({ block: "nearest" });
    }
  }

  function onKeydown(event: KeyboardEvent): void {
    const index = navigable.findIndex((row) => row.key === selectedKey);
    const row = navigable[index] ?? null;
    switch (event.key) {
      case "ArrowDown":
        select(Math.min(navigable.length - 1, index + 1));
        break;
      case "ArrowUp":
        select(Math.max(0, index - 1));
        break;
      case "ArrowRight":
      case "ArrowLeft":
        if (row?.kind === "project") {
          aiStore.setExpanded(row.key, event.key === "ArrowRight");
        }
        break;
      case "Enter":
      case " ":
        if (row) {
          activate(row);
        }
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  function agentLabel(agentId: string): string {
    return agentById(agentId)?.label ?? agentId;
  }

  function folderName(folderPath: string | null): string {
    return folderPath ? folderPath.slice(folderPath.lastIndexOf("/") + 1) : "";
  }
</script>

{#snippet agentRow(row: Extract<PanelRow, { kind: "session" }>)}
  {@const session = row.session}
  <div
    class="agent"
    class:selected={selectedKey === row.key}
    class:active={activeTab === terminalTabPath(session.terminalKey)}
    data-key={row.key}
    role="treeitem"
    tabindex="-1"
    aria-selected={selectedKey === row.key}
    title="{session.name}: {stateLabel(session.state)}{session.title ? `\n${session.title}` : ''}"
    onclick={() => activate(row)}
    oncontextmenu={(event) => onContextMenu(event, row)}
    onkeydown={(event) => {
      event.stopPropagation();
      onKeydown(event);
    }}
  >
    <AgentStateIcon state={session.state} />
    <span class="badge" title={agentLabel(session.agentId)}>{agentMark(session.agentId)}</span>
    <span class="agent-text">
      {#if session.title}
        <span class="agent-title">{session.title}</span>
        <span class="agent-name dim">{session.name}</span>
      {:else}
        <span class="agent-title">{session.name}</span>
        <span class="agent-name dim">{stateLabel(session.state)}</span>
      {/if}
    </span>
    <span class="age dim">{formatAge(now - session.changedAt)}</span>
  </div>
{/snippet}

<div class="ai-view">
  <PanelHead title="AI Agents" hideTitle={withCommandKeys("Hide", "view.aiPanel")} onhide={() => settings.toggleRightPanel("ai")}>
    <button
      class="icon-btn small"
      title="Collapse All"
      aria-label="Collapse all"
      onclick={() => aiStore.collapseAll(rows.filter((row) => row.kind === "project").map((row) => row.key))}
      disabled={rows.length === 0}
    >
      <Icon name="chevrons-left" size={14} />
    </button>
    <button
      class="icon-btn small"
      title="Refresh worktrees and agents"
      aria-label="Refresh"
      onclick={refresh}
      disabled={aiStore.loading || agentPrograms.loading}
    >
      <Icon name="refresh" size={13} />
    </button>
  </PanelHead>

  {#if projects.length > 0}
    <div class="toolbar">
      <div class="filter">
        <span class="filter-icon"><Icon name="search" size={13} /></span>
        <input
          class="input filter-input"
          type="text"
          placeholder="Filter"
          aria-label="Filter worktrees and agents"
          spellcheck="false"
          bind:value={filter}
          onkeydown={(event) => {
            if (event.key === "Escape" && filter) {
              filter = "";
              event.stopPropagation();
            }
          }}
        />
        {#if filter}
          <button class="icon-btn clear" title="Clear filter" aria-label="Clear filter" onclick={() => (filter = "")}>
            <Icon name="x" size={12} />
          </button>
        {/if}
      </div>
      <button
        class="btn small primary new-agent"
        title="Start an agent in {folderName(defaultFolder) || 'the active repository'}"
        disabled={defaultFolder === null}
        onclick={(event) => {
          if (defaultFolder) {
            openStartMenu(event, defaultFolder);
          }
        }}
      >
        <Icon name="plus" size={12} />
        New Agent
      </button>
    </div>
  {/if}

  {#if counts.waiting > 0 || counts.working > 0}
    <div class="summary">
      {#if counts.waiting > 0}
        <button class="pill waiting" title="Show the agent that needs you" onclick={showFirstWaiting}>
          <AgentStateIcon state="waiting" />
          {counts.waiting} {counts.waiting === 1 ? "needs you" : "need you"}
        </button>
      {/if}
      {#if counts.working > 0}
        <span class="pill"><AgentStateIcon state="working" />{counts.working} working</span>
      {/if}
    </div>
  {/if}

  <div
    bind:this={listEl}
    class="list"
    role="tree"
    tabindex="0"
    aria-label="AI projects"
    aria-busy={aiStore.loading}
    onkeydown={onKeydown}
  >
    {#each sections as section (section.key)}
      {#if section.folder}
        <div class="folder-heading truncate" title={section.folder}>{section.folder}</div>
      {/if}
      {#if section.row}
        {@const row = section.row}
        <div
          class="project"
          class:selected={selectedKey === row.key}
          data-key={row.key}
          role="treeitem"
          tabindex="-1"
          aria-expanded={row.project.isRepo || row.sessionCount > 0 ? row.expanded : undefined}
          aria-selected={selectedKey === row.key}
          onclick={() => activate(row)}
          oncontextmenu={(event) => onContextMenu(event, row)}
          onkeydown={(event) => {
            event.stopPropagation();
            onKeydown(event);
          }}
        >
          {#if row.project.isRepo || row.sessionCount > 0}
            <Icon name={row.expanded ? "chevron-down" : "chevron-right"} size={12} />
          {:else}
            <span class="no-chevron" aria-hidden="true"></span>
          {/if}
          <Icon name={row.project.isRepo ? "folder-git" : "folder"} size={14} />
          <span class="project-name truncate" title={row.project.root}>{row.project.name}</span>
          {#if !row.project.isRepo}
            <span class="tag" title="A workspace folder: agents start in it, without a worktree">folder</span>
          {/if}
          {#if row.sessionCount > 0}
            <span class="count" title="{row.sessionCount} {row.sessionCount === 1 ? 'agent' : 'agents'}">
              {row.sessionCount}
            </span>
          {/if}
          <span class="spacer"></span>
          {#if row.project.isRepo}
            <button
              class="icon-btn hover-action"
              title="New task in {row.project.name}: a worktree and an agent"
              aria-label="New task in {row.project.name}"
              onclick={(event) => {
                event.stopPropagation();
                newTask(row.project.root);
              }}
            >
              <Icon name="plus" size={13} />
            </button>
          {:else}
            <button
              class="icon-btn hover-action"
              title="Start an agent in {row.project.name}"
              aria-label="Start an agent in {row.project.name}"
              onclick={(event) => openStartMenu(event, row.project.root)}
            >
              <Icon name="plus" size={13} />
            </button>
          {/if}
        </div>
      {/if}

      {#each section.cards as card (card.row.key)}
        {@const row = card.row}
        <div class="card" class:missing={row.missing} class:selected={selectedKey === row.key}>
          <div
            class="card-head"
            data-key={row.key}
            role="treeitem"
            tabindex="-1"
            aria-selected={selectedKey === row.key}
            title={row.tooltip}
            onclick={() => activate(row)}
            oncontextmenu={(event) => onContextMenu(event, row)}
            onkeydown={(event) => {
              event.stopPropagation();
              onKeydown(event);
            }}
          >
            {#if card.state}
              <AgentStateIcon state={card.state} />
            {:else}
              <span class="branch-mark"><Icon name="branch" size={12} /></span>
            {/if}
            <span class="card-title truncate">{row.label}</span>
            {#if row.isMain}
              <span class="tag" title="The repository's own folder (the main worktree)">primary</span>
            {/if}
            {#if row.missing}
              <span class="tag warn" title="The worktree's folder is gone">missing</span>
            {/if}
            <span class="spacer"></span>
            {#if !row.missing}
              <button
                class="icon-btn hover-action"
                title="Start an agent in {row.label}"
                aria-label="Start an agent in {row.label}"
                onclick={(event) => openStartMenu(event, row.path)}
              >
                <Icon name="plus" size={13} />
              </button>
            {/if}
            <button
              class="icon-btn hover-action"
              title="More actions"
              aria-label="More actions for {row.label}"
              onclick={(event) => openRowMenu(event, row)}
            >
              <Icon name="more" size={13} />
            </button>
          </div>
          <div class="card-sub dim" title={row.path}>
            <Icon name="folder" size={11} />
            <span class="truncate">{folderName(row.path)}</span>
          </div>
          {#each card.sessions as session (session.key)}
            {@render agentRow(session)}
          {/each}
        </div>
      {/each}

      {#if section.sessions.length > 0}
        <div class="card loose">
          {#each section.sessions as session (session.key)}
            {@render agentRow(session)}
          {/each}
        </div>
      {/if}
    {/each}

    {#if projects.length === 0}
      <div class="empty">
        <Icon name="bot" size={28} strokeWidth={1.5} />
        <strong>No folder open</strong>
        <span>Open a folder to see its projects and start AI agents in them.</span>
        <button class="btn small" onclick={() => void pickAndOpenRepo()}>Open Folder...</button>
      </div>
    {:else if rows.length === 0 && filter.trim()}
      <div class="empty">
        <span>Nothing matches "{filter.trim()}".</span>
        <button class="btn small" onclick={() => (filter = "")}>Clear Filter</button>
      </div>
    {:else if noAgents}
      <div class="notice">
        <strong>No AI agents found</strong>
        <span>Install Claude Code, Codex, Gemini CLI or another agent, then press Refresh. Blank Terminal still works.</span>
        <button class="btn small" onclick={() => settings.openDialog("ai")}>AI Settings...</button>
      </div>
    {:else if sessions.length === 0}
      <div class="hint">
        Click <strong>New Agent</strong>, or hover a worktree and click +, to start an agent there. Click + next to a
        repository for a <strong>new task</strong>: its own branch and worktree, with one agent or several racing.
      </div>
    {/if}
  </div>
</div>

<style>
  .ai-view {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .toolbar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px;
  }

  .filter {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
  }

  .filter-icon {
    position: absolute;
    left: 8px;
    display: inline-flex;
    color: var(--text-dim);
    pointer-events: none;
  }

  .filter-input {
    flex: 1;
    min-width: 0;
    height: 26px;
    padding-left: 26px;
    padding-right: 24px;
  }

  .clear {
    position: absolute;
    right: 3px;
    height: 20px;
    min-width: 20px;
    padding: 0;
    color: var(--text-dim);
  }

  .new-agent {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .summary {
    flex: none;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 0 8px 8px;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 22px;
    padding: 0 8px 0 5px;
    border: 1px solid var(--border);
    border-radius: 11px;
    background: transparent;
    color: var(--text-dim);
    font-size: 11px;
  }

  .pill.waiting {
    border-color: color-mix(in srgb, var(--warning) 45%, transparent);
    background: color-mix(in srgb, var(--warning) 10%, transparent);
    color: var(--text);
    cursor: pointer;
  }

  .list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0 8px 12px;
    outline: none;
    border-top: 1px solid var(--border);
  }

  .folder-heading {
    padding: 12px 4px 2px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-dim);
  }

  .project {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 28px;
    margin-top: 6px;
    padding: 0 4px;
    border-radius: 6px;
    color: var(--text);
    outline: none;
    cursor: default;
  }

  .project:hover {
    background: var(--hover);
  }

  .project.selected {
    background: var(--selected-inactive);
  }

  .list:focus-within .project.selected {
    background: var(--selected);
  }

  .project-name {
    flex: 0 1 auto;
    min-width: 0;
    font-weight: 600;
  }

  .no-chevron {
    flex: none;
    width: 12px;
  }

  .count {
    flex: none;
    min-width: 16px;
    height: 16px;
    padding: 0 5px;
    border-radius: 8px;
    font-size: 10px;
    line-height: 16px;
    text-align: center;
    color: var(--text-dim);
    background: var(--hover);
  }

  .spacer {
    flex: 1;
  }

  .hover-action {
    flex: none;
    width: 22px;
    height: 22px;
    min-width: 22px;
    padding: 0;
    color: var(--text-dim);
    visibility: hidden;
  }

  .project:hover .hover-action,
  .project.selected .hover-action,
  .card-head:hover .hover-action,
  .card.selected .hover-action,
  .hover-action:focus-visible {
    visibility: visible;
  }

  .card {
    margin: 4px 0 0 14px;
    padding: 4px 0;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--panel);
  }

  .card.selected {
    border-color: var(--accent);
  }

  .card.missing {
    opacity: 0.7;
  }

  .card-head {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 26px;
    padding: 0 4px 0 8px;
    outline: none;
    cursor: default;
  }

  .branch-mark {
    flex: none;
    display: inline-flex;
    width: 14px;
    justify-content: center;
    color: var(--text-dim);
  }

  .card-title {
    flex: 0 1 auto;
    min-width: 0;
    font-weight: 500;
  }

  .card.missing .card-title {
    text-decoration: line-through;
  }

  .tag {
    flex: none;
    height: 16px;
    padding: 0 5px;
    border-radius: 4px;
    font-size: 10px;
    line-height: 16px;
    color: var(--text-dim);
    background: var(--hover);
  }

  .tag.warn {
    color: var(--warning);
    background: color-mix(in srgb, var(--warning) 14%, transparent);
  }

  .card-sub {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    padding: 0 8px 4px 28px;
    font-size: 11px;
  }

  .agent {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 26px;
    margin: 0 4px;
    padding: 0 6px 0 4px;
    border-radius: 5px;
    outline: none;
    cursor: pointer;
  }

  .agent:hover {
    background: var(--hover);
  }

  .agent.active {
    background: var(--selected-inactive);
  }

  .agent.selected,
  .list:focus-within .agent.selected {
    background: var(--selected);
  }

  .badge {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 16px;
    border-radius: 4px;
    font-size: 9px;
    font-weight: 700;
    color: var(--text-dim);
    background: var(--hover);
  }

  .agent-text {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: 6px;
    overflow: hidden;
    white-space: nowrap;
  }

  .agent-title {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* The dimmed name gives way first, so the task stays readable. */
  .agent-name {
    flex: 0 100 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 11px;
  }

  .age {
    flex: none;
    font-size: 11px;
  }

  .empty,
  .notice {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 24px 16px;
    text-align: center;
    color: var(--text-dim);
    font-size: 12px;
  }

  .empty strong,
  .notice strong {
    color: var(--text);
  }

  .notice {
    margin-top: 12px;
    border: 1px dashed var(--border-strong);
    border-radius: 8px;
  }

  .hint {
    padding: 14px 4px;
    color: var(--text-dim);
    font-size: 12px;
    line-height: 1.5;
  }
</style>
