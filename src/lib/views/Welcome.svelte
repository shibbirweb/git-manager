<!--
  The welcome screen, laid out like the JetBrains one: a sidebar with Projects, Customize and
  Learn, and the recent projects as one searchable list with a colored badge each.
-->
<script lang="ts">
  import { revealItemInDir } from "@tauri-apps/plugin-opener";
  import { tick } from "svelte";
  import { helpDialogs } from "$lib/help/helpDialogs.svelte";
  import { platformFromUserAgent } from "$lib/menu/menuSpec";
  import { FONT_SIZE_RANGE, settings, type ThemeSetting } from "$lib/stores/settings.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import { contextMenu, type MenuItem } from "$lib/ui/menu.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { platformName, WIKI_URL } from "$lib/update/releases";
  import { updates } from "$lib/update/updates.svelte";
  import { openCloneDialog } from "./git/gitMenuActions";
  import { revealLabel } from "./files/reveal";
  import { type RecentEntry, recentEntries } from "./recentEntries";
  import { openRecent, openRecentInNewWindow, pickAndOpenInNewWindow, pickAndOpenRepo, pickAndOpenWorkspaceFile } from "./repoPicker";
  import ColorThemePicker from "./settings/ColorThemePicker.svelte";
  import { badgeColor, entryKey, entryPaths, entrySubtitle, filterEntries, moveSelection, projectInitials } from "./welcomeModel";

  type Section = "projects" | "customize" | "learn";

  const SECTIONS: { id: Section; label: string }[] = [
    { id: "projects", label: "Projects" },
    { id: "customize", label: "Customize" },
    { id: "learn", label: "Learn" },
  ];

  const THEMES: { value: ThemeSetting; label: string }[] = [
    { value: "system", label: "System" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ];

  const newWindowKey = platformFromUserAgent(navigator.userAgent) === "macos" ? "Cmd" : "Ctrl";
  const REVEAL_LABEL = revealLabel(platformName(navigator.userAgent));

  let section = $state<Section>("projects");
  let query = $state("");
  let selected = $state(0);
  let searchEl = $state<HTMLInputElement | null>(null);
  let listEl = $state<HTMLUListElement | null>(null);

  const entries = $derived(
    recentEntries(
      {
        recentWorkspaceFiles: settings.recentWorkspaceFiles,
        recentWorkspaces: settings.recentWorkspaces,
        recentRepos: settings.recentRepos,
      },
      null,
    ),
  );
  const shown = $derived(filterEntries(entries, query));
  const empty = $derived(entries.length === 0 && !settings.stateLoadError);

  // A new search starts at the top; a shorter list keeps the selection inside it.
  $effect(() => {
    void query;
    selected = 0;
  });
  $effect(() => {
    if (selected >= shown.length) {
      selected = Math.max(0, shown.length - 1);
    }
  });

  function open(entry: RecentEntry, newWindow: boolean): void {
    void (newWindow ? openRecentInNewWindow(entry) : openRecent(entry));
  }

  function remove(entry: RecentEntry): void {
    if (entry.kind === "workspaceFile") {
      settings.removeRecentWorkspaceFile(entry.filePath);
    } else if (entry.kind === "workspace") {
      settings.removeRecentWorkspace(entry.folderPaths);
    } else {
      settings.removeRecent(entry.folderPath);
    }
  }

  function copyPaths(entry: RecentEntry): void {
    navigator.clipboard
      .writeText(entryPaths(entry).join("\n"))
      .then(() => toast.success("Path copied"))
      .catch(() => toast.error("Could not copy the path"));
  }

  function entryItems(entry: RecentEntry): MenuItem[] {
    const paths = entryPaths(entry);
    return [
      { label: "Open", action: () => open(entry, false) },
      { label: "Open in New Window", action: () => open(entry, true) },
      { separator: true },
      ...(paths.length === 1
        ? [{ label: REVEAL_LABEL, action: () => void revealItemInDir(paths[0]).catch(() => toast.error("Could not show it")) }]
        : []),
      { label: paths.length === 1 ? "Copy Path" : "Copy Paths", action: () => copyPaths(entry) },
      { separator: true },
      { label: "Remove from Recent Projects", action: () => remove(entry) },
    ];
  }

  function moreItems(): MenuItem[] {
    return [
      { label: "Open Workspace from File...", action: () => void pickAndOpenWorkspaceFile() },
      { label: "Open Folder in New Window...", action: () => void pickAndOpenInNewWindow() },
    ];
  }

  async function revealSelected(): Promise<void> {
    await tick();
    listEl?.querySelector<HTMLElement>(".row.selected")?.scrollIntoView({ block: "nearest" });
  }

  /** The search field keeps the keyboard: arrows pick a project, Enter opens it, Delete forgets it. */
  function onSearchKeydown(event: KeyboardEvent): void {
    const next = moveSelection(selected, event.key, shown.length);
    if (next !== null && (event.key.startsWith("Arrow") || query === "")) {
      event.preventDefault();
      selected = next;
      void revealSelected();
      return;
    }
    const entry = shown[selected];
    if (event.key === "Enter" && entry) {
      event.preventDefault();
      open(entry, event.metaKey || event.ctrlKey);
    } else if (event.key === "Escape" && query !== "") {
      event.preventDefault();
      query = "";
    } else if ((event.key === "Delete" || (event.key === "Backspace" && event.metaKey)) && query === "" && entry) {
      event.preventDefault();
      remove(entry);
    }
  }

  function showSection(next: Section): void {
    section = next;
    if (next === "projects") {
      void tick().then(() => searchEl?.focus());
    }
  }
</script>

<main class="welcome">
  <nav class="sidebar" aria-label="Welcome">
    <div class="brand">
      <div class="logo"><Icon name="merge" size={22} /></div>
      <div class="brand-text">
        <span class="app-name">Git Manager</span>
        {#if updates.current}
          <span class="version">{updates.current}</span>
        {/if}
      </div>
    </div>
    <div class="sections" role="tablist" aria-orientation="vertical">
      {#each SECTIONS as item (item.id)}
        <button
          class="section"
          class:active={section === item.id}
          role="tab"
          aria-selected={section === item.id}
          onclick={() => showSection(item.id)}
        >
          {item.label}
        </button>
      {/each}
    </div>
    <div class="sidebar-links">
      <button class="sidebar-link" onclick={() => void updates.openRepository()}>
        <Icon name="star" size={14} />
        Star on GitHub
      </button>
      <button class="sidebar-link" onclick={() => void updates.reportBug()}>
        <Icon name="bug" size={14} />
        Report a Bug
      </button>
      <button class="sidebar-link" onclick={() => void updates.requestFeature()}>
        <Icon name="lightbulb" size={14} />
        Request a Feature
      </button>
    </div>
    <div class="sidebar-foot">
      <button class="icon-btn" title="Settings" aria-label="Settings" onclick={() => settings.openDialog()}>
        <Icon name="settings" size={15} />
      </button>
    </div>
  </nav>

  <section class="content" role="tabpanel">
    {#if section === "projects"}
      {#if empty}
        <div class="hello">
          <div class="logo big"><Icon name="merge" size={34} /></div>
          <h1>Welcome to Git Manager</h1>
          <p class="dim">Open a folder with one repository, many repositories, or none yet.<br />Or clone one from a server.</p>
          <div class="tiles">
            <button class="tile" onclick={pickAndOpenRepo}>
              <span class="tile-icon"><Icon name="folder" size={24} /></span>
              Open
            </button>
            <button class="tile" onclick={openCloneDialog}>
              <span class="tile-icon"><Icon name="cloud-download" size={24} /></span>
              Clone Repository
            </button>
            <button class="tile" onclick={() => void pickAndOpenWorkspaceFile()}>
              <span class="tile-icon"><Icon name="folder-git" size={24} /></span>
              Open Workspace
            </button>
          </div>
        </div>
      {:else}
        <div class="toolbar">
          <label class="search">
            <Icon name="search" size={15} />
            <!-- svelte-ignore a11y_autofocus -->
            <input
              bind:this={searchEl}
              bind:value={query}
              placeholder="Search projects"
              aria-label="Search projects"
              spellcheck="false"
              autocomplete="off"
              autofocus
              onkeydown={onSearchKeydown}
            />
          </label>
          <button class="btn" title="Open Folder..." onclick={pickAndOpenRepo}>Open</button>
          <button class="btn" title="Clone Repository..." onclick={openCloneDialog}>Clone</button>
          <button class="icon-btn more" title="More actions" aria-label="More actions" onclick={(event) => contextMenu.open(event, moreItems())}>
            <Icon name="more" size={15} />
          </button>
        </div>

        {#if settings.stateLoadError}
          <p class="notice">
            <Icon name="alert" size={13} />
            <span>Recent projects could not be loaded because state.json could not be read.</span>
            <button class="link" onclick={() => settings.openDialog("files")}>Open Settings</button>
          </p>
        {/if}

        <ul class="projects" bind:this={listEl} aria-label="Recent projects">
          {#each shown as entry, index (entryKey(entry))}
            <li class="row" class:selected={index === selected}>
              <button
                class="project"
                title="{newWindowKey}+click to open in a new window"
                onclick={(event) => open(entry, event.metaKey || event.ctrlKey)}
                onmouseenter={() => (selected = index)}
                oncontextmenu={(event) => contextMenu.open(event, entryItems(entry))}
              >
                <span class="badge badge-{badgeColor(entryKey(entry))}" aria-hidden="true">{projectInitials(entry.label)}</span>
                <span class="text">
                  <span class="name truncate">{entry.label}</span>
                  <span class="path dim truncate">{entrySubtitle(entry)}</span>
                </span>
              </button>
              <button
                class="icon-btn row-menu"
                title="Project actions"
                aria-label="Actions for {entry.label}"
                onclick={(event) => contextMenu.open(event, entryItems(entry))}
              >
                <Icon name="more" size={16} />
              </button>
            </li>
          {:else}
            {#if query}
              <li class="nothing dim">No recent project matches "{query}".</li>
            {/if}
          {/each}
        </ul>
      {/if}
    {:else if section === "customize"}
      <div class="page">
        <h2>Customize</h2>
        <div class="field">
          <span class="field-label">Theme</span>
          <div class="segmented" role="radiogroup" aria-label="Theme">
            {#each THEMES as theme (theme.value)}
              <button
                role="radio"
                aria-checked={settings.theme === theme.value}
                class:on={settings.theme === theme.value}
                onclick={() => settings.setTheme(theme.value)}
              >
                {theme.label}
              </button>
            {/each}
          </div>
        </div>
        <div class="field stacked">
          {#key settings.colorMode}
            <ColorThemePicker
              mode={settings.colorMode}
              selectedId={settings.colorMode === "dark" ? settings.darkColorTheme : settings.lightColorTheme}
              active
              onSelect={(themeId) => settings.setColorTheme(settings.colorMode, themeId)}
            />
          {/key}
        </div>
        <div class="field">
          <span class="field-label">Interface font size</span>
          <div class="range">
            <input
              type="range"
              min={FONT_SIZE_RANGE.ui[0]}
              max={FONT_SIZE_RANGE.ui[1]}
              step="0.5"
              value={settings.uiFontSize}
              oninput={(event) => settings.setPreference("uiFontSize", Number(event.currentTarget.value))}
              aria-label="Interface font size"
            />
            <span class="value">{settings.uiFontSize}px</span>
          </div>
        </div>
        <div class="field">
          <span class="field-label">Editor font size</span>
          <div class="range">
            <input
              type="range"
              min={FONT_SIZE_RANGE.editor[0]}
              max={FONT_SIZE_RANGE.editor[1]}
              step="0.5"
              value={settings.editorFontSize}
              oninput={(event) => settings.setPreference("editorFontSize", Number(event.currentTarget.value))}
              aria-label="Editor font size"
            />
            <span class="value">{settings.editorFontSize}px</span>
          </div>
        </div>
        <label class="field">
          <span class="field-label">Rounded panels</span>
          <input
            type="checkbox"
            class="switch"
            checked={settings.roundedPanels}
            onchange={(event) => settings.setPreference("roundedPanels", event.currentTarget.checked)}
          />
        </label>
        <button class="link all-settings" onclick={() => settings.openDialog()}>All settings...</button>
      </div>
    {:else}
      <div class="page">
        <h2>Learn</h2>
        <div class="learn">
          <button class="learn-item" onclick={() => void updates.open(WIKI_URL)}>
            <Icon name="book" size={18} />
            <span class="text">
              <span class="name">Documentation</span>
              <span class="dim">A guide to every feature, on the GitHub wiki.</span>
            </span>
          </button>
          <button class="learn-item" onclick={() => helpDialogs.openShortcuts()}>
            <Icon name="keyboard" size={18} />
            <span class="text">
              <span class="name">Keyboard Shortcuts</span>
              <span class="dim">Every key, grouped by menu, with a filter.</span>
            </span>
          </button>
          <button class="learn-item" onclick={() => (updates.whatsNewOpen = true)}>
            <Icon name="bell" size={18} />
            <span class="text">
              <span class="name">What's New</span>
              <span class="dim">The changes in this version.</span>
            </span>
          </button>
        </div>
      </div>
    {/if}
  </section>
</main>

<style>
  /* Sizes follow the JetBrains welcome screen: a 240 px sidebar, 36 px rows in it, 32 px controls and 56 px project rows. */
  .welcome {
    height: 100vh;
    display: flex;
    background: var(--panel);
  }

  .sidebar {
    flex: none;
    width: 240px;
    display: flex;
    flex-direction: column;
    padding: 20px 12px 14px;
    background: var(--panel-alt);
    border-right: 1px solid var(--border);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 10px 26px;
  }

  .logo {
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent);
    color: var(--accent-text);
  }

  .logo.big {
    width: 72px;
    height: 72px;
    border-radius: 18px;
  }

  .brand-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .app-name {
    font-size: calc(var(--ui-size) + 2px);
    font-weight: 600;
  }

  .version {
    font-size: calc(var(--ui-size) - 1px);
    color: var(--text-dim);
  }

  .sections {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .section {
    display: flex;
    align-items: center;
    height: 36px;
    padding: 0 12px;
    border: none;
    border-radius: var(--radius);
    background: transparent;
    color: var(--text);
    font-size: var(--ui-size);
    text-align: left;
    cursor: pointer;
  }

  .section:hover {
    background: var(--hover);
  }

  .section.active {
    background: var(--selected);
  }

  /* The GitHub links stay in sight on every page, above the gear. */
  .sidebar-links {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-bottom: 10px;
  }

  .sidebar-link {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 30px;
    padding: 0 12px;
    border: none;
    border-radius: var(--radius);
    background: transparent;
    color: var(--text-dim);
    text-align: left;
    cursor: pointer;
  }

  .sidebar-link:hover {
    background: var(--hover);
    color: var(--text);
  }

  .sidebar-foot {
    display: flex;
    padding: 10px 6px 0;
    border-top: 1px solid var(--border);
  }

  .sidebar-foot .icon-btn {
    width: 30px;
    height: 30px;
  }

  .content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    padding: 22px 26px 16px;
    overflow: hidden;
  }

  /* Projects */

  .toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 18px;
  }

  .search {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 0 12px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--editor-bg);
    color: var(--text-dim);
  }

  .search:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent);
  }

  .search input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    color: var(--text);
    font: inherit;
  }

  .toolbar .btn {
    height: 32px;
    padding: 0 16px;
  }

  .toolbar .more {
    width: 32px;
    height: 32px;
  }

  .projects {
    flex: 1;
    min-height: 0;
    overflow: auto;
    list-style: none;
    margin: 0 -8px;
    padding: 0;
  }

  .row {
    display: flex;
    align-items: center;
    border-radius: 8px;
  }

  .row.selected {
    background: var(--hover);
  }

  .project {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 56px;
    padding: 10px 12px;
    border: none;
    background: transparent;
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }

  .badge {
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-text);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.03em;
  }

  /* Solid like JetBrains' badges, from the theme's terminal colors so every color theme tints them,
     darkened a little towards its terminal black so the white letters read and the colors stay calm. */
  .badge-blue {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--term-bright-blue) 88%, var(--term-black)),
      color-mix(in srgb, var(--term-blue) 72%, var(--term-black))
    );
  }

  .badge-green {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--term-bright-green) 88%, var(--term-black)),
      color-mix(in srgb, var(--term-green) 72%, var(--term-black))
    );
  }

  .badge-magenta {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--term-bright-magenta) 88%, var(--term-black)),
      color-mix(in srgb, var(--term-magenta) 72%, var(--term-black))
    );
  }

  .badge-cyan {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--term-bright-cyan) 88%, var(--term-black)),
      color-mix(in srgb, var(--term-cyan) 72%, var(--term-black))
    );
  }

  .badge-red {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--term-bright-red) 88%, var(--term-black)),
      color-mix(in srgb, var(--term-red) 72%, var(--term-black))
    );
  }

  .text {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .name {
    font-size: calc(var(--ui-size) + 0.5px);
    font-weight: 600;
  }

  .path {
    font-size: calc(var(--ui-size) - 1px);
  }

  .row-menu {
    flex: none;
    width: 30px;
    height: 30px;
    visibility: hidden;
    margin-right: 10px;
  }

  .row.selected .row-menu,
  .row-menu:focus-visible {
    visibility: visible;
  }

  .nothing {
    padding: 16px 12px;
  }

  .notice {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 14px;
    padding: 10px 12px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--danger) 10%, var(--panel));
  }

  .notice :global(svg) {
    flex: none;
    color: var(--danger);
  }

  .notice span {
    flex: 1;
  }

  .link {
    padding: 0;
    border: none;
    background: transparent;
    color: var(--accent);
    font: inherit;
    cursor: pointer;
  }

  .link:hover {
    color: var(--accent-hover);
  }

  /* No projects yet */

  .hello {
    margin: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 12px;
    padding: 32px;
  }

  .hello h1 {
    margin: 14px 0 0;
    font-size: 22px;
    font-weight: 600;
  }

  .hello p {
    margin: 0;
    line-height: 1.6;
  }

  .tiles {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 32px;
    margin-top: 30px;
  }

  .tile {
    width: 112px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--text);
    cursor: pointer;
  }

  .tile-icon {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border-strong);
    background: var(--panel-alt);
    color: var(--text);
    transition:
      border-color 0.12s,
      color 0.12s;
  }

  .tile:hover .tile-icon,
  .tile:focus-visible .tile-icon {
    border-color: var(--accent);
    color: var(--accent);
  }

  /* Customize and Learn */

  .page {
    min-height: 0;
    max-width: 600px;
    overflow-x: hidden;
    overflow-y: auto;
    padding-right: 6px;
  }

  h2 {
    margin: 4px 0 22px;
    font-size: calc(var(--ui-size) + 5px);
    font-weight: 600;
  }

  .field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    min-height: 32px;
    margin-bottom: 18px;
  }

  .field.stacked {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .field-label {
    color: var(--text);
  }

  .segmented {
    display: flex;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .segmented button {
    height: 30px;
    padding: 0 16px;
    border: none;
    background: transparent;
    color: var(--text);
    cursor: pointer;
  }

  .segmented button + button {
    border-left: 1px solid var(--border-strong);
  }

  .segmented button.on {
    background: var(--accent);
    color: var(--accent-text);
  }

  .range {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .range input {
    width: 180px;
  }

  .value {
    width: 48px;
    text-align: right;
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }

  .switch {
    flex: none;
    appearance: none;
    position: relative;
    width: 34px;
    height: 20px;
    margin: 0;
    border-radius: 10px;
    background: var(--border-strong);
    cursor: pointer;
    transition: background 0.15s;
  }

  .switch::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--accent-text);
    box-shadow: 0 1px 2px color-mix(in srgb, var(--text) 25%, transparent);
    transition: transform 0.15s;
  }

  .switch:checked {
    background: var(--accent);
  }

  .switch:checked::after {
    transform: translateX(14px);
  }

  .switch:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--accent) 45%, transparent);
    outline-offset: 2px;
  }

  .all-settings {
    margin-top: 6px;
  }

  .learn {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .learn-item {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 56px;
    padding: 10px 12px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }

  .learn-item:hover {
    background: var(--hover);
  }

  .learn-item :global(svg) {
    flex: none;
    color: var(--text-dim);
  }
</style>
