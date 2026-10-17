<script lang="ts">
  import Card from "$ui/components/Card.svelte";
  import DialogHead from "$ui/components/DialogHead.svelte";
</script>

<Card label="Sign-in prompt" padded>
  <DialogHead icon="lock" title="Password for github.com" subtitle="git asks for this to continue in storefront." />
</Card>
<Card label="Panel dialog">
  <DialogHead size="panel" icon="cloud-download" title="Nibtree 0.2.0 is available" subtitle="You have 0.1.0." />
  <DialogHead size="panel" title="Keyboard Shortcuts" onclose={() => undefined} />
</Card>
