<!--
  Git or ssh needs a username, password, passphrase or a yes for a new host (askpass.rs). One
  question at a time; Cancel lets the git command fail as it did before.
-->
<script lang="ts">
  import { tick } from "svelte";
  import Icon from "$lib/ui/Icon.svelte";
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
  const tokenHint = $derived(parsed?.kind === "username" || (parsed?.kind === "password" && parsed.host !== null && !parsed.text.includes("'s password")));

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

  // Keys stay in the dialog, so window shortcuts never act behind it.
  function onKeydown(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  }
</script>

{#if question && parsed}
  <div class="overlay" role="presentation" onkeydown={onKeydown}>
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="askpass-title">
      <form
        onsubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div class="head">
          <span class="badge"><Icon name={parsed.kind === "confirm" ? "alert" : "lock"} size={15} /></span>
          <div class="head-text">
            <h2 id="askpass-title">{title}</h2>
            {#if repoName}
              <p class="dim">git asks for this to continue in {repoName}.</p>
            {/if}
          </div>
        </div>

        {#if parsed.kind === "confirm"}
          <pre class="prompt selectable">{parsed.text}</pre>
        {:else}
          {#if parsed.kind === "username"}
            <label class="field">
              <span>Username</span>
              <input bind:this={firstField} class="input" bind:value={username} autocomplete="username" spellcheck="false" />
            </label>
          {/if}
          {#if parsed.kind === "passphrase" && parsed.keyPath}
            <p class="key dim selectable">{parsed.keyPath}</p>
          {/if}
          {#if parsed.kind === "other"}
            <p class="prompt-line selectable">{parsed.text}</p>
          {/if}
          <label class="field">
            <span>{parsed.kind === "passphrase" ? "Passphrase" : parsed.kind === "other" ? "Answer" : "Password"}</span>
            <span class="secret-row">
              {#if parsed.kind === "username"}
                <input
                  class="input"
                  type={reveal ? "text" : "password"}
                  bind:value={secret}
                  autocomplete="current-password"
                  spellcheck="false"
                />
              {:else}
                <input
                  bind:this={firstField}
                  class="input"
                  type={reveal || !parsed.secret ? "text" : "password"}
                  bind:value={secret}
                  autocomplete="current-password"
                  spellcheck="false"
                />
              {/if}
              {#if parsed.secret || parsed.kind === "username"}
                <button
                  type="button"
                  class="icon-btn reveal"
                  class:on={reveal}
                  onclick={() => (reveal = !reveal)}
                  title={reveal ? "Hide" : "Show"}
                  aria-label={reveal ? "Hide password" : "Show password"}
                  aria-pressed={reveal}
                >
                  <Icon name="eye" size={14} />
                </button>
              {/if}
            </span>
          </label>
          {#if tokenHint}
            <p class="hint dim">GitHub, GitLab and Bitbucket take a personal access token or app password here, not your account password.</p>
          {/if}
          {#if parsed.kind === "username"}
            <p class="hint dim">Git saves it with your credential helper, if one is set, so you are not asked again.</p>
          {/if}
        {/if}

        <div class="actions">
          <button type="button" class="btn" onclick={cancel}>Cancel</button>
          <button bind:this={confirmButton} type="submit" class="btn primary">
            {parsed.kind === "confirm" ? "Connect" : parsed.kind === "username" ? "Sign In" : parsed.kind === "passphrase" ? "Unlock" : "OK"}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 950;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 14vh;
    background: var(--overlay);
  }

  .dialog {
    width: min(440px, calc(100vw - 32px));
    padding: 18px 20px 16px;
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    background: var(--panel);
    box-shadow: var(--shadow);
  }

  .head {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    margin-bottom: 14px;
  }

  .badge {
    flex: none;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    color: var(--accent);
  }

  .head-text {
    min-width: 0;
  }

  h2 {
    margin: 2px 0 2px;
    font-size: 14px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .head-text p {
    margin: 0;
    font-size: 12px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 12px;
  }

  .field .input {
    width: 100%;
  }

  .secret-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .secret-row .input {
    flex: 1;
    min-width: 0;
  }

  .reveal {
    flex: none;
    width: 28px;
    height: 28px;
    color: var(--text-dim);
  }

  .reveal.on {
    color: var(--accent);
  }

  .key,
  .prompt-line {
    margin: 0 0 12px;
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .prompt {
    max-height: 220px;
    overflow: auto;
    margin: 0 0 14px;
    padding: 10px;
    border-radius: 6px;
    background: var(--panel-alt);
    font-family: var(--font-mono);
    font-size: 11.5px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .hint {
    margin: -4px 0 10px;
    font-size: 12px;
    line-height: 1.45;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 6px;
  }
</style>
