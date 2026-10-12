<script lang="ts">
  import TextArea from "$ui/components/TextArea.svelte";

  let message = $state("");
</script>

<TextArea bind:value={message} rows="large" placeholder="Commit message" aria-label="Commit message" />
<TextArea value={"fix: a typo\n\nLonger body text."} resize="vertical" mono aria-label="Mono" />
