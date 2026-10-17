<!-- The app's toasts, drawn by the UI library's ToastHost from the toast store. -->
<script lang="ts">
  import ToastHost from "@nibtree/ui/components/ToastHost.svelte";
  import { toast } from "./toast.svelte";
</script>

<ToastHost
  items={toast.items}
  ondismiss={(id) => toast.dismiss(id)}
  onaction={(id) => toast.runAction(id)}
  onhold={(id, held) => toast.hold(id, held)}
/>
