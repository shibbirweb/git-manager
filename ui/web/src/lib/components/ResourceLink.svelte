<!-- A large row that opens something to read or do, with an icon, a title and a line of description, like the
     Welcome page's Learn links. -->
<script lang="ts">
  import type { IconName } from "../icons";
  import Icon from "./Icon.svelte";

  interface Props {
    icon: IconName;
    title: string;
    description?: string;
    variant?: "plain" | "card";
    onclick: () => void;
  }

  let { icon, title, description = "", variant = "plain", onclick }: Props = $props();
</script>

<button class="resource {variant}" type="button" {onclick}>
  <Icon name={icon} size="xlarge" />
  <span class="lines">
    <span class="title">{title}</span>
    {#if description}<span class="description">{description}</span>{/if}
  </span>
</button>

<style>
  .resource {
    display: flex;
    align-items: center;
    gap: var(--resource-link-gap);
    min-height: var(--resource-link-min-height);
    padding: var(--resource-link-padding-y) var(--resource-link-padding-x);
    border: none;
    border-radius: var(--resource-link-radius);
    background: transparent;
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .resource:hover {
    background: var(--hover);
  }

  .resource :global(svg) {
    color: var(--text-dim);
  }

  .lines {
    display: flex;
    flex-direction: column;
    gap: var(--resource-link-lines-gap);
    min-width: 0;
  }

  .title {
    font-size: var(--font-size-medium);
    font-weight: var(--font-weight-semibold);
  }

  .description {
    color: var(--text-dim);
  }

  /* Settings' About links: a bordered card that turns accent on hover, its icon in the accent color. */
  .card {
    align-items: flex-start;
    gap: var(--resource-link-card-gap);
    min-height: 0;
    padding: var(--resource-link-card-padding-y) var(--resource-link-card-padding-x);
    border: 1px solid var(--border-strong);
    background: var(--panel);
  }

  .card:hover {
    border-color: var(--accent);
    background: var(--panel);
  }

  .card :global(svg) {
    margin-top: var(--space-1);
    color: var(--accent);
  }

  .card .lines {
    gap: var(--resource-link-card-lines-gap);
  }

  .card .title {
    font-size: inherit;
  }
</style>
