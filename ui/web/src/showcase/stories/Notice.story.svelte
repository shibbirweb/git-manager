<script lang="ts">
  import Button from "$ui/components/Button.svelte";
  import Notice from "$ui/components/Notice.svelte";
</script>

<Notice tone="danger">
  The file changed on disk while you were merging.
  {#snippet action()}<Button size="small">Reload</Button>{/snippet}
</Notice>
<Notice tone="warning">The branch is 3 commits behind its upstream.</Notice>
<Notice>Your folder and tabs come back after Clear Cache.</Notice>
<Notice tone="success">Pushed to origin/main.</Notice>
