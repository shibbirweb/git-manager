<!-- Help > Available MCP Tools: every tool AI agents can use, with a switch each, and the recent
     calls. Lazy-loaded by App.svelte and mounted only while open. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import type { McpToolInfo } from "$lib/types";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import { mcpStore } from "./mcpStore.svelte";
  import { filterTools, groupTools, toolBadge, toolCountLabel, toolEnabled, withToolStates } from "./toolStates";

  let filter = $state("");
  let filterEl = $state<HTMLInputElement | null>(null);

  const tools = $derived(mcpStore.tools);
  const shown = $derived(filterTools(tools, filter));
  const groups = $derived(groupTools(shown));
  const enabledCount = $derived(tools.filter((tool) => toolEnabled(tool, settings.mcpTools)).length);
  const recent = $derived([...mcpStore.activity].reverse());
  const status = $derived(mcpStore.status);
  const statusLine = $derived.by(() => {
    if (mcpStore.statusError) {
      return "The server is not available in this build.";
    }
    if (!status) {
      return "Checking...";
    }
    if (status.error) {
      return status.error;
    }
    if (status.running) {
      return `Running at ${status.url}`;
    }
    return "Off. Turn it on in Settings > Automation.";
  });

  onMount(() => {
    void mcpStore.refreshStatus();
    void mcpStore.loadTools();
    void mcpStore.loadActivity();
    const stop = mcpStore.followActivity();
    filterEl?.focus();
    return stop;
  });

  function close(): void {
    mcpStore.toolsDialogOpen = false;
  }

  function openSettings(): void {
    close();
    settings.openDialog("automation");
  }

  /** Turning on destructive tools in bulk asks first: they run commands or change files without asking. */
  async function setMany(list: McpToolInfo[], enabled: boolean): Promise<void> {
    const risky = enabled ? list.filter((tool) => tool.destructive && !toolEnabled(tool, settings.mcpTools)) : [];
    if (risky.length > 0) {
      const ok = await dialogs.confirm({
        title: "Turn On Destructive Tools",
        message: `This turns on ${risky.length === 1 ? "1 destructive tool" : `${risky.length} destructive tools`} (${risky
          .map((tool) => tool.title)
          .join(", ")}). Agents can then use them without asking you.`,
        confirmLabel: "Turn On",
        danger: true,
      });
      if (!ok) {
        return;
      }
    }
    settings.setPreference("mcpTools", withToolStates(settings.mcpTools, list, enabled));
  }

  function setOne(tool: McpToolInfo, enabled: boolean): void {
    settings.setPreference("mcpTools", withToolStates(settings.mcpTools, [tool], enabled));
  }

  function timeOf(at: number): string {
    return new Date(at).toLocaleTimeString();
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
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="mcp-tools-title">
    <div class="head">
      <div class="title-row">
        <h2 id="mcp-tools-title">Available MCP Tools</h2>
        <button class="icon-btn" onclick={close} aria-label="Close"><Icon name="x" size={15} /></button>
      </div>
      <div class="status">
        <span class="dot" class:on={status?.running} class:error={!!status?.error || !!mcpStore.statusError}></span>
        <span class="selectable">{statusLine}</span>
        <span class="count">{toolCountLabel(enabledCount, tools.length)}</span>
      </div>
      <p class="hint">These switches apply to MCP clients and to the command line tool. Destructive tools start off.</p>
    </div>

    <div class="toolbar">
      <input class="input filter" placeholder="Filter tools" bind:value={filter} bind:this={filterEl} aria-label="Filter tools" />
      <button class="btn small" onclick={() => void setMany(shown, true)} disabled={shown.length === 0}>Turn All On</button>
      <button class="btn small" onclick={() => void setMany(shown, false)} disabled={shown.length === 0}>Turn All Off</button>
      <button class="btn small" onclick={openSettings}>Settings...</button>
    </div>

    <div class="body">
      {#if mcpStore.toolsError}
        <p class="hint notice">Only the app window's tools are listed: {mcpStore.toolsError}</p>
      {/if}
      {#each groups as group (group.category)}
        <section>
          <div class="group-head">
            <h3>{group.category}</h3>
            <span class="dim">{group.tools.filter((tool) => toolEnabled(tool, settings.mcpTools)).length} of {group.tools.length}</span>
            <div class="spacer"></div>
            <button class="link" onclick={() => void setMany(group.tools, true)}>Turn All On</button>
            <button class="link" onclick={() => void setMany(group.tools, false)}>Turn All Off</button>
          </div>
          {#each group.tools as tool (tool.name)}
            {@const badge = toolBadge(tool)}
            <label class="tool">
              <div class="tool-text">
                <div class="tool-title">
                  <span class="name">{tool.title}</span>
                  <code class="selectable">{tool.name}</code>
                  <span class="badge" class:danger={badge === "destructive"} class:write={badge === "can change files"}>{badge}</span>
                </div>
                <span class="description">{tool.description}</span>
              </div>
              <input
                type="checkbox"
                class="switch"
                checked={toolEnabled(tool, settings.mcpTools)}
                onchange={(event) => setOne(tool, event.currentTarget.checked)}
                aria-label="Use {tool.title}"
              />
            </label>
          {/each}
        </section>
      {:else}
        <p class="dim empty">{tools.length === 0 ? "Loading tools..." : "No tool matches the filter."}</p>
      {/each}

      <section class="recent">
        <div class="group-head">
          <h3>Recent calls</h3>
        </div>
        {#each recent as call, index (`${call.at}-${call.tool}-${index}`)}
          <div class="call" title={call.error ?? ""}>
            <span class="call-state" class:failed={!call.ok}>{call.ok ? "ok" : "error"}</span>
            <code class="call-tool">{call.tool}</code>
            <span class="client">{call.client === "cli" ? "CLI" : "MCP"}</span>
            <span class="dim">{timeOf(call.at)}</span>
            <span class="dim duration">{call.durationMs} ms</span>
            {#if call.error}
              <span class="call-error truncate">{call.error}</span>
            {/if}
          </div>
        {:else}
          <p class="dim empty">No calls yet.</p>
        {/each}
      </section>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 855;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 7vh;
    background: var(--overlay);
  }

  .dialog {
    width: min(760px, calc(100vw - 32px));
    max-height: 84vh;
    display: flex;
    flex-direction: column;
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: 12px;
    box-shadow: var(--shadow);
  }

  .head {
    padding: 14px 16px 8px 20px;
  }

  .title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h2 {
    margin: 0;
    font-size: 15px;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
    font-size: 12.5px;
  }

  .dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-faint);
  }

  .dot.on {
    background: var(--success);
  }

  .dot.error {
    background: var(--danger);
  }

  .count {
    margin-left: auto;
    color: var(--text-dim);
  }

  .hint {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--text-dim);
  }

  .notice {
    margin: 8px 0;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 20px 10px;
    border-bottom: 1px solid var(--border-strong);
  }

  .filter {
    flex: 1;
    min-width: 0;
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 4px 20px 16px;
  }

  section {
    padding-top: 10px;
  }

  .group-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    border-bottom: 1px solid var(--border);
  }

  h3 {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-dim);
  }

  .spacer {
    flex: 1;
  }

  .link {
    padding: 0;
    border: none;
    background: transparent;
    color: var(--accent);
    font-size: 12px;
    cursor: pointer;
  }

  .tool {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 9px 0;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
  }

  .tool-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .tool-title {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .name {
    font-weight: 500;
  }

  code {
    font-family: var(--font-mono);
    font-size: 11.5px;
    color: var(--text-dim);
  }

  .badge {
    padding: 0 6px;
    border-radius: 8px;
    font-size: 11px;
    line-height: 17px;
    background: color-mix(in srgb, var(--success) 14%, transparent);
    color: var(--success);
  }

  .badge.write {
    background: color-mix(in srgb, var(--warning) 16%, transparent);
    color: var(--warning);
  }

  .badge.danger {
    background: color-mix(in srgb, var(--danger) 14%, transparent);
    color: var(--danger);
  }

  .description {
    font-size: 12px;
    color: var(--text-dim);
    line-height: 1.45;
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

  .empty {
    margin: 10px 0;
    font-size: 12.5px;
  }

  .call {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px 0;
    border-bottom: 1px solid var(--border);
    font-size: 12px;
  }

  .call-state {
    flex: none;
    width: 38px;
    color: var(--success);
  }

  .call-state.failed {
    color: var(--danger);
  }

  .call-tool {
    color: var(--text);
  }

  .client {
    padding: 0 5px;
    border-radius: 4px;
    background: var(--panel-alt);
    font-size: 11px;
  }

  .duration {
    min-width: 54px;
    text-align: right;
  }

  .call-error {
    flex: 1;
    min-width: 0;
    color: var(--danger);
  }
</style>
