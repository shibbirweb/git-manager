<!-- Create Gist: the file on screen (or its selection) as a secret or public gist, with a
     preview of exactly what is uploaded. -->
<script lang="ts">
  import Button from "@nibtree/ui/components/Button.svelte";
  import CodeBlock from "@nibtree/ui/components/CodeBlock.svelte";
  import Dialog from "@nibtree/ui/components/Dialog.svelte";
  import Field from "@nibtree/ui/components/Field.svelte";
  import Input from "@nibtree/ui/components/Input.svelte";
  import Segmented from "@nibtree/ui/components/Segmented.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import { api, errorMessage } from "$lib/api";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import { closeGitHubDialog, openGitHubDialog } from "./githubDialogs";
  import { validateGistFileName } from "./githubModel";

  interface Props {
    fileName: string;
    content: string;
    fromSelection: boolean;
  }

  let { fileName: initialFileName, content, fromSelection }: Props = $props();

  /** The preview shows this much; the whole content is uploaded. */
  const PREVIEW_CHARS = 20_000;

  // svelte-ignore state_referenced_locally
  let fileName = $state(initialFileName);
  let description = $state("");
  let visibility = $state<"secret" | "public">("secret");
  const isPublic = $derived(visibility === "public");
  let working = $state(false);
  let problem = $state<string | null>(null);

  const fileNameError = $derived(validateGistFileName(fileName));
  const empty = $derived(content.trim() === "");
  const lineCount = $derived(content === "" ? 0 : content.split("\n").length);
  const sourceLabel = $derived(
    `${fromSelection ? "Selection" : "Whole file"}, ${lineCount} ${lineCount === 1 ? "line" : "lines"}`,
  );
  const preview = $derived(content.length > PREVIEW_CHARS ? `${content.slice(0, PREVIEW_CHARS)}\n...` : content);
  const canCreate = $derived(!working && fileNameError === null && !empty);

  function close(): void {
    if (!working) {
      closeGitHubDialog();
    }
  }

  async function submit(): Promise<void> {
    if (!canCreate) {
      return;
    }
    if (isPublic) {
      const confirmed = await dialogs.confirm({
        title: "Create Public Gist",
        message: "A public gist is listed on your profile and can be found by anyone. Create it as public?",
        confirmLabel: "Create Public",
        danger: true,
      });
      if (!confirmed) {
        return;
      }
    }
    working = true;
    problem = null;
    try {
      const gist = await api.githubCreateGist({
        fileName: fileName.trim(),
        description: description.trim(),
        public: isPublic,
        content,
      });
      openGitHubDialog({
        kind: "result",
        title: "Gist Created",
        message:
          `${isPublic ? "Public" : "Secret"} gist with ${fileName.trim()}.` +
          (isPublic ? "" : " Anyone with the link can see it."),
        url: gist.htmlUrl,
        openLabel: "Open Gist",
        problem: null,
      });
    } catch (error) {
      problem = errorMessage(error);
      working = false;
    }
  }
</script>

<Dialog
  open
  variant="form"
  title="Create Gist"
  width="large"
  dismissible={!working}
  onclose={close}
  onsubmit={() => void submit()}
>
  <Stack direction="row" align="start" gap="md">
    <Stack grow>
      <Field label="File name" look="compact" error={fileNameError || null}>
        <Input width="fill" bind:value={fileName} disabled={working} spellcheck="false" autocomplete="off" autofocus />
      </Field>
    </Stack>
    <Field label="Visibility" look="compact">
      <Segmented
        label="Gist visibility"
        variant="joined"
        disabled={working}
        bind:value={visibility}
        options={[
          { value: "secret", label: "Secret" },
          { value: "public", label: "Public" },
        ]}
      />
    </Field>
  </Stack>
  <Field label="Description" look="compact">
    <Input width="fill" bind:value={description} disabled={working} placeholder="Optional" autocomplete="off" />
  </Field>
  <Field label={sourceLabel} look="compact">
    <CodeBlock variant="preview" maxHeight="small" text={preview} label="Gist content" />
  </Field>
  {#if empty}
    <Text size="small" tone="danger">
      There is nothing to share: the {fromSelection ? "selection" : "file"} is empty.
    </Text>
  {/if}
  {#if problem}
    <Text size="small" tone="danger" selectable>{problem}</Text>
  {/if}

  {#snippet actions()}
    <Button onclick={close} disabled={working}>Cancel</Button>
    <Button variant="primary" disabled={!canCreate} onclick={() => void submit()}>
      {working ? "Creating..." : "Create Gist"}
    </Button>
  {/snippet}
</Dialog>
