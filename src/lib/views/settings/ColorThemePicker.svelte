<!-- A color theme list for one mode (light or dark), grouped by kind, with a swatch per theme.
     Selection follows the arrow keys and applies and saves at once, like a radio group. -->
<script lang="ts">
  import { onMount } from "svelte";
  import type { ThemeSwatch as Swatch } from "@nibtree/ui/themes/catalog";
  import { type ColorMode, type ThemeInfo, themeGroups } from "@nibtree/ui/themes/themeIndex";
  import OptionList from "@nibtree/ui/components/OptionList.svelte";
  import Pill from "@nibtree/ui/components/Pill.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import ThemeSwatch from "@nibtree/ui/components/ThemeSwatch.svelte";

  interface Props {
    mode: ColorMode;
    selectedId: string;
    /** This mode is the one in use right now. */
    active: boolean;
    onSelect: (themeId: string) => void;
  }

  let { mode, selectedId, active, onSelect }: Props = $props();

  const groups = $derived(
    themeGroups(mode)
      .filter((group) => group.themes.length > 0)
      .map((group) => ({ label: group.label, options: group.themes })),
  );
  const title = $derived(mode === "dark" ? "Dark theme" : "Light theme");

  // Swatches come from the catalog, loaded when this list shows; they go with the component.
  let swatches = $state.raw<Record<string, Swatch>>({});

  onMount(() => {
    let cancelled = false;
    void import("@nibtree/ui/themes/catalog")
      .then((catalog) => {
        if (cancelled) {
          return;
        }
        const next: Record<string, Swatch> = {};
        for (const theme of groups.flatMap((group) => group.options)) {
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
</script>

{#snippet option(theme: ThemeInfo)}
  {@const swatch = swatches[theme.id] ?? null}
  {#if swatch}<ThemeSwatch colors={swatch} label={theme.name} />{/if}
  <Text truncate>{theme.name}</Text>
{/snippet}

<Stack gap="sm">
  <Stack direction="row" align="center" gap="md">
    <Text weight="medium">{title}</Text>
    {#if active}
      <Pill tone="accent">In use</Pill>
    {/if}
  </Stack>
  <OptionList
    label={title}
    {groups}
    optionKey={(theme) => theme.id}
    value={selectedId}
    {option}
    onpick={(theme) => {
      if (theme.id !== selectedId) {
        onSelect(theme.id);
      }
    }}
  />
</Stack>
