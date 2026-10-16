<!-- The status bar bell: unread errors and warnings on the badge; the popup lists every message
     of this session, newest first, with any button that still works. -->
<script lang="ts">
  import Badge from "@git-manager/ui/components/Badge.svelte";
  import Button from "@git-manager/ui/components/Button.svelte";
  import Checkbox from "@git-manager/ui/components/Checkbox.svelte";
  import EmptyState from "@git-manager/ui/components/EmptyState.svelte";
  import Icon from "@git-manager/ui/components/Icon.svelte";
  import Popover from "@git-manager/ui/components/Popover.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import StatusItem from "@git-manager/ui/components/StatusItem.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import type { IconName } from "@git-manager/ui/icons";
  import { fullDate, relativeTime } from "$lib/log/format";
  import { settings } from "$lib/stores/settings.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { bellTitle, kindLabel, type NotificationKind } from "./notificationModel";
  import { notifications } from "./notifications.svelte";

  /** The time the relative times are counted from; refreshed while the list is open. */
  let now = $state(Date.now());

  const unread = $derived(notifications.unread);
  const hasUnreadError = $derived(notifications.items.some((entry) => !entry.read && entry.kind === "error"));
  const doNotDisturb = $derived(settings.notificationsDoNotDisturb);

  $effect(() => {
    if (!notifications.open) {
      return;
    }
    now = Date.now();
    const timer = setInterval(() => {
      now = Date.now();
    }, 30_000);
    return () => clearInterval(timer);
  });

  const KIND_TONES = { error: "danger", warning: "warning", success: "success", info: "accent" } as const;

  function kindIcon(kind: NotificationKind): IconName {
    if (kind === "error" || kind === "warning") {
      return "alert";
    }
    return kind === "success" ? "check" : "lightbulb";
  }
</script>

<Popover
  bind:open={() => notifications.open, (open) => notifications.setOpen(open)}
  label="Notifications"
  placement="above"
  align="end"
  width="large"
  padding="panel"
  textSize="small"
>
  {#snippet trigger({ toggle, open })}
    <StatusItem
      icon={doNotDisturb ? "bell-off" : "bell"}
      label="Notifications"
      title={bellTitle(unread, notifications.items.length, doNotDisturb)}
      {open}
      onclick={toggle}
    >
      {#snippet trailing()}
        {#if unread > 0}
          <Badge count={unread} size="small" tone={hasUnreadError ? "danger" : "warning"} />
        {/if}
      {/snippet}
    </StatusItem>
  {/snippet}
  <Stack gap="sm">
    <Stack direction="row" align="center" gap="mdPlus" paddingY="xs" line="bottom">
      <Stack grow><Text weight="semibold">Notifications</Text></Stack>
      <Checkbox
        size="small"
        label="Do Not Disturb"
        title="Only errors pop up; everything is still listed here"
        checked={doNotDisturb}
        onchange={(checked) => settings.setPreference("notificationsDoNotDisturb", checked)}
      />
      <Button size="small" disabled={notifications.items.length === 0} onclick={() => notifications.clear()}>
        Clear All
      </Button>
    </Stack>
    <Stack gap="none" scroll="y" maxHeight="large" label="Messages">
      {#each notifications.items as entry, index (entry.id)}
        <Stack direction="row" align="start" gap="md" paddingY="sm" line={index > 0 ? "top" : "none"}>
          <Text title={kindLabel(entry.kind)}>
            <Icon name={kindIcon(entry.kind)} size="medium" tone={KIND_TONES[entry.kind]} />
          </Text>
          <Stack grow gap="xs">
            <Stack direction="row" align="baseline" gap="md">
              <Stack grow>
                <Text weight="semibold" wrap="anywhere" selectable>{entry.title}</Text>
              </Stack>
              <Text size="xsmall" tone="dim" title={fullDate(Math.floor(entry.time / 1000))}>
                {relativeTime(Math.floor(entry.time / 1000), now)}
              </Text>
            </Stack>
            {#if entry.detail}
              <Stack scroll="y" maxHeight="xsmall">
                <Text size="xsmall" tone="dim" mono wrap="pre" selectable>{entry.detail}</Text>
              </Stack>
            {/if}
            {#if entry.action && notifications.actionAvailable(entry)}
              <Stack direction="row">
                <Button size="small" onclick={() => toast.runNotificationAction(entry.id)}>
                  {entry.action.label}
                </Button>
              </Stack>
            {/if}
          </Stack>
        </Stack>
      {:else}
        <EmptyState variant="panel" title="No notifications yet" titleTone="dim" />
      {/each}
    </Stack>
  </Stack>
</Popover>
