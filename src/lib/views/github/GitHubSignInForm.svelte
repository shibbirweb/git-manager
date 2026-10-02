<!-- The GitHub account: who is signed in (with Sign Out), or the ways to sign in: a personal
     access token (sent once to Rust, which verifies it and keeps it in the keychain) or the
     GitHub CLI's own login. Used by Settings > GitHub and the sign-in dialog. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { errorMessage } from "$lib/api";
  import type { GitHubAccount } from "$lib/types";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { updates } from "$lib/update/updates.svelte";
  import { githubAccount } from "./githubAccount.svelte";
  import { accountInitials, missingScopesHint, TOKEN_URL } from "./githubModel";

  interface Props {
    onSignedIn?: (account: GitHubAccount) => void;
  }

  let { onSignedIn }: Props = $props();

  // Held only while typed: cleared as soon as it is sent.
  let token = $state("");
  let working = $state<"token" | "cli" | "signOut" | null>(null);
  let problem = $state<string | null>(null);

  const account = $derived(githubAccount.account);
  const cli = $derived(githubAccount.cli);
  const scopeHint = $derived(missingScopesHint(account));

  onMount(() => {
    void githubAccount.load();
    void githubAccount.loadCli();
  });

  async function signInWithToken(): Promise<void> {
    const typed = token;
    token = "";
    if (!typed.trim() || working) {
      return;
    }
    working = "token";
    problem = null;
    try {
      const signedIn = await githubAccount.signInWithToken(typed);
      toast.success(`Signed in to GitHub as ${signedIn.login}`);
      onSignedIn?.(signedIn);
    } catch (error) {
      problem = errorMessage(error);
    } finally {
      working = null;
    }
  }

  async function signInWithCli(): Promise<void> {
    if (working) {
      return;
    }
    working = "cli";
    problem = null;
    try {
      const signedIn = await githubAccount.signInWithCli();
      toast.success(`Signed in to GitHub as ${signedIn.login}`, "Using the GitHub CLI's login.");
      onSignedIn?.(signedIn);
    } catch (error) {
      problem = errorMessage(error);
    } finally {
      working = null;
    }
  }

  async function signOut(): Promise<void> {
    const login = account?.login ?? "";
    const fromCli = account?.source === "ghCli";
    const confirmed = await dialogs.confirm({
      title: "Sign Out of GitHub",
      message: fromCli
        ? `Stop using the GitHub CLI's login (${login})? gh itself stays signed in.`
        : `Remove the token of ${login} from the keychain?`,
      confirmLabel: "Sign Out",
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    working = "signOut";
    problem = null;
    try {
      await githubAccount.signOut();
      toast.success("Signed out of GitHub");
    } catch (error) {
      problem = errorMessage(error);
    } finally {
      working = null;
    }
  }

  function onTokenKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter" && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      void signInWithToken();
    }
  }
</script>

<div class="github-account">
  {#if account}
    <div class="signed-in">
      <span class="avatar" aria-hidden="true">{accountInitials(account)}</span>
      <div class="who">
        <strong class="selectable">{account.login}</strong>
        <span class="hint">
          {account.name ? `${account.name}, ` : ""}{account.host},
          {account.source === "ghCli" ? "through the GitHub CLI" : "token in the keychain"}
        </span>
      </div>
      <button type="button" class="btn small" onclick={() => void signOut()} disabled={working !== null}>
        {working === "signOut" ? "Signing Out..." : "Sign Out"}
      </button>
    </div>
    {#if scopeHint}
      <div class="warning">{scopeHint}</div>
    {/if}
  {:else}
    <label class="token-field">
      <span>Sign in with a token</span>
      <div class="token-row">
        <input
          class="input mono token"
          type="password"
          bind:value={token}
          onkeydown={onTokenKeydown}
          disabled={working !== null}
          placeholder="ghp_... or github_pat_..."
          autocomplete="off"
          spellcheck="false"
          aria-label="Personal access token"
          data-autofocus
        />
        <button
          type="button"
          class="btn primary"
          onclick={() => void signInWithToken()}
          disabled={working !== null || token.trim() === ""}
        >
          {working === "token" ? "Signing In..." : "Sign In"}
        </button>
      </div>
    </label>
    <div class="hint">
      A classic token with the <code>repo</code> and <code>gist</code> scopes
      (<button type="button" class="link" onclick={() => void updates.open(TOKEN_URL)}>create one on GitHub</button>).
      It is checked with GitHub, then kept only in the system keychain.
    </div>
    {#if cli?.installed}
      <div class="cli-row">
        <button
          type="button"
          class="btn"
          onclick={() => void signInWithCli()}
          disabled={working !== null || !cli.signedIn}
        >
          {working === "cli" ? "Signing In..." : "Use GitHub CLI"}
        </button>
        <span class="hint">
          {cli.signedIn
            ? "Uses the login of gh, asked each time; nothing is stored."
            : "gh is installed but not signed in: run gh auth login first."}
        </span>
      </div>
    {/if}
  {/if}
  {#if problem}
    <div class="problem selectable" role="alert">{problem}</div>
  {/if}
</div>

<style>
  .github-account {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .signed-in {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .avatar {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--accent);
    color: var(--accent-text);
    font-size: 12px;
    font-weight: 600;
  }

  .who {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .token-field {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .token-field > span {
    color: var(--text-dim);
    font-size: 12px;
  }

  .token-row,
  .cli-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .token {
    flex: 1;
    min-width: 0;
  }

  .hint {
    color: var(--text-faint);
    font-size: 12px;
    line-height: 1.45;
  }

  .link {
    padding: 0;
    border: none;
    background: none;
    color: var(--accent);
    font: inherit;
    cursor: pointer;
  }

  .link:hover {
    text-decoration: underline;
  }

  .warning {
    color: var(--warning);
    font-size: 12px;
  }

  .problem {
    color: var(--danger);
    font-size: 12px;
  }
</style>
