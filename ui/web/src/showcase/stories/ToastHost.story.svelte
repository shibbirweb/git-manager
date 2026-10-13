<script lang="ts">
  import Button from "$ui/components/Button.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import ToastHost from "$ui/components/ToastHost.svelte";
  import { createToasts } from "$ui/toasts.svelte";

  const toasts = createToasts();
</script>

<Stack direction="row" gap="sm" wrap>
  <Button onclick={() => toasts.show("success", "Pushed to origin/main")}>Success</Button>
  <Button onclick={() => toasts.show("info", "Fetched 3 new commits")}>Info</Button>
  <Button onclick={() => toasts.show("warning", "The branch is behind its upstream")}>Warning</Button>
  <Button onclick={() => toasts.show("error", "Push failed", "! [rejected] main -> main (fetch first)")}>Error</Button>
  <Button onclick={() => toasts.show("success", "Stashed changes", undefined, { label: "Undo", run: () => undefined })}>
    With a button
  </Button>
</Stack>
<ToastHost items={toasts.items} ondismiss={toasts.dismiss} onaction={toasts.runAction} />
