<!-- Settings > GitHub: the account used by Share Project, Sync Fork and Create Gist. -->
<script lang="ts">
  import GitHubSignInForm from "../github/GitHubSignInForm.svelte";
  import SettingsRow from "./SettingsRow.svelte";
</script>

<SettingsRow title="GitHub account" stacked>
  {#snippet hintContent()}
    Used by Git &gt; GitHub: Share Project on GitHub, Sync Fork and Create Gist. Pushing and pulling keep using git's
    own credentials.
  {/snippet}
  <GitHubSignInForm />
</SettingsRow>
