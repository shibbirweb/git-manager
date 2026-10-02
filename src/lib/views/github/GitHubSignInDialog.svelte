<!-- Asked before a GitHub item that needs an account; continues with that item once signed in. -->
<script lang="ts">
  import type { GitHubAccount } from "$lib/types";
  import GitDialogFrame from "../git/GitDialogFrame.svelte";
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

<GitDialogFrame title="Sign In to GitHub" width={520} onCancel={closeGitHubDialog}>
  <div class="hint">{actionLabel} needs a GitHub account.</div>
  <GitHubSignInForm onSignedIn={signedIn} />

  {#snippet footer()}
    <button type="button" class="btn" onclick={closeGitHubDialog}>Cancel</button>
  {/snippet}
</GitDialogFrame>
