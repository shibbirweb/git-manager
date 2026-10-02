<!-- The end of a GitHub action: what happened, and the page it made with Copy and Open. -->
<script lang="ts">
  import { errorMessage } from "$lib/api";
  import { toast } from "$lib/ui/toast.svelte";
  import { updates } from "$lib/update/updates.svelte";
  import GitDialogFrame from "../git/GitDialogFrame.svelte";
  import { closeGitHubDialog } from "./githubDialogs";

  interface Props {
    title: string;
    message: string;
    url: string | null;
    openLabel: string;
    problem: string | null;
  }

  let { title, message, url, openLabel, problem }: Props = $props();

  async function copy(): Promise<void> {
    if (!url) {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Copied link", url);
    } catch (error) {
      toast.error("Could not copy", errorMessage(error));
    }
  }

  async function open(): Promise<void> {
    if (url) {
      await updates.open(url);
    }
    closeGitHubDialog();
  }
</script>

<GitDialogFrame {title} width={520} onCancel={closeGitHubDialog} onSubmit={url ? () => void open() : undefined}>
  <div class="message">{message}</div>
  {#if problem}
    <div class="error selectable">{problem}</div>
  {/if}
  {#if url}
    <div class="command selectable">{url}</div>
  {/if}

  {#snippet footer()}
    {#if url}
      <button type="button" class="btn" onclick={() => void copy()}>Copy Link</button>
    {/if}
    <span class="spacer"></span>
    <button type="button" class={url ? "btn" : "btn primary"} onclick={closeGitHubDialog}>Close</button>
    {#if url}
      <button type="button" class="btn primary" onclick={() => void open()}>{openLabel}</button>
    {/if}
  {/snippet}
</GitDialogFrame>

<style>
  .message {
    line-height: 1.5;
  }
</style>
