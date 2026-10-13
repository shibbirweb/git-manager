<!-- The AI agents' usage in the status bar, like Orca: per agent a mark, a small bar for its fuller window and
     "78% 5h · 94% wk", warning from 80%. Click for the details: each window's bar and reset, Refresh and the
     settings. Logic in usageView.ts. -->
<script lang="ts">
  import { settings } from "$lib/stores/settings.svelte";
  import { AI_USAGE_PROVIDERS } from "$lib/stores/settingsData";
  import type { ProviderUsage } from "$lib/types";
  import Icon from "$lib/ui/Icon.svelte";
  import { agentById } from "./agents";
  import { agentMark, formatAge } from "./panelView";
  import { usageStore } from "./usageStore.svelte";
  import {
    namedWindows,
    providerTitle,
    resetIn,
    tightestWindow,
    usageLevel,
    usageText,
    windowLines,
  } from "./usageView";

  /** Which side of the status bar it sits on, so the details open toward the window. */
  let { side }: { side: "left" | "right" } = $props();

  let open = $state(false);
  let rootEl = $state<HTMLDivElement | null>(null);
  let now = $state(Date.now());

  const anyShown = $derived(settings.aiUsageHidden.length < AI_USAGE_PROVIDERS.length);

  // Polls only while at least one provider is shown.
  $effect(() => (anyShown ? usageStore.start() : undefined));

  // The time left until each reset counts down in the status bar.
  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(timer);
  });

  // A provider shown again in Settings is read at once (hidden ones were never read).
  let hiddenBefore = settings.aiUsageHidden;
  $effect(() => {
    const hidden = settings.aiUsageHidden;
    if (hidden !== hiddenBefore && hidden.length < hiddenBefore.length) {
      void usageStore.refresh();
    }
    hiddenBefore = hidden;
  });

  function label(usage: ProviderUsage): string {
    return agentById(usage.provider)?.label ?? usage.provider;
  }

  function title(usage: ProviderUsage): string {
    const head = providerTitle(label(usage), usage);
    return usage.status === "ok"
      ? [head, ...windowLines(usage, now), "Click for details."].join("\n")
      : `${head}: ${usage.message ?? "no numbers"}`;
  }

  function toggle(): void {
    open = !open;
    now = Date.now();
  }

  function updatedText(updatedAt: number | null, at: number): string {
    if (updatedAt === null) {
      return "";
    }
    const age = formatAge(at - updatedAt);
    return age === "now" ? "updated just now" : `updated ${age} ago`;
  }
</script>

<svelte:window
  onmousedown={(event) => {
    if (open && rootEl && !rootEl.contains(event.target as Node)) {
      open = false;
    }
  }}
  onkeydown={(event) => {
    if (event.key === "Escape" && open) {
      open = false;
    }
  }}
/>

{#if usageStore.shown.length > 0}
  <div class="usage" bind:this={rootEl} role="group" aria-label="AI usage">
    {#each usageStore.shown as usage (usage.provider)}
      {@const tightest = tightestWindow(usage)}
      {@const level = tightest ? usageLevel(tightest.usedPercent) : "ok"}
      <button
        class="usage-item {level}"
        class:dim={usage.status !== "ok"}
        title={title(usage)}
        aria-expanded={open}
        onclick={toggle}
      >
        <span class="mark">{agentMark(usage.provider)}</span>
        {#if usage.status === "ok" && tightest}
          <span class="bar" aria-hidden="true"
            ><span class="fill" style:width="{Math.max(4, tightest.usedPercent)}%"></span></span
          >
          <span class="text">{usageText(usage, now)}</span>
        {:else if usage.status === "signedOut"}
          <span>signed out</span>
        {:else if usage.status === "noData"}
          <span>no data</span>
        {:else}
          <span>unavailable</span>
        {/if}
      </button>
    {/each}

    {#if open}
      <div class="details" class:left={side === "left"} role="dialog" aria-label="AI usage details">
        <div class="details-head">
          <span>AI usage</span>
          <span class="dim updated">{updatedText(usageStore.updatedAt, now)}</span>
          <button
            class="icon-btn small"
            title="Refresh"
            aria-label="Refresh usage"
            disabled={usageStore.loading}
            onclick={() => void usageStore.refresh(true).then(() => (now = Date.now()))}
          >
            <Icon name="refresh" size={12} />
          </button>
        </div>
        {#each usageStore.shown as usage (usage.provider)}
          <div class="provider">
            <div class="provider-title">
              <span class="mark">{agentMark(usage.provider)}</span>
              {providerTitle(label(usage), usage)}
            </div>
            {#if usage.status === "ok"}
              {#each namedWindows(usage) as { long, window } (long)}
                {@const level = usageLevel(window.usedPercent)}
                <div class="window {level}">
                  <div class="window-row">
                    <span>{long}</span>
                    <span class="spacer"></span>
                    <strong>{Math.round(window.usedPercent)}% used</strong>
                  </div>
                  <div class="wide-bar" aria-hidden="true">
                    <div class="fill" style:width="{Math.max(2, window.usedPercent)}%"></div>
                  </div>
                  {#if window.resetsAt !== null}
                    <div class="dim reset">Resets {resetIn(window.resetsAt, now)}</div>
                  {/if}
                </div>
              {/each}
            {:else}
              <div class="dim message">{usage.message ?? "No usage numbers yet."}</div>
            {/if}
          </div>
        {/each}
        <button
          class="link"
          onclick={() => {
            open = false;
            settings.openDialog("ai");
          }}
        >
          Usage settings...
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .usage {
    position: relative;
    display: flex;
    align-items: center;
    min-width: 0;
  }

  /* The status bar's item look (its styles are scoped to StatusBar.svelte). */
  .usage-item {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 20px;
    padding: 0 7px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    font-size: 12px;
    white-space: nowrap;
    cursor: pointer;
  }

  .usage-item:hover {
    background: var(--hover);
  }

  .usage-item.dim {
    color: var(--text-dim);
  }

  .mark {
    flex: none;
    padding: 0 3px;
    border-radius: 3px;
    font-size: 9px;
    font-weight: 700;
    line-height: 13px;
    background: var(--hover);
  }

  .bar {
    flex: none;
    width: 32px;
    height: 4px;
    border-radius: 2px;
    background: var(--border);
    overflow: hidden;
  }

  .fill {
    display: block;
    height: 100%;
    border-radius: 2px;
    background: var(--accent);
  }

  .warn .fill {
    background: var(--warning);
  }

  .full .fill {
    background: var(--danger);
  }

  .warn .text,
  .warn strong {
    color: var(--warning);
  }

  .full .text,
  .full strong {
    color: var(--danger);
  }

  .details {
    position: absolute;
    right: 0;
    bottom: 26px;
    z-index: 600;
    width: 290px;
    padding: 12px 14px;
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    box-shadow: var(--shadow);
    color: var(--text);
    font-size: 12px;
  }

  .details.left {
    right: auto;
    left: 0;
  }

  .details-head {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
    font-weight: 600;
  }

  .updated {
    flex: 1;
    font-weight: 400;
    font-size: 11px;
  }

  .provider {
    padding: 8px 0;
    border-top: 1px solid var(--border);
  }

  .provider-title {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
    font-weight: 500;
  }

  .window {
    margin: 0 0 8px;
  }

  .window-row {
    display: flex;
    align-items: baseline;
  }

  .spacer {
    flex: 1;
  }

  .wide-bar {
    height: 6px;
    margin: 4px 0 2px;
    border-radius: 3px;
    background: var(--border);
    overflow: hidden;
  }

  .reset,
  .message {
    font-size: 11px;
  }

  .link {
    margin-top: 2px;
    padding: 0;
    border: none;
    background: none;
    color: var(--accent);
    font-size: 12px;
    cursor: pointer;
  }

  .link:hover {
    text-decoration: underline;
  }
</style>
