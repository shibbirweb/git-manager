<!-- Settings dialog. Every change is applied immediately and saved to ~/.gitmanager/settings.json. -->
<script lang="ts">
  import { errorMessage } from "$lib/api";
  import {
    DEFAULT_EDITOR_FONT,
    FONT_SIZE_RANGE,
    MONOSPACE_FONTS,
    normalizeFontFamily,
    type Preferences,
    settings,
    type SettingsSection,
    TAB_SIZES,
    type ThemeSetting,
  } from "$lib/stores/settings.svelte";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { updates } from "$lib/update/updates.svelte";

  const channels: { value: "auto" | "stable" | "beta"; label: string }[] = [
    { value: "auto", label: "Automatic" },
    { value: "stable", label: "Stable" },
    { value: "beta", label: "Beta" },
  ];

  function checkedLabel(): string {
    if (updates.checking) {
      return "Checking...";
    }
    if (updates.error) {
      return `Last check failed: ${updates.error}`;
    }
    if (!updates.checkedAt) {
      return "Not checked yet";
    }
    const minutes = Math.round((Date.now() - updates.checkedAt) / 60000);
    const when = minutes < 1 ? "just now" : minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} h ago`;
    if (updates.newer.length === 0) {
      return `Checked ${when}: up to date`;
    }
    return `Checked ${when}: ${updates.newer[0].version} is available${updates.newestSkipped ? " (skipped)" : ""}`;
  }

  const sections: { id: SettingsSection; label: string }[] = [
    { id: "appearance", label: "Appearance" },
    { id: "editor", label: "Editor" },
    { id: "merge", label: "Merge and Log" },
    { id: "layout", label: "Layout" },
    { id: "updates", label: "Updates" },
    { id: "files", label: "Settings Files" },
    { id: "about", label: "About" },
  ];

  const themes: { value: ThemeSetting; label: string }[] = [
    { value: "system", label: "System" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ];

  let section = $state<SettingsSection>(settings.dialogSection);

  // Dragging by the title areas. The offset is relative to the centered position.
  const KEEP_VISIBLE = 60;
  let dialogEl = $state<HTMLDivElement | null>(null);
  let offset = $state({ x: 0, y: 0 });
  let dragging = $state(false);
  let dragStart = { pointerX: 0, pointerY: 0, x: 0, y: 0, left: 0, top: 0, width: 0, height: 0 };

  function startDrag(event: PointerEvent): void {
    // Buttons and inputs inside the title areas keep working normally.
    if (event.button !== 0 || (event.target as HTMLElement).closest("button, input, a") || !dialogEl) {
      return;
    }
    event.preventDefault();
    const rect = dialogEl.getBoundingClientRect();
    dragStart = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: offset.x,
      y: offset.y,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
    dragging = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function drag(event: PointerEvent): void {
    if (!dragging) {
      return;
    }
    const dx = event.clientX - dragStart.pointerX;
    const dy = event.clientY - dragStart.pointerY;
    // Keep part of the dialog (and its title) on screen so it can always be grabbed again.
    const minDx = KEEP_VISIBLE - dragStart.left - dragStart.width;
    const maxDx = window.innerWidth - KEEP_VISIBLE - dragStart.left;
    const minDy = -dragStart.top;
    const maxDy = window.innerHeight - KEEP_VISIBLE - dragStart.top;
    offset = {
      x: dragStart.x + Math.min(maxDx, Math.max(minDx, dx)),
      y: dragStart.y + Math.min(maxDy, Math.max(minDy, dy)),
    };
  }

  function endDrag(event: PointerEvent): void {
    if (!dragging) {
      return;
    }
    dragging = false;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  }

  function recenter(event: MouseEvent): void {
    if (!(event.target as HTMLElement).closest("button, input, a")) {
      offset = { x: 0, y: 0 };
    }
  }
  /** Font list being typed; applied on Enter or when the field loses focus. */
  let fontDraft = $state(settings.editorFontFamily);

  function applyFont(): void {
    const next = normalizeFontFamily(fontDraft);
    fontDraft = next;
    if (next !== settings.editorFontFamily) {
      set("editorFontFamily", next);
    }
  }

  function addFont(family: string): void {
    const quoted = /\s/.test(family) ? `'${family}'` : family;
    fontDraft = normalizeFontFamily(`${quoted}, ${DEFAULT_EDITOR_FONT}`);
    applyFont();
  }

  function set<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
    settings.setPreference(key, value);
  }

  function close(): void {
    settings.dialogOpen = false;
  }

  async function reset(): Promise<void> {
    const ok = await dialogs.confirm({
      title: "Reset Settings",
      message: "Restore every setting to its default value?",
      confirmLabel: "Reset",
      danger: true,
    });
    if (ok) {
      settings.resetPreferences();
      toast.success("Settings reset to defaults");
    }
  }

  async function resetState(): Promise<void> {
    const ok = await dialogs.confirm({
      title: "Reset state.json",
      message: "Replace state.json with a fresh file? The recent folders, last session and panel sizes saved in it are lost.",
      confirmLabel: "Reset",
      danger: true,
    });
    if (ok) {
      settings.resetState();
      toast.success("state.json was reset");
    }
  }

  async function copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch (error) {
      toast.error("Could not copy", errorMessage(error));
    }
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && !dialogs.active && !event.defaultPrevented) {
      event.preventDefault();
      close();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="overlay" role="presentation" onmousedown={(event) => event.target === event.currentTarget && close()}>
  <div
    class="dialog"
    class:dragging
    role="dialog"
    aria-modal="true"
    aria-labelledby="settings-title"
    bind:this={dialogEl}
    style="transform: translate({offset.x}px, {offset.y}px)"
  >
    <nav class="nav" aria-label="Settings sections">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <h2
        id="settings-title"
        class="drag-handle"
        title="Drag to move, double-click to center"
        onpointerdown={startDrag}
        onpointermove={drag}
        onpointerup={endDrag}
        onpointercancel={endDrag}
        ondblclick={recenter}
      >
        Settings
      </h2>
      {#each sections as item (item.id)}
        <button class="nav-item" class:active={section === item.id} onclick={() => (section = item.id)}>
          {item.label}
        </button>
      {/each}
      <div class="nav-spacer"></div>
      <button class="nav-item reset" onclick={reset}>Reset to Defaults</button>
    </nav>

    <div class="content">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="content-head drag-handle"
        title="Drag to move, double-click to center"
        onpointerdown={startDrag}
        onpointermove={drag}
        onpointerup={endDrag}
        onpointercancel={endDrag}
        ondblclick={recenter}
      >
        <h3>{sections.find((item) => item.id === section)?.label}</h3>
        <button class="icon-btn" onclick={close} aria-label="Close settings"><Icon name="x" size={15} /></button>
      </div>

      {#if settings.loadError}
        <div class="error-banner">
          <Icon name="alert" size={15} />
          <div>
            <strong>settings.json could not be read</strong>, so defaults are in use and it will not be overwritten.
            <div class="dim selectable">{settings.loadError}</div>
          </div>
          <button class="btn small" onclick={() => void settings.reload()}>Try Again</button>
        </div>
      {/if}
      {#if settings.stateLoadError}
        <div class="error-banner">
          <Icon name="alert" size={15} />
          <div>
            <strong>state.json could not be read</strong>, so recent folders and panel sizes start empty and it will not be
            overwritten.
            <div class="dim selectable">{settings.stateLoadError}</div>
          </div>
          <div class="banner-actions">
            <button class="btn small" onclick={() => void settings.reloadState()}>Try Again</button>
            <button class="btn small danger" onclick={() => void resetState()}>Reset</button>
          </div>
        </div>
      {/if}

      <div class="rows">
        {#if section === "appearance"}
          <div class="row">
            <div class="label">
              <span>Theme</span>
              <span class="hint">System follows the macOS appearance.</span>
            </div>
            <div class="segmented" role="radiogroup" aria-label="Theme">
              {#each themes as theme (theme.value)}
                <button
                  role="radio"
                  aria-checked={settings.theme === theme.value}
                  class:on={settings.theme === theme.value}
                  onclick={() => set("theme", theme.value)}
                >
                  {theme.label}
                </button>
              {/each}
            </div>
          </div>
          <div class="row">
            <div class="label">
              <span>Interface font size</span>
              <span class="hint">Menus, lists and buttons.</span>
            </div>
            <div class="range">
              <input
                type="range"
                min={FONT_SIZE_RANGE.ui[0]}
                max={FONT_SIZE_RANGE.ui[1]}
                step="0.5"
                value={settings.uiFontSize}
                oninput={(event) => set("uiFontSize", Number(event.currentTarget.value))}
                aria-label="Interface font size"
              />
              <span class="value">{settings.uiFontSize}px</span>
            </div>
          </div>
        {:else if section === "editor"}
          <div class="row stacked">
            <div class="label">
              <span>Editor font family</span>
              <span class="hint">
                A comma-separated list, like VS Code's <code>editor.fontFamily</code>. The first installed font is used;
                <code>monospace</code> is always added as the last fallback.
              </span>
            </div>
            <div class="font-row">
              <input
                class="input font-input"
                list="monospace-fonts"
                spellcheck="false"
                autocomplete="off"
                bind:value={fontDraft}
                onchange={applyFont}
                onkeydown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyFont();
                  }
                }}
                aria-label="Editor font family"
              />
              <datalist id="monospace-fonts">
                {#each MONOSPACE_FONTS as family (family)}
                  <option value={family}></option>
                {/each}
              </datalist>
              {#if settings.editorFontFamily !== DEFAULT_EDITOR_FONT}
                <button
                  class="btn small"
                  onclick={() => {
                    fontDraft = DEFAULT_EDITOR_FONT;
                    applyFont();
                  }}
                >
                  Reset
                </button>
              {/if}
            </div>
            <div class="font-picks">
              {#each MONOSPACE_FONTS as family (family)}
                <button class="font-pick" style="font-family: '{family}', monospace" onclick={() => addFont(family)} title="Use {family}">
                  {family}
                </button>
              {/each}
            </div>
            <pre class="font-preview code-ligatures" style="font-family: {normalizeFontFamily(fontDraft)}; font-size: {settings.editorFontSize}px">function greet(name: string) &#123;
  return `Hello, $&#123;name&#125;!`; // 0O 1lI =&gt; != ===
&#125;</pre>
          </div>
          <div class="row">
            <div class="label">
              <span>Editor font size</span>
              <span class="hint">Code in the editor, diffs and the merge tool.</span>
            </div>
            <div class="range">
              <input
                type="range"
                min={FONT_SIZE_RANGE.editor[0]}
                max={FONT_SIZE_RANGE.editor[1]}
                step="0.5"
                value={settings.editorFontSize}
                oninput={(event) => set("editorFontSize", Number(event.currentTarget.value))}
                aria-label="Editor font size"
              />
              <span class="value">{settings.editorFontSize}px</span>
            </div>
          </div>
          <label class="row toggle-row">
            <div class="label">
              <span>Change font size with Ctrl + mouse wheel</span>
              <span class="hint">
                Hold Control (or Command) and scroll over an editor, diff or merge pane to make the code bigger or smaller.
                A trackpad pinch works too.
              </span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.mouseWheelZoom}
              onchange={(event) => set("mouseWheelZoom", event.currentTarget.checked)}
            />
          </label>
          <label class="row toggle-row">
            <div class="label">
              <span>Font ligatures</span>
              <span class="hint">
                Draw <code>=&gt;</code>, <code>!=</code>, <code>===</code> and similar as single glyphs. Needs a font with
                ligatures such as Fira Code, JetBrains Mono or Cascadia Code; Menlo has none.
              </span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.fontLigatures}
              onchange={(event) => set("fontLigatures", event.currentTarget.checked)}
            />
          </label>
          <div class="row">
            <div class="label">
              <span>Tab size</span>
              <span class="hint">Spaces per indent level. Applies to editors opened from now on.</span>
            </div>
            <div class="segmented" role="radiogroup" aria-label="Tab size">
              {#each TAB_SIZES as size (size)}
                <button role="radio" aria-checked={settings.tabSize === size} class:on={settings.tabSize === size} onclick={() => set("tabSize", size)}>
                  {size}
                </button>
              {/each}
            </div>
          </div>
          <label class="row toggle-row">
            <div class="label">
              <span>Word wrap</span>
              <span class="hint">Wrap long lines in the file editor. Diffs and the merge tool never wrap so their panes stay aligned.</span>
            </div>
            <input type="checkbox" class="switch" checked={settings.wordWrap} onchange={(event) => set("wordWrap", event.currentTarget.checked)} />
          </label>
          <label class="row toggle-row">
            <div class="label">
              <span>Current line blame</span>
              <span class="hint">Show the author, age and commit of the cursor line at its end, like VS Code with GitLens. Click it to show the commit in the Log; Option-click copies the commit hash.</span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.currentLineBlame}
              onchange={(event) => set("currentLineBlame", event.currentTarget.checked)}
            />
          </label>
          <label class="row toggle-row">
            <div class="label">
              <span>Blame gutter</span>
              <span class="hint">A column with the commit, author and age of every block of lines. Also toggled with the Blame button in the editor and diff toolbars.</span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.blameGutter}
              onchange={(event) => set("blameGutter", event.currentTarget.checked)}
            />
          </label>
        {:else if section === "merge"}
          <label class="row toggle-row">
            <div class="label">
              <span>Ignore whitespace in the merge tool</span>
              <span class="hint">Start merges with whitespace-only differences hidden. The Ignore whitespace button in the merge tool changes this setting too.</span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.ignoreWhitespace}
              onchange={(event) => set("ignoreWhitespace", event.currentTarget.checked)}
            />
          </label>
          <label class="row toggle-row">
            <div class="label">
              <span>Show all branches in the log</span>
              <span class="hint">Include every local and remote branch, like <code>git log --all</code>.</span>
            </div>
            <input type="checkbox" class="switch" checked={settings.logAllRefs} onchange={(event) => set("logAllRefs", event.currentTarget.checked)} />
          </label>
        {:else if section === "layout"}
          <label class="row toggle-row">
            <div class="label">
              <span>Files panel</span>
              <span class="hint">Show the file tree on the right.</span>
            </div>
            <input type="checkbox" class="switch" checked={settings.explorerOpen} onchange={() => settings.toggleExplorer()} />
          </label>
          <div class="row">
            <div class="label">
              <span>Left sidebar</span>
              <span class="hint">Also toggled from the activity bar or with Cmd+B.</span>
            </div>
            <div class="segmented" role="radiogroup" aria-label="Left sidebar">
              {#each [{ value: "changes", label: "Changes" }, { value: "branches", label: "Branches" }, { value: null, label: "Hidden" }] as const as option (option.label)}
                <button
                  role="radio"
                  aria-checked={settings.leftPanel === option.value}
                  class:on={settings.leftPanel === option.value}
                  onclick={() => settings.setLeftPanel(option.value)}
                >
                  {option.label}
                </button>
              {/each}
            </div>
          </div>
        {:else if section === "updates"}
          <div class="row">
            <div class="label">
              <span>Version</span>
              <span class="hint">{checkedLabel()}</span>
            </div>
            <div class="update-actions">
              <code class="path">{updates.current ?? "unknown"}</code>
              <button class="btn small" onclick={() => void updates.check(true)} disabled={updates.checking}>Check Now</button>
            </div>
          </div>
          <label class="row toggle-row">
            <div class="label">
              <span>Check for updates automatically</span>
              <span class="hint">Asks GitHub for new releases every few hours. Nothing is downloaded or installed without you.</span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.checkForUpdates}
              onchange={(event) => set("checkForUpdates", event.currentTarget.checked)}
            />
          </label>
          <div class="row">
            <div class="label">
              <span>Update channel</span>
              <span class="hint">
                Stable gets finished releases only. Beta also gets pre-releases with new features to try early.
                Automatic follows betas only when this build is a beta. Now following: <strong>{updates.channel}</strong>.
              </span>
            </div>
            <div class="segmented" role="radiogroup" aria-label="Update channel">
              {#each channels as option (option.value)}
                <button
                  role="radio"
                  aria-checked={settings.updateChannel === option.value}
                  class:on={settings.updateChannel === option.value}
                  onclick={() => {
                    set("updateChannel", option.value);
                    void updates.check(false);
                  }}
                >
                  {option.label}
                </button>
              {/each}
            </div>
          </div>
          <div class="row">
            <div class="label">
              <span>Release notes</span>
              <span class="hint">What changed in this version, from the changelog built into the app.</span>
            </div>
            <div class="update-actions">
              <button class="btn small" onclick={() => (updates.whatsNewOpen = true)}>What's New</button>
              <button class="btn small" onclick={() => void updates.openReleasesPage()}>All Releases</button>
            </div>
          </div>
          {#if settings.skippedVersion}
            <div class="row">
              <div class="label">
                <span>Skipped version</span>
                <span class="hint">{settings.skippedVersion} is not announced.</span>
              </div>
              <button class="btn small" onclick={() => updates.unskip()}>Announce Again</button>
            </div>
          {/if}
        {:else if section === "about"}
          <div class="about">
            <div class="about-logo"><Icon name="merge" size={26} /></div>
            <div>
              <div class="about-name">Git Manager</div>
              <div class="dim">Version {updates.current ?? "unknown"} &middot; {updates.channel} channel</div>
            </div>
          </div>
          <div class="link-list">
            <button class="link-row" onclick={() => void updates.openRepository()}>
              <Icon name="star" size={15} />
              <span>
                <strong>Star on GitHub</strong>
                <span class="hint">Like Git Manager? A star helps other people find it.</span>
              </span>
            </button>
            <button class="link-row" onclick={() => void updates.reportBug()}>
              <Icon name="bug" size={15} />
              <span>
                <strong>Report a Bug</strong>
                <span class="hint">Opens a GitHub issue with your version and system filled in.</span>
              </span>
            </button>
            <button class="link-row" onclick={() => void updates.requestFeature()}>
              <Icon name="lightbulb" size={15} />
              <span>
                <strong>Request a Feature</strong>
                <span class="hint">Suggest an idea or an improvement.</span>
              </span>
            </button>
            <button class="link-row" onclick={() => (updates.whatsNewOpen = true)}>
              <Icon name="history" size={15} />
              <span>
                <strong>Release Notes</strong>
                <span class="hint">What changed in this version.</span>
              </span>
            </button>
          </div>
        {:else if section === "files"}
          <div class="row stacked">
            <div class="label">
              <span>Settings folder</span>
              <span class="hint">
                Git Manager keeps its files here, like VS Code's <code>~/.vscode</code>. You can edit
                <code>settings.json</code> by hand; <code>state.json</code> remembers recent folders and panel sizes.
              </span>
            </div>
            <div class="path-row">
              <code class="path selectable">{settings.configDir ?? "~/.gitmanager"}</code>
              {#if settings.configDir}
                <button class="btn small" onclick={() => void copy(`${settings.configDir}/settings.json`)}>Copy settings.json Path</button>
              {/if}
            </div>
          </div>
          <div class="row stacked">
            <div class="label">
              <span>Changed from defaults</span>
            </div>
            <ul class="changed">
              {#each settings.changedPreferences() as key (key)}
                <li><code>{key}</code>: {String(settings.preferences()[key])}</li>
              {:else}
                <li class="dim">Nothing yet</li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 850;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 8vh;
    background: var(--overlay);
  }

  .dialog {
    width: min(760px, calc(100vw - 32px));
    height: min(520px, 84vh);
    display: flex;
    overflow: hidden;
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: 12px;
    box-shadow: var(--shadow);
  }

  .drag-handle {
    cursor: grab;
    user-select: none;
  }

  .dialog.dragging,
  .dialog.dragging .drag-handle {
    cursor: grabbing;
  }

  .dialog.dragging {
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.32);
  }

  .nav {
    flex: none;
    width: 190px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 16px 10px 12px;
    background: var(--panel-alt);
    border-right: 1px solid var(--border-strong);
  }

  h2 {
    margin: 0 8px 12px;
    font-size: 15px;
  }

  .nav-item {
    padding: 6px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    text-align: left;
    cursor: pointer;
  }

  .nav-item:hover {
    background: var(--hover);
  }

  .nav-item.active {
    background: var(--selected);
    font-weight: 500;
  }

  .nav-spacer {
    flex: 1;
  }

  .nav-item.reset {
    color: var(--danger);
    font-size: 12px;
  }

  .content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .content-head {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 12px 8px 22px;
  }

  h3 {
    margin: 0;
    font-size: 14px;
  }

  .rows {
    flex: 1;
    overflow-y: auto;
    padding: 4px 22px 20px;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
  }

  .row.stacked {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .toggle-row {
    cursor: pointer;
  }

  .label {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .label > span:first-child {
    font-weight: 500;
  }

  .hint {
    font-size: 12px;
    color: var(--text-dim);
    line-height: 1.45;
  }

  .segmented {
    flex: none;
    display: flex;
    padding: 2px;
    border-radius: 7px;
    background: var(--panel-alt);
    border: 1px solid var(--border-strong);
  }

  .segmented button {
    padding: 4px 12px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
  }

  .segmented button.on {
    background: var(--panel);
    color: var(--text);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.14);
  }

  .range {
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .range input {
    width: 160px;
    accent-color: var(--accent);
  }

  .value {
    width: 46px;
    text-align: right;
    font-family: var(--font-mono);
    font-size: 12px;
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
    background: #fff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
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

  .font-row {
    display: flex;
    gap: 8px;
  }

  .font-input {
    flex: 1;
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .font-picks {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .font-pick {
    padding: 2px 8px;
    border: 1px solid var(--border-strong);
    border-radius: 12px;
    background: var(--panel);
    font-size: 12px;
    cursor: pointer;
  }

  .font-pick:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .font-preview {
    margin: 0;
    padding: 10px 12px;
    border-radius: 6px;
    background: var(--editor-bg);
    border: 1px solid var(--border-strong);
    line-height: 1.55;
    white-space: pre;
    overflow-x: auto;
  }

  .about {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 8px 0 16px;
  }

  .about-logo {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background: var(--accent);
    color: var(--accent-text);
  }

  .about-name {
    font-size: 16px;
    font-weight: 700;
  }

  .link-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .link-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    background: var(--panel);
    text-align: left;
    cursor: pointer;
  }

  .link-row:hover {
    border-color: var(--accent);
  }

  .link-row :global(svg) {
    margin-top: 2px;
    color: var(--accent);
  }

  .link-row > span {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .update-actions {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .path-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .path {
    padding: 4px 8px;
    border-radius: 5px;
    background: var(--panel-alt);
    font-size: 12px;
  }

  code {
    font-family: var(--font-mono);
    font-size: 0.92em;
  }

  .changed {
    margin: 0;
    padding-left: 18px;
    font-size: 12.5px;
    line-height: 1.7;
  }

  .error-banner {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin: 0 22px 8px;
    padding: 10px 12px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--danger) 10%, var(--panel));
    color: var(--text);
    font-size: 12.5px;
  }

  .error-banner :global(svg) {
    color: var(--danger);
    margin-top: 1px;
  }

  .error-banner > div {
    flex: 1;
    min-width: 0;
  }

  .error-banner > .banner-actions {
    flex: none;
    display: flex;
    gap: 6px;
  }
</style>
