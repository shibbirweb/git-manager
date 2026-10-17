<!--
  Git or ssh needs a username, password, passphrase or a yes for a new host (askpass.rs). One
  question at a time; Cancel lets the git command fail as it did before. An urgent library Dialog: over every
  other dialog, and its keys never reach the window's shortcuts.
-->
<script lang="ts">
  import Button from "@nibtree/ui/components/Button.svelte";
  import CodeBlock from "@nibtree/ui/components/CodeBlock.svelte";
  import Dialog from "@nibtree/ui/components/Dialog.svelte";
  import Field from "@nibtree/ui/components/Field.svelte";
  import IconButton from "@nibtree/ui/components/IconButton.svelte";
  import Input from "@nibtree/ui/components/Input.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import { tick } from "svelte";
  import { askpass } from "./askpass.svelte";
  import { folderLabel, parsePrompt } from "./askpassPrompt";

  const question = $derived(askpass.current);
  const parsed = $derived(question ? parsePrompt(question.prompt) : null);
  const repoName = $derived(question ? folderLabel(question.repoPath) : "");

  let username = $state("");
  let secret = $state("");
  let reveal = $state(false);
  let firstField = $state<HTMLInputElement | null>(null);
  let confirmButton = $state<HTMLButtonElement | null>(null);
  const confirmLabel = $derived(
    parsed?.kind === "confirm"
      ? "Connect"
      : parsed?.kind === "username"
        ? "Sign In"
        : parsed?.kind === "passphrase"
          ? "Unlock"
          : "OK",
  );

  const title = $derived.by(() => {
    if (!parsed) {
      return "";
    }
    switch (parsed.kind) {
      case "username":
        return parsed.host ? `Sign in to ${parsed.host}` : "Sign In";
      case "password":
        return parsed.user && parsed.host ? `Password for ${parsed.user}@${parsed.host}` : "Password";
      case "passphrase":
        return "Unlock SSH Key";
      case "confirm":
        return parsed.host ? `Connect to ${parsed.host}?` : "Connect to This Host?";
      default:
        return "Git Needs an Answer";
    }
  });
  /** Hosting services take a token where git says password. */
  const tokenHint = $derived(
    parsed?.kind === "username" ||
      (parsed?.kind === "password" && parsed.host !== null && !parsed.text.includes("'s password")),
  );

  // A new question starts empty and takes the keyboard.
  $effect(() => {
    if (!question) {
      return;
    }
    username = "";
    secret = "";
    reveal = false;
    void tick().then(() => (firstField ?? confirmButton)?.focus());
  });

  function submit(): void {
    if (!question || !parsed) {
      return;
    }
    if (parsed.kind === "confirm") {
      askpass.answer(question.id, "yes");
    } else if (parsed.kind === "username") {
      const host = parsed.host;
      askpass.answer(question.id, username, host ? { host, user: username, value: secret } : null);
    } else {
      askpass.answer(question.id, secret);
    }
  }

  function cancel(): void {
    if (question) {
      askpass.cancel(question.id);
    }
  }
</script>

{#snippet revealButton()}
  <IconButton
    icon="eye"
    iconSize="normal"
    size="small"
    tone="dim"
    active={reveal}
    label={reveal ? "Hide password" : "Show password"}
    title={reveal ? "Hide" : "Show"}
    onclick={() => (reveal = !reveal)}
  />
{/snippet}

{#if question && parsed}
  <Dialog
    open
    urgent
    variant="form"
    width="small"
    {title}
    subtitle={repoName ? `git asks for this to continue in ${repoName}.` : ""}
    icon={parsed.kind === "confirm" ? "alert" : "lock"}
    iconTone={parsed.kind === "confirm" ? "warning" : "accent"}
    enterSubmits
    onclose={cancel}
    onsubmit={submit}
  >
    <Stack gap="md">
      {#if parsed.kind === "confirm"}
        <CodeBlock variant="detail" text={parsed.text} label="The question" />
      {:else}
        {#if parsed.kind === "username"}
          <Field label="Username">
            <Input
              width="fill"
              bind:value={username}
              bind:element={firstField}
              autocomplete="username"
              spellcheck="false"
              aria-label="Username"
            />
          </Field>
        {/if}
        {#if parsed.kind === "passphrase" && parsed.keyPath}
          <Text size="small" tone="dim" mono selectable wrap="anywhere">{parsed.keyPath}</Text>
        {/if}
        {#if parsed.kind === "other"}
          <Text selectable wrap="anywhere">{parsed.text}</Text>
        {/if}
        {@const answerLabel =
          parsed.kind === "passphrase" ? "Passphrase" : parsed.kind === "other" ? "Answer" : "Password"}
        <Field label={answerLabel}>
          <Stack direction="row" align="center" gap="xs">
            <Stack grow>
              {#if parsed.kind === "username"}
                <Input
                  width="fill"
                  type={reveal ? "text" : "password"}
                  bind:value={secret}
                  autocomplete="current-password"
                  spellcheck="false"
                  aria-label={answerLabel}
                />
              {:else}
                <Input
                  width="fill"
                  type={reveal || !parsed.secret ? "text" : "password"}
                  bind:value={secret}
                  bind:element={firstField}
                  autocomplete="current-password"
                  spellcheck="false"
                  aria-label={answerLabel}
                />
              {/if}
            </Stack>
            {#if parsed.secret || parsed.kind === "username"}
              {@render revealButton()}
            {/if}
          </Stack>
        </Field>
        {#if tokenHint}
          <Text size="small" tone="dim" element="p">
            GitHub, GitLab and Bitbucket take a personal access token or app password here, not your account password.
          </Text>
        {/if}
        {#if parsed.kind === "username"}
          <Text size="small" tone="dim" element="p">
            Git saves it with your credential helper, if one is set, so you are not asked again.
          </Text>
        {/if}
      {/if}
    </Stack>
    {#snippet actions()}
      <Button onclick={cancel}>Cancel</Button>
      <Button variant="primary" bind:element={confirmButton} onclick={submit}>{confirmLabel}</Button>
    {/snippet}
  </Dialog>
{/if}
