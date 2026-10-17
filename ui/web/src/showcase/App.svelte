<!-- The showcase: a sidebar of every component by group, and the open component's page. The address keeps the
     page (#Button), and the theme switch sets data-theme like the app. -->
<script lang="ts">
  import Segmented from "$ui/components/Segmented.svelte";
  import ComponentPage from "./ComponentPage.svelte";
  import Colors from "./foundations/Colors.svelte";
  import Layout from "./foundations/Layout.svelte";
  import Sizes from "./foundations/Sizes.svelte";
  import Typography from "./foundations/Typography.svelte";
  import { entries } from "./registry";

  type Theme = "system" | "light" | "dark";

  const GROUP_ORDER = [
    "Actions",
    "Forms",
    "Feedback",
    "Overlays",
    "Navigation",
    "Layout",
    "Editor",
    "Not documented yet",
  ];

  let current = $state(location.hash.slice(1) || (entries[0]?.name ?? ""));
  let filter = $state("");
  let theme = $state<Theme>("system");

  const shown = $derived(entries.filter((entry) => entry.name.toLowerCase().includes(filter.trim().toLowerCase())));
  const groups = $derived(
    GROUP_ORDER.map((group) => ({
      group,
      items: shown.filter((entry) => (entry.doc?.group ?? "Not documented yet") === group),
    })).filter((group) => group.items.length > 0),
  );
  const entry = $derived(entries.find((candidate) => candidate.name === current) ?? null);
  const FOUNDATIONS = ["Colors", "Typography", "Sizes", "Layout"];

  $effect(() => {
    if (theme === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
  });

  function open(name: string): void {
    current = name;
    history.replaceState(null, "", `#${name}`);
  }
</script>

<svelte:window onhashchange={() => (current = location.hash.slice(1))} />

<div class="shell">
  <nav class="sidebar" aria-label="Components">
    <div class="brand">Nibtree UI</div>
    <input class="filter" placeholder="Filter components" bind:value={filter} aria-label="Filter components" />
    <div class="list">
      <div class="group">Foundations</div>
      {#each FOUNDATIONS as page (page)}
        <button class="item" class:active={page === current} type="button" onclick={() => open(page)}>{page}</button>
      {/each}
      {#each groups as { group, items } (group)}
        <div class="group">{group}</div>
        {#each items as item (item.name)}
          <button class="item" class:active={item.name === current} type="button" onclick={() => open(item.name)}>
            {item.name}
          </button>
        {/each}
      {/each}
    </div>
    <div class="theme">
      <Segmented
        label="Theme"
        bind:value={theme}
        options={[
          { value: "system", label: "System" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
      />
    </div>
  </nav>
  <main class="page">
    {#if current === "Colors"}
      <Colors />
    {:else if current === "Typography"}
      <Typography />
    {:else if current === "Sizes"}
      <Sizes />
    {:else if current === "Layout"}
      <Layout />
    {:else if entry}
      {#key entry.name}
        <ComponentPage {entry} />
      {/key}
    {:else}
      <p class="empty">Pick a component on the left.</p>
    {/if}
  </main>
</div>

<style>
  .shell {
    display: flex;
    height: 100vh;
  }

  .sidebar {
    flex: none;
    width: 230px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 10px 10px;
    background: var(--panel-alt);
    border-right: 1px solid var(--border-strong);
  }

  .brand {
    padding: 0 6px;
    font-size: 15px;
    font-weight: 600;
  }

  .filter {
    height: 28px;
    padding: 0 8px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--panel);
    color: var(--text);
    font: inherit;
    outline: none;
  }

  .list {
    flex: 1;
    overflow-y: auto;
  }

  .group {
    padding: 12px 6px 4px;
    color: var(--text-faint);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .item {
    display: block;
    width: 100%;
    padding: 5px 8px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }

  .item:hover {
    background: var(--hover);
  }

  .item.active {
    background: var(--selected);
  }

  .theme {
    display: flex;
    justify-content: center;
  }

  .page {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    background: var(--panel);
  }

  .empty {
    padding: 40px;
    color: var(--text-dim);
  }
</style>
