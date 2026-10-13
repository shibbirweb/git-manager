<!-- The end of a GitHub action: what happened, and the page it made with Copy and Open. -->
<script lang="ts">
  import Button from "@git-manager/ui/components/Button.svelte";
  import CodeBlock from "@git-manager/ui/components/CodeBlock.svelte";
  import Dialog from "@git-manager/ui/components/Dialog.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import { errorMessage } from "$lib/api";
  import { toast } from "$lib/ui/toast.svelte";
  import { updates } from "$lib/update/updates.svelte";
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

<Dialog
  open
  variant="form"
  {title}
  width="normal"
  onclose={closeGitHubDialog}
  onsubmit={url ? () => void open() : undefined}
>
  <Text variant="paragraph">{message}</Text>
  {#if problem}
    <Text size="small" tone="danger" selectable>{problem}</Text>
  {/if}
  {#if url}
    <CodeBlock variant="command" text={url} label="Link" />
  {/if}

  {#snippet footnote()}
    {#if url}
      <Button onclick={() => void copy()}>Copy Link</Button>
    {/if}
  {/snippet}
  {#snippet actions()}
    <Button variant={url ? "default" : "primary"} onclick={closeGitHubDialog}>Close</Button>
    {#if url}
      <Button variant="primary" onclick={() => void open()}>{openLabel}</Button>
    {/if}
  {/snippet}
</Dialog>
