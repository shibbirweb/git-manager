<!-- A color theme list for one mode (light or dark), grouped by kind, with a swatch per theme.
     Selection follows the arrow keys and applies and saves at once, like a radio group. -->
<script lang="ts">
  import { onMount } from "svelte";
  import type { ThemeSwatch } from "$lib/themes/catalog";
  import { type ColorMode, pickerMove, themeGroups } from "$lib/themes/themeIndex";

  interface Props {
    mode: ColorMode;
    selectedId: string;
    /** This mode is the one in use right now. */
    active: boolean;
    onSelect: (themeId: string) => void;
  }

  let { mode, selectedId, active, onSelect }: Props = $props();

  const groups = $derived(themeGroups(mode));
  const themes = $derived(groups.flatMap((group) => group.themes));
  const labelId = $derived(`color-theme-${mode}-label`);

  // Swatches come from the catalog, loaded when this list shows; they go with the component.
  let swatches = $state.raw<Record<string, ThemeSwatch>>({});
  let list = $state<HTMLDivElement | null>(null);

  onMount(() => {
    let cancelled = false;
    void import("$lib/themes/catalog")
      .then((catalog) => {
        if (cancelled) {
          return;
        }
        const next: Record<string, ThemeSwatch> = {};
        for (const theme of themes) {
          const swatch = catalog.themeSwatch(theme.id);
          if (swatch) {
            next[theme.id] = swatch;
          }
        }
        swatches = next;
      })
      .catch(() => {
        // Without swatches the names still work.
      });
    return () => {
      cancelled = true;
    };
  });

  function optionId(themeId: string): string {
    return `color-theme-${mode}-${themeId}`;
  }

  function select(themeId: string): void {
    if (themeId !== selectedId) {
      onSelect(themeId);
    }
    requestAnimationFrame(() => {
      list?.querySelector(`#${CSS.escape(optionId(themeId))}`)?.scrollIntoView({ block: "nearest" });
    });
  }

  function onKeydown(event: KeyboardEvent): void {
    const index = themes.findIndex((theme) => theme.id === selectedId);
    const next = pickerMove(index, event.key, themes.length);
    if (next === null) {
      return;
    }
    event.preventDefault();
    select(themes[next].id);
  }

  function onClick(event: MouseEvent): void {
    const option = (event.target as HTMLElement).closest<HTMLElement>("[data-theme-id]");
    const themeId = option?.dataset.themeId ?? null;
    if (themeId) {
      select(themeId);
    }
  }
</script>

<div class="picker">
  <div class="head">
    <span id={labelId} class="title">{mode === "dark" ? "Dark theme" : "Light theme"}</span>
    {#if active}
      <span class="badge">In use</span>
    {/if}
  </div>
  <div
    class="list"
    role="listbox"
    tabindex="0"
    aria-labelledby={labelId}
    aria-activedescendant={optionId(selectedId)}
    bind:this={list}
    onkeydown={onKeydown}
    onclick={onClick}
  >
    {#each groups as group (group.label)}
      {#if group.themes.length > 0}
        <div role="group" aria-label={group.label}>
          <div class="group-label" aria-hidden="true">{group.label}</div>
          {#each group.themes as theme (theme.id)}
            {@const swatch = swatches[theme.id] ?? null}
            <div
              id={optionId(theme.id)}
              class="option"
              class:selected={theme.id === selectedId}
              role="option"
              aria-selected={theme.id === selectedId}
              data-theme-id={theme.id}
            >
              <span
                class="swatch"
                aria-hidden="true"
                style={swatch
                  ? `--sw-bg: ${swatch.background}; --sw-fg: ${swatch.foreground}; --sw-keyword: ${swatch.keyword}; --sw-string: ${swatch.string}; --sw-selection: ${swatch.selection}; --sw-accent: ${swatch.accent}; --sw-border: ${swatch.border}`
                  : ""}
              >
                {#if swatch}
                  <span class="sample"><span class="kw">fn</span> <span class="sel">Aa</span></span>
                  <span class="bars">
                    <span class="bar keyword"></span>
                    <span class="bar string"></span>
                    <span class="bar accent"></span>
                  </span>
                {/if}
              </span>
              <span class="name truncate">{theme.name}</span>
            </div>
          {/each}
        </div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .picker {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 18px;
  }

  .title {
    font-weight: 500;
  }

  .badge {
    padding: 1px 6px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    color: var(--accent);
    font-size: 11px;
  }

  .list {
    height: 236px;
    overflow-y: auto;
    padding: 4px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--panel);
    outline: none;
  }

  .list:focus-visible {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent);
  }

  .group-label {
    padding: 6px 6px 3px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 6px;
    border-radius: 5px;
    cursor: pointer;
  }

  .option:hover {
    background: var(--hover);
  }

  .option.selected {
    background: var(--selected-inactive);
  }

  .list:focus .option.selected {
    background: var(--selected);
  }

  .name {
    min-width: 0;
  }

  .swatch {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    width: 64px;
    height: 22px;
    padding: 0 4px;
    border: 1px solid var(--sw-border, var(--border-strong));
    border-radius: 4px;
    background: var(--sw-bg, var(--panel-alt));
    font-family: var(--font-mono);
    font-size: 10px;
    line-height: 1;
  }

  .sample {
    color: var(--sw-fg);
    white-space: nowrap;
  }

  .kw {
    color: var(--sw-keyword);
  }

  .sel {
    padding: 0 1px;
    background: var(--sw-selection);
  }

  .bars {
    display: flex;
    gap: 2px;
  }

  .bar {
    width: 4px;
    height: 12px;
    border-radius: 2px;
  }

  .bar.keyword {
    background: var(--sw-keyword);
  }

  .bar.string {
    background: var(--sw-string);
  }

  .bar.accent {
    background: var(--sw-accent);
  }
</style>
