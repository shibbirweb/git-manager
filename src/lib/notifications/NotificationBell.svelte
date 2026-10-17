<!-- The status bar bell: unread errors and warnings on the badge; it shows or hides the Notifications panel in the
     right sidebar, the same as the bell in the right activity bar. -->
<script lang="ts">
  import Badge from "@nibtree/ui/components/Badge.svelte";
  import StatusItem from "@nibtree/ui/components/StatusItem.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { bellTitle, hasUnreadError } from "./notificationModel";
  import { notifications } from "./notifications.svelte";

  const unread = $derived(notifications.unread);
  const doNotDisturb = $derived(settings.notificationsDoNotDisturb);
</script>

<StatusItem
  icon={doNotDisturb ? "bell-off" : "bell"}
  label="Notifications"
  title={bellTitle(unread, notifications.items.length, doNotDisturb)}
  open={settings.notificationsPanelShown}
  onclick={() => settings.toggleRightPanel("notifications")}
>
  {#snippet trailing()}
    {#if unread > 0}
      <Badge count={unread} size="small" tone={hasUnreadError(notifications.items) ? "danger" : "warning"} />
    {/if}
  {/snippet}
</StatusItem>
