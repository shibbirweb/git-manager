<!-- Asked before a GitHub item that needs an account; continues with that item once signed in. -->
<script lang="ts">
  import Button from "@nibtree/ui/components/Button.svelte";
  import Dialog from "@nibtree/ui/components/Dialog.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import type { GitHubAccount } from "$lib/types";
  import { closeGitHubDialog } from "./githubDialogs";
  import GitHubSignInForm from "./GitHubSignInForm.svelte";

  interface Props {
    actionLabel: string;
    onSignedIn: (() => void) | null;
  }

  let { actionLabel, onSignedIn }: Props = $props();

  function signedIn(_account: GitHubAccount): void {
    closeGitHubDialog();
    onSignedIn?.();
  }
</script>

<Dialog open variant="form" title="Sign In to GitHub" width="normal" onclose={closeGitHubDialog}>
  <Text variant="hint" tone="faint">{actionLabel} needs a GitHub account.</Text>
  <GitHubSignInForm onSignedIn={signedIn} />

  {#snippet actions()}
    <Button onclick={closeGitHubDialog}>Cancel</Button>
  {/snippet}
</Dialog>
