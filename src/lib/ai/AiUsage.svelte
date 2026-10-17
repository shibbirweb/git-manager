<!-- The AI agents' usage in the status bar, like Orca: per agent a mark, a small bar for its fuller window and
     "78% 5h · 94% wk", warning from 80%. Click for the details: each window's bar and reset, Refresh and the
     settings. Logic in usageView.ts. -->
<script lang="ts">
  import IconButton from "@nibtree/ui/components/IconButton.svelte";
  import Link from "@nibtree/ui/components/Link.svelte";
  import Mark from "@nibtree/ui/components/Mark.svelte";
  import Meter from "@nibtree/ui/components/Meter.svelte";
  import Popover from "@nibtree/ui/components/Popover.svelte";
  import Spacer from "@nibtree/ui/components/Spacer.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import StatusItem from "@nibtree/ui/components/StatusItem.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { AI_USAGE_PROVIDERS } from "$lib/stores/settingsData";
  import type { ProviderUsage } from "$lib/types";
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

  const TONES = { ok: "accent", warn: "warning", full: "danger" } as const;
  const STATUS_WORDS: Record<ProviderUsage["status"], string> = {
    ok: "unavailable",
    signedOut: "signed out",
    noData: "no data",
    error: "unavailable",
  };

  function label(usage: ProviderUsage): string {
    return agentById(usage.provider)?.label ?? usage.provider;
  }

  function title(usage: ProviderUsage): string {
    const head = providerTitle(label(usage), usage);
    return usage.status === "ok"
      ? [head, ...windowLines(usage, now), "Click for details."].join("\n")
      : `${head}: ${usage.message ?? "no numbers"}`;
  }

  function updatedText(updatedAt: number | null, at: number): string {
    if (updatedAt === null) {
      return "";
    }
    const age = formatAge(at - updatedAt);
    return age === "now" ? "updated just now" : `updated ${age} ago`;
  }
</script>

{#if usageStore.shown.length > 0}
  <Popover
    bind:open
    label="AI usage details"
    placement="above"
    align={side === "left" ? "start" : "end"}
    width="medium"
    padding="panel"
    textSize="small"
  >
    {#snippet trigger({ toggle, open: shown })}
      <Stack direction="row" align="center" label="AI usage">
        {#each usageStore.shown as usage (usage.provider)}
          {@const tightest = tightestWindow(usage)}
          {@const level = tightest ? usageLevel(tightest.usedPercent) : "ok"}
          <StatusItem
            text={usage.status === "ok" && tightest ? usageText(usage, now) : STATUS_WORDS[usage.status]}
            title={title(usage)}
            tone={level === "full" ? "danger" : level === "warn" ? "warning" : "default"}
            open={shown}
            onclick={() => {
              now = Date.now();
              toggle();
            }}
          >
            {#snippet leading()}
              <Mark text={agentMark(usage.provider)} size="small" title={label(usage)} />
              {#if usage.status === "ok" && tightest}
                <Meter variant="mini" fraction={tightest.usedPercent / 100} tone={TONES[level]} />
              {/if}
            {/snippet}
          </StatusItem>
        {/each}
      </Stack>
    {/snippet}
    <Stack gap="sm">
      <Stack direction="row" align="center" gap="sm">
        <Text weight="semibold">AI usage</Text>
        <Text size="xsmall" tone="dim">{updatedText(usageStore.updatedAt, now)}</Text>
        <Spacer />
        <IconButton
          icon="refresh"
          iconSize="compact"
          size="small"
          label="Refresh usage"
          title="Refresh"
          disabled={usageStore.loading}
          onclick={() => void usageStore.refresh(true).then(() => (now = Date.now()))}
        />
      </Stack>
      {#each usageStore.shown as usage (usage.provider)}
        <Stack gap="sm" line="top" paddingY="sm">
          <Stack direction="row" align="center" gap="sm">
            <Mark text={agentMark(usage.provider)} size="small" />
            <Text weight="medium">{providerTitle(label(usage), usage)}</Text>
          </Stack>
          {#if usage.status === "ok"}
            {#each namedWindows(usage) as { long, window } (long)}
              <Meter
                variant="usage"
                label={long}
                value="{Math.round(window.usedPercent)}% used"
                fraction={window.usedPercent / 100}
                tone={TONES[usageLevel(window.usedPercent)]}
                detail={window.resetsAt === null ? "" : `Resets ${resetIn(window.resetsAt, now)}`}
              />
            {/each}
          {:else}
            <Text size="xsmall" tone="dim">{usage.message ?? "No usage numbers yet."}</Text>
          {/if}
        </Stack>
      {/each}
      <Link
        size="small"
        onclick={() => {
          open = false;
          settings.openDialog("ai");
        }}>Usage settings...</Link
      >
    </Stack>
  </Popover>
{/if}
