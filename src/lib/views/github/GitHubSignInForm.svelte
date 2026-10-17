<!-- The GitHub account: who is signed in (with Sign Out), or the ways to sign in: a personal
     access token (sent once to Rust, which verifies it and keeps it in the keychain) or the
     GitHub CLI's own login. Used by Settings > GitHub and the sign-in dialog. -->
<script lang="ts">
  import Avatar from "@nibtree/ui/components/Avatar.svelte";
  import Button from "@nibtree/ui/components/Button.svelte";
  import Field from "@nibtree/ui/components/Field.svelte";
  import Input from "@nibtree/ui/components/Input.svelte";
  import Link from "@nibtree/ui/components/Link.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
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

<Stack gap="mdPlus">
  {#if account}
    <Stack direction="row" align="center" gap="mdPlus">
      <Avatar text={accountInitials(account)} label={account.login} />
      <Stack gap="xxs" grow>
        <Text weight="semibold" selectable>{account.login}</Text>
        <Text variant="hint" tone="faint">
          {account.name ? `${account.name}, ` : ""}{account.host},
          {account.source === "ghCli" ? "through the GitHub CLI" : "token in the keychain"}
        </Text>
      </Stack>
      <Button size="small" onclick={() => void signOut()} disabled={working !== null}>
        {working === "signOut" ? "Signing Out..." : "Sign Out"}
      </Button>
    </Stack>
    {#if scopeHint}
      <Text size="small" tone="warning">{scopeHint}</Text>
    {/if}
  {:else}
    <Field label="Sign in with a token" look="compact">
      <Stack direction="row" align="center" gap="md">
        <Input
          type="password"
          mono
          width="fill"
          bind:value={token}
          onkeydown={onTokenKeydown}
          disabled={working !== null}
          placeholder="ghp_... or github_pat_..."
          autocomplete="off"
          spellcheck="false"
          aria-label="Personal access token"
          autofocus
        />
        <Button
          variant="primary"
          onclick={() => void signInWithToken()}
          disabled={working !== null || token.trim() === ""}
        >
          {working === "token" ? "Signing In..." : "Sign In"}
        </Button>
      </Stack>
    </Field>
    <Text variant="hint" tone="faint">
      A classic token with the <Text variant="code">repo</Text> and <Text variant="code">gist</Text> scopes (<Link
        onclick={() => void updates.open(TOKEN_URL)}>create one on GitHub</Link
      >). It is checked with GitHub, then kept only in the system keychain.
    </Text>
    {#if cli?.installed}
      <Stack direction="row" align="center" gap="md">
        <Button onclick={() => void signInWithCli()} disabled={working !== null || !cli.signedIn}>
          {working === "cli" ? "Signing In..." : "Use GitHub CLI"}
        </Button>
        <Text variant="hint" tone="faint">
          {cli.signedIn
            ? "Uses the login of gh, asked each time; nothing is stored."
            : "gh is installed but not signed in: run gh auth login first."}
        </Text>
      </Stack>
    {/if}
  {/if}
  {#if problem}
    <Stack role="alert">
      <Text size="small" tone="danger" selectable>{problem}</Text>
    </Stack>
  {/if}
</Stack>
