<!-- The vertical icon bar beside a side panel: one button per panel, the open one tinted with an accent line, and
     an optional count badge. Items after a `null` entry sit at the bottom. -->
<script lang="ts">
  import type { IconName } from "../icons";
  import Badge from "./Badge.svelte";
  import Icon from "./Icon.svelte";

  interface ActivityItem {
    id: string;
    icon: IconName;
    label: string;
    badge?: number;
  }

  interface Props {
    items: (ActivityItem | null)[];
    active?: string | null;
    label: string;
    side?: "left" | "right";
    onselect?: (id: string) => void;
  }

  let { items, active = $bindable(null), label, side = "left", onselect }: Props = $props();
</script>

<nav class="activity {side}" aria-label={label}>
  {#each items as item, index (item?.id ?? `spacer-${index}`)}
    {#if item === null}
      <div class="spacer"></div>
    {:else}
      <button
        class="item"
        class:active={item.id === active}
        type="button"
        aria-label={item.label}
        aria-pressed={item.id === active}
        title={item.label}
        onclick={() => {
          active = item.id;
          onselect?.(item.id);
        }}
      >
        <Icon name={item.icon} size={20} />
        {#if item.badge}
          <span class="badge"><Badge count={item.badge} /></span>
        {/if}
      </button>
    {/if}
  {/each}
</nav>

<style>
  .activity {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--activity-bar-gap);
    width: var(--activity-bar-width);
    padding: var(--activity-bar-padding) 0;
    background: var(--panel-alt);
    border-right: 1px solid var(--border-strong);
  }

  .right {
    border-right: none;
    border-left: 1px solid var(--border-strong);
  }

  .item {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--activity-bar-item);
    height: var(--activity-bar-item);
    border: none;
    border-radius: var(--activity-bar-radius);
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
  }

  .item:hover {
    color: var(--text);
    background: var(--hover);
  }

  .item.active {
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }

  .item.active::before {
    content: "";
    position: absolute;
    top: 8px;
    bottom: 8px;
    left: -4px;
    width: var(--activity-bar-indicator);
    border-radius: 2px;
    background: var(--accent);
  }

  .right .item.active::before {
    left: auto;
    right: -4px;
  }

  .spacer {
    flex: 1;
  }

  .badge {
    position: absolute;
    right: 1px;
    bottom: 3px;
    display: flex;
  }
</style>
